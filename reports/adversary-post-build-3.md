# Adversary Post-Build Report -- Iteration 3

**Date:** 2026-02-19
**Implementation reviewed:**
- `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-api/index.js`
- `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-api/public/index.html` (NEW -- web interface)

**Prior reports:**
- Pre-build: `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-api/reports/adversary-pre-build.md`
- Iteration 1: `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-api/reports/adversary-post-build-1.md`
- Iteration 2: `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-api/reports/adversary-post-build-2.md`

**Author:** Adversary Agent (Post-Build Adversarial Attack on Implementation, Iteration 3)

---

## Scope

This report focuses on the **new attack surface introduced by `public/index.html`** and its interaction with the hardened backend. The following vectors from iterations 1-2 are confirmed fixed or accepted and are NOT re-probed:

- Division-by-zero bypass via trailing slash or case-insensitive routing (fixed in iteration 1, confirmed in iteration 2)
- Case-insensitive routing bypass (fixed in iteration 1)
- Trailing slash bypass (fixed in iteration 1)
- Undefined routes returning HTML (fixed in iteration 1, confirmed in iteration 2)
- 405 method handling / Content-Type middleware ordering interaction (analyzed in iteration 2, accepted as design tradeoff)
- `entity.too.large` misleading message (accepted design decision)
- IEEE 754 near-integer float rounding (accepted platform limitation)
- Negative zero serialization (accepted platform limitation)

Security infrastructure concerns (CORS, rate limiting, auth, TLS, logging, CSP hardening) are covered by the CISO and are not duplicated here.

---

## Findings

### FINDING 1 -- Frontend Sends Floats for Decimal Input, Bypassing UI Type="number" Expectation

- **Severity:** Medium
- **Attack Description:** The HTML input fields use `type="number"`, which permits decimal entry in all browsers. A user types `1.5` into the "Value a" field. The frontend JavaScript reads `inputA.value` (which is the string `"1.5"`), converts it via `Number("1.5")` (line 193), producing the float `1.5`. This is sent as `{ "a": 1.5, "b": ... }` to the server. The server correctly rejects it with Rule 4 ("Both a and b must be integers"). However, the frontend does **no client-side validation** -- there is no `step="1"` attribute on the input, no `pattern` attribute, no JavaScript pre-check for integer-ness. The user receives the server error after a network round-trip.
- **Expected Behavior:** For a calculator that only accepts integers, the UI should either constrain input to integers (via `step="1"` on the `<input>`) or provide immediate client-side feedback before the API call.
- **Actual Behavior:** The request is sent, the server rejects it, and the error is displayed. Functionally correct at the API level, but the UI provides no guardrails or immediate feedback. The `type="number"` input without `step="1"` accepts any numeric value including decimals, scientific notation, and extremely large numbers.
- **Severity Rationale:** Medium. The server-side validation is correct and prevents any data integrity issue. However, the lack of client-side validation is a UX gap that could also be exploited in testing scenarios where the frontend is expected to enforce the same constraints as the backend. If any future change relaxes server-side validation assuming the frontend "handles it," this becomes a real vulnerability.

---

### FINDING 2 -- `Number("")` Evaluates to `0`, But Frontend Sends `null` for Empty Inputs -- Divergent Handling for Whitespace-Only Input

- **Severity:** Medium
- **Attack Description:** The frontend checks `inputA.value === ''` on line 193 and sends `null` for empty fields. This is correct for a truly empty field. However, if a user types spaces into the number input (e.g., `"   "`), the browser's `type="number"` input typically returns `""` for its `.value` property when the content is not a valid number. The frontend would then send `null`. But consider a manipulated DOM or a programmatic test that sets `inputA.value = "   "` directly on a text input: `Number("   ")` evaluates to `0` in JavaScript (whitespace strings coerce to zero). If the input type were changed or the validation path altered, `"   "` would silently become `0` rather than being rejected.

    More critically: the actual divergence is that `Number("")` also evaluates to `0`. The frontend guards against this with the explicit `=== ''` check, sending `null` instead. But if the check were `inputA.value.trim() === ''` or if any refactoring removed the empty-string guard, empty inputs would silently become `{ "a": 0, "b": 0 }` and the server would compute with zeros -- a valid request that the user did not intend.
- **Expected Behavior:** Empty or whitespace-only inputs should be clearly rejected, never silently converted to `0`.
- **Actual Behavior:** The current implementation correctly sends `null` for empty string, which the server rejects via Rule 4 (`Number.isInteger(null)` is `false`). However, the correctness depends on the fragile `=== ''` guard. The `Number()` coercion path is one refactoring step away from silently converting empty inputs to zero.
- **Severity Rationale:** Medium. The current code is correct but relies on a single equality check against empty string. The underlying `Number()` coercion of empty/whitespace strings to `0` is a well-known JavaScript trap. This is a latent vulnerability -- not exploitable today, but a maintenance hazard.

---

### FINDING 3 -- Frontend Does Not Validate Range, Sends Out-of-Range Values to Server

- **Severity:** Medium
- **Attack Description:** A user types `99999999` into the input field. The frontend sends `{ "a": 99999999, "b": ... }` to the server. The server rejects it with Rule 5 ("Values must be between -1000000 and 1000000"). The `type="number"` input has no `min` or `max` attributes, so the browser provides no constraint. Combined with Finding 1 (no `step`), the input element is completely unconstrained -- any numeric value the browser's number input accepts will be sent to the server.

    The input also accepts scientific notation in some browsers (e.g., `1e99`), which `Number("1e99")` converts to `1e+99`, a finite number that is far outside the valid range. The server correctly rejects this via Rule 5. However, `Number("1e999")` produces `Infinity`, and `Number.isInteger(Infinity)` is `false`, so the server rejects it via Rule 4 ("must be integers") rather than Rule 5 ("out of range"). The error message mismatch -- the user typed a very large number and is told it is "not an integer" -- is confusing from a UX perspective, though the server behavior is spec-compliant.
- **Expected Behavior:** The frontend should constrain inputs to the valid range, or at minimum the error messages should make sense to the user for the input they provided.
- **Actual Behavior:** The server correctly rejects all out-of-range values. The error message for `Infinity`-producing inputs ("must be integers") is technically correct but semantically misleading to the user.
- **Severity Rationale:** Medium. Server validation is intact. The concern is that the frontend provides zero input constraints (`min`, `max`, `step` attributes are all absent), delegating all validation to the server. If the server were ever bypassed or relaxed, the frontend offers no defense.

---

### FINDING 4 -- `Number()` Coercion Converts Non-Numeric Browser Input to `NaN`, Which is Sent as `null` in JSON

- **Severity:** Medium
- **Attack Description:** Although `type="number"` inputs generally prevent non-numeric text entry, some browser behaviors and programmatic DOM manipulation can produce edge-case `.value` strings. For example, setting `inputA.value` programmatically to a non-numeric string via JavaScript console or browser automation produces `Number("abc")` = `NaN`. The frontend then calls `JSON.stringify({ a: NaN, b: ... })`, which serializes `NaN` as `null`. The server receives `{ "a": null, "b": ... }` and rejects it via Rule 4.

    This is the same `NaN`-to-`null` JSON serialization issue identified in pre-build Finding #20 for server-side division results, but now it appears on the **client side** in the input path. The user typed "abc" (or a programmatic script injected it), the frontend silently converted it to `null`, and the server error says "must be integers" -- which is correct but gives the user no indication that their input was converted.
- **Expected Behavior:** Non-numeric input should produce a clear client-side error like "Please enter a valid number," not a silent conversion to `null` followed by a server-side rejection.
- **Actual Behavior:** `NaN` is silently serialized as `null` in the JSON payload. The server rejects it. The user sees "Both a and b must be integers." Functionally safe but confusing.
- **Severity Rationale:** Medium. The server-side validation prevents any data integrity issue. The concern is that the `NaN`-to-`null` serialization obscures the real problem (invalid input) behind a generic server error.

---

### FINDING 5 -- `express.static('public')` Serves `index.html` Before Content-Type Middleware, Creating Inconsistent Request Handling

- **Severity:** High
- **Attack Description:** The `express.static('public')` middleware (line 12) is mounted BEFORE the Content-Type validation middleware (lines 15-19). This means a `GET /` request serves the HTML page without requiring `Content-Type: application/json`. This is intentionally correct -- static files should not require JSON headers.

    However, this creates a subtle inconsistency: `GET /index.html` also serves the page (via `express.static`), and `POST /index.html` with no Content-Type header returns `400 { "error": "Content-Type must be application/json" }` (because `express.static` does not serve on POST, so the request falls through to the Content-Type middleware). Meanwhile, `POST /` with `Content-Type: application/json` and body `{}` falls through `express.static` (which does not handle POST), hits the Content-Type middleware (passes), hits the JSON parser (passes), and falls through to the 404 handler, returning `{ "error": "Not found" }`.

    The real attack surface: **`express.static` serves ANY file in the `public/` directory.** Currently, `public/` contains only `index.html`. But if any file is ever added to `public/` (e.g., a config file, a `.env` accidentally copied, debug logs, source maps), it will be served to any HTTP client without authentication. The `express.static` middleware is a directory listing risk if `dotfiles` is not configured (the default is `'ignore'`, which is safe for dotfiles, but non-dotfiles are served unconditionally).
- **Expected Behavior:** Static file serving should be tightly scoped. Only explicitly intended files should be served.
- **Actual Behavior:** Any file added to the `public/` directory is immediately served via HTTP with no access control. Currently safe (only `index.html` exists), but a maintenance hazard.
- **Severity Rationale:** High. The `express.static` middleware is mounted before ALL other middleware, meaning static files bypass the Content-Type check, JSON parsing, and all validation. Today this is correct behavior for serving the HTML page. The severity is High because: (1) the `public/` directory is a deployment surface that requires ongoing vigilance -- any accidentally placed file becomes publicly accessible, and (2) the middleware ordering means static file requests bypass all API security middleware, which is by design but creates a split-brain security model where some paths have full validation and others have none.

---

### FINDING 6 -- Frontend `fetch()` Uses Relative URL, Vulnerable to Base Tag Injection or Proxy Misrouting

- **Severity:** Medium
- **Attack Description:** The frontend constructs API URLs as `'/' + operation` (line 197), producing relative URLs like `/add`, `/subtract`, etc. These are resolved relative to the current page origin. If the page is served through a reverse proxy that rewrites paths (e.g., the app is mounted at `/calculator/` behind nginx), the fetch requests will go to `/add` instead of `/calculator/add`, causing 404 errors.

    More critically, if an attacker can inject a `<base href="https://evil.com/">` tag into the HTML (e.g., through a proxy injection or an HTML injection vulnerability elsewhere in the stack), all `fetch()` calls would be redirected to `https://evil.com/add`, `https://evil.com/subtract`, etc. The attacker's server would receive the user's calculator inputs and could return fabricated results. The CSP `default-src 'self'` directive in the meta tag DOES mitigate this -- `fetch()` calls to a different origin would be blocked by CSP. However, the CSP is set via a `<meta>` tag (line 6), not via an HTTP header. Meta-tag CSP can be bypassed if the attacker can inject content before the `<meta>` tag in the HTML (early injection), though this is a narrow attack window.
- **Expected Behavior:** API URLs should be resilient to base-path changes and proxy configurations.
- **Actual Behavior:** Relative URLs work correctly when the page is served from the application root. The CSP meta tag provides defense against origin-changing base tag injection. However, the reliance on relative URLs combined with meta-tag CSP (rather than HTTP-header CSP) creates a narrow but real attack surface for proxy misconfiguration or early-injection scenarios.
- **Severity Rationale:** Medium. The current deployment (Express serves static files and API from the same origin and root path) makes this unexploitable today. The severity reflects the fragility of the assumptions: if the deployment model changes (reverse proxy, CDN, subpath mounting), the frontend breaks silently.

---

### FINDING 7 -- Race Condition: Rapid Button Clicks Cause Concurrent Requests with Stale UI State

- **Severity:** Medium
- **Attack Description:** The frontend disables all buttons during a request (line 190) and re-enables them in the `finally` block (line 215). This prevents concurrent requests during normal usage. However, there is a window between the button click event firing and the button disable executing (microtask timing). A user (or automated script) that triggers two click events in rapid succession (e.g., via `btnAdd.click(); btnAdd.click()`) before the first `calculate()` call reaches line 190 can cause two concurrent fetch requests.

    When both responses arrive, they race to update `resultDisplay` and `errorDisplay`. The second response overwrites the first. If the user changed input values between clicks, the displayed result may not correspond to the currently visible inputs. More importantly, the `finally` block of the first request re-enables buttons and hides the loading indicator while the second request is still in-flight, creating a state where: buttons are enabled, loading indicator is hidden, but a request is pending. If the user clicks again during this window, a third concurrent request fires.

    Programmatically: `btnAdd.click(); btnDivide.click()` in quick succession sends both an add and a divide request. The displayed result will be whichever response arrives last, which may be the add result displayed after the user intended to see the divide result.
- **Expected Behavior:** The UI should either queue or debounce operations, or use an AbortController to cancel the in-flight request when a new one starts.
- **Actual Behavior:** Concurrent requests can produce a result display that does not match the last-requested operation. The loading indicator behavior becomes inconsistent (hidden while a request is still pending).
- **Severity Rationale:** Medium. This cannot cause incorrect server-side computation or data corruption. The server handles each request independently and correctly. The impact is purely a UI consistency issue -- the displayed result may not match the user's intent. For a calculator, displaying the wrong operation's result is a meaningful UX bug.

---

### FINDING 8 -- Response Parsing Assumes JSON, No Guard Against Non-JSON Server Responses

- **Severity:** Medium
- **Attack Description:** On line 203, the frontend calls `response.json()` unconditionally, regardless of the response status code or Content-Type header. If the server returns a non-JSON response (e.g., due to a proxy error page, a 502 gateway error, or a server crash returning raw text), `response.json()` will throw a `SyntaxError`. This error is caught by the `catch` block (line 211), which displays "Network error: Could not reach the server."

    The error message is misleading -- the server WAS reached (the response was received), but the response was not valid JSON. The user is told there is a network problem when the actual problem is server-side. This matters for debugging: a user reporting "network error" sends the operations team looking at DNS and load balancers, when the actual issue is a 502 from a reverse proxy returning HTML.

    Additionally, if a MITM or proxy returns a `200` response with an HTML body (e.g., a captive portal), `response.json()` throws, and the user sees "Network error" -- masking the interception entirely.
- **Expected Behavior:** The frontend should check `response.headers.get('content-type')` before calling `.json()`, and provide a distinct error message for non-JSON responses vs. actual network failures (which would reject the `fetch()` promise itself, not the `.json()` call).
- **Actual Behavior:** All non-JSON responses produce the same "Network error" message. True network failures (DNS, connection refused) and non-JSON server responses are indistinguishable to the user.
- **Severity Rationale:** Medium. The catch block prevents crashes, which is good. But the misleading error message hides the real failure mode. In a production deployment behind a proxy or CDN, this could mask serious infrastructure issues or interception attacks.

---

### FINDING 9 -- Frontend Displays Server-Controlled Error Text via `textContent`, But Backend Operation String is Unsanitized in Result Display

- **Severity:** Low
- **Attack Description:** The frontend uses `textContent` (not `innerHTML`) to display both results (line 207) and errors (line 209). This is a correct XSS prevention measure -- `textContent` does not parse HTML. Even if the server returned `{ "error": "<script>alert(1)</script>" }`, it would be displayed as literal text, not executed.

    However, the result display (line 207) concatenates multiple server-controlled values: `data.operation`, `data.a`, `data.b`, and `data.result`. These are all set via `textContent`, so XSS is not possible. But the display format is: `"addition: 5 + 3 = 8"`. The `operation` field comes directly from the server response. If the server were compromised or a proxy modified the response, the operation string could be anything (e.g., an extremely long string, control characters, RTL override characters). While `textContent` prevents script execution, it does not prevent visual spoofing via Unicode bidirectional override characters (e.g., U+202E RIGHT-TO-LEFT OVERRIDE), which could make the displayed result appear to show a different number than what was actually returned.
- **Expected Behavior:** The frontend should either validate the `operation` field against the expected set (`addition`, `subtraction`, `multiplication`, `division`) or limit the display length.
- **Actual Behavior:** All server response fields are displayed verbatim via `textContent`. No length limit, no character validation. XSS is prevented, but visual spoofing via Unicode control characters is possible if the server response is tampered with.
- **Severity Rationale:** Low. Requires server compromise or MITM to inject unexpected response fields. The `textContent` usage prevents the most dangerous attack (XSS). Unicode visual spoofing is a theoretical concern for a calculator that has no financial or security-critical output.

---

### FINDING 10 -- CSP `'unsafe-inline'` for Both `script-src` and `style-src` Negates Most CSP Protection

- **Severity:** Low (deferred to CISO domain, noted here for completeness)
- **Attack Description:** The CSP meta tag on line 6 includes `script-src 'self' 'unsafe-inline'` and `style-src 'self' 'unsafe-inline' https:`. The `'unsafe-inline'` directive for `script-src` allows execution of any inline `<script>` tag, which is the primary attack vector that CSP is designed to prevent. If an attacker can inject HTML into the page (via a proxy, server-side rendering bug, or response modification), they can execute arbitrary JavaScript despite CSP being present.

    This is noted here because the CSP was likely added as a security measure for the web interface, but `script-src 'unsafe-inline'` makes it largely ineffective against XSS. The inline script on lines 161-223 should be moved to an external `.js` file, and the CSP should use a nonce or hash instead of `'unsafe-inline'`.
- **Expected Behavior:** CSP should meaningfully restrict inline script execution.
- **Actual Behavior:** CSP allows all inline scripts, providing no protection against injected script tags.
- **Severity Rationale:** Low for this report. This is primarily a CISO concern. Noted here only because it interacts with Finding 9 (if CSP were effective, it would be an additional layer of defense against response tampering scenarios). The functional calculator behavior is unaffected.

---

## Vectors Probed and Found Non-Exploitable

The following attack vectors were investigated for the new web interface and found to be correctly handled:

| Vector | Result |
|--------|--------|
| Empty inputs (both fields blank) | Frontend sends `{ "a": null, "b": null }`. Server returns Rule 4 error. Correct. |
| One field empty, one filled | Frontend sends `{ "a": null, "b": 5 }`. Server returns Rule 4 error. Correct. |
| Division by zero via UI | Frontend sends `{ "a": 10, "b": 0 }`. Server returns Rule 6 error. Correctly displayed. |
| Very large number typed in browser | Frontend sends the value as-is. Server validates via Rule 5. Correct. |
| XSS via input field (`<script>` in number input) | Browser's `type="number"` rejects non-numeric input. Even if bypassed, `Number("<script>...")` = `NaN`, sent as `null`, rejected by server. Display uses `textContent`. No XSS path. |
| Server error message displayed safely | `errorDisplay.textContent = data.error` -- safe against HTML injection. |
| Correct HTTP method used | Frontend always uses `method: 'POST'`. No GET/PUT/DELETE requests from normal UI interaction. |
| Content-Type header correctly set | Frontend always sends `'Content-Type': 'application/json'`. Server accepts. |
| `GET /` serves the web interface | `express.static('public')` serves `index.html` for `GET /`. Correct. |
| `GET /index.html` serves the web interface | `express.static` serves the file directly. Correct. |

---

## Summary

| Severity | Count | Findings |
|----------|-------|----------|
| Critical | 0 | -- |
| High | 1 | #5 (express.static Bypasses All API Middleware) |
| Medium | 6 | #1 (Frontend Accepts Floats), #2 (Empty String / Number Coercion), #3 (No Client-Side Range Validation), #4 (NaN-to-null Serialization in Input Path), #6 (Relative URL / Base Tag Injection), #7 (Race Condition on Rapid Clicks), #8 (Non-JSON Response Handling) |
| Low | 2 | #9 (Unicode Visual Spoofing via textContent), #10 (CSP unsafe-inline -- deferred to CISO) |
| **Total** | **9** | |

---

## Iteration 2 to Iteration 3 Comparison

| Metric | Iteration 2 | Iteration 3 | Delta |
|--------|-------------|-------------|-------|
| Critical findings | 0 | 0 | -- |
| High findings | 0 | 1 | +1 (new attack surface from static file serving) |
| Medium findings | 2 | 6 | +4 (all new, from web interface) |
| Low findings | 5 | 2 | -3 (iteration 2 low findings not re-listed; 2 new from web interface) |
| **Total** | **7** | **9** | **+2** |

### Disposition of All Iteration 2 Findings

| Iter 2 # | Severity | Title | Iter 3 Status |
|-----------|----------|-------|---------------|
| #1 | Medium | Content-Type Middleware Blocks 405 Responses | **Not re-probed** (accepted design tradeoff per scope exclusion) |
| #2 | Medium | 405 Handlers and Middleware Ordering | **Not re-probed** (accepted design tradeoff per scope exclusion) |
| #3 | Low | 404 Confirms API Existence | **Not re-probed** (accepted risk) |
| #4 | Low | Error Handler Swallows Errors Silently | **Not re-probed** (operational concern, not correctness) |
| #5 | Low | entity.too.large Misleading Message | **Not re-probed** (accepted design decision) |
| #6 | Low | IEEE 754 Float Rounding | **Not re-probed** (platform limitation) |
| #7 | Low | Negative Zero Serialization | **Not re-probed** (platform limitation) |

---

## Overall Assessment

The backend API remains well-hardened. No new backend vulnerabilities were introduced in iteration 3. All Critical and High findings from iterations 1-2 remain fixed, and the core validation logic (Rules 1-6) continues to function correctly.

The new attack surface is entirely in the **web interface** (`public/index.html`). The frontend correctly delegates all validation to the server and uses `textContent` for display (preventing XSS). However, it provides **zero client-side input constraints** -- no `step`, `min`, `max` on the number inputs, no pre-submission validation, no input sanitization. Every invalid input requires a server round-trip to produce an error. This is not a security vulnerability (the server catches everything), but it creates a fragile defense-in-depth posture where the server is the sole line of defense.

The highest-severity finding (#5) concerns `express.static` being mounted before all API middleware, creating a path where any file in `public/` is served without Content-Type validation, JSON parsing, or any other API-level security check. This is by design for serving HTML, but it means the `public/` directory is an unguarded deployment surface.

The Medium findings (#1-4, #6-8) are all frontend robustness issues: lack of client-side validation, `Number()` coercion traps, race conditions on concurrent requests, and misleading error messages for non-JSON responses. None of these can cause incorrect server-side computation or data corruption. They represent UX gaps and maintenance hazards rather than exploitable vulnerabilities.

**The API's defined endpoint behavior remains correct. No validation bypasses, no incorrect computation results, and no data integrity failures were found in iteration 3.**
