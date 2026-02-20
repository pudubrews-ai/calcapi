# Frontend Developer Instructions -- Iteration 4

**Date:** 2026-02-19
**Author:** Architect Agent
**Target:** Frontend Developer Agent
**Files you may touch:** `public/index.html` (one behavioral change only)
**Files you must NOT touch:** `index.js`, `package.json`, `.gitignore`, `README.md`, anything in `reports/`

---

## Context

Iteration 3 produced 0/13 UI test passes. All 13 failures are caused by a server-side defect in `index.js` (the static file path is resolved relative to `cwd` instead of `__dirname`). The Developer is fixing that in this iteration. Your HTML file is correctly structured and does not need changes for the 13 test failures.

You have one change to make: adding a rapid-click guard to the `calculate()` function. This addresses Adversary Finding #7 (race condition on rapid button clicks).

---

## Confirmation: What Is Correct and Must Not Change

The following elements of `public/index.html` are correct. Do NOT modify them:

1. All 9 `data-testid` attributes are present and correctly spelled.
2. The `loading-indicator` has `display: none` in CSS (hidden by default).
3. All `fetch` calls use relative URLs (`/add`, `/subtract`, `/multiply`, `/divide`).
4. All `fetch` calls include `Content-Type: application/json` header.
5. All `fetch` calls use `method: 'POST'`.
6. Success responses display in `result-display` via `textContent`.
7. Error responses display in `error-display` via `textContent`.
8. Network errors are caught and displayed in `error-display`.
9. All four buttons are disabled during a request and re-enabled in `finally`.
10. `loading-indicator` is shown during a request and hidden in `finally`.
11. `result-display` and `error-display` are cleared at the start of each request.
12. No `innerHTML` anywhere.
13. No external JavaScript.
14. CSP meta tag is present.
15. Viewport meta tag is present.
16. Error display (red background, dark red text) is visually distinct from result display (green background, dark green text).
17. The empty-string check (`inputA.value === '' ? null : Number(inputA.value)`) is correct.
18. No `step`, `min`, `max`, or `required` attributes on inputs (spec-compliant).

---

## Required Change 1 -- Add Rapid-Click Guard

### The defect

There is a timing gap between a button click event firing and the `btn.disabled = true` line executing (line 190). If two click events fire in rapid succession (e.g., a user double-clicks, or an automated script calls `btnAdd.click(); btnAdd.click()`), two `calculate()` invocations can run concurrently. Both send separate fetch requests. Their responses race to update the display. The second `finally` block may re-enable buttons while the first request is still in-flight, causing inconsistent UI state.

### The fix

Add a module-level guard variable `isCalculating` and check it at the entry of `calculate()`.

**Step 1:** Add this line immediately after the `const buttons = [...]` declaration (after line 172):

```js
var isCalculating = false;
```

**Step 2:** Add this guard as the very first line inside the `calculate()` function body (before the "Clear displays" comment):

```js
if (isCalculating) return;
isCalculating = true;
```

**Step 3:** In the `finally` block (currently lines 213-215), add `isCalculating = false;` before or after the existing statements:

```js
} finally {
  loadingIndicator.style.display = 'none';
  buttons.forEach(function(btn) { btn.disabled = false; });
  isCalculating = false;
}
```

### Why this works

The guard variable is checked synchronously at the top of `calculate()`. Even if two click events fire back-to-back in the same microtask queue, the first call sets `isCalculating = true` before yielding to `await fetch(...)`. The second call checks `isCalculating`, finds it `true`, and returns immediately. The `finally` block resets the flag, allowing the next legitimate click to proceed.

This is a belt-and-suspenders defense alongside the button-disable mechanism. The button-disable prevents most duplicate submissions; the guard variable covers the microtask timing edge case.

---

## What NOT to Do

- Do NOT change any `data-testid` attributes.
- Do NOT add `step`, `min`, `max`, or `required` attributes to the input fields.
- Do NOT add client-side validation (integer checks, range checks).
- Do NOT change the `textContent` usage to `innerHTML`.
- Do NOT change the fetch URLs, headers, or body format.
- Do NOT change the empty-string handling logic.
- Do NOT modify the CSP meta tag.
- Do NOT add external JavaScript files or CDN script links.
- Do NOT touch `index.js`, `package.json`, `.gitignore`, or `README.md`.

---

## Complete Diff

The changes are within the `<script>` block of `public/index.html`:

```diff
     const buttons = [btnAdd, btnSubtract, btnMultiply, btnDivide];
+    var isCalculating = false;

     const symbols = {
       add:      '+',
@@ -181,6 +182,8 @@
     };

     async function calculate(operation) {
+      if (isCalculating) return;
+      isCalculating = true;
       // Clear displays immediately
       resultDisplay.textContent = '';
       errorDisplay.textContent  = '';
@@ -213,6 +216,7 @@
       } finally {
         loadingIndicator.style.display = 'none';
         buttons.forEach(function(btn) { btn.disabled = false; });
+        isCalculating = false;
       }
     }
```

Three insertions. No deletions. No other changes.

---

## Verification Checklist

After making your change, verify:

- [ ] `var isCalculating = false;` exists after the `buttons` array declaration
- [ ] `if (isCalculating) return;` is the first line inside `calculate()`
- [ ] `isCalculating = true;` immediately follows the guard check
- [ ] `isCalculating = false;` is in the `finally` block
- [ ] All 9 `data-testid` attributes are still present and unchanged
- [ ] No `innerHTML` usage anywhere
- [ ] No `step`, `min`, `max`, or `required` attributes on inputs
- [ ] The loading indicator still has `display: none` in CSS
- [ ] The empty-string guard (`=== ''`) is unchanged
- [ ] No external JavaScript added

---

**End of Frontend Developer Instructions -- Iteration 4**
