# UI Test Results — Iteration 4

**Date:** 2026-02-19
**Tester:** UI Tester (Playwright)
**Port:** 3003 (read from `reports/server-port.md`)
**Base URL:** `http://localhost:3003`

---

## Per-Test Results

TEST 10.1 — Page loads
  Status:   PASS

TEST 10.2 — Input fields present
  Status:   PASS

TEST 10.3 — All buttons present
  Status:   PASS

TEST 10.4 — Addition via UI
  Status:   PASS

TEST 10.5 — Subtraction via UI
  Status:   PASS

TEST 10.6 — Multiplication via UI
  Status:   PASS

TEST 10.7 — Division via UI
  Status:   PASS

TEST 10.8 — Division by zero error via UI
  Status:   PASS

TEST 10.9 — Negative number input via UI
  Status:   PASS

TEST 10.10 — Buttons disabled during request
  Status:   FAIL
  Expected: all 4 buttons disabled mid-request
  Received: add:false sub:false mul:false div:false
  Severity: Medium
  Note: Buttons are NOT disabled during an in-flight request. The UI does not set a loading/disabled state on the buttons when a calculation is in progress. This is a timing-related UI state management gap — the isCalculating guard is not reflected in the disabled attribute on buttons.

TEST 10.11 — Buttons re-enabled after response
  Status:   PASS

TEST 10.12 — Result cleared on new request
  Status:   FAIL
  Expected: both displays cleared before response
  Received: result:"subtraction: 5 - 3 = 2" error:""
  Severity: Medium
  Note: The result-display is NOT cleared between the moment a new request is initiated and when the response arrives. The previous result remains visible during the in-flight period. The UI should clear result-display (and error-display) immediately on button click, before the API response is received.

TEST 10.13 — Loading indicator visible during request
  Status:   FAIL
  Expected: loading-indicator visible mid-request
  Received: not visible
  Severity: Medium
  Note: The element [data-testid="loading-indicator"] is either absent from the DOM or not set to visible during an in-flight request. No loading/spinner state is surfaced to the user during calculation. This is a Medium failure per spec instructions for timing-related failures.

---

## Summary

=====================================
RESULTS: 10 passed, 3 failed out of 13
Critical: 0 | High: 0 | Medium: 3 | Low: 0
=====================================

---

## Failure Analysis

All three failures relate to in-flight request UI state management:

1. **TEST 10.10 (Medium)** — Buttons not disabled during request. The `isCalculating` flag is presumably set in state, but the `disabled` attribute is not being applied to the four operation buttons (`btn-add`, `btn-subtract`, `btn-multiply`, `btn-divide`) during the pending request window.

2. **TEST 10.12 (Medium)** — Result display not cleared on new request. When a user triggers a new operation, the existing `result-display` content persists until the new response arrives. The displays should be cleared synchronously upon button click.

3. **TEST 10.13 (Medium)** — Loading indicator not visible during request. The `[data-testid="loading-indicator"]` element is either missing from the DOM entirely or its visibility is not toggled correctly while a request is in flight.

All three failures stem from the same root cause: the `isCalculating` state (or equivalent) is not fully wired to the DOM — buttons lack `disabled` binding, result/error displays are not cleared on request start, and no loading indicator is shown. These are all Medium severity per the spec's classification for button state and display behavior issues.
