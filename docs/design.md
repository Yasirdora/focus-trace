# Design decisions

## Purpose

Make a failed keyboard interaction easier to explain. Playwright already records
actions, DOM snapshots and screenshots. This package adds a small, ordered record
of focus events, focused-node removal and explicit checkpoints.

The initial motivating examples were controlled-dialog focus restoration and
focus lost after removal. They are integration scenarios, not claims that an
upstream library currently has an unfixed defect.

## Sources

- [Playwright automatic fixtures](https://playwright.dev/docs/test-fixtures):
  setup/teardown ordering and attachments for unexpected outcomes.
- [Playwright Page API](https://playwright.dev/docs/api/class-page):
  document init scripts, exposed bindings and setContent behavior.
- [Document.open](https://developer.mozilla.org/en-US/docs/Web/API/Document/open):
  document rewriting removes document and window event listeners.
- [Playwright Trace Viewer](https://github.com/microsoft/playwright/blob/main/docs/src/trace-viewer.md):
  existing diagnostics this package should complement.
- [Radix controlled-dialog focus discussion](https://github.com/radix-ui/primitives/discussions/3319):
  a concrete focus-restoration use case, with application-specific expectations.

## Tradeoffs

A browser-side recorder sends bounded event records through a Playwright binding.
The host retains a global prefix of at most maxEvents, assigns sequence and document
numbers, and explicitly flags truncation. Per-document buffers are bounded too.
This favors preserving evidence before a later page close over collecting only
when teardown runs. It introduces protocol traffic and may perturb timing.

IDs and data-testid values aid diagnosis without collecting text or form values.
They can be disabled. Private/internal node numbers remain available either way.
The HTML report escapes strings and requires no executable script.

Only observed facts appear in reports. A missing focus restoration is checked by
the application's assertion, not inferred from a button label or a guessed ARIA
pattern. Iframes, closed shadow roots and screen-reader behavior are deliberately
outside the first version.

Init scripts cannot simply be removed from a Page through the APIs used here.
The first version therefore supports one recording session per Page. Stopped host
callbacks reject late deliveries and newly created document recorders shut down.
A new page gives a fresh session without accumulating bindings and init scripts.

Document rewriting is a known gap, not a silent success. A uniquely named probe
event checks that the document listener still exists. Missing listeners are
reattached and the report becomes incomplete; earlier events are not fabricated.

## Before public release

- Pass the browser suite and automatic-failure attachment check on Chromium.
- Test Firefox and WebKit and document engine-specific focus/removal ordering.
- Verify reports visually and with keyboard navigation.
- Run the example against a real component integration and evaluate whether the
  timeline helps a maintainer diagnose the failure.
- Review one-session-per-page ergonomics, recorder overhead, license and package
  publication metadata.

No browser-specific support or performance claim should be made from unit tests.
