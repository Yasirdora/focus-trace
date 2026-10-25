import type { ElementRef, FocusReport } from './types.js';

const escape = (value: string): string => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const describe = (element: ElementRef | null): string => element
  ? `${element.tag}${element.id ? `#${element.id}` : ''}${element.testId ? ` [${element.testId}]` : ''} · node ${element.node}`
  : '—';

/** No scripts, external assets, page text or embedded screenshots. */
export function renderHtml(report: FocusReport): string {
  const rows = report.events.map(event => `<tr class="${event.kind === 'removed' ? 'removed' : ''}"><td>${event.sequence}</td><td>${event.document}</td><td>${event.elapsed.toFixed(2)}</td><td>${escape(event.kind)}</td><td>${escape(event.key ?? event.label ?? '—')}</td><td>${escape(describe(event.target))}</td><td>${escape(describe(event.related))}</td></tr>`).join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Focus trace</title>
<style>
:root{color-scheme:light dark;font:15px/1.6 system-ui,sans-serif;background:#f5f5f2;color:#202522}body{max-width:1240px;margin:48px auto;padding:0 24px}h1{font-size:32px;letter-spacing:-1px;margin:0}p{max-width:80ch}.eyebrow{font:12px ui-monospace,monospace;text-transform:uppercase;letter-spacing:2px;color:#52665a}.status{padding:12px 16px;background:#e6eee8;border-left:3px solid #397450}.warning{background:#fff0d7;border-color:#a85c00}.table{overflow:auto;border:1px solid #d5dbd6;border-radius:8px;margin-top:24px}table{width:100%;border-collapse:collapse;font:12px/1.6 ui-monospace,monospace;text-align:left}th,td{padding:12px;border-bottom:1px solid #d5dbd6;vertical-align:top}th{background:#e9ede9;white-space:nowrap}td{overflow-wrap:anywhere;min-width:30px}.removed{background:#fff0d7}footer{font-size:12px;color:#56645a;margin-top:24px}@media(prefers-color-scheme:dark){:root{background:#151b18;color:#e4ebe6}th{background:#222d26}.status{background:#243a2b}.warning,.removed{background:#47351d}th,td,.table{border-color:#39453d}.eyebrow,footer{color:#b3c2b8}}
</style></head><body><div class="eyebrow">focus-trace · observed behavior</div><h1>Keyboard and focus timeline</h1><p>Read each key or pointer action alongside the focus events that followed it. A removed row identifies a previously focused element found disconnected at a mutation checkpoint; it does not prove the cause of a test failure.</p>
<p class="status${report.truncated || report.incomplete ? ' warning' : ''}">${report.events.length} events retained.${report.truncated ? ' Event limit reached; later events were not retained.' : ''}${report.incomplete ? ' A document could not be flushed; the report may be incomplete.' : ''}</p>
<div class="table"><table><caption>Events in host receipt order; elapsed time is relative to each document.</caption><thead><tr><th scope="col">#</th><th scope="col">Doc</th><th scope="col">ms</th><th scope="col">Event</th><th scope="col">Key / checkpoint</th><th scope="col">Target</th><th scope="col">Related / current</th></tr></thead><tbody>${rows}</tbody></table></div>
<footer>Main document and observed open shadow roots. No inference of accessibility compliance. Node numbers are local to each document.</footer></body></html>`;
}
