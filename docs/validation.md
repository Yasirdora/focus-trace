# Validation status

This file distinguishes checks executed in the development environment from
checks that still require a browser-capable environment.

## Browser run, 2026-10-29

Installed Chrome 156.0.8078.73 on macOS 27, through `FOCUS_TRACE_CHANNEL=chrome`:

- `npm test`: build, 11 host-side tests and 14 browser tests passed.
- `npm run test:failure`: the intentional failure attached both the JSON and the
  HTML report, with the recorded focus target.

On 2026-10-25 the same suite could not start a browser (`bootstrap_check_in ...:
Permission denied (1100)`). That failure came from the sandbox the checks ran in;
outside it, Chrome started normally. No browser security settings were changed.

## Checks

- TypeScript build: passed.
- Host-side protocol/report tests: all 11 passed.
- TypeScript checks for browser tests, fixture cases and the example: passed.
- Browser suite on Chrome 156: 14 passed.
- Unexpected-failure attachment integration on Chrome 156: passed.
- Packed consumer verification (2026-10-25): clean offline install, both ESM export
  paths and TypeScript declarations passed. This check does not launch a browser.
- Playwright's own Chromium build for the pinned version: passed in GitHub Actions on
  Ubuntu (build, type-check, unit and browser tests, failure attachments, packed package).
- HTML report visual review on Chrome 156: done for the lost-focus demo
  (`npm run report-image`, saved as `docs/report.png`).
- Firefox, WebKit, custom fixture composition and performance measurements: pending.

The protocol unit tests use a fake Playwright transport. They verify event budgets,
report ownership, host sequencing, failure handling and attachment payloads. They
do not simulate DOM focus or establish browser compatibility.

## Reproduce

```sh
npm ci
npx playwright install chromium
npm test
npm run test:failure
npm run verify
```

Keep failures visible. Do not convert unavailable browsers into passing tests.
