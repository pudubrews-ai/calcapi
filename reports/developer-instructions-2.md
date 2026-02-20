# Developer Instruction Set #2 -- Calculator API Iteration 2

**Date:** 2026-02-18
**Author:** Architect Agent (Step 12 -- Produce Iteration 2 Instructions)
**Companion spec:** `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-api/calculator-app-spec.md`
**Iteration 1 code:** `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-api/index.js`

---

## How to Read This Document

You built the app in Iteration 1. This document describes exactly four changes to `index.js`. Apply them in the order listed. Do not change anything else. The existing middleware, validation logic (Rules 1-5), route computations, and server startup are correct and must remain unchanged.

---

## Fix 1: Remove Division-by-Zero Check from `validate()` and Move It into the `/divide` Route Handler

**Priority:** Critical
**What it fixes:** Adversary findings #1-4 (trailing-slash and case-insensitive routing bypasses the `path === '/divide'` check, allowing `0/0` and `-N/0` to return `null` results with HTTP 200)

### Step 1A: Remove Rule 6 from the `validate()` function

Delete these lines from the `validate()` function (currently lines 51-54):

```javascript
  // Rule 6: Division by zero (only for /divide)
  if (path === '/divide' && b === 0) {
    return 'Division by zero is not allowed';
  }
```

After removal, the `validate()` function ends like this:

```javascript
  // Rule 5: Both a and b must be in range [-1000000, 1000000] inclusive
  if (a < -1000000 || a > 1000000 || b < -1000000 || b > 1000000) {
    return 'Values must be between -1000000 and 1000000';
  }

  return null; // No error
}
```

### Step 1B: Remove the `path` parameter from `validate()`

The function signature changes from:

```javascript
function validate(body, path) {
```

to:

```javascript
function validate(body) {
```

### Step 1C: Update all four route handler calls to `validate()`

Every route handler currently passes two arguments: `validate(req.body, req.path)`. Change each one to pass only one argument: `validate(req.body)`.

The four calls (in `/add`, `/subtract`, `/multiply`, `/divide`) all become:

```javascript
  const error = validate(req.body);
```

### Step 1D: Add the division-by-zero check directly inside the `/divide` route handler

Place it AFTER the `validate()` call and BEFORE the computation. The `/divide` handler becomes:

```javascript
app.post('/divide', (req, res) => {
  const error = validate(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const { a, b } = req.body;
  if (b === 0) {
    return res.status(400).json({ error: 'Division by zero is not allowed' });
  }
  const result = Math.floor(a / b);
  res.status(200).json({ operation: 'division', a, b, result });
});
```

The key difference: the check `if (b === 0)` runs inside the route handler itself, not inside a shared function that compares path strings. Express has already matched the route by the time the handler runs, so there is no path-string comparison to exploit.

Note that `b` is extracted via destructuring BEFORE the zero check. This is safe because `validate()` has already confirmed `req.body` is a non-null object with integer `a` and `b` fields.

---

## Fix 2: Add a Catch-All 404 Handler

**Priority:** Medium
**What it fixes:** Adversary finding #5, CISO finding #1 (undefined routes return Express default HTML instead of JSON)

Add the following middleware AFTER all four `app.post()` route definitions and BEFORE `app.listen()`:

```javascript
// Catch-all 404 handler (after all routes)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});
```

This catches any request that does not match a defined route and returns a JSON 404 response instead of Express's default HTML.

---

## Fix 3: Add 405 Method Not Allowed Handlers for Defined Paths

**Priority:** Medium
**What it fixes:** Adversary finding #6 (non-POST methods on defined paths return inconsistent responses)

For each of the four defined paths, add an `app.all()` handler that returns 405 for any non-POST method. Place these AFTER the four `app.post()` routes and BEFORE the catch-all 404 handler from Fix 2.

```javascript
// 405 Method Not Allowed for defined paths (after POST routes, before 404 handler)
app.all('/add', (req, res) => {
  res.status(405).json({ error: 'Method not allowed' });
});
app.all('/subtract', (req, res) => {
  res.status(405).json({ error: 'Method not allowed' });
});
app.all('/multiply', (req, res) => {
  res.status(405).json({ error: 'Method not allowed' });
});
app.all('/divide', (req, res) => {
  res.status(405).json({ error: 'Method not allowed' });
});
```

**Why this works:** Express matches routes in registration order. A `POST /add` request matches the `app.post('/add', ...)` handler first and never reaches the `app.all('/add', ...)` handler. A `GET /add` request does NOT match `app.post('/add', ...)`, falls through, and matches `app.all('/add', ...)`, which returns 405.

---

## Fix 4: Add a Final Error Handler

**Priority:** Low
**What it fixes:** CISO finding #2 (stack trace leakage via Express default error handler when `NODE_ENV !== 'production'`)

Add a final error-handling middleware at the very end of the middleware chain -- AFTER the 404 handler from Fix 2, and BEFORE `app.listen()`. This is the last `app.use()` call before the server starts.

```javascript
// Final error handler (prevents stack trace leakage)
app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Internal server error' });
});
```

**Important:** This function MUST have exactly four parameters `(err, req, res, next)` -- Express identifies error-handling middleware by its four-argument signature. Even though `next` is not called, it must be present in the parameter list.

---

## Complete Middleware and Route Registration Order (Updated)

After all four fixes, the registration order in `index.js` is:

```
 1. app.disable('x-powered-by')
 2. app.use(contentTypeMiddleware)              -- unchanged
 3. app.use(express.json({ limit: '1kb', strict: false }))  -- unchanged
 4. app.use(jsonParseErrorHandler)              -- unchanged
 5. app.post('/add', handler)                   -- updated: validate(req.body) (no path arg)
 6. app.post('/subtract', handler)              -- updated: validate(req.body) (no path arg)
 7. app.post('/multiply', handler)              -- updated: validate(req.body) (no path arg)
 8. app.post('/divide', handler)                -- updated: validate(req.body) + inline b===0 check
 9. app.all('/add', 405handler)                 -- NEW (Fix 3)
10. app.all('/subtract', 405handler)            -- NEW (Fix 3)
11. app.all('/multiply', 405handler)            -- NEW (Fix 3)
12. app.all('/divide', 405handler)              -- NEW (Fix 3)
13. app.use(404handler)                         -- NEW (Fix 2)
14. app.use(finalErrorHandler)                  -- NEW (Fix 4)
15. app.listen(3000)
```

---

## New Verbatim Error Messages (in addition to existing ones)

```
"Not found"
"Method not allowed"
"Internal server error"
```

Copy these strings exactly. These join the six existing error messages from Iteration 1 (which remain unchanged).

---

## Summary Checklist

Before declaring the build complete, verify:

- [ ] The `validate()` function no longer accepts a `path` parameter
- [ ] The `validate()` function no longer contains any `path === '/divide'` check
- [ ] All four route handlers call `validate(req.body)` with one argument (no second argument)
- [ ] The `/divide` route handler checks `if (b === 0)` AFTER `validate()` and BEFORE `Math.floor(a / b)`
- [ ] The `/divide` route handler returns `{ "error": "Division by zero is not allowed" }` with status 400 when `b === 0`
- [ ] Four `app.all()` handlers exist for `/add`, `/subtract`, `/multiply`, `/divide` returning 405
- [ ] The `app.all()` handlers are registered AFTER the `app.post()` handlers
- [ ] A catch-all 404 middleware exists and returns `{ "error": "Not found" }` with status 404
- [ ] The 404 handler is registered AFTER the `app.all()` handlers
- [ ] A final error handler with four parameters `(err, req, res, next)` exists and returns `{ "error": "Internal server error" }` with status 500
- [ ] The final error handler is the last `app.use()` before `app.listen()`
- [ ] All existing middleware, validation (Rules 1-5), computations, and error messages are unchanged
- [ ] No new files were created -- all changes are in `index.js`

---

**End of Developer Instruction Set #2**
