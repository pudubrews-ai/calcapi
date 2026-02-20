# Adversary Post-Build Report -- Iteration 4

**Date:** 2026-02-19
**Implementation reviewed:**
- `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-api/index.js`
- `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-api/public/index.html`

**Prior reports:**
- Pre-build: `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-api/reports/adversary-pre-build.md`
- Iteration 1: `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-api/reports/adversary-post-build-1.md`
- Iteration 2: `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-api/reports/adversary-post-build-2.md`
- Iteration 3: `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-api/reports/adversary-post-build-3.md`

**Author:** Adversary Agent (Post-Build Adversarial Attack on Implementation, Iteration 4)

---

## Scope

Iteration 4 made three targeted changes:
1. `index.js` line 6: `PORT` wrapped in `Number()` -- `const PORT = Number(process.env.PORT) || 3000`
2. `index.js` line 12: `express.static` now uses `require('path').join(__dirname, 'public')` instead of a bare `'public'` string
3. `public/index.html`: added `isCalculating` boolean guard to prevent concurrent requests

This report evaluates whether these changes actually close the targeted findings, whether they introduce new attack surfaces, and the status of all remaining open findings from prior iterations.

**Confirmed fixed / accepted / deferred -- NOT re-probed:**
- Division-by-zero bypass via trailing slash or case-insensitive routing (fixed iteration 1, confirmed iteration 2)
- Routing bypasses (fixed iteration 1)
- 405/404 method handling (deferred as design choice, iteration 2)
- Content-Type middleware interaction with 405 (deferred as design choice, iteration 2)
- `entity.too.large` misleading message (accepted design decision)
- IEEE 754 near-integer float rounding (accepted platform limitation)
- Negative zero serialization (accepted platform limitation)
- 404 confirms API existence (accepted risk)
- Error handler swallows errors silently (operational concern, accepted)

---

## Iteration 4 Change Analysis

### Change 1: `PORT` Wrapped in `Number()`

**Line 6:** `const PORT = Number(process.env.PORT) || 3000`

Previously: `const PORT = process.env.PORT || 3000`

The prior version passed a string from `process.env.PORT` directly to `app.listen()`. Express/Node's `app.listen()` accepts both strings and numbers, so this was not a runtime bug. However, if `PORT` were used in any numeric comparison or arithmetic elsewhere, the string type could produce unexpected results. The `Number()` wrapper ensures `PORT` is always a number. `Number(undefined)` is `NaN`, and `NaN || 3000` evaluates to `3000`. `Number("3000")` is `3000`. `Number("")` is `0`, and `0 || 3000` evaluates to `3000`. `Number("abc")` is `NaN`, and `NaN || 3000` evaluates to `3000`.

**Assessment:** This is a defensive hardening change. No new attack surface introduced. No finding to raise.

### Change 2: `__dirname`-Based Static Path

**Line 12:** `app.use(express.static(require('path').join(__dirname, 'public')))`

Previously: `app.use(express.static('public'))`

This change resolves the path relative to the module's directory rather than the process's current working directory. See Finding 1 below for analysis of whether this introduces directory traversal risk.

### Change 3: `isCalculating` Boolean Guard

**Lines 173, 183-184:** `var isCalculating = false;` and `if (isCalculating) return; isCalculating = true;`

This directly targets Adversary-3 Finding #7 (race condition on rapid clicks). See Finding 2 below for analysis of whether this actually closes the race.

---

## Findings

### FINDING 1 -- `__dirname`-Based Static Path Does NOT Introduce Directory Traversal

- **Severity:** Informational (non-finding, documented for completeness)
- **Attack Description:** Probe whether the change from `express.static('public')` to `express.static(require('path').join(__dirname, 'public'))` introduces any new path traversal vectors. An attacker sends `GET /../index.js` or `GET /..%2F..%2Findex.js` or `GET /%2e%2e/index.js` attempting to escape the `public/` directory and read the server source code or `package.json`.
- **Expected Behavior:** `express.static` should confine file serving to the specified root directory. Path traversal should be blocked.
- **Actual Behavior:** `express.static` internally calls `path.resolve()` on the root and then uses `path.normalize()` on the request path, rejecting any result that escapes the root directory. The `send` package (used internally by `express.static`) explicitly checks for `..` path segments after URL decoding and returns 403 Forbidden. This behavior is unchanged regardless of whether the root is a relative path (`'public'`) or an absolute path (`path.join(__dirname, 'public')`). Both produce the same resolved absolute root internally.
- **Verification:** `express.static` uses the `send` npm package, which has hardened path traversal prevention. Encoded variants (`%2e%2e`, `%2f`, `..%5c`) are all decoded before the path-escape check runs. Null bytes (`%00`) are rejected. The `__dirname`-based path is marginally more robust because it is immune to the process's working directory changing at runtime (e.g., via `process.chdir()`), but this is not a realistic attack vector for this application.
- **Severity Rationale:** Informational. No traversal vector was found. The change is a net improvement (removes dependency on CWD) with no new attack surface.

---

### FINDING 2 -- `isCalculating` Guard Closes the Rapid-Click Race for Normal User Interaction, But Is Bypassable via Console/Automation

- **Severity:** Medium
- **Attack Description:** The `isCalculating` boolean guard (line 173: `var isCalculating = false`, line 183: `if (isCalculating) return`, line 184: `isCalculating = true`) is a synchronous check at the top of the `calculate()` function. Because JavaScript in the browser is single-threaded, the sequence `if (isCalculating) return; isCalculating = true;` is atomic with respect to other event handlers -- no other click handler can interleave between the check and the set within the same microtask.

    This means the specific attack from Adversary-3 Finding #7 -- `btnAdd.click(); btnDivide.click()` in rapid succession -- IS effectively blocked. The first `click()` enters `calculate()`, sets `isCalculating = true`, and begins the async `fetch()`. The second `click()` enters `calculate()`, sees `isCalculating === true`, and returns immediately. The guard holds until the `finally` block on line 219 sets `isCalculating = false`.

    **However, the guard can be bypassed in three ways:**

    1. **Direct `fetch()` calls from the console:** An attacker (or automated test) can bypass the UI entirely and call `fetch('/add', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({a:1,b:2}) })` directly. The `isCalculating` guard only protects the UI flow, not the API. This is expected behavior -- the server handles concurrent requests correctly regardless.

    2. **Overwriting the `isCalculating` variable:** Because `isCalculating` is declared with `var` (line 173), not `const` or within a closure, it is accessible as a property of the script's scope. From the browser console: `isCalculating = false` resets the guard, allowing a second click to fire while the first is in-flight. Using `let` inside a closure or module scope would make this marginally harder (though not impossible via debugger).

    3. **Multiple browser tabs/windows:** Each tab has its own `isCalculating` state. Two tabs open to the same calculator can fire concurrent requests. The server handles this correctly (stateless request handling), so this is not a server-side issue. But it means the "one request at a time" guarantee is per-tab, not global.

- **Expected Behavior:** The `isCalculating` guard should prevent concurrent UI-initiated requests within a single page context.
- **Actual Behavior:** The guard achieves this goal for normal user interaction (clicks, keyboard). It does not prevent programmatic or cross-tab concurrent requests, which is acceptable since the server is stateless and handles concurrency correctly.
- **Severity Rationale:** Medium. The guard closes the originally reported race condition (Adversary-3 #7) for the practical attack scenario (rapid button clicks). The bypasses require console access or programmatic manipulation, which are outside the threat model of a calculator UI. Downgrading from the original Medium because the fix addresses the specific vulnerability. Maintaining Medium (rather than Low) because the `var` declaration makes the guard trivially resettable from the console, and the guard does not use `AbortController` to cancel in-flight requests -- meaning if the guard is bypassed, the original race condition (stale UI state from overlapping responses) reappears in full.

---

### FINDING 3 -- `isCalculating` Guard Does Not Abort In-Flight Requests on Page Navigation or Tab Close

- **Severity:** Low
- **Attack Description:** When a user clicks a button and then navigates away (or closes the tab) before the response arrives, the `fetch()` request remains in-flight. The `finally` block (line 216-220) may or may not execute depending on the browser's behavior during page unload. If the user navigates back (via browser back button or history), the page reloads with fresh state (`isCalculating = false`), so there is no stale guard. However, if the page uses a service worker or is served from bfcache, the old page state (including `isCalculating = true`) could persist, leaving buttons permanently disabled.

    Additionally, if the server is slow to respond and the user navigates away and back, the abandoned `fetch()` may eventually resolve and trigger DOM updates on a page that the user has mentally "reset." This is a general SPA lifecycle issue, not specific to this implementation.
- **Expected Behavior:** In-flight requests should be cancelled when the user navigates away or starts a new operation.
- **Actual Behavior:** No `AbortController` is used. In-flight requests complete (or timeout) independently of page lifecycle. The `finally` block re-enables buttons and resets `isCalculating`, so the worst case is a brief period of disabled buttons if the response is slow.
- **Severity Rationale:** Low. The calculator is a simple page with no service worker or SPA routing. Page navigation causes a full reload, resetting all state. The bfcache scenario is theoretical and browser-dependent. No data integrity risk.

---

### FINDING 4 -- `express.static` with `__dirname` Still Serves All Files in `public/` Without Access Control (Iteration 3 Finding #5 Unaddressed)

- **Severity:** High (carried forward from Adversary-3 #5, unchanged)
- **Attack Description:** The `__dirname`-based path change does not alter the fundamental behavior identified in Adversary-3 Finding #5: `express.static` serves ANY file placed in the `public/` directory, bypassing all API middleware (Content-Type validation, JSON parsing, error handlers). The change from `'public'` to `path.join(__dirname, 'public')` resolves which directory is served but does not constrain what files within that directory are accessible.

    Currently `public/` contains only `index.html` (verified by directory listing). The risk remains: if any file is added to `public/` -- accidentally or through a deployment pipeline artifact (source maps, `.env` copies, debug logs, deployment manifests) -- it becomes immediately accessible via HTTP `GET` with no authentication or access control.

    The `__dirname` change actually makes the path resolution more predictable (no longer dependent on CWD), which slightly reduces the risk of serving the wrong directory. But the core issue -- uncontrolled static file serving -- remains.
- **Expected Behavior:** Only explicitly intended files should be served from `public/`.
- **Actual Behavior:** All files in `public/` are served. No allow-list, no file extension filter, no access logging specific to static assets.
- **Severity Rationale:** High, unchanged from Adversary-3 #5. The `__dirname` change is a deployment robustness improvement, not a security fix for this finding. The attack surface (any file in `public/` is public) persists.

---

### FINDING 5 -- Frontend Still Has Zero Client-Side Input Validation (Iteration 3 Findings #1, #3 Unaddressed)

- **Severity:** Medium (carried forward from Adversary-3 #1 and #3, unchanged)
- **Attack Description:** The `<input type="number">` elements on lines 140-141 and 145-146 still have no `step`, `min`, or `max` attributes. The iteration 4 changes did not modify the input elements. A user can still type `1.5`, `99999999`, `1e999`, or any other value the browser's number input accepts. All such values are sent to the server, which correctly rejects them. The frontend provides no pre-submission feedback.
- **Expected Behavior:** Input elements should use `step="1"`, `min="-1000000"`, `max="1000000"` to constrain values at the browser level.
- **Actual Behavior:** Inputs are unconstrained. All validation is server-side only.
- **Severity Rationale:** Medium, unchanged. Server validation prevents data integrity issues. The lack of client-side constraints remains a defense-in-depth gap and a UX issue.

---

### FINDING 6 -- Frontend `Number()` Coercion of Empty/Whitespace Strings to `0` Still a Latent Hazard (Iteration 3 Finding #2 Unaddressed)

- **Severity:** Medium (carried forward from Adversary-3 #2, unchanged)
- **Attack Description:** The `=== ''` guard on line 196 (`inputA.value === '' ? null : Number(inputA.value)`) correctly prevents empty inputs from being coerced to `0`. However, `Number("   ")` still evaluates to `0`, and `Number("")` still evaluates to `0`. The guard is the sole protection against this coercion. No changes in iteration 4 addressed this. A future refactoring that replaces the `=== ''` check with a truthiness check (`!inputA.value`) or a trim-based check (`inputA.value.trim() === ''`) would behave identically for these cases. But a refactoring that removes the null-coalescing pattern entirely (e.g., always using `Number(inputA.value)`) would silently convert empty inputs to zero.
- **Expected Behavior:** Empty or non-numeric inputs should be clearly identified and rejected before any coercion.
- **Actual Behavior:** Current code is correct. The risk is maintenance fragility, not a current bug.
- **Severity Rationale:** Medium, unchanged. Latent vulnerability, not currently exploitable.

---

### FINDING 7 -- Frontend Still Does Not Distinguish Network Errors from Non-JSON Response Errors (Iteration 3 Finding #8 Unaddressed)

- **Severity:** Medium (carried forward from Adversary-3 #8, unchanged)
- **Attack Description:** The `catch` block on line 214 displays "Network error: Could not reach the server" for all exceptions, including `SyntaxError` from `response.json()` when the server returns non-JSON (e.g., a 502 proxy error page). True network failures (DNS, connection refused) cause `fetch()` itself to reject, producing a `TypeError`. JSON parse failures produce a `SyntaxError`. Both are caught by the same `catch` and shown with the same "Network error" message. No changes in iteration 4 addressed this.
- **Expected Behavior:** The error message should distinguish between "server unreachable" and "server returned invalid response."
- **Actual Behavior:** All non-success paths through the `catch` block produce an identical misleading message.
- **Severity Rationale:** Medium, unchanged. Misleading error messages can misdirect debugging efforts.

---

### FINDING 8 -- Frontend Relative URL Construction Unchanged (Iteration 3 Finding #6 Unaddressed)

- **Severity:** Medium (carried forward from Adversary-3 #6, unchanged)
- **Attack Description:** Line 200: `fetch('/' + operation, ...)` constructs relative URLs. This works when the application is served from the root path of a domain. If the application is mounted at a subpath behind a reverse proxy (e.g., `/calculator/`), the fetch requests go to `/add` instead of `/calculator/add`. Additionally, `<base href>` injection could redirect all fetches to an attacker-controlled origin, though the CSP meta tag mitigates cross-origin fetches. No changes in iteration 4 addressed this.
- **Expected Behavior:** API URL construction should be resilient to subpath mounting.
- **Actual Behavior:** Relative URLs break silently under subpath proxy configurations.
- **Severity Rationale:** Medium, unchanged. Not exploitable in the current single-origin deployment, but fragile under common production deployment patterns.

---

### FINDING 9 -- `var isCalculating` Declared in Global-ish Scope with `var` Instead of `let` in Closure

- **Severity:** Low
- **Attack Description:** The `isCalculating` guard is declared with `var` on line 173, within the inline `<script>` block. In a browser, `var` declarations in a non-module inline script are added to the `window` object. This means `window.isCalculating` is directly accessible and settable from the console, from browser extensions, or from any other script on the page (if CSP were to allow third-party scripts). An attacker or test automation framework can set `window.isCalculating = false` to bypass the guard at any time.

    If `let` were used instead, the variable would be block-scoped to the script and NOT added to `window`, making it slightly harder (though not impossible) to access from external code. Alternatively, wrapping the entire script in an IIFE or using a module `<script type="module">` would isolate the scope.

    This is a minor hardening concern. The `isCalculating` guard is a UI convenience, not a security control. The server handles concurrent requests correctly regardless.
- **Expected Behavior:** UI state variables should not be globally accessible.
- **Actual Behavior:** `isCalculating` is accessible as `window.isCalculating` due to `var` declaration in an inline script.
- **Severity Rationale:** Low. The guard is a UX protection, not a security boundary. Server-side correctness is unaffected. The `var` declaration is a code quality issue, not a vulnerability.

---

### FINDING 10 -- CSP Meta Tag Still Uses `'unsafe-inline'` for `script-src` (Iteration 3 Finding #10 Unaddressed, Deferred to CISO)

- **Severity:** Low (deferred to CISO domain, noted for tracking)
- **Attack Description:** Line 6: `script-src 'self' 'unsafe-inline'` still permits arbitrary inline script execution. The iteration 4 changes did not address this. The `isCalculating` guard was added as inline code within the existing `<script>` block, which continues to require `'unsafe-inline'`. Moving the script to an external file would allow removing `'unsafe-inline'` and using nonce-based or hash-based CSP.
- **Expected Behavior:** CSP should meaningfully restrict inline script execution.
- **Actual Behavior:** CSP permits all inline scripts.
- **Severity Rationale:** Low, unchanged. Deferred to CISO per iteration 3.

---

## Iteration 3 Findings Disposition

| Iter 3 # | Severity | Title | Iter 4 Status |
|-----------|----------|-------|---------------|
| #1 | Medium | Frontend Accepts Floats (no `step` attribute) | **Unaddressed** -- carried forward as Finding #5 |
| #2 | Medium | Empty String / Number Coercion Hazard | **Unaddressed** -- carried forward as Finding #6 |
| #3 | Medium | No Client-Side Range Validation | **Unaddressed** -- merged with #1 above in Finding #5 |
| #4 | Medium | NaN-to-null Serialization in Input Path | **Unaddressed** -- still present but not re-listed as standalone; the `isCalculating` guard does not interact with this code path |
| #5 | High | `express.static` Bypasses All API Middleware | **Unaddressed** -- carried forward as Finding #4. The `__dirname` change improves path resolution robustness but does not address the core access-control concern |
| #6 | Medium | Relative URL / Base Tag Injection | **Unaddressed** -- carried forward as Finding #8 |
| #7 | Medium | Race Condition on Rapid Clicks | **ADDRESSED** -- the `isCalculating` boolean guard closes this for normal UI interaction. See Finding #2 for residual analysis |
| #8 | Medium | Non-JSON Response Handling | **Unaddressed** -- carried forward as Finding #7 |
| #9 | Low | Unicode Visual Spoofing via textContent | **Not re-probed** -- accepted low risk |
| #10 | Low | CSP `'unsafe-inline'` | **Unaddressed** -- carried forward as Finding #10, deferred to CISO |

---

## Summary

| Severity | Count | Findings |
|----------|-------|----------|
| Critical | 0 | -- |
| High | 1 | #4 (express.static uncontrolled file serving -- carried forward from Adversary-3 #5) |
| Medium | 5 | #2 (isCalculating guard residual bypass analysis), #5 (no client-side input validation -- carried forward), #6 (Number coercion hazard -- carried forward), #7 (non-JSON response handling -- carried forward), #8 (relative URL fragility -- carried forward) |
| Low | 2 | #9 (var declaration exposes guard to window), #10 (CSP unsafe-inline -- deferred to CISO) |
| Informational | 2 | #1 (__dirname path traversal non-finding), #3 (isCalculating and page lifecycle) |
| **Total** | **10** | |

---

## Iteration 3 to Iteration 4 Comparison

| Metric | Iteration 3 | Iteration 4 | Delta |
|--------|-------------|-------------|-------|
| Critical findings | 0 | 0 | -- |
| High findings | 1 | 1 | 0 (same finding, unaddressed by iteration 4 changes) |
| Medium findings | 6 | 5 | -1 (rapid-click race addressed; all others carried forward) |
| Low findings | 2 | 2 | 0 (1 new from `var` scope; CSP carried forward; iteration 3 #9 not re-probed) |
| Informational | 0 | 2 | +2 (new, documenting non-findings from iteration 4 changes) |
| **Total** | **9** | **10** | **+1** |

---

## Key Conclusions for Iteration 4

1. **`isCalculating` guard DOES close the rapid-click race** for normal user interaction. JavaScript's single-threaded event loop ensures the check-and-set on lines 183-184 is atomic with respect to click handlers. The original attack (`btnAdd.click(); btnDivide.click()` in quick succession) is blocked. The guard is bypassable only through console manipulation or programmatic override, which is outside the normal UI threat model.

2. **`__dirname`-based static path does NOT introduce directory traversal.** Express's `send` package has hardened path traversal prevention that applies regardless of whether the root path is relative or absolute. The change is a robustness improvement (immune to CWD changes) with zero new attack surface.

3. **`Number(process.env.PORT)` is a defensive improvement** with no new attack surface. `NaN` falls through to the `|| 3000` default.

4. **The sole High finding (uncontrolled static file serving) persists from iteration 3** and was not the target of any iteration 4 change. The `__dirname` path resolution improves deployment robustness but does not address the access-control gap.

5. **Five Medium findings from iteration 3 remain unaddressed** (client-side input validation, Number coercion hazard, non-JSON response handling, relative URL fragility). These are all frontend robustness issues that do not affect server-side correctness.

6. **No new Critical or High findings introduced by iteration 4 changes.** All three changes are net-positive hardening with no regression.

**The API's defined endpoint behavior remains correct. No validation bypasses, no incorrect computation results, and no data integrity failures exist.**
