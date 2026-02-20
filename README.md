# Calculator API

A four-endpoint REST API that performs integer arithmetic: addition, subtraction, multiplication, and integer floor division. It accepts JSON bodies, validates inputs strictly, and returns predictable JSON responses.

## How This Was Built

This API was built autonomously by a team of six Claude AI agents coordinated by an Orchestrator — no human wrote any code or made any design decisions.

| Agent | Role |
|---|---|
| **Orchestrator** | Managed workflow, enforced communication rules, routed work between agents |
| **Architect** | Owned all design decisions, reviewed findings, wrote unambiguous instructions for the Developer |
| **CISO** | Reviewed the spec and implementation for security vulnerabilities each iteration |
| **Adversary** | Actively attacked the spec and implementation each iteration to find what others missed |
| **Developer** | Implemented the API based solely on Architect instructions — never read test results or security reports |
| **Tester** | Verified correctness via black-box HTTP testing only — never read the source code, only made HTTP requests and checked responses |

The pipeline ran in two phases:

1. **Pre-Build** — Architect reviewed the spec, CISO reviewed for security gaps, Adversary attacked the spec for logical weaknesses, Architect synthesized all findings into unambiguous Developer instructions.
2. **Build & Verify (iterated)** — Developer built the API, CISO reviewed the code, Adversary attacked the implementation, Tester ran the full HTTP test suite, Architect evaluated all three reports and issued an ITERATE or COMPLETE decision.

The build was considered complete only when the Tester reported zero Critical, High, or Medium failures **and** the CISO and Adversary post-build reports each contained zero Critical or High findings.

### The One Bug Found

The Adversary discovered that the divide-by-zero check used `path === '/divide'` — an exact string comparison — while Express normalizes routes for matching. Sending `POST /divide/` (trailing slash) or `POST /DIVIDE` with `b=0` bypassed the check entirely, returning HTTP 200 with `null` as the result (silent data corruption). The Tester's standard test suite did not catch this because it used the canonical path. The Adversary caught it in Iteration 1; it was fixed in Iteration 2 by moving the `b === 0` check directly into the `/divide` route handler, eliminating the path comparison entirely.

---

## Requirements

- Node.js v18 or later
- npm

## Installation

```bash
npm install
```

## Running the Server

```bash
npm start
```

The server defaults to port 3000. To use a custom port:

```bash
PORT=4567 npm start
```

The startup log confirms which port is active:

```
Calculator API running on port 3000
```

---

## Web Interface

The app includes a web interface accessible at `http://localhost:<PORT>/` (using whatever port the server is running on, e.g. `http://localhost:3000/`).

The web interface is a single-page HTML file served statically from `public/index.html`. It lets you perform calculations directly in the browser without needing curl or any API client.

The API endpoints remain at `/add`, `/subtract`, `/multiply`, and `/divide` (POST only) and are unchanged.

---

## API Reference

All endpoints:
- Method: `POST`
- Header: `Content-Type: application/json`
- Body: `{ "a": <integer>, "b": <integer> }`

### Success Response — HTTP 200

```json
{
  "operation": "<operation name>",
  "a": <integer>,
  "b": <integer>,
  "result": <integer>
}
```

### Error Response — HTTP 400

```json
{
  "error": "<human-readable message>"
}
```

---

### POST /add

```bash
curl -X POST http://localhost:3000/add \
  -H "Content-Type: application/json" \
  -d '{"a": 10, "b": 5}'
```

```json
{"operation":"addition","a":10,"b":5,"result":15}
```

Negative numbers:

```bash
curl -X POST http://localhost:3000/add \
  -H "Content-Type: application/json" \
  -d '{"a": -5, "b": -3}'
```

```json
{"operation":"addition","a":-5,"b":-3,"result":-8}
```

---

### POST /subtract

```bash
curl -X POST http://localhost:3000/subtract \
  -H "Content-Type: application/json" \
  -d '{"a": 10, "b": 5}'
```

```json
{"operation":"subtraction","a":10,"b":5,"result":5}
```

Result can be negative:

```bash
curl -X POST http://localhost:3000/subtract \
  -H "Content-Type: application/json" \
  -d '{"a": 3, "b": 10}'
```

```json
{"operation":"subtraction","a":3,"b":10,"result":-7}
```

---

### POST /multiply

```bash
curl -X POST http://localhost:3000/multiply \
  -H "Content-Type: application/json" \
  -d '{"a": 10, "b": 5}'
```

```json
{"operation":"multiplication","a":10,"b":5,"result":50}
```

---

### POST /divide

Result is floored toward negative infinity (not truncated toward zero).

```bash
curl -X POST http://localhost:3000/divide \
  -H "Content-Type: application/json" \
  -d '{"a": 10, "b": 3}'
```

```json
{"operation":"division","a":10,"b":3,"result":3}
```

Negative floor example — `-10 ÷ 3 = -4`, not `-3`:

```bash
curl -X POST http://localhost:3000/divide \
  -H "Content-Type: application/json" \
  -d '{"a": -10, "b": 3}'
```

```json
{"operation":"division","a":-10,"b":3,"result":-4}
```

Division by zero:

```bash
curl -X POST http://localhost:3000/divide \
  -H "Content-Type: application/json" \
  -d '{"a": 10, "b": 0}'
```

```json
{"error":"Division by zero is not allowed"}
```

---

## Error Examples

### Missing field

```bash
curl -X POST http://localhost:3000/add \
  -H "Content-Type: application/json" \
  -d '{"a": 10}'
```

```json
{"error":"Both a and b are required"}
```

### Non-integer input (float, string, boolean, null)

```bash
curl -X POST http://localhost:3000/add \
  -H "Content-Type: application/json" \
  -d '{"a": 1.5, "b": 5}'
```

```json
{"error":"Both a and b must be integers"}
```

### Out of range

```bash
curl -X POST http://localhost:3000/add \
  -H "Content-Type: application/json" \
  -d '{"a": 1000001, "b": 0}'
```

```json
{"error":"Values must be between -1000000 and 1000000"}
```

### Missing Content-Type header

```bash
curl -X POST http://localhost:3000/add \
  -d '{"a": 10, "b": 5}'
```

```json
{"error":"Content-Type must be application/json"}
```

---

## Validation Rules

Checked in this exact order for every request:

1. `Content-Type` must be `application/json` (charset parameters like `; charset=utf-8` are accepted)
2. Body must be valid JSON
3. Both `a` and `b` must be present
4. Both `a` and `b` must be integers — floats, strings, booleans, and `null` are all rejected
5. Both `a` and `b` must be within `-1,000,000` to `1,000,000` (inclusive)
6. `/divide` only: `b` must not be zero

## Accepted Integer Range

- Minimum: `-1,000,000`
- Maximum: `1,000,000`

The computed result is never range-checked. For example, `1,000,000 × 1,000,000 = 1,000,000,000,000` is a valid response.
