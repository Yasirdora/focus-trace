import type { BrowserConfig, BrowserMessage, ElementRef, FocusEvent } from './types.js';

/** Serialized into the page: keep runtime dependencies inside this function. */
export function installRecorder(config: BrowserConfig): void {
  if (window !== window.top) return;
  const globals = window as unknown as Record<string, unknown>;
  if (globals[config.slot]) return;
  const token = Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16)).join('-');
  const started = performance.now();
  const nodes = new WeakMap<Element, number>();
  let nextNode = 0;
  let count = 0;
  let stopped = false;
  const pending = new Set<Promise<unknown>>();
  const roots = new Set<Node>();
  const observers: MutationObserver[] = [];
  let focused: Element | null = null;
  const listeners: Array<[string, EventListener]> = [];
  let probeObserved = false;
  const send = globals[config.binding] as (message: BrowserMessage) => Promise<boolean>;

  function describe(element: EventTarget | null): ElementRef | null {
    if (!(element instanceof Element)) return null;
    if (!nodes.has(element)) nodes.set(element, ++nextNode);
    return {
      node: nodes.get(element)!, tag: element.localName,
      id: config.identifiers ? element.id.slice(0, 120) || null : null,
      testId: config.identifiers ? element.getAttribute('data-testid')?.slice(0, 120) || null : null,
    };
  }
  function active(): Element | null {
    let element = document.activeElement;
    while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
    return element;
  }
  function cleanup(): void {
    if (stopped) return;
    stopped = true;
    for (const [name, listener] of listeners) document.removeEventListener(name, listener, true);
    for (const observer of observers) observer.disconnect();
    roots.clear();
    focused = null;
  }
  function deliver(event: BrowserMessage['event']): void {
    const promise = send({ token, event }).then(keepRecording => {
      if (!keepRecording) cleanup();
    }).catch(() => cleanup());
    pending.add(promise);
    void promise.finally(() => pending.delete(promise));
  }
  function emit(kind: FocusEvent['kind'], target: EventTarget | null, related: EventTarget | null = null, key: string | null = null, label: string | null = null): void {
    if (stopped) return;
    if (count >= config.maxEvents) {
      deliver(null);
      cleanup();
      return;
    }
    count++;
    deliver({ elapsed: Math.round((performance.now() - started) * 100) / 100, kind,
      target: describe(target), related: describe(related), key, label });
  }
  function checkListeners(): void {
    if (stopped) return;
    probeObserved = false;
    document.dispatchEvent(new Event(config.slot));
    if (probeObserved) return;
    for (const [name, listener] of listeners) document.addEventListener(name, listener, true);
    emit('gap', active(), null, null, 'Document listeners were removed; recording resumed.');
  }
  function checkRemoval(): void {
    if (focused && !focused.isConnected) {
      const removed = focused;
      focused = active();
      emit('removed', removed, focused);
    }
  }
  function observe(root: Node): void {
    if (roots.has(root)) return;
    roots.add(root);
    const observer = new MutationObserver(() => { checkListeners(); checkRemoval(); });
    observer.observe(root, { childList: true, subtree: true });
    observers.push(observer);
  }
  function listen(name: string, listener: EventListener): void {
    listeners.push([name, listener]);
    document.addEventListener(name, listener, true);
  }
  function targetOf(event: Event): EventTarget | null {
    return event.composedPath()[0] ?? event.target;
  }
  function observeAncestors(element: Element | null): void {
    let root = element?.getRootNode();
    while (root instanceof ShadowRoot) {
      observe(root);
      root = root.host.getRootNode();
    }
  }
  listen(config.slot, () => { probeObserved = true; });
  listen('focusin', event => {
    checkRemoval();
    focused = targetOf(event) as Element;
    observeAncestors(focused);
    emit('focusin', focused, (event as globalThis.FocusEvent).relatedTarget);
  });
  listen('focusout', event => {
    emit('focusout', targetOf(event), (event as globalThis.FocusEvent).relatedTarget);
    // Retain the prior element until the microtask checkpoint to detect removals
    // on browsers that dispatch blur during DOM removal.
    queueMicrotask(() => { checkRemoval(); focused = active(); });
  });
  const keys = new Set(['Tab', 'Escape', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);
  listen('keydown', event => {
    const keyboard = event as KeyboardEvent;
    if (!keys.has(keyboard.key)) return;
    const modifiers = [keyboard.ctrlKey && 'Control', keyboard.altKey && 'Alt', keyboard.metaKey && 'Meta', keyboard.shiftKey && 'Shift'].filter(Boolean);
    emit('keydown', targetOf(event), null, [...modifiers, keyboard.key === ' ' ? 'Space' : keyboard.key].join('+'));
  });
  listen('pointerdown', event => emit('pointerdown', targetOf(event)));
  observe(document);
  focused = active();
  observeAncestors(focused);
  globals[config.slot] = {
    async flush(label: string | null, stop: boolean): Promise<void> {
      checkListeners();
      checkRemoval();
      if (label !== null) emit('checkpoint', active(), null, null, label);
      if (stop) cleanup();
      await Promise.all([...pending]);
    },
  };
  emit('document', focused);
}
