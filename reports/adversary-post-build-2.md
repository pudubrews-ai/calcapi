# Adversary Post-Build Report -- Iteration 2

**Date:** 2026-02-18
**Implementation reviewed:** `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-api/index.js`
**Iteration 1 report:** `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-api/reports/adversary-post-build-1.md`
**Author:** Adversary Agent (Step 15 -- Post-Build Adversarial Attack on Implementation, Iteration 2)

---

## Scope

This report covers the Iteration 2 implementation in `index.js`, focusing on:
1. Whether the 4 Critical findings from Iteration 1 were actually fixed
2. Whether the 2 Medium findings from Iteration 1 were addressed
3. Any new attack surfaces introduced by Iteration 2 changes (new 404/405/error handlers, restructured divide handler)
4. Anything still exploitable or producing incorrect results

Security infrastructure concerns (CORS, rate limiting, auth, TLS, logging) are covered by the CISO and are not duplicated here.

---

## Iteration 1 Critical Findings: Disposition

| Iter 1 # | Title | Severity | Status | Notes |
|-----------|-------|----------|--------|-------|
| #1 | Trailing Slash Bypasses Division-by-Zero Check | Critical | **FIXED** | The `path === '/divide'` comparison has been completely removed. The division-by-zero check (`if (b === 0)`) is now inline in the `/divide` route handler (line 92). The check runs inside the handler that Express has already routed to, so it executes regardless of the URL form (`/divide`, `/divide/`, `/DIVIDE`, etc.). |
| #2 | Case-Insensitive Routing Bypasses Division-by-Zero Check | Critical | **FIXED** | Same root cause as #1. The path-based conditional no longer exists. The inline `b === 0` check on line 92 is path-agnostic. |
| #3 | 0/0 Returns `null` (NaN) via Bypass | Critical | **FIXED** | Consequence of #1/#2. With the bypass eliminated, `POST /divide` (any URL variant) with `b=0` now returns `400` with `"Division by zero is not allowed"` before the division is performed. |
| #4 | -N/0 Returns `null` (-Infinity) via Bypass | Critical | **FIXED** | Same as #3. All division-by-zero cases are caught regardless of URL normalization. |

**Verification approach:** The `validate()` function (lines 32-51) no longer accepts a `path` parameter and no longer contains any path-string comparison. All four route handlers call `validate(req.body)` with a single argument. The `/divide` handler (lines 86-97) checks `b === 0` after validation passes and before `Math.floor(a / b)` is computed. The fix follows the Architect's recommended Option (a) -- moving the check into the route handler to eliminate the class of bug entirely.

**Root cause eliminated:** Yes. The mismatch between Express's permissive route matching and exact path-string comparison no longer exists in the codebase.

---

## Iteration 1 Medium Findings: Disposition

| Iter 1 # | Title | Severity | Status | Notes |
|-----------|-------|----------|--------|-------|
| #5 | Undefined Routes Return HTML, Not JSON | Medium | **FIXED** | A catch-all 404 handler (lines 113-116) now returns `res.status(404).json({ error: 'Not found' })` for all unmatched requests. |
| #6 | Non-POST Methods Return Inconsistent Responses | Medium | **PARTIALLY FIXED** | Four `app.all()` handlers (lines 99-111) return 405 for non-POST methods on defined paths. However, the Content-Type middleware creates a new inconsistency -- see Finding 1 below. |

---

## Iteration 1 Low Findings: Disposition

| Iter 1 # | Title | Severity | Status | Notes |
|-----------|-------|----------|--------|-------|
| #7 | `entity.too.large` Returns Misleading Message | Low | **Unchanged (Accepted Risk)** | Still returns "Invalid JSON body" for oversized payloads. This was an accepted design decision. |
| #8 | IEEE 754 Near-Integer Float Rounding | Low | **Unchanged (Accepted Risk)** | Inherent platform limitation. Deferred by Architect. |
| #9 | Negative Zero Serialization | Low | **Unchanged (Accepted Risk)** | Inherent JSON limitation. Deferred by Architect. |

---

## Post-Build Findings -- Iteration 2

### FINDING 1 -- Content-Type Middleware Blocks 405 Responses for Bodyless Methods
- **Severity:** Medium
- **Attack Description:** Send `GET /add` or `DELETE /add` without a request body (no `Content-Type` header). The Content-Type validation middleware on lines 10-15 runs on ALL requests before routing occurs. For a `GET` request with no body, `req.is('application/json')` returns `false` (because there is no `Content-Type` header). The middleware intercepts the request and returns `400` with `{ "error": "Content-Type must be application/json" }`. The request never reaches the `app.all('/add', ...)` handler that would return `405 Method Not Allowed`.
- **Expected Behavior:** A `GET /add` request (wrong HTTP method on a defined path) should return `405 Method Not Allowed`, because the path exists but only accepts POST. The 400 Content-Type error is misleading: the problem is not the Content-Type, it is the HTTP method.
- **Actual Behavior:** Returns `400` with `{ "error": "Content-Type must be application/json" }`. The client is told to fix their Content-Type header, but even if they add the correct header and resend with GET, they will then get a `405` (if the body parses) or another `400` (if the body is malformed). The error guidance is incorrect.
- **Location:** `index.js` lines 10-15 (Content-Type middleware runs before routing), and lines 99-111 (405 handlers never reached for bodyless requests).
- **Severity Rationale:** Medium. The 405 handlers were added specifically to address Iteration 1's Finding #6, but they are only reachable for non-POST requests that include a `Content-Type: application/json` header AND a valid JSON body. For the most common wrong-method scenarios (browser `GET` requests, `curl` without `-X POST`, `DELETE` from tooling), the client receives a misleading 400 error instead of the intended 405. The fix addresses only a subset of the original problem. This is not a correctness bug in the defined POST endpoints, but it is a behavioral inconsistency in the error handling surface that the Iteration 2 changes were intended to resolve.

---

### FINDING 2 -- 405 Handlers Affected by Trailing Slash and Case Normalization
- **Severity:** Medium
- **Attack Description:** Send `PUT /ADD` or `PUT /add/` with `Content-Type: application/json` and a valid JSON body `{ "a": 1, "b": 2 }`. The request passes the Content-Type middleware and JSON body parser. Express's route matching (with default `case sensitive routing: false` and `strict routing: false`) routes the POST request to `app.post('/add')` if it were a POST. For a PUT request, Express skips the `app.post('/add')` handler because the method does not match, then checks `app.all('/add')`. The `app.all()` handler uses the same route matching behavior and will match `/ADD` (case-insensitive) and `/add/` (trailing slash). However, if `PUT /Add/Extra` is sent, it will NOT match `app.all('/add')` and will fall through to the catch-all 404 handler, returning `404 Not found` instead of `405`. This is correct behavior (the path `/add/Extra` is not a defined endpoint). More importantly, `PUT /add` with the correct header and valid body correctly reaches the 405 handler and returns the expected response. The trailing-slash and case-insensitive variants also correctly reach the 405 handler because Express's `app.all()` applies the same normalization as `app.post()`.
- **Expected Behavior:** Non-POST requests to defined paths (including URL variants) should return 405.
- **Actual Behavior:** The 405 handlers DO correctly match trailing-slash and case variants of the four defined paths -- Express normalizes consistently across `app.post()` and `app.all()`. The finding is that this only works when the request includes `Content-Type: application/json` AND a parseable body. Without both, the Content-Type middleware intercepts first (see Finding 1). For requests that DO pass the Content-Type middleware, the 405 handlers work correctly for all URL normalization variants.
- **Location:** `index.js` lines 99-111 (405 handlers).
- **Severity Rationale:** Medium. This finding is a refinement of Finding 1. The 405 handlers themselves are correctly implemented and handle URL normalization properly. The issue is that the prerequisite middleware (Content-Type check) prevents most non-POST requests from reaching them. Downgrading from the initial assessment because the 405 mechanism itself is sound -- the problem is the middleware ordering interaction, which is fully described in Finding 1.

**Note on Findings 1 and 2:** These two findings share a root cause -- the Content-Type validation middleware runs on all requests, including those where the correct error is 405 (wrong method) rather than 400 (wrong Content-Type). The fix would require either: (a) making the Content-Type middleware method-aware (only check POST requests), (b) moving the Content-Type check into the route handlers, or (c) reordering middleware so 405 detection happens before Content-Type validation. All three approaches require an Architect decision because the current middleware ordering (Content-Type first, per the spec) is explicitly mandated by the developer instructions.

---

### FINDING 3 -- 404 Handler Returns JSON Error for All Paths Including Static Resource Probes
- **Severity:** Low
- **Attack Description:** Send `POST /favicon.ico`, `POST /.env`, `POST /wp-admin/`, or `POST /api/v1/health` with `Content-Type: application/json` and body `{}`. All requests pass the Content-Type middleware and JSON parser, then fall through to the catch-all 404 handler, which returns `{ "error": "Not found" }` with status 404. This confirms the API exists and responds, even for paths that were never defined.
- **Expected Behavior:** The spec now authorizes a JSON 404 response for undefined routes, so this behavior is correct per spec.
- **Actual Behavior:** Returns `404` with `{ "error": "Not found" }` for all unmatched paths. This is the intended behavior from the Iteration 2 fix.
- **Location:** `index.js` lines 113-116 (catch-all 404 handler).
- **Severity Rationale:** Low. The 404 handler works as designed. The observation is that the consistent JSON 404 response confirms to scanners that the server is running an API, but this is an inherent property of any server that responds to requests. The 404 handler is a net improvement over the Iteration 1 behavior (HTML response with Express framework details). No correctness issue.

---

### FINDING 4 -- Final Error Handler Swallows Errors Silently
- **Severity:** Low
- **Attack Description:** If any middleware or route handler throws an unexpected error that is not `entity.parse.failed` or `entity.too.large`, the error falls through the first error handler (lines 21-29) via `next(err)` and is caught by the final error handler (lines 119-121), which returns `500` with `{ "error": "Internal server error" }`. The error is not logged anywhere. In production, this means unexpected failures produce no server-side diagnostic record.
- **Expected Behavior:** The spec does not define logging requirements. The Architect's instructions for Fix 4 specify only the response format. The implementation is spec-compliant.
- **Actual Behavior:** Returns `500` with `{ "error": "Internal server error" }` and discards the error object entirely. No `console.error()`, no logging, no diagnostic output.
- **Location:** `index.js` lines 119-121 (final error handler).
- **Severity Rationale:** Low. This is a defense-in-depth improvement over Iteration 1 (which leaked stack traces). The lack of error logging is an operational concern, not a correctness or security vulnerability. The handler correctly prevents information leakage. This is not a CISO finding because it is about operational observability, not security posture.

---

### FINDING 5 -- `entity.too.large` Error Returns "Invalid JSON body" (Unchanged from Iteration 1)
- **Severity:** Low
- **Attack Description:** Send a POST request with `Content-Type: application/json` and a body exceeding 1KB (e.g., `{ "a": 1, "b": 2, "padding": "AAAA...1100 bytes..." }`). The `express.json({ limit: '1kb' })` middleware rejects it. The custom error handler returns `{ "error": "Invalid JSON body" }`.
- **Expected Behavior:** The spec does not define a separate message for oversized payloads. The developer instructions explicitly prescribe "Invalid JSON body" for `entity.too.large`.
- **Actual Behavior:** Returns `400` with `{ "error": "Invalid JSON body" }`. The JSON may be perfectly valid; it is simply too large. The error message is misleading.
- **Location:** `index.js` lines 25-27.
- **Severity Rationale:** Low. Carried forward from Iteration 1 Finding #7. Accepted design decision per developer instructions. No change in Iteration 2.

---

### FINDING 6 -- IEEE 754 Near-Integer Float Acceptance (Unchanged from Iteration 1)
- **Severity:** Low
- **Attack Description:** Send `POST /add` with `{ "a": 0.99999999999999999, "b": 1 }`. JavaScript's `JSON.parse` rounds `0.99999999999999999` to `1.0` due to IEEE 754 double-precision representation. `Number.isInteger(1.0)` returns `true`. The request is accepted with `a = 1`.
- **Expected Behavior:** The spec says "floats (e.g. 1.5) are invalid." The value `0.99999999999999999` is conceptually a float but is indistinguishable from `1` after parsing.
- **Actual Behavior:** Accepted as `a = 1`. The computation is correct for the parsed values.
- **Location:** Inherent JavaScript/JSON limitation. No code change can address this without raw body inspection.
- **Severity Rationale:** Low. Carried forward from Iteration 1 Finding #8. Deferred by Architect as inherent platform limitation.

---

### FINDING 7 -- Negative Zero Echoed as Positive Zero (Unchanged from Iteration 1)
- **Severity:** Low
- **Attack Description:** Send `POST /divide` with `{ "a": 0, "b": -5 }`. JavaScript computes `Math.floor(0 / -5) = -0`. `JSON.stringify(-0)` produces `0`.
- **Expected Behavior:** The spec does not address `-0`. At the JSON wire level, `-0` and `0` are indistinguishable.
- **Actual Behavior:** Returns `{ "result": 0 }` (positive zero). Correct at the JSON API level.
- **Location:** `index.js` line 95, Express's `res.json()`.
- **Severity Rationale:** Low. Carried forward from Iteration 1 Finding #9. Deferred by Architect as inherent JSON limitation.

---

## Verification of Iteration 2 Changes

The following changes specified in Developer Instructions #2 were verified by code inspection:

| Check | Status |
|-------|--------|
| `validate()` no longer accepts a `path` parameter | **Verified.** Line 32: `function validate(body)` -- single parameter. |
| `validate()` no longer contains `path === '/divide'` | **Verified.** No string `'/divide'` or `path` variable appears in the validate function (lines 32-51). |
| All four route handlers call `validate(req.body)` with one argument | **Verified.** Lines 57, 67, 77, 87 -- all use `validate(req.body)`. |
| `/divide` handler checks `b === 0` after `validate()` and before computation | **Verified.** Lines 91-93: `const { a, b } = req.body; if (b === 0) { return ... }` precedes `Math.floor(a / b)` on line 95. |
| Four `app.all()` handlers return 405 for defined paths | **Verified.** Lines 100-111. |
| `app.all()` handlers are after `app.post()` handlers and before 404 handler | **Verified.** Post routes: lines 56-97. All handlers: lines 100-111. 404 handler: lines 114-116. |
| Catch-all 404 handler returns JSON | **Verified.** Line 115: `res.status(404).json({ error: 'Not found' })`. |
| Final error handler with 4 params returns JSON 500 | **Verified.** Lines 119-121: `(err, req, res, next) => { res.status(500).json(...) }`. |
| Existing middleware, validation (Rules 1-5), and computations unchanged | **Verified.** Content-Type middleware (lines 10-15), express.json config (line 18), parse error handler (lines 21-29), validate function logic (lines 32-51), route computations (add/subtract/multiply unchanged). |

---

## Findings NOT Raised (Verified Correct)

The following previously identified risks were re-verified and found to still be correctly handled:

| Area | Status |
|------|--------|
| Floor division with negative numbers (`-7 / 2 = -4`) | Correct. `Math.floor()` on line 95. |
| `null` triggers Rule 4, not Rule 3 | Correct. `=== undefined` on line 37. |
| No result range validation | Correct. No output range check exists. |
| Content-Type with charset accepted | Correct. `req.is()` on line 11 handles parameters. |
| Non-object JSON bodies handled via null guard | Correct. Lines 33-34 guard against null/undefined body. |
| Scientific notation (`1e2` = 100 accepted, `1e20` rejected by range) | Correct. |
| Per-rule validation ordering | Correct. Rule 4 checks both a and b before Rule 5. |
| Boundary values inclusive (`-1000000` and `1000000` accepted) | Correct. `<` and `>` on line 47 implement inclusive range. |
| Division-by-zero on canonical path `/divide` | Correct. `b === 0` on line 92 catches this before computation. |

---

## Summary

| Severity | Count | Findings |
|----------|-------|----------|
| Critical | 0 | -- |
| High | 0 | -- |
| Medium | 2 | #1 (Content-Type Middleware Blocks 405 Responses), #2 (405 Handlers and Middleware Ordering Interaction) |
| Low | 5 | #3 (404 Confirms API Existence), #4 (Error Handler Swallows Errors Silently), #5 (entity.too.large Misleading Message -- carried forward), #6 (IEEE 754 Float Rounding -- carried forward), #7 (Negative Zero Serialization -- carried forward) |
| **Total** | **7** | |

---

## Iteration 1 to Iteration 2 Comparison

| Metric | Iteration 1 | Iteration 2 | Delta |
|--------|-------------|-------------|-------|
| Critical findings | 4 | 0 | -4 (all fixed) |
| High findings | 0 | 0 | -- |
| Medium findings | 2 | 2 | 0 (1 fixed, 1 partially fixed, 1 new nuance from the fix) |
| Low findings | 3 | 5 | +2 (3 carried forward, 2 new from new handlers) |
| **Total** | **9** | **7** | **-2** |

### Disposition of All Iteration 1 Findings

| Iter 1 # | Severity | Title | Iter 2 Status |
|-----------|----------|-------|---------------|
| #1 | Critical | Trailing Slash Bypass | **FIXED** -- path comparison eliminated |
| #2 | Critical | Case-Insensitive Routing Bypass | **FIXED** -- path comparison eliminated |
| #3 | Critical | 0/0 NaN via Bypass | **FIXED** -- bypass eliminated |
| #4 | Critical | -N/0 -Infinity via Bypass | **FIXED** -- bypass eliminated |
| #5 | Medium | Undefined Routes Return HTML | **FIXED** -- catch-all 404 handler returns JSON |
| #6 | Medium | Non-POST Methods Inconsistent | **PARTIALLY FIXED** -- 405 handlers added but reachable only when Content-Type middleware passes |
| #7 | Low | entity.too.large Misleading Message | **Carried forward** (accepted design decision) |
| #8 | Low | IEEE 754 Float Rounding | **Carried forward** (platform limitation) |
| #9 | Low | Negative Zero Serialization | **Carried forward** (platform limitation) |

---

## Overall Assessment

Iteration 2 successfully eliminates all 4 Critical findings from Iteration 1. The division-by-zero bypass -- the most serious functional defect in Iteration 1 -- has been cleanly resolved by moving the `b === 0` check into the `/divide` route handler, eliminating the path-string comparison entirely. This is the strongest possible fix because it removes the class of vulnerability rather than patching individual attack vectors.

The new 404 handler, 405 handlers, and final error handler are all correctly implemented and improve the API's consistency. The 404 handler eliminates HTML responses for undefined routes. The final error handler prevents stack trace leakage.

The remaining 2 Medium findings relate to the interaction between the Content-Type validation middleware (which runs before routing) and the new 405 handlers (which run during routing). Non-POST requests without a body or without the correct Content-Type header receive a misleading 400 error instead of the intended 405 error. This is a middleware ordering issue that the developer instructions explicitly mandate (Content-Type check runs first), so it may be an accepted tradeoff. The defined POST endpoints are unaffected -- this is purely about the error response for invalid (wrong-method) requests.

The 5 Low findings consist of 3 carried forward from Iteration 1 (all accepted risks or platform limitations) and 2 new observations about the Iteration 2 additions (404 confirming API existence, error handler lacking logging). None represent correctness failures or exploitable bypasses.

**No logic bypasses or correctness failures remain in the defined endpoint behavior.** The API correctly validates inputs per all 6 rules, computes correct results for all 4 operations, and returns spec-compliant error messages for all defined error conditions.
