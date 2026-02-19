# Calculator API

A minimal, well-validated REST API that performs arithmetic on integers. Built as a demonstration of a multi-agent AI build pipeline — the API was designed, reviewed for security, adversarially attacked, implemented, and black-box tested entirely by a team of specialized AI agents coordinated by an orchestrator. Zero Critical, High, or Medium issues remain after two build iterations.

The API is intentionally simple: four operations, strict integer-only inputs, predictable error shapes, and no moving parts. It is designed to serve as a stable backend contract for a future web interface.

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

The server listens on port 3000:

```
Calculator API running on port 3000
```

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
