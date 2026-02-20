# Adversary Post-Build Report -- Iteration 1

**Date:** 2026-02-18
**Implementation reviewed:** `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-api/index.js`
**Pre-build report:** `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-api/reports/adversary-pre-build.md`
**Author:** Adversary Agent (Step 7 -- Post-Build Adversarial Attack on Implementation, Iteration 1)

---

## Scope

This report covers the actual implementation in `index.js`, focusing on logical bypasses, type coercion issues, boundary failures, and unexpected behavior. All findings were verified against the running server. Security infrastructure concerns (CORS, rate limiting, auth, TLS, logging) are covered by the CISO and are not duplicated here.

---

## Pre-Build Critical/High Findings: Disposition

Before listing new findings, here is the status of every Critical and High finding from the pre-build adversary report.

| Pre-Build # | Title | Severity | Status | Notes |
|-------------|-------|----------|--------|-------|
| #1 | Negative Floor Division | Critical | **ADDRESSED** | Implementation uses `Math.floor(a / b)` on line 97. Verified: `-7 / 2 = -4`, `7 / -2 = -4`, `-7 / -2 = 3`. All correct. |
| #2 | Bitwise OR Truncation on Multiply | High | **ADDRESSED** | Implementation uses plain `a * b` (line 88), `a + b` (line 67), `a - b` (line 77). No bitwise operations anywhere. `1000000 * 1000000 = 1000000000000` verified correct. |
| #4 | null Triggers Rule 3 vs Rule 4 | High | **ADDRESSED** | Validation uses `a === undefined` (strict equality, line 37). `{ "a": null, "b": 5 }` correctly falls through to Rule 4 ("Both a and b must be integers"). Verified. |
| #8 | Result Range Validation | High | **ADDRESSED** | No range check on computed results. `1000000 * 1000000 = 1000000000000` returns 200. `1000000 + 1000000 = 2000000` returns 200. Verified. |
| #18 | Content-Type Check Before Body Parsing | High | **ADDRESSED** | Content-Type middleware (lines 10-15) runs before `express.json()` (line 18). `req.is('application/json')` correctly handles missing headers, wrong types, and charset parameters. Verified. |

**Summary: All 5 pre-build Critical/High findings were successfully addressed.**

---

## Post-Build Findings

### FINDING 1 -- Trailing Slash Bypasses Division-by-Zero Check (Rule 6)
- **Severity:** Critical
- **Attack Description:** Send `POST /divide/` (with trailing slash) with `{ "a": 10, "b": 0 }`. Express's default `strict routing: false` setting means the route pattern `/divide` matches both `/divide` and `/divide/`. However, `req.path` returns the actual URL path including the trailing slash: `'/divide/'`. The validation function on line 52 checks `path === '/divide'`, which is `false` when `path` is `'/divide/'`. This means Rule 6 (division by zero) is never evaluated.
- **Expected Behavior:** `POST /divide/` with `b=0` should return `400` with `{ "error": "Division by zero is not allowed" }`.
- **Actual Behavior:** Returns `200` with `{ "operation": "division", "a": 10, "b": 0, "result": null }`. The division `10 / 0` produces `Infinity` in JavaScript, `Math.floor(Infinity)` is `Infinity`, and `JSON.stringify(Infinity)` produces `null`. The response contains a non-integer `result`, violating the spec's response contract.
- **Location:** `index.js` line 52: `if (path === '/divide' && b === 0)`
- **Verified:** Yes. Tested against running server. `curl -X POST http://localhost:3000/divide/ -H "Content-Type: application/json" -d '{"a":10,"b":0}'` returns `{"operation":"division","a":10,"b":0,"result":null}` with status 200.
- **Severity Rationale:** Critical. The API returns a 200 success response with a `null` result for division by zero. This is a complete bypass of a validation rule, a contract violation (result must be an integer), and silent data corruption. The attack requires only appending a `/` to the URL.

---

### FINDING 2 -- Case-Insensitive Routing Bypasses Division-by-Zero Check (Rule 6)
- **Severity:** Critical
- **Attack Description:** Send `POST /DIVIDE` (uppercase) with `{ "a": 10, "b": 0 }`. Express's default `case sensitive routing: false` setting means `/DIVIDE`, `/Divide`, `/dIvIdE`, etc., all match the route pattern `/divide`. However, `req.path` returns the original URL casing: `'/DIVIDE'`. The validation function checks `path === '/divide'`, which is `false` for any non-lowercase variant.
- **Expected Behavior:** `POST /DIVIDE` with `b=0` should return `400` with `{ "error": "Division by zero is not allowed" }`.
- **Actual Behavior:** Returns `200` with `{ "operation": "division", "a": 10, "b": 0, "result": null }`. Same mechanism as Finding 1 -- the Rule 6 check is bypassed, division by zero proceeds, and `Infinity` is serialized as `null`.
- **Location:** `index.js` line 52: `if (path === '/divide' && b === 0)`
- **Verified:** Yes. Tested against running server. `curl -X POST http://localhost:3000/DIVIDE -H "Content-Type: application/json" -d '{"a":10,"b":0}'` returns `{"operation":"division","a":10,"b":0,"result":null}` with status 200.
- **Severity Rationale:** Critical. Same impact as Finding 1. A different attack vector exploiting the same root cause: the path comparison uses exact string match against a value that Express normalizes for routing but not for `req.path`.

---

### FINDING 3 -- Zero Divided by Zero via Bypass Returns `null` (NaN Serialization)
- **Severity:** Critical
- **Attack Description:** Send `POST /divide/` with `{ "a": 0, "b": 0 }`. The Rule 6 bypass from Finding 1 allows this through. In JavaScript, `0 / 0` evaluates to `NaN`. `Math.floor(NaN)` returns `NaN`. `JSON.stringify({ result: NaN })` produces `{ "result": null }` because `NaN` is not a valid JSON value and is replaced with `null` by the JSON serializer.
- **Expected Behavior:** `POST /divide` (or `/divide/`) with `{ "a": 0, "b": 0 }` should return `400` with `{ "error": "Division by zero is not allowed" }`.
- **Actual Behavior:** Returns `200` with `{ "operation": "division", "a": 0, "b": 0, "result": null }`. The result is `null`, not an integer.
- **Location:** `index.js` line 52 (bypass), line 97 (computation), Express's `res.json()` (serialization).
- **Verified:** Yes. `curl -X POST http://localhost:3000/divide/ -H "Content-Type: application/json" -d '{"a":0,"b":0}'` returns `{"operation":"division","a":0,"b":0,"result":null}`.
- **Severity Rationale:** Critical. This is a direct consequence of Finding 1/2 but produces a qualitatively different incorrect result (`NaN` instead of `Infinity`). Listed separately because the `NaN`-to-`null` serialization is a distinct JavaScript trap that would also be a problem if the division-by-zero check had any other bypass path.

---

### FINDING 4 -- Negative Division by Zero via Bypass Returns `null` (-Infinity Serialization)
- **Severity:** Critical
- **Attack Description:** Send `POST /divide/` with `{ "a": -5, "b": 0 }`. The bypass allows the division to proceed. `-5 / 0` produces `-Infinity` in JavaScript. `Math.floor(-Infinity)` is `-Infinity`. `JSON.stringify(-Infinity)` produces `null`.
- **Expected Behavior:** `400` with `{ "error": "Division by zero is not allowed" }`.
- **Actual Behavior:** `200` with `{ "operation": "division", "a": -5, "b": 0, "result": null }`.
- **Location:** Same root cause as Finding 1.
- **Verified:** Yes. Confirmed via server testing.
- **Severity Rationale:** Critical. Same class as Findings 1-3. All three infinity/NaN cases (`+Infinity`, `-Infinity`, `NaN`) are silently serialized as `null` in JSON responses.

**Note on Findings 1-4:** These four findings share a single root cause -- the exact string comparison `path === '/divide'` on line 52. Fixing the comparison to handle trailing slashes and case variants eliminates all four findings simultaneously. They are listed separately because each represents a distinct attack vector or distinct incorrect output, and a fix that addresses only one variant (e.g., trimming trailing slashes but not lowercasing) would leave the others open.

---

### FINDING 5 -- Undefined Routes Return HTML Error, Not JSON
- **Severity:** Medium
- **Attack Description:** Send `POST /nonexistent` with `Content-Type: application/json` and valid JSON body `{ "a": 1, "b": 2 }`. The request passes the Content-Type middleware and JSON parsing. Express then looks for a matching route, finds none, and falls through to its default 404 handler, which returns an HTML response: `<!DOCTYPE html><html>...<pre>Cannot POST /nonexistent</pre>...</html>`.
- **Expected Behavior:** The spec does not define behavior for undefined routes. However, an API should return consistent response formats. A JSON API returning HTML for any path is a contract inconsistency.
- **Actual Behavior:** Returns `404` with `Content-Type: text/html` and an HTML body. Clients expecting JSON will fail to parse the response.
- **Location:** No explicit 404 handler in `index.js`. Express's default handler generates the HTML response.
- **Verified:** Yes. `curl -s -X POST http://localhost:3000/nonexistent -H "Content-Type: application/json" -d '{"a":1,"b":2}'` returns HTML.
- **Severity Rationale:** Medium. The spec only defines four endpoints and does not specify behavior for undefined routes. However, returning HTML from a JSON API is a meaningful inconsistency that could confuse API clients and automated tooling. This is not a correctness bug in the defined endpoints but a gap in the API's error handling surface.

---

### FINDING 6 -- Non-POST Methods on Defined Routes Return HTML or Inconsistent Errors
- **Severity:** Medium
- **Attack Description:** Send `PUT /add` with `Content-Type: application/json` and valid JSON body. The Content-Type middleware passes. Express parses the JSON body. Express looks for a PUT handler for `/add`, finds none, and returns a 404 HTML error: `Cannot PUT /add`. Similarly, `GET /add` without a body triggers the Content-Type error (because `req.is()` returns `null` for bodyless requests) with a 400 JSON response. `DELETE /add` without a body also triggers the Content-Type error.
- **Expected Behavior:** The spec says "All endpoints are POST only." The appropriate HTTP response for a valid path with the wrong method is `405 Method Not Allowed`, not `404 Not Found`.
- **Actual Behavior:** `PUT /add` returns `404` with HTML body. `GET /add` (without body) returns `400` with JSON `{"error":"Content-Type must be application/json"}`. The response format and status code depend on the HTTP method used, creating inconsistent behavior.
- **Location:** No method-checking middleware in `index.js`. The inconsistency arises from the interaction between the Content-Type middleware (which runs on all requests) and Express's default 404 handler.
- **Verified:** Yes. Tested with curl.
- **Severity Rationale:** Medium. The spec defines POST-only endpoints but does not specify behavior for other methods. Returning 404 (with HTML) instead of 405 for wrong methods is an HTTP semantics violation but does not affect the defined POST endpoints. The inconsistency between PUT (gets HTML 404) and GET (gets JSON 400) is a minor but observable behavioral gap.

---

### FINDING 7 -- `entity.too.large` Error Returns Misleading Error Message
- **Severity:** Low
- **Attack Description:** Send a POST request with `Content-Type: application/json` and a body exceeding 1KB. The `express.json({ limit: '1kb' })` middleware rejects it with an `entity.too.large` error. The custom error handler on line 25-27 catches this and returns `{ "error": "Invalid JSON body" }`.
- **Expected Behavior:** The spec says "Request bodies must be limited to 1KB" but does not specify a separate error message for this case. The developer instructions explicitly say to return "Invalid JSON body" for `entity.too.large`.
- **Actual Behavior:** Returns `400` with `{ "error": "Invalid JSON body" }`. The body might be perfectly valid JSON that simply exceeds the size limit. The error message is technically inaccurate -- the JSON is not invalid, it is too large.
- **Location:** `index.js` lines 25-27.
- **Verified:** By code inspection. The developer instructions explicitly prescribe this behavior.
- **Severity Rationale:** Low. The error message is misleading but the behavior (400 rejection) is correct. The spec does not define a separate error message for oversized payloads. This is a design decision documented in the developer instructions, not an implementation bug. A client debugging a 1.1KB valid JSON body would receive a confusing "Invalid JSON body" message, but this does not affect correctness for payloads within the size limit.

---

### FINDING 8 -- IEEE 754 Precision Causes Near-Integer Floats to Be Accepted as Integers
- **Severity:** Low
- **Attack Description:** Send `POST /add` with `{ "a": 0.99999999999999999, "b": 1 }` (17 nines after the decimal point). JavaScript's `JSON.parse` converts `0.99999999999999999` to `1.0` due to IEEE 754 double-precision floating-point rounding. `Number.isInteger(1.0)` returns `true`. The API accepts the request and computes with `a = 1`.
- **Expected Behavior:** The spec says "floats (e.g. 1.5) are invalid." The value `0.99999999999999999` is conceptually a float, but after JSON parsing it is indistinguishable from the integer `1`.
- **Actual Behavior:** The request is accepted with `a = 1`, `b = 1`, and `result = 2`. The API computes the correct result for the parsed values, but the parsed values differ from the sender's intent.
- **Location:** This is an inherent limitation of JSON parsing via IEEE 754 doubles. No code change in `index.js` can address it without raw body inspection.
- **Verified:** Yes. `JSON.parse("0.99999999999999999")` returns `1`. `Number.isInteger(1)` returns `true`.
- **Severity Rationale:** Low. This affects only values with 17+ decimal digits that happen to round to integers -- an extreme edge case. Within the spec's range of [-1000000, 1000000], all integers are safely representable, and the API correctly validates the parsed value. The spec and Architect's resolution (Ambiguity #7) accept `1.0` as valid, and this is the same class of issue at a more extreme precision boundary. No practical impact on real-world usage.

---

### FINDING 9 -- Negative Zero Echoed as Positive Zero in Response
- **Severity:** Low
- **Attack Description:** Send `POST /divide` with `{ "a": 0, "b": -5 }`. JavaScript computes `0 / -5 = -0`. `Math.floor(-0)` returns `-0`. The result is `-0`, which passes all validation. However, `JSON.stringify({ result: -0 })` serializes as `{ "result": 0 }` (positive zero). Similarly, if `-0` is sent as an input (e.g., `{ "a": -0, "b": 5 }`), the echoed value in the response will be `"a": 0` (positive zero).
- **Expected Behavior:** The spec does not address `-0`. The Architect did not resolve this ambiguity. A reasonable interpretation is that `-0` and `0` are equivalent.
- **Actual Behavior:** `-0` is accepted as a valid integer (correct -- `Number.isInteger(-0)` is `true`, and `-0 === 0` is `true`). The response echoes `0` for `-0` inputs. The result `0` is returned for `-0` results. This is consistent and correct at the JSON API level because JSON has no `-0` representation.
- **Location:** Line 97 (`Math.floor(a / b)`), Express's `res.json()` (uses `JSON.stringify`).
- **Verified:** Yes. `JSON.stringify({result: -0})` produces `{"result":0}`.
- **Severity Rationale:** Low. No observable API-level bug. The only potential issue is a test that uses `Object.is()` to distinguish `-0` from `0` in the response, which would fail. But JSON serialization normalizes this, and no standard JSON client can distinguish the two.

---

## Findings NOT Raised (Pre-Build Findings Confirmed Correct)

The following pre-build Medium/Low findings were verified as correctly handled by the implementation:

| Pre-Build # | Title | Status |
|-------------|-------|--------|
| #3 | `1.0` as Integer | Correctly accepted. `Number.isInteger(1.0)` returns `true`. |
| #5 | Express JSON Parse Error Message | Custom error handler (lines 21-29) replaces Express's default message with "Invalid JSON body". |
| #6 | Empty Object Rule 3 vs Rule 4 | `{}` correctly triggers Rule 3 ("Both a and b are required"). Validation is per-rule, not per-field. |
| #7 | Infinity/NaN via `1e999` | `Number.isInteger(Infinity)` returns `false`. Rule 4 correctly fires. |
| #9 | Content-Type with Charset | `req.is('application/json')` correctly accepts `application/json; charset=utf-8`. |
| #10 | Non-Object JSON Bodies | `strict: false` allows parsing. Null guard on lines 33-34 prevents `TypeError`. All non-object bodies trigger Rule 3. |
| #11 | Scientific Notation | `1e2` correctly parsed as `100` and accepted. `1e20` correctly rejected by Rule 5. |
| #12 | Validation Per-Rule vs Per-Field | Implementation checks Rule 4 for both `a` and `b` before Rule 5. `{ "a": 5000000, "b": "hello" }` correctly returns Rule 4 error. |
| #16 | Express Strict Mode | `strict: false` is correctly configured. Bare primitives pass Rule 2 and fail at Rule 3. |
| #17 | Boundary Off-by-One | Boundaries use `<` and `>` (line 47), which correctly implement inclusive range. `1000000` accepted, `1000001` rejected. `-1000000` accepted, `-1000001` rejected. |
| #20 | 0/0 NaN Serialization | Division by zero check (line 52) catches `b === 0` BEFORE division is performed (via the normal `/divide` path). The pre-build risk of compute-before-validate does not apply. **However**, the trailing-slash bypass (Finding 1 above) re-opens this risk. |

---

## Summary

| Severity | Count | Findings |
|----------|-------|----------|
| Critical | 4 | #1 (Trailing Slash Bypass), #2 (Case-Insensitive Routing Bypass), #3 (0/0 NaN via Bypass), #4 (-N/0 -Infinity via Bypass) |
| High | 0 | -- |
| Medium | 2 | #5 (Undefined Routes Return HTML), #6 (Non-POST Methods Inconsistent) |
| Low | 3 | #7 (entity.too.large Misleading Message), #8 (IEEE 754 Float-to-Integer Rounding), #9 (Negative Zero Serialization) |
| **Total** | **9** | |

---

## Root Cause Analysis

**Findings 1-4 share a single root cause:** The validation function compares `path === '/divide'` using exact string equality against `req.path`, which preserves the original URL casing and trailing slashes. Meanwhile, Express's route matching normalizes both case and trailing slashes by default (`case sensitive routing: false`, `strict routing: false`). This creates a gap where a request reaches the `/divide` route handler but the validation function does not recognize it as a `/divide` request, skipping Rule 6.

**Recommended fix approaches (for the Architect's consideration, not prescriptive):**
- Use `req.route.path` instead of `req.path` (returns the route pattern `/divide` regardless of the request URL).
- Normalize `path` before comparison (e.g., `path.toLowerCase().replace(/\/+$/, '')`).
- Enable Express's `strict` and `case sensitive` routing options.
- Hard-code the division-by-zero check in the `/divide` route handler instead of parameterizing it through the validation function.

**Findings 5-6** stem from the absence of catch-all error handling middleware. Express's default 404 handler returns HTML, which is inconsistent with a JSON API. A catch-all middleware at the end of the middleware chain could return JSON 404 responses and optionally check for wrong HTTP methods (405).

---

## Overall Assessment

The implementation is well-constructed and correctly addresses all 5 pre-build Critical and High findings. The validation logic, rule ordering, floor division, null handling, range checks, and Content-Type middleware are all correctly implemented per the spec and developer instructions.

The single critical vulnerability is the path comparison in the division-by-zero check, which can be bypassed via trailing slashes (`/divide/`) or case variations (`/DIVIDE`). This is a serious functional bug because it produces 200 responses with `null` results for division-by-zero inputs -- a silent correctness failure with no error signal. The root cause is a mismatch between Express's permissive route matching and the validation function's strict string comparison.

The Medium findings (HTML error responses for undefined routes and non-POST methods) are not spec violations but represent gaps in the API's error handling consistency. The Low findings are inherent limitations of JavaScript/JSON that the implementation handles as well as possible.
