# Validation status

This file distinguishes checks executed in the development environment from
checks that still require a browser-capable environment.

## Browser blocker

On 2026-10-25 the browser suite could not execute: installed Chrome exited during
startup, and the cached Chromium headless executable reported:

```
bootstrap_check_in ...: Permission denied (1100)
```

The Playwright-managed executable for the pinned version was not installed either.
No browser assertions ran successfully. The package is a development preview,
not a verified browser release. No permissions or browser security settings were
changed to work around this failure.

## Checks

- TypeScript build: passed.
- Host-side protocol/report tests: all 11 passed.
- TypeScript checks for browser tests, fixture cases and the example: passed.
- Playwright discovery: 14 browser tests loaded successfully without launching a browser.
- Browser suite: written; blocked before assertions.
- Unexpected-failure attachment integration: written; pending browser execution.
- Packed consumer verification: clean offline install, both ESM export paths and
  TypeScript declarations passed. This check does not launch a browser.
- HTML report visual review: pending.
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
