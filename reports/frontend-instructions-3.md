# Frontend Developer Instructions -- V2 Build Iteration (Phase 1, Step 4)

**Date:** 2026-02-19
**Author:** Architect Agent
**Target:** Frontend Developer Agent
**Files you may touch:** `public/index.html` (create it, including the `public/` directory)
**Files you must NOT touch:** `index.js`, `package.json`, `.gitignore`, `README.md`, anything in `reports/`

---

## Context

You are building the web interface for a calculator REST API. The API server already exists and serves four POST endpoints (`/add`, `/subtract`, `/multiply`, `/divide`). A separate Developer is updating the server to serve static files from the `public/` directory. Your job is to create the single file `public/index.html` that provides the UI.

Read `calculator-app-spec.md` (root of the repo) for the authoritative spec. This instruction file tells you exactly what to build.

---

## File to Create

```
calculator-api/public/index.html
```

Create the `public/` directory if it does not exist. The entire web interface must be a single HTML file with inline CSS and inline JavaScript. No external JavaScript dependencies. You may use a CDN link for CSS styling (e.g., a classless CSS framework like Pico CSS or Water.css) but this is optional.

---

## Layout Requirements

The page must contain all of the following visible elements:

1. **A title** -- A heading that clearly identifies the app as a calculator (e.g., `<h1>Calculator</h1>`).

2. **Input field for `a`** -- A number input field. Must have a visible label indicating it is for value "a". Must accept negative numbers (e.g., `-10`). Must have `type="number"` so the browser provides a numeric input.

3. **Input field for `b`** -- A number input field. Must have a visible label indicating it is for value "b". Must accept negative numbers. Must have `type="number"`.

4. **Four operation buttons** -- Buttons labeled exactly:
   - **Add**
   - **Subtract**
   - **Multiply**
   - **Divide**

5. **Result display area** -- A container that shows successful operation results. Must be visually distinct from the error display area.

6. **Error display area** -- A container that shows error messages. Must be visually distinct from the result display area (e.g., different background color or text color -- red is conventional for errors).

7. **Loading indicator** -- An element that is visible while an API request is in flight and hidden at all other times. This can be a text label (e.g., "Calculating..."), a spinner, or any visible element. It MUST be hidden by default when the page loads and hidden after every response is received.

8. **Responsive layout** -- The interface must be usable on both desktop and mobile viewport widths. Use a `<meta name="viewport" content="width=device-width, initial-scale=1">` tag. Inputs and buttons should be large enough to tap on mobile.

---

## Required `data-testid` Attributes

The UI Tester (Playwright) locates elements exclusively by `data-testid` attributes. Every attribute listed below MUST be present on the corresponding element, spelled exactly as shown. No typos, no variations.

| Element | `data-testid` value | HTML element type |
|---|---|---|
| Input field for `a` | `input-a` | `<input>` |
| Input field for `b` | `input-b` | `<input>` |
| Add button | `btn-add` | `<button>` |
| Subtract button | `btn-subtract` | `<button>` |
| Multiply button | `btn-multiply` | `<button>` |
| Divide button | `btn-divide` | `<button>` |
| Result display area | `result-display` | `<div>` (or any block element) |
| Error display area | `error-display` | `<div>` (or any block element) |
| Loading indicator | `loading-indicator` | `<div>` (or any block/inline element) |

### How to apply `data-testid`

```html
<input type="number" data-testid="input-a" />
<input type="number" data-testid="input-b" />
<button data-testid="btn-add">Add</button>
<button data-testid="btn-subtract">Subtract</button>
<button data-testid="btn-multiply">Multiply</button>
<button data-testid="btn-divide">Divide</button>
<div data-testid="result-display"></div>
<div data-testid="error-display"></div>
<div data-testid="loading-indicator"></div>
```

Do NOT rely on IDs, class names, or element types for testability. The `data-testid` attributes are the sole contract with the UI Tester.

---

## Behavior Requirements

### Clicking an operation button

When the user clicks any of the four operation buttons:

1. **Clear both display areas** -- Set the text content of `result-display` to empty and the text content of `error-display` to empty. This must happen immediately when the button is clicked, before the fetch call.

2. **Show the loading indicator** -- Make the `loading-indicator` element visible (e.g., set `style.display = 'block'` or remove a `hidden` attribute). It must be visible for the entire duration of the API request.

3. **Disable all four operation buttons** -- Set the `disabled` property to `true` on all four buttons (`btn-add`, `btn-subtract`, `btn-multiply`, `btn-divide`). This prevents duplicate submissions while a request is in flight.

4. **Send a POST request** to the corresponding endpoint:
   - `btn-add` sends to `/add`
   - `btn-subtract` sends to `/subtract`
   - `btn-multiply` sends to `/multiply`
   - `btn-divide` sends to `/divide`

5. **Read input values** from `input-a` and `input-b`. Parse them as numbers using `Number()` or `parseFloat()` and send them in the JSON body as `a` and `b`. Do NOT pre-validate the inputs in JavaScript -- send whatever the user typed and let the server validate. The server returns specific error messages for invalid inputs, and those messages must be displayed in the error area.

   IMPORTANT: Send the raw numeric values. If the input field is empty, send the value as-is (it will be `NaN` after `Number('')`, which serializes to `null` in JSON -- the server will return the appropriate validation error). Do NOT convert to integer client-side. Do NOT reject non-integer values client-side. Let the server do all validation.

6. **On success (HTTP 200)** -- Display the result in `result-display`. The display must include at minimum the operation name and the numeric result. A clear format is:
   ```
   <operation>: <a> <symbol> <b> = <result>
   ```
   For example: `addition: 10 + 5 = 15` or `division: 10 / 3 = 3`. You may also show just the essential fields from the response object, but the result number MUST be visible in `result-display`.

7. **On error (HTTP 400 or any non-200 status)** -- Parse the response JSON and display the `error` field value in `error-display`. Do NOT display error messages in `result-display`. Example: the server returns `{ "error": "Division by zero is not allowed" }` -- display `Division by zero is not allowed` in `error-display`.

8. **On network error (server unreachable, fetch throws)** -- Display a message in `error-display` indicating the network error. Example text: `Network error: Could not reach the server` or `An error occurred. Please try again.` The exact wording is not spec'd, but it MUST appear in `error-display` and MUST NOT appear in `result-display`.

9. **After the response (or error) is received:**
   - **Hide the loading indicator** -- Make `loading-indicator` invisible again.
   - **Re-enable all four operation buttons** -- Set `disabled` to `false` on all four buttons.
   - These two actions must happen regardless of whether the response was a success, an error, or a network failure. Use a `finally` block in your promise chain or try/catch to guarantee this.

### Loading indicator specifics

- **Default state on page load:** Hidden. The `loading-indicator` must NOT be visible when the page first loads. Use `style="display: none;"` in the HTML or set it via CSS.
- **During a request:** Visible. Must become visible immediately when a button is clicked and before the fetch call starts.
- **After a response:** Hidden. Must become hidden after the response is processed (success or error) or after a network error is caught.
- The Playwright UI Tester will check visibility of this element. Use `display: none` / `display: block` (or `display: inline`, `display: flex`, etc.) to toggle visibility. Do NOT use `visibility: hidden` or `opacity: 0` as these may not be detected as "hidden" by Playwright's visibility checks.

### Button disable/enable specifics

- All four buttons must be disabled simultaneously when any one is clicked.
- All four buttons must be re-enabled simultaneously after the response.
- Use the `disabled` HTML attribute/property: `button.disabled = true` / `button.disabled = false`.
- Playwright will check the `disabled` attribute to verify buttons are disabled during requests.

---

## API Communication Requirements

### Relative URLs ONLY

All fetch calls MUST use relative URLs:
- `/add` (correct)
- `/subtract` (correct)
- `/multiply` (correct)
- `/divide` (correct)

Do NOT use absolute URLs like `http://localhost:3000/add`. The server may run on any port, and absolute URLs would break when the port changes.

### Request format

Every fetch call must:

1. Use the `POST` method.
2. Include the header `Content-Type: application/json`.
3. Send a JSON body with `a` and `b` fields.

Example fetch call:
```js
fetch('/add', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ a: Number(inputA.value), b: Number(inputB.value) })
})
```

### Response handling

- Parse the response body as JSON using `response.json()`.
- Check `response.ok` (true for 200, false for 400) to determine success vs error.
- On success: read `data.operation`, `data.a`, `data.b`, `data.result` from the parsed JSON.
- On error: read `data.error` from the parsed JSON.

---

## Security Requirements (from CISO and Adversary pre-build reviews)

### XSS Prevention (CRITICAL)

When displaying API responses in the result or error areas, you MUST use `textContent` (or `innerText`), NOT `innerHTML`. The server echoes user input values (`a` and `b`) in its response. If a future bug or proxy modifies the response to include HTML/script content, using `innerHTML` would execute it.

```js
// CORRECT -- safe from XSS
resultDisplay.textContent = `addition: ${data.a} + ${data.b} = ${data.result}`;

// WRONG -- vulnerable to XSS
resultDisplay.innerHTML = `addition: ${data.a} + ${data.b} = ${data.result}`;
```

This applies to ALL places where API response data is rendered into the DOM: `result-display`, `error-display`, and any other element that shows server data.

### Input fields

- Use `type="number"` on both input fields. This provides browser-level constraints (numeric keyboard on mobile, rejection of non-numeric characters in some browsers).
- Do NOT add `min`, `max`, or `step` attributes that would prevent the user from entering values the server should validate. Let the server enforce range limits and return its own error messages.
- Do NOT add `required` attributes. If the user submits empty fields, the server returns `"Both a and b are required"` -- that message must be displayed, not a browser validation popup.

### No external JavaScript

Do not load any JavaScript from CDNs or external sources. All JavaScript must be inline in the HTML file within a `<script>` tag. This eliminates supply chain attack risk and removes CSP complexity.

CDN CSS is permitted (for styling only) but not required. If you use CDN CSS, use a well-known library (e.g., Pico CSS, Water.css, Simple.css).

### Content Security Policy

Add the following `<meta>` tag in the `<head>` to set a basic Content Security Policy:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline';">
```

This allows:
- `default-src 'self'` -- Only load resources from the same origin by default.
- `style-src 'self' 'unsafe-inline' https:` -- Allow inline styles and CDN CSS over HTTPS.
- `script-src 'self' 'unsafe-inline'` -- Allow inline scripts (needed since all JS is inline).

---

## Complete HTML Structure Template

Use this as a structural guide. You may adjust styling, element order, and class names, but the `data-testid` attributes and behavioral requirements are non-negotiable.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline';">
  <title>Calculator</title>
  <!-- Optional: CDN CSS link here -->
  <style>
    /* Your inline CSS here */
    /* Ensure error-display is visually distinct (e.g., red text) */
    /* Ensure result-display is visually distinct (e.g., green text or neutral) */
    /* Ensure loading-indicator is hidden by default */
  </style>
</head>
<body>
  <h1>Calculator</h1>

  <!-- Input fields -->
  <label for="input-a">a:</label>
  <input type="number" id="input-a" data-testid="input-a">

  <label for="input-b">b:</label>
  <input type="number" id="input-b" data-testid="input-b">

  <!-- Operation buttons -->
  <button data-testid="btn-add">Add</button>
  <button data-testid="btn-subtract">Subtract</button>
  <button data-testid="btn-multiply">Multiply</button>
  <button data-testid="btn-divide">Divide</button>

  <!-- Loading indicator (hidden by default) -->
  <div data-testid="loading-indicator" style="display: none;">Calculating...</div>

  <!-- Result display -->
  <div data-testid="result-display"></div>

  <!-- Error display -->
  <div data-testid="error-display"></div>

  <script>
    // Your inline JavaScript here
    // See Behavior Requirements section above for full logic
  </script>
</body>
</html>
```

---

## JavaScript Implementation Guide

The following is the complete logic you must implement in the `<script>` tag. Follow this exactly.

```
1. Get references to all elements by data-testid:
   - const inputA = document.querySelector('[data-testid="input-a"]');
   - const inputB = document.querySelector('[data-testid="input-b"]');
   - const btnAdd = document.querySelector('[data-testid="btn-add"]');
   - const btnSubtract = document.querySelector('[data-testid="btn-subtract"]');
   - const btnMultiply = document.querySelector('[data-testid="btn-multiply"]');
   - const btnDivide = document.querySelector('[data-testid="btn-divide"]');
   - const resultDisplay = document.querySelector('[data-testid="result-display"]');
   - const errorDisplay = document.querySelector('[data-testid="error-display"]');
   - const loadingIndicator = document.querySelector('[data-testid="loading-indicator"]');

2. Define an array of all four buttons for bulk enable/disable:
   - const buttons = [btnAdd, btnSubtract, btnMultiply, btnDivide];

3. Define a single async function to handle all operations:
   - async function calculate(operation)
   - operation is one of: 'add', 'subtract', 'multiply', 'divide'
   - The function maps operation to endpoint: `/${operation}`
   - The function maps operation to display symbol:
     - 'add' -> '+'
     - 'subtract' -> '-'
     - 'multiply' -> '*' (or multiplication sign)
     - 'divide' -> '/'

4. Inside calculate(operation):
   a. Clear displays: resultDisplay.textContent = ''; errorDisplay.textContent = '';
   b. Show loading: loadingIndicator.style.display = 'block';
   c. Disable all buttons: buttons.forEach(btn => btn.disabled = true);
   d. Read inputs: const a = Number(inputA.value); const b = Number(inputB.value);
   e. try {
        const response = await fetch(`/${operation}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ a, b })
        });
        const data = await response.json();
        if (response.ok) {
          resultDisplay.textContent = `${data.operation}: ${data.a} ${symbol} ${data.b} = ${data.result}`;
        } else {
          errorDisplay.textContent = data.error;
        }
      } catch (err) {
        errorDisplay.textContent = 'Network error: Could not reach the server';
      } finally {
        loadingIndicator.style.display = 'none';
        buttons.forEach(btn => btn.disabled = false);
      }

5. Attach click handlers:
   - btnAdd.addEventListener('click', () => calculate('add'));
   - btnSubtract.addEventListener('click', () => calculate('subtract'));
   - btnMultiply.addEventListener('click', () => calculate('multiply'));
   - btnDivide.addEventListener('click', () => calculate('divide'));
```

### Critical implementation notes

- The `finally` block is MANDATORY. It ensures buttons are re-enabled and loading is hidden even if the fetch throws (network error) or response.json() throws (malformed response).
- Use `textContent` for ALL DOM updates. Never use `innerHTML`.
- The `Number()` conversion for input values is intentional. If the input is empty, `Number('')` returns `0`... Actually, no: `Number('')` returns `0`, which IS a valid integer, so the server will accept it. If you want the server to report "Both a and b are required" for empty inputs, you need to handle empty string specially. Here is the correct approach:

```js
const a = inputA.value === '' ? null : Number(inputA.value);
const b = inputB.value === '' ? null : Number(inputB.value);
```

When `inputA.value` is `''` (empty), send `null` as the value. `JSON.stringify({ a: null, b: 5 })` produces `{"a":null,"b":5}`, and the server will respond with `"Both a and b must be integers"` (Rule 4, since the key is present but the value is not an integer). This is the correct behavior.

When `inputA.value` is a valid number string like `"10"`, `Number("10")` returns `10`, which is correct.

When `inputA.value` is a non-numeric string (this should not happen with `type="number"` inputs, but handle it defensively), `Number("abc")` returns `NaN`, and `JSON.stringify({ a: NaN })` produces `{"a":null}`, which triggers the server's Rule 4 error. This is correct.

---

## What NOT to Do

- Do NOT pre-validate inputs in JavaScript. No checking for integers, no checking for range, no checking for empty fields with `alert()` or browser validation. Send everything to the server and display the server's error messages.
- Do NOT add `required`, `min`, `max`, or `step` attributes to the input fields.
- Do NOT use `innerHTML` anywhere. Always use `textContent`.
- Do NOT use absolute URLs (`http://localhost:3000/...`).
- Do NOT load any external JavaScript libraries (jQuery, Axios, React, etc.).
- Do NOT create any additional files beyond `public/index.html`.
- Do NOT touch `index.js`, `package.json`, `.gitignore`, or `README.md`.

---

## Verification Checklist

After creating `public/index.html`, verify:

- [ ] The file is at `calculator-api/public/index.html`
- [ ] All 9 `data-testid` attributes are present and spelled exactly as specified
- [ ] `loading-indicator` has `style="display: none;"` (hidden by default)
- [ ] All fetch calls use relative URLs (`/add`, `/subtract`, `/multiply`, `/divide`)
- [ ] All fetch calls include `Content-Type: application/json` header
- [ ] All fetch calls use `method: 'POST'`
- [ ] Success responses are displayed in `result-display` using `textContent`
- [ ] Error responses are displayed in `error-display` using `textContent`
- [ ] Network errors are caught and displayed in `error-display`
- [ ] All four buttons are disabled during a request
- [ ] All four buttons are re-enabled after a response (in a `finally` block)
- [ ] `loading-indicator` is shown during a request and hidden after (in a `finally` block)
- [ ] `result-display` and `error-display` are cleared when a new request begins
- [ ] No `innerHTML` is used anywhere
- [ ] No external JavaScript is loaded
- [ ] `<meta name="viewport">` tag is present for mobile responsiveness
- [ ] Content Security Policy `<meta>` tag is present
- [ ] Error display area is visually distinct from result display area
