# Developer Instructions -- Iteration 4

**Date:** 2026-02-19
**Author:** Architect Agent
**Target:** Developer Agent
**Files you may touch:** `index.js` (two line changes only)
**Files you must NOT touch:** `public/index.html`, `package.json`, `.gitignore`, `README.md`, anything in `reports/`

---

## Context

Iteration 3 produced 38/38 API test passes and 0/13 UI test passes. All 13 UI failures share a single root cause: `express.static('public')` resolves the path relative to `process.cwd()`, but the server is started from the parent directory (`calculator-test/`), so Express looks for `calculator-test/public/` instead of `calculator-test/calculator-api/public/`. The fix is to resolve the path relative to `__dirname` instead.

A second fix addresses the CISO finding that `process.env.PORT` is not validated as numeric.

You are making exactly two line changes. Nothing else.

---

## Required Change 1 -- Fix Static File Path Resolution

### The defect

**Line 12 of `index.js`** currently reads:
```js
app.use(express.static('public'));
```

`express.static('public')` resolves the string `'public'` relative to `process.cwd()` at the time the middleware is created. When the server is started from any directory other than `calculator-api/`, this path does not resolve to the correct `public/` directory. The `public/index.html` file exists at `calculator-api/public/index.html`, but Express never finds it because it is looking in `<cwd>/public/`.

When the static middleware finds no file, it calls `next()`, passing the request to the Content-Type validation middleware (line 15), which rejects all non-JSON requests with HTTP 400. This is why `GET /` returns `{"error":"Content-Type must be application/json"}` instead of serving the HTML page.

### The fix

Replace line 12:

**Old:**
```js
app.use(express.static('public'));
```

**New:**
```js
app.use(express.static(require('path').join(__dirname, 'public')));
```

`__dirname` is always the directory containing the currently executing script (`index.js`), regardless of where the Node process was started. `require('path').join(__dirname, 'public')` produces an absolute path to the `public/` directory adjacent to `index.js`.

### Do NOT add a `require` statement at the top of the file

Use `require('path')` inline. The `path` module is a Node.js built-in (zero-cost require, no npm dependency). Inlining it keeps the change to a single line.

### Verification

After this change, starting the server from ANY directory should serve `public/index.html` at `GET /`:

```bash
# From calculator-test/ (the parent directory)
cd /path/to/calculator-test
node calculator-api/index.js
# GET http://localhost:3000/ should return the HTML page, not a 400 error

# From calculator-api/ (the project directory)
cd /path/to/calculator-test/calculator-api
node index.js
# GET http://localhost:3000/ should return the HTML page
```

---

## Required Change 2 -- Validate PORT as Numeric

### The defect

**Line 6 of `index.js`** currently reads:
```js
const PORT = process.env.PORT || 3000;
```

`process.env.PORT` is always a string. If set to a non-numeric value (e.g., `PORT=abc`), Node.js interprets non-numeric strings as Unix socket paths, causing unexpected behavior. If set to an out-of-range number (e.g., `PORT=99999`), `app.listen()` throws an unhandled error.

### The fix

Replace line 6:

**Old:**
```js
const PORT = process.env.PORT || 3000;
```

**New:**
```js
const PORT = Number(process.env.PORT) || 3000;
```

`Number('abc')` returns `NaN`. `NaN || 3000` evaluates to `3000` (safe fallback).
`Number('8080')` returns `8080`. `8080 || 3000` evaluates to `8080` (correct).
`Number('')` returns `0`. `0 || 3000` evaluates to `3000` (safe fallback, same as before).
`Number(undefined)` returns `NaN`. `NaN || 3000` evaluates to `3000` (same as before when env var is unset).

---

## What NOT to Do

- Do NOT change any validation logic, route handlers, error handlers, or middleware ordering.
- Do NOT change any other lines of `index.js` beyond lines 6 and 12.
- Do NOT add any new npm dependencies.
- Do NOT modify `public/index.html`.
- Do NOT add a `const path = require('path');` at the top of the file. Use `require('path')` inline on line 12.
- Do NOT change the `module.exports = app;` line.
- Do NOT add any new middleware, routes, headers, or security features.

---

## Complete Diff

```diff
--- a/calculator-api/index.js
+++ b/calculator-api/index.js
@@ -3,10 +3,10 @@
 const express = require('express');
 const app = express();

-const PORT = process.env.PORT || 3000;
+const PORT = Number(process.env.PORT) || 3000;

 // 1. Disable X-Powered-By header (must be first)
 app.disable('x-powered-by');

 // 2. Serve static files from public/ (BEFORE Content-Type middleware)
-app.use(express.static('public'));
+app.use(express.static(require('path').join(__dirname, 'public')));
```

That is the entire change. Two lines. Nothing else.

---

## Verification Checklist

After making your changes, verify:

- [ ] Line 6 reads: `const PORT = Number(process.env.PORT) || 3000;`
- [ ] Line 12 reads: `app.use(express.static(require('path').join(__dirname, 'public')));`
- [ ] No other lines were changed
- [ ] `module.exports = app;` is still the last line
- [ ] No new `require` statements were added at the top of the file
- [ ] No new dependencies in `package.json`

---

**End of Developer Instructions -- Iteration 4**
