# Calculator App — Claude Code Implementation Guide

## Overview

A simple REST API calculator with 4 endpoints that perform arithmetic operations on integers (whole numbers, including negatives). This spec is written to be unambiguous so that a separate testing agent can verify correct behavior purely through HTTP inputs and outputs (black box testing).

> **Note:** A web interface will be added in a future phase. The API contract defined here must remain stable when that happens.

---

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** JavaScript

---

## Project Setup

Tell Claude Code:

> "Create a new Express.js app called `calculator-api`. Initialize a Node project, install Express, and create a server that listens on port 3000."

---

## Definitions

- **Valid integer:** Any whole number including negatives (e.g. `-10`, `0`, `42`). Floats (e.g. `1.5`), strings (e.g. `"abc"`), booleans, `null`, and `undefined` are all invalid.
- **Black box contract:** The internal implementation is irrelevant. Only HTTP request/response behavior is specified here.

---

## API Endpoints

All endpoints are `POST` only. They accept a JSON body with two fields (`a` and `b`) and return a JSON response. Successful responses always return HTTP status `200`. Invalid requests always return HTTP status `400`.

### Standard Success Response Shape
```json
{
  "operation": "<operation name>",
  "a": <integer>,
  "b": <integer>,
  "result": <integer>
}
```

### Standard Error Response Shape
```json
{
  "error": "<human-readable message>"
}
```

---

### 1. Addition
- **Endpoint:** `POST /add`
- **Body:** `{ "a": 10, "b": 5 }`
- **Success (200):** `{ "operation": "addition", "a": 10, "b": 5, "result": 15 }`

### 2. Subtraction
- **Endpoint:** `POST /subtract`
- **Body:** `{ "a": 10, "b": 5 }`
- **Success (200):** `{ "operation": "subtraction", "a": 10, "b": 5, "result": 5 }`

### 3. Multiplication
- **Endpoint:** `POST /multiply`
- **Body:** `{ "a": 10, "b": 5 }`
- **Success (200):** `{ "operation": "multiplication", "a": 10, "b": 5, "result": 50 }`

### 4. Division
- **Endpoint:** `POST /divide`
- **Body:** `{ "a": 10, "b": 5 }`
- **Success (200):** `{ "operation": "division", "a": 10, "b": 5, "result": 2 }`
- **Divide by zero (400):** `{ "error": "Division by zero is not allowed" }`

> Division result should be an integer. If the result is not a whole number (e.g. 10 / 3), return the **floored** integer value (i.e. rounded toward negative infinity). Examples: `10 / 3 = 3`, `-7 / 2 = -4` (not `-3`), `7 / -2 = -4` (not `-3`).

---

## Validation Rules

All rules apply to every endpoint. Rules are checked in this order. If a request fails at step N, later steps are not evaluated and the error from step N is returned. Each rule checks **both** `a` and `b` before moving to the next rule.

1. **Request must have `Content-Type: application/json` header** — otherwise return `400` with `{ "error": "Content-Type must be application/json" }`. The check must accept media type parameters (e.g. `application/json; charset=utf-8` is valid).
2. **Body must be valid JSON** — otherwise return `400` with `{ "error": "Invalid JSON body" }`
3. **Both `a` and `b` must be present** — if either key is absent from the parsed body (i.e. `undefined`), return `400` with `{ "error": "Both a and b are required" }`. A key explicitly set to `null` is **not** absent — it is present but invalid, and is caught by Rule 4 instead.
4. **Both `a` and `b` must be integers** — floats, strings, booleans, and `null` are all invalid. Return `400` with `{ "error": "Both a and b must be integers" }`
5. **Both `a` and `b` must be within range** — values outside `-1,000,000` to `1,000,000` (inclusive) return `400` with `{ "error": "Values must be between -1000000 and 1000000" }`
6. **For `/divide` only: `b` must not be zero** — return `400` with `{ "error": "Division by zero is not allowed" }`

> **Note:** Range validation (Rule 5) applies only to input values `a` and `b`. The computed result is never range-checked — operations that produce results outside [-1000000, 1000000] are valid (e.g. `1000000 * 1000000 = 1000000000000` is a valid 200 response).

---

## Accepted Integer Range

- Minimum: `-1,000,000`
- Maximum: `1,000,000`

---

## Security Hardening

- **Payload size limit:** Request bodies must be limited to 1KB. Requests exceeding this limit should be rejected before JSON parsing.
- **Server fingerprinting:** The `X-Powered-By` response header must be disabled.

---

## Negative Number Behavior

Negative integers are fully supported. For example:
- `POST /add` with `{ "a": -5, "b": -3 }` → `{ "operation": "addition", "a": -5, "b": -3, "result": -8 }`
- `POST /subtract` with `{ "a": 3, "b": 10 }` → `{ "operation": "subtraction", "a": 3, "b": 10, "result": -7 }`

---

## Suggested Prompts for Claude Code

**Step 1 — Scaffold the project:**
```
Create a new Node.js Express project in a folder called calculator-api. 
Initialize npm, install express, and create an index.js entry point with 
a server running on port 3000.
```

**Step 2 — Add the endpoints:**
```
Add 4 POST endpoints to the Express app: /add, /subtract, /multiply, and /divide. 
Each should accept a JSON body with fields "a" and "b" (integers), perform the 
operation, and return a JSON response with the operation name, inputs, and result.

Validation rules (check in this order):
1. Reject requests without Content-Type: application/json header → 400
2. Reject invalid JSON bodies → 400
3. Reject requests where a or b are missing → 400
4. Reject requests where a or b are not integers (floats, strings, booleans, null are all invalid) → 400
5. Reject values outside the range -1000000 to 1000000 → 400
6. For /divide only: reject b = 0 → 400

All error responses: { "error": "<message>" }
All success responses: { "operation": "...", "a": ..., "b": ..., "result": ... }
Division results should be floored to the nearest integer.
```

**Step 3 — Add a test script:**
```
Write a test script that tests all 4 endpoints via HTTP only (black box — no importing 
internal functions). Cover: happy path, negative numbers, floats, missing fields, 
non-integer strings, null values, divide by zero, and out-of-range values.
```

**Step 4 — Add a README:**
```
Generate a README.md that documents how to install dependencies, run the server, 
and use each of the 4 API endpoints with example curl commands.
```

---

## Example `curl` Commands

```bash
# Addition
curl -X POST http://localhost:3000/add \
  -H "Content-Type: application/json" \
  -d '{"a": 10, "b": 5}'

# Subtraction
curl -X POST http://localhost:3000/subtract \
  -H "Content-Type: application/json" \
  -d '{"a": 10, "b": 5}'

# Multiplication
curl -X POST http://localhost:3000/multiply \
  -H "Content-Type: application/json" \
  -d '{"a": 10, "b": 5}'

# Division
curl -X POST http://localhost:3000/divide \
  -H "Content-Type: application/json" \
  -d '{"a": 10, "b": 5}'

# Division by zero (expect 400)
curl -X POST http://localhost:3000/divide \
  -H "Content-Type: application/json" \
  -d '{"a": 10, "b": 0}'

# Invalid input — float (expect 400)
curl -X POST http://localhost:3000/add \
  -H "Content-Type: application/json" \
  -d '{"a": 1.5, "b": 5}'
```

---

## Expected File Structure

```
calculator-api/
├── index.js          # Main server file
├── package.json
└── README.md
```
