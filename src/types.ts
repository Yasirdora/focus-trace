export interface ElementRef {
  /** Stable within one document, even if attributes change. */
  node: number;
  tag: string;
  id: string | null;
  testId: string | null;
}
export type EventKind = 'document' | 'keydown' | 'pointerdown' | 'focusin' | 'focusout' | 'removed' | 'checkpoint';
export interface FocusEvent {
  sequence: number;
  document: number;
  /** Milliseconds since that document's recorder was installed. */
  elapsed: number;
  kind: EventKind;
  target: ElementRef | null;
  related: ElementRef | null;
  key: string | null;
  label: string | null;
}
export interface FocusReport {
  schemaVersion: 1;
  events: FocusEvent[];
  truncated: boolean;
  /** Teardown could not flush a document, e.g. because the page was closed. */
  incomplete: boolean;
}
export interface FocusTraceOptions {
  /** Maximum retained events across all documents. Default 2000, maximum 100000. */
  maxEvents?: number;
  /** Include id and data-testid attributes; never text content or input values. Default true. */
  identifiers?: boolean;
}
export interface BrowserMessage {
  token: string;
  event: Omit<FocusEvent, 'sequence' | 'document'> | null;
}
export interface BrowserConfig {
  binding: string;
  slot: string;
  maxEvents: number;
  identifiers: boolean;
}
