# Architect Evaluation -- Iteration 3

**Date:** 2026-02-19
**Author:** Architect Agent
**Iteration:** 3
**Decision:** ITERATE (proceed to Iteration 4)

---

## Report Summary

| Report | Result | Notes |
|--------|--------|-------|
| API Tests | **38/38 PASS** | All groups (happy path, negatives, zero, floor division, boundaries, divide-by-zero, invalid types, missing fields, malformed requests) pass. Zero regressions. |
| UI Tests | **0/13 PASS** | All 13 tests fail. Single root cause: static files not served. |
| CISO Post-Build | 0 Critical, 0 High, 3 Medium, 4 Low | No blockers. Three Medium findings are architectural trade-offs. Four Low findings are hardening opportunities. |
| Adversary Post-Build | 0 Critical, 1 High, 6 Medium, 2 Low | The High finding (express.static bypasses API middleware) is by design and overlaps with CISO Finding #2. Six Medium findings are frontend robustness gaps. |

---

## Root Cause of All 13 UI Test Failures

All 13 UI test failures share a single root cause. This is an infrastructure defect in `index.js`, not a frontend defect.

**Line 12 of `index.js`:**
```js
app.use(express.static('public'));
```

`express.static('public')` resolves the path `'public'` relative to `process.cwd()` -- the directory from which the Node process was started. The test runner starts the server from the parent directory (`calculator-test/`), so Express looks for `calculator-test/public/` (which does not exist) instead of `calculator-test/calculator-api/public/` (which does exist and contains `index.html`).

Because the static middleware finds no matching directory, it passes all requests through to the next middleware. For `GET /` requests from a browser, the next middleware is the Content-Type validation check (lines 15-19), which rejects the request with HTTP 400 `{"error":"Content-Type must be application/json"}`. This is exactly what the UI tester observed.

**The fix:** Replace the relative path with an absolute path derived from `__dirname`:

```js
app.use(express.static(require('path').join(__dirname, 'public')));
```

`__dirname` always resolves to the directory containing `index.js`, regardless of where the process was started. This is the standard Express pattern for static file serving.

**The frontend HTML (`public/index.html`) is correct.** All `data-testid` attributes are present and correctly spelled. The JavaScript logic follows the spec. The CSP meta tag is present. No changes to the HTML are required for the 13 test failures.

---

## Severity Breakdown (All Sources Combined)

### Critical: 0

No critical findings from any report.

### High: 1

| Source | Finding | Description | Action |
|--------|---------|-------------|--------|
| **Architect (Root Cause)** | Static file path resolution | `express.static('public')` resolves relative to `cwd`, not `__dirname`. Causes 100% UI test failure rate. | **FIX IN ITERATION 4** -- Developer must change line 12. |

The Adversary's High finding (#5: "express.static bypasses all API middleware") describes intentional, correct middleware ordering -- static files *should* bypass the Content-Type check and JSON parser. This is not a defect. However, the Adversary's concern about uncontrolled file serving from `public/` is valid and overlaps with CISO Finding #2. Both are deferred (see below).

### Medium: 9 (across CISO + Adversary)

**CISO Medium findings:**

| # | Finding | Disposition |
|---|---------|-------------|
| CISO #1 | `process.env.PORT` accepts non-numeric values | **FIX IN ITERATION 4.** Change to `const PORT = Number(process.env.PORT) || 3000;`. Low-effort, eliminates a class of startup failures. |
| CISO #2 | Static file serving scope expansion risk | **DEFERRED.** Procedural risk. Only `index.html` exists in `public/`. No technical enforcement needed this iteration. Document for future maintainers. |
| CISO #3 | CSP `script-src 'unsafe-inline'` | **DEFERRED.** Inherent trade-off of all-inline architecture. Mitigated by consistent `textContent` usage. Redesigning to external JS files is out of scope. |

**Adversary Medium findings:**

| # | Finding | Disposition |
|---|---------|-------------|
| ADV #1 | Frontend accepts floats (no `step="1"`) | **DEFERRED.** The frontend-instructions-3.md explicitly prohibited `step` attributes ("Do NOT add `min`, `max`, or `step` attributes"). Server validation catches all floats. Adding `step="1"` would be a spec violation. |
| ADV #2 | `Number("")` coercion fragility | **DEFERRED.** Current code correctly sends `null` for empty inputs. The `=== ''` guard is intentional and was prescribed in the frontend instructions. This is a maintenance note, not a defect. |
| ADV #3 | No client-side range validation | **DEFERRED.** Same as ADV #1 -- frontend instructions explicitly prohibited `min` and `max` attributes. Server validation catches all out-of-range values. |
| ADV #4 | `NaN`-to-`null` serialization | **DEFERRED.** Same category as ADV #2. Server correctly rejects `null` values. |
| ADV #6 | Relative URL / base tag injection | **DEFERRED.** CSP `default-src 'self'` mitigates this. Reverse proxy deployment is out of scope. |
| ADV #7 | Race condition on rapid clicks | **FIX IN ITERATION 4.** Add a guard variable to prevent concurrent `calculate()` invocations. The button-disable mechanism has a timing gap between click event and `btn.disabled = true`. A simple `if (isCalculating) return;` flag at the top of `calculate()` eliminates the race. |
| ADV #8 | Non-JSON response handling | **DEFERRED.** The `catch` block correctly prevents crashes. The misleading error message ("Network error" for non-JSON responses) is a UX imperfection, not a functional defect. Out of scope for this phase. |

### Low: 6 (across CISO + Adversary)

All Low findings are deferred. None require action in Iteration 4.

| Source | Finding | Disposition |
|--------|---------|-------------|
| CISO #4 | CSP `style-src https:` too broad | DEFERRED. No external CSS is loaded. Tightening the CSP to remove `https:` is a hardening measure for a future iteration. |
| CISO #5 | No security headers on static responses | DEFERRED. `X-Frame-Options`, `X-Content-Type-Options` are defense-in-depth. Not required for functional correctness. |
| CISO #6 | Static files bypass API middleware | DEFERRED. By design. Documented. |
| CISO #7 | Weak default `Cache-Control` | DEFERRED. Informational. |
| ADV #9 | Unicode visual spoofing via `textContent` | DEFERRED. Requires server compromise. Theoretical. |
| ADV #10 | CSP `unsafe-inline` (duplicate of CISO #3) | DEFERRED. Already covered above. |

**Persisting Low findings from Iteration 2 (all remain deferred):**

| Finding | Status |
|---------|--------|
| Missing `Allow` header on 405 | DEFERRED (RFC compliance, not functional) |
| Content-Type middleware masks 405 | DEFERRED (accepted design tradeoff) |
| `strict: false` accepted risk | DEFERRED (accepted) |
| Error pattern future-proofing | DEFERRED (informational) |

---

## What Must Be Fixed in Iteration 4

### Developer (index.js) -- 2 changes

1. **[HIGH] Fix static file path resolution (line 12).** Replace:
   ```js
   app.use(express.static('public'));
   ```
   With:
   ```js
   app.use(express.static(require('path').join(__dirname, 'public')));
   ```
   This is the single change that unblocks all 13 UI tests.

2. **[MEDIUM] Validate PORT environment variable (line 6).** Replace:
   ```js
   const PORT = process.env.PORT || 3000;
   ```
   With:
   ```js
   const PORT = Number(process.env.PORT) || 3000;
   ```
   This ensures PORT is always numeric. `Number('abc')` returns `NaN`, and `NaN || 3000` evaluates to `3000`.

### Frontend Developer (public/index.html) -- 1 change

1. **[MEDIUM] Add rapid-click guard.** Add a module-level boolean `isCalculating` (initialized to `false`) and check it at the top of the `calculate()` function. If `true`, return immediately. Set it to `true` before the fetch, and set it back to `false` in the `finally` block. This closes the timing gap between click event and `btn.disabled = true`.

---

## What Is Being Deferred (Low Severity or Accepted Architecture)

1. CSP `unsafe-inline` for scripts (CISO #3) -- inherent to inline-JS architecture
2. CSP `style-src https:` breadth (CISO #4) -- no external CSS loaded
3. Static file scope expansion (CISO #2, ADV #5) -- procedural, only `index.html` in `public/`
4. No HTTP security headers on static responses (CISO #5) -- defense-in-depth
5. Static files bypass API middleware ordering (CISO #6) -- by design
6. Weak `Cache-Control` defaults (CISO #7) -- informational
7. No client-side input validation: `step`, `min`, `max` (ADV #1, #3) -- explicitly prohibited by spec
8. `Number()` coercion fragility for empty/whitespace inputs (ADV #2, #4) -- current code is correct
9. Relative URL / base tag injection (ADV #6) -- mitigated by CSP
10. Non-JSON response handling UX (ADV #8) -- catch block prevents crashes
11. Unicode visual spoofing (ADV #9) -- theoretical, requires MITM
12. All Iteration 2 Low findings -- unchanged, accepted

---

## Decision: ITERATE

**Rationale:** 0/13 UI tests pass due to a single infrastructure defect in `index.js`. The fix is a one-line change. The API is fully functional (38/38). The frontend HTML is correct. No critical or high security vulnerabilities exist (the Adversary High finding is by-design behavior). Two additional small fixes (PORT validation, rapid-click guard) address Medium findings with minimal risk.

**Expected outcome of Iteration 4:** 38/38 API tests pass (no regression) and 13/13 UI tests pass (all unblocked by the static path fix).

**Instruction files produced:**
- `developer-instructions-4.md` -- Two exact line changes for `index.js`
- `frontend-instructions-4.md` -- One behavioral change for rapid-click guard

---

**End of Architect Evaluation -- Iteration 3**
