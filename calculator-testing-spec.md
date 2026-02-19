# Calculator API — Black Box Testing Spec

## Overview

This document is for a **testing agent only**. Your job is to verify the calculator API behaves correctly by making HTTP requests and checking the responses. You have no access to the source code and should not need it. All verification is done purely through inputs and outputs.

> The server should be running at `http://localhost:3000` before tests begin.

---

## Ground Rules

- All requests must use `POST`
- All requests must include the header `Content-Type: application/json`
- All success responses return HTTP status `200`
- All error responses return HTTP status `400`
- Every response body is JSON
- Success shape: `{ "operation": "...", "a": ..., "b": ..., "result": ... }`
- Error shape: `{ "error": "..." }`
- A test **passes** if both the HTTP status code AND the response body match exactly
- A test **fails** if either the status code or any field in the response body is wrong

---

## Test Suite

---

### GROUP 1 — Happy Path (all 4 endpoints)

These are the baseline cases. If any of these fail, stop and report immediately.

#### TEST 1.1 — Addition basic
- `POST /add` with `{ "a": 10, "b": 5 }`
- **Expected status:** `200`
- **Expected body:** `{ "operation": "addition", "a": 10, "b": 5, "result": 15 }`

#### TEST 1.2 — Subtraction basic
- `POST /subtract` with `{ "a": 10, "b": 5 }`
- **Expected status:** `200`
- **Expected body:** `{ "operation": "subtraction", "a": 10, "b": 5, "result": 5 }`

#### TEST 1.3 — Multiplication basic
- `POST /multiply` with `{ "a": 10, "b": 5 }`
- **Expected status:** `200`
- **Expected body:** `{ "operation": "multiplication", "a": 10, "b": 5, "result": 50 }`

#### TEST 1.4 — Division basic
- `POST /divide` with `{ "a": 10, "b": 5 }`
- **Expected status:** `200`
- **Expected body:** `{ "operation": "division", "a": 10, "b": 5, "result": 2 }`

---

### GROUP 2 — Negative Numbers

#### TEST 2.1 — Add two negatives
- `POST /add` with `{ "a": -5, "b": -3 }`
- **Expected status:** `200`
- **Expected body:** `{ "operation": "addition", "a": -5, "b": -3, "result": -8 }`

#### TEST 2.2 — Subtract resulting in negative
- `POST /subtract` with `{ "a": 3, "b": 10 }`
- **Expected status:** `200`
- **Expected body:** `{ "operation": "subtraction", "a": 3, "b": 10, "result": -7 }`

#### TEST 2.3 — Multiply a negative and a positive
- `POST /multiply` with `{ "a": -4, "b": 3 }`
- **Expected status:** `200`
- **Expected body:** `{ "operation": "multiplication", "a": -4, "b": 3, "result": -12 }`

#### TEST 2.4 — Divide a negative by a positive
- `POST /divide` with `{ "a": -9, "b": 3 }`
- **Expected status:** `200`
- **Expected body:** `{ "operation": "division", "a": -9, "b": 3, "result": -3 }`

---

### GROUP 3 — Zero Behavior

#### TEST 3.1 — Add zero
- `POST /add` with `{ "a": 0, "b": 5 }`
- **Expected status:** `200`
- **Expected body:** `{ "operation": "addition", "a": 0, "b": 5, "result": 5 }`

#### TEST 3.2 — Multiply by zero
- `POST /multiply` with `{ "a": 100, "b": 0 }`
- **Expected status:** `200`
- **Expected body:** `{ "operation": "multiplication", "a": 100, "b": 0, "result": 0 }`

#### TEST 3.3 — Subtract to reach zero
- `POST /subtract` with `{ "a": 5, "b": 5 }`
- **Expected status:** `200`
- **Expected body:** `{ "operation": "subtraction", "a": 5, "b": 5, "result": 0 }`

#### TEST 3.4 — Divide zero by a number
- `POST /divide` with `{ "a": 0, "b": 5 }`
- **Expected status:** `200`
- **Expected body:** `{ "operation": "division", "a": 0, "b": 5, "result": 0 }`

---

### GROUP 4 — Division Floor Behavior

> When division does not produce a whole number, the result must be floored (rounded down toward negative infinity).

#### TEST 4.1 — Division with remainder (positive)
- `POST /divide` with `{ "a": 10, "b": 3 }`
- **Expected status:** `200`
- **Expected body:** `{ "operation": "division", "a": 10, "b": 3, "result": 3 }`

#### TEST 4.2 — Division with remainder (negative, floor toward negative infinity)
- `POST /divide` with `{ "a": -10, "b": 3 }`
- **Expected status:** `200`
- **Expected body:** `{ "operation": "division", "a": -10, "b": 3, "result": -4 }`

#### TEST 4.3 — Division result is exactly 1
- `POST /divide` with `{ "a": 7, "b": 7 }`
- **Expected status:** `200`
- **Expected body:** `{ "operation": "division", "a": 7, "b": 7, "result": 1 }`

---

### GROUP 5 — Boundary Values (Range Limits)

#### TEST 5.1 — Maximum allowed value
- `POST /add` with `{ "a": 1000000, "b": 0 }`
- **Expected status:** `200`
- **Expected body:** `{ "operation": "addition", "a": 1000000, "b": 0, "result": 1000000 }`

#### TEST 5.2 — Minimum allowed value
- `POST /add` with `{ "a": -1000000, "b": 0 }`
- **Expected status:** `200`
- **Expected body:** `{ "operation": "addition", "a": -1000000, "b": 0, "result": -1000000 }`

#### TEST 5.3 — Value just over maximum (expect 400)
- `POST /add` with `{ "a": 1000001, "b": 0 }`
- **Expected status:** `400`
- **Expected body:** `{ "error": "Values must be between -1000000 and 1000000" }`

#### TEST 5.4 — Value just under minimum (expect 400)
- `POST /add` with `{ "a": -1000001, "b": 0 }`
- **Expected status:** `400`
- **Expected body:** `{ "error": "Values must be between -1000000 and 1000000" }`

---

### GROUP 6 — Divide by Zero

#### TEST 6.1 — Divide by zero
- `POST /divide` with `{ "a": 10, "b": 0 }`
- **Expected status:** `400`
- **Expected body:** `{ "error": "Division by zero is not allowed" }`

#### TEST 6.2 — Divide negative by zero
- `POST /divide` with `{ "a": -10, "b": 0 }`
- **Expected status:** `400`
- **Expected body:** `{ "error": "Division by zero is not allowed" }`

#### TEST 6.3 — Divide zero by zero
- `POST /divide` with `{ "a": 0, "b": 0 }`
- **Expected status:** `400`
- **Expected body:** `{ "error": "Division by zero is not allowed" }`

---

### GROUP 7 — Invalid Input Types

#### TEST 7.1 — Float value for `a`
- `POST /add` with `{ "a": 1.5, "b": 5 }`
- **Expected status:** `400`
- **Expected body:** `{ "error": "Both a and b must be integers" }`

#### TEST 7.2 — Float value for `b`
- `POST /add` with `{ "a": 5, "b": 1.5 }`
- **Expected status:** `400`
- **Expected body:** `{ "error": "Both a and b must be integers" }`

#### TEST 7.3 — String value for `a`
- `POST /add` with `{ "a": "ten", "b": 5 }`
- **Expected status:** `400`
- **Expected body:** `{ "error": "Both a and b must be integers" }`

#### TEST 7.4 — Numeric string value for `a`
- `POST /add` with `{ "a": "10", "b": 5 }`
- **Expected status:** `400`
- **Expected body:** `{ "error": "Both a and b must be integers" }`

#### TEST 7.5 — Boolean value for `a`
- `POST /add` with `{ "a": true, "b": 5 }`
- **Expected status:** `400`
- **Expected body:** `{ "error": "Both a and b must be integers" }`

#### TEST 7.6 — Null value for `a`
- `POST /add` with `{ "a": null, "b": 5 }`
- **Expected status:** `400`
- **Expected body:** `{ "error": "Both a and b must be integers" }`

#### TEST 7.7 — Both values are floats
- `POST /multiply` with `{ "a": 1.1, "b": 2.2 }`
- **Expected status:** `400`
- **Expected body:** `{ "error": "Both a and b must be integers" }`

---

### GROUP 8 — Missing Fields

#### TEST 8.1 — Missing `b`
- `POST /add` with `{ "a": 10 }`
- **Expected status:** `400`
- **Expected body:** `{ "error": "Both a and b are required" }`

#### TEST 8.2 — Missing `a`
- `POST /add` with `{ "b": 5 }`
- **Expected status:** `400`
- **Expected body:** `{ "error": "Both a and b are required" }`

#### TEST 8.3 — Both fields missing (empty object)
- `POST /add` with `{}`
- **Expected status:** `400`
- **Expected body:** `{ "error": "Both a and b are required" }`

---

### GROUP 9 — Malformed Requests

#### TEST 9.1 — Invalid JSON body
- `POST /add` with raw body: `not-json`
- Header: `Content-Type: application/json`
- **Expected status:** `400`
- **Expected body:** `{ "error": "Invalid JSON body" }`

#### TEST 9.2 — Missing Content-Type header
- `POST /add` with body `{ "a": 10, "b": 5 }` but **no** `Content-Type` header
- **Expected status:** `400`
- **Expected body:** `{ "error": "Content-Type must be application/json" }`

#### TEST 9.3 — Wrong Content-Type header
- `POST /add` with body `{ "a": 10, "b": 5 }` and header `Content-Type: text/plain`
- **Expected status:** `400`
- **Expected body:** `{ "error": "Content-Type must be application/json" }`

---

## Test Reporting Format

For each test, report:

```
TEST <id> — <description>
  Status:   PASS / FAIL
  Expected: <status code> <body>
  Received: <status code> <body>
```

At the end, print a summary:

```
=====================================
RESULTS: X passed, Y failed out of Z
=====================================
```

If any test in GROUP 1 fails, halt all remaining tests and report the failure immediately — the server is not functioning at a basic level.

---

## Notes for the Testing Agent

- Do not import or call any internal application code — HTTP only
- Do not assume any test passes without verifying both status code and body
- Field order in JSON responses does not matter — check key/value pairs, not order
- If the server is unreachable, report that immediately and stop
