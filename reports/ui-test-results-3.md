# UI Test Results — Iteration 3

**Date:** 2026-02-19
**Port:** 3003
**Base URL:** http://localhost:3003/
**Tool:** Playwright (Chromium headless)

---

## Root Cause: Server Blocks All GET Requests

Before individual test results, the following critical infrastructure failure was detected:

The server at port 3003 applies a global `Content-Type: application/json` middleware check to **all** incoming requests — including GET requests for static files. A GET request to `http://localhost:3003/` returns:

```
HTTP 400 Bad Request
{"error":"Content-Type must be application/json"}
```

This means the web interface cannot be loaded in a browser at all. The frontend HTML is never served. All UI tests that require the page to load, locate elements, or interact with the UI will fail as a consequence of this single infrastructure defect.

---

## Test Results

TEST 10.1 — Page loads
  Status:   FAIL
  Expected: Page loads without error, title is visible
  Received: Response status 400 — {"error":"Content-Type must be application/json"} — page did not load

TEST 10.2 — Input fields present
  Status:   FAIL
  Expected: Both [data-testid="input-a"] and [data-testid="input-b"] visible and accept input
  Received: Page failed to load (HTTP 400); input-a visible=false, input-b visible=false — elements not found

TEST 10.3 — All buttons present
  Status:   FAIL
  Expected: All four buttons visible: btn-add, btn-subtract, btn-multiply, btn-divide
  Received: Page failed to load (HTTP 400); btn-add=false, btn-subtract=false, btn-multiply=false, btn-divide=false — no elements found

TEST 10.4 — Addition via UI
  Status:   FAIL
  Expected: result-display contains "15", error-display is empty
  Received: Page failed to load; locator('[data-testid="input-a"]') timed out — could not interact with UI

TEST 10.5 — Subtraction via UI
  Status:   FAIL
  Expected: result-display contains "5", error-display is empty
  Received: Page failed to load; locator('[data-testid="input-a"]') timed out — could not interact with UI

TEST 10.6 — Multiplication via UI
  Status:   FAIL
  Expected: result-display contains "50", error-display is empty
  Received: Page failed to load; locator('[data-testid="input-a"]') timed out — could not interact with UI

TEST 10.7 — Division via UI
  Status:   FAIL
  Expected: result-display contains "2", error-display is empty
  Received: Page failed to load; locator('[data-testid="input-a"]') timed out — could not interact with UI

TEST 10.8 — Division by zero error via UI
  Status:   FAIL
  Expected: error-display contains error message, result-display is empty or unchanged
  Received: Page failed to load; locator('[data-testid="input-a"]') timed out — could not interact with UI

TEST 10.9 — Negative number input via UI
  Status:   FAIL
  Expected: result-display contains "-8"
  Received: Page failed to load; locator('[data-testid="input-a"]') timed out — could not interact with UI

TEST 10.10 — Buttons disabled during request
  Status:   FAIL
  Expected: All four buttons disabled immediately after click and before response
  Received: Page failed to load; could not interact with UI — test could not execute

TEST 10.11 — Buttons re-enabled after response
  Status:   FAIL
  Expected: All four buttons enabled after response received
  Received: Page failed to load; could not interact with UI — test could not execute

TEST 10.12 — Result cleared on new request
  Status:   FAIL
  Expected: result-display and error-display cleared before new response arrives
  Received: Page failed to load; could not interact with UI — test could not execute

TEST 10.13 — Loading indicator visible during request
  Status:   FAIL
  Expected: [data-testid="loading-indicator"] is visible between click and response
  Received: Page failed to load; could not interact with UI — test could not execute

---

## Defect Analysis

**Root Defect:** The server's Content-Type validation middleware intercepts ALL requests — including browser GET requests for the HTML page — and rejects them with HTTP 400 if they do not include `Content-Type: application/json`. The `express.static()` middleware for serving the frontend either (a) is not configured, (b) is registered after the content-type check middleware so it never receives the request, or (c) the content-type check runs before routing and blocks static file serving.

**Verified via curl:**
- `GET /` → HTTP 400, `{"error":"Content-Type must be application/json"}`
- `GET /index.html` → HTTP 400, `{"error":"Content-Type must be application/json"}`
- `GET /public/index.html` → HTTP 400, `{"error":"Content-Type must be application/json"}`

**Fix required:** The Content-Type validation middleware must only apply to POST API routes (`/add`, `/subtract`, `/multiply`, `/divide`), not to GET requests or static file routes.

---

=====================================
RESULTS: 0 passed, 13 failed out of 13
Critical: 1 | High: 5 | Medium: 7 | Low: 0
=====================================

**Severity breakdown:**
- Critical (1): TEST 10.1 — Page will not load due to server returning HTTP 400 for all GET requests
- High (5): TEST 10.4, 10.5, 10.6, 10.7, 10.8 — Core operations and error display untestable
- Medium (7): TEST 10.2, 10.3, 10.9, 10.10, 10.11, 10.12, 10.13 — All UI interaction/state tests untestable
