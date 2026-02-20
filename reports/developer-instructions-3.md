# Developer Instructions -- V2 Build Iteration (Phase 1, Step 4)

**Date:** 2026-02-19
**Author:** Architect Agent
**Target:** Developer Agent
**Files you may touch:** `index.js`, `package.json`, `.gitignore`, `README.md`
**Files you must NOT touch:** Anything in `public/`, any test files, any report files

---

## Context

A working V1 `index.js` already exists and passes all 35 API tests. You must make exactly the changes described below. Do NOT alter any existing API endpoint logic, validation logic, route handlers, error handlers, or middleware ordering unless explicitly instructed. The existing API behavior must remain identical after your changes.

Read `calculator-app-spec.md` (root of the repo) for the authoritative spec. This instruction file tells you exactly what to change.

---

## Required Change 1 -- Dynamic PORT from Environment Variable

### Current behavior (BROKEN)

Line 124 of `index.js`:
```js
app.listen(3000, () => {
  console.log('Calculator API running on port 3000');
});
```

The port is hardcoded to `3000`. The spec requires reading it from the environment.

### Required behavior

Replace the hardcoded port with a dynamic port read from `process.env.PORT`, defaulting to `3000` if the environment variable is not set.

Add this line near the top of the file (after the `app` declaration, before any middleware):
```js
const PORT = process.env.PORT || 3000;
```

Then change the `app.listen` block at the bottom of the file to:
```js
app.listen(PORT, () => {
  console.log(`Calculator API running on port ${PORT}`);
});
```

### Startup log message (EXACT)

The startup log must be exactly:
```
Calculator API running on port <PORT>
```
where `<PORT>` is the actual numeric port value (e.g., `Calculator API running on port 3000` or `Calculator API running on port 4567`).

- Use a template literal to interpolate the variable.
- No extra whitespace, no trailing newline beyond what `console.log` adds.
- No prefix (no `[INFO]`, no timestamp).

---

## Required Change 2 -- Serve Static Files from `public/`

### Current behavior (BROKEN)

The server does not serve any static files. There is no `express.static` middleware.

### Required behavior

Add Express static file serving middleware so that files in the `public/` directory are served at the root path. This line must be placed AFTER the `app.disable('x-powered-by')` line and BEFORE the Content-Type validation middleware.

Add this line at line 8 (after `app.disable('x-powered-by');` and before the Content-Type middleware):
```js
app.use(express.static('public'));
```

### Why it must go before the Content-Type middleware

The Content-Type validation middleware currently rejects ALL requests that do not have `Content-Type: application/json`. If `express.static` is placed after the Content-Type middleware, browser requests for `index.html` (which have no Content-Type or `text/html`) will be rejected with a 400 error. Static file serving must be registered first so that requests for static files are handled before any API middleware runs.

### Exact placement

The middleware order in `index.js` must be:

1. `app.disable('x-powered-by')` (already exists)
2. `app.use(express.static('public'))` (NEW -- add this)
3. Content-Type validation middleware (already exists)
4. `app.use(express.json({ limit: '1kb', strict: false }))` (already exists)
5. JSON parse error handler (already exists)
6. Route handlers (already exist)
7. 405 handlers (already exist)
8. 404 catch-all (already exists)
9. Final error handler (already exists)

Do NOT change the relative order of any existing middleware. Only insert the `express.static` line in the position specified above.

### The `public/` directory does not exist yet

The Frontend Developer will create `public/index.html` separately. Your job is only to add the `express.static` middleware. Express handles a missing `public/` directory gracefully (it simply serves no files), so this is safe to add before the directory exists.

---

## Required Change 3 -- Update `.gitignore`

### Current content

The current `.gitignore` contains:
```
node_modules/
reports/
```

### Required content

The spec mandates that `.gitignore` must exclude `node_modules`, `.env`, `*.log`, and `.DS_Store`. The existing `reports/` exclusion must be kept (it is project-specific).

Replace the entire `.gitignore` with:
```
node_modules/
.env
*.log
.DS_Store
reports/
```

- `node_modules/` MUST be present. This directory must never be committed.
- `.env` prevents accidental commit of environment variables (e.g., PORT overrides, future secrets).
- `*.log` prevents commit of any log files.
- `.DS_Store` prevents commit of macOS filesystem metadata.
- `reports/` is kept from the existing file.

---

## Required Change 4 -- Update README.md

Update `README.md` to document the web interface. The README must include:

1. A section explaining that the app includes a web interface accessible at `http://localhost:<PORT>/` (or whatever port the server is running on).
2. A note that the web interface is a single-page HTML file served statically from `public/index.html`.
3. How to start the server: `npm start` or `PORT=4567 npm start` to use a custom port.
4. That the API endpoints remain at `/add`, `/subtract`, `/multiply`, `/divide` (POST only).
5. Do NOT remove any existing API documentation in the README. Add the web interface section alongside it.

If no `README.md` exists, create one with the above content plus a brief description of the project ("A REST API calculator with a web interface").

---

## What NOT to Do

- Do NOT change any validation logic (the `validate` function, Content-Type middleware, JSON parse error handler).
- Do NOT change any route handler logic (`/add`, `/subtract`, `/multiply`, `/divide`).
- Do NOT change the 405, 404, or 500 error handlers.
- Do NOT change the `express.json({ limit: '1kb', strict: false })` configuration.
- Do NOT add any new npm dependencies. The `package.json` `dependencies` section must remain unchanged (only `express`).
- Do NOT create or modify anything in the `public/` directory.
- Do NOT add rate limiting, CORS headers, helmet, or any other middleware not specified above. Those are out of scope for this iteration.
- Do NOT change the `module.exports = app;` line at the bottom of the file.

---

## Security Requirements (from CISO and Adversary pre-build reviews)

The following security measures are already correctly implemented in the existing `index.js`. Do NOT remove or weaken them:

1. **`app.disable('x-powered-by')`** -- Prevents server fingerprinting via the `X-Powered-By` header. Already on line 7. Keep it.

2. **Body size limit** -- `express.json({ limit: '1kb' })` is already set. This mitigates payload size abuse (CISO Finding 2) and JSON parsing DoS (CISO Finding 13). Keep it exactly as-is.

3. **Content-Type check before body parsing** -- The dedicated Content-Type middleware on lines 10-15 fires before `express.json()`. This satisfies the spec's validation rule ordering (Adversary Finding 18). Keep it.

4. **Custom JSON parse error handler** -- The error handler on lines 21-29 returns the spec-mandated `"Invalid JSON body"` message instead of Express's default verbose error. This prevents information leakage (CISO Finding 7) and satisfies Adversary Finding 5. Keep it.

5. **Final 500 error handler** -- The catch-all error handler on lines 119-121 returns `"Internal server error"` without a stack trace. This prevents stack trace leakage. Keep it.

6. **Prototype pollution defense** -- The `validate` function destructures only `a` and `b` from the body. Extra fields are ignored. This addresses CISO Finding 10. Keep it.

7. **`strict: false` on `express.json()`** -- This allows bare JSON primitives (`42`, `"hello"`, `null`) to be parsed rather than rejected by Express, ensuring the spec's validation rule ordering is correct (bare primitives pass Rule 2 and fail at Rule 3, per Adversary Finding 16). Keep it.

### New security consideration for static file serving

The `express.static('public')` middleware you are adding will serve any file in the `public/` directory. This is safe as long as:
- No sensitive files are placed in `public/` (the Frontend Developer is instructed to only create `index.html` there).
- The `public/` directory is not a symlink to a sensitive location.

You do not need to add any additional security middleware for static file serving in this iteration.

---

## Verification Checklist

After making your changes, verify:

- [ ] `const PORT = process.env.PORT || 3000;` exists near the top of the file
- [ ] `app.use(express.static('public'));` is placed after `app.disable('x-powered-by')` and before the Content-Type middleware
- [ ] `app.listen(PORT, ...)` uses the `PORT` variable, not a hardcoded `3000`
- [ ] The startup log uses a template literal: `` `Calculator API running on port ${PORT}` ``
- [ ] `module.exports = app;` is still the last line
- [ ] `.gitignore` contains `node_modules/`, `.env`, `*.log`, `.DS_Store`, and `reports/`
- [ ] No existing API logic, validation, or middleware ordering has been altered
- [ ] No new dependencies have been added to `package.json`
