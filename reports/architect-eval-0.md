# Architect Evaluation Report — Pre-Build Spec Review

**Date:** 2026-02-18
**Spec reviewed:** `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-app-spec.md`
**Author:** Architect Agent (Step 1 — Pre-Build Spec Review)

---

## 1. Endpoint Inventory

The spec defines exactly four endpoints. All share the same HTTP method, request body schema, and response shapes.

| # | Method | Path | Operation Name (in response) |
|---|--------|------|-------------------------------|
| 1 | POST | `/add` | `"addition"` |
| 2 | POST | `/subtract` | `"subtraction"` |
| 3 | POST | `/multiply` | `"multiplication"` |
| 4 | POST | `/divide` | `"division"` |

### 1.1 Request Body (all endpoints)

```json
{
  "a": <integer>,
  "b": <integer>
}
```

Both fields are required. Both must be integers (whole numbers, including negatives). No other fields are mentioned or expected.

### 1.2 Success Response Shape (HTTP 200, all endpoints)

```json
{
  "operation": "<operation name string>",
  "a": <integer — the input value>,
  "b": <integer — the input value>,
  "result": <integer>
}
```

The `a` and `b` fields in the response echo the validated input values. The `result` is always an integer.

### 1.3 Error Response Shape (HTTP 400, all endpoints)

```json
{
  "error": "<human-readable message>"
}
```

Single field. No other metadata is included in error responses.

### 1.4 Division-Specific Behavior

- Division by zero returns HTTP 400 with a specific error message (see Section 3).
- Non-whole-number results are **floored to an integer**. The spec gives the example: `10 / 3 = 3` (floored).

---

## 2. Validation Rules — Exact Order of Evaluation

The spec explicitly mandates that validation rules are checked **in this order**. If a request fails at step N, later steps are not evaluated and the error from step N is returned.

| Priority | Rule | HTTP Status | Verbatim Error Message |
|----------|------|-------------|------------------------|
| 1 | Request must have `Content-Type: application/json` header | 400 | `"Content-Type must be application/json"` |
| 2 | Body must be valid JSON | 400 | `"Invalid JSON body"` |
| 3 | Both `a` and `b` must be present in the body | 400 | `"Both a and b are required"` |
| 4 | Both `a` and `b` must be integers (floats, strings, booleans, null all rejected) | 400 | `"Both a and b must be integers"` |
| 5 | Both `a` and `b` must be in the range [-1000000, 1000000] inclusive | 400 | `"Values must be between -1000000 and 1000000"` |
| 6 | `/divide` only: `b` must not be zero | 400 | `"Division by zero is not allowed"` |

---

## 3. Verbatim Error Message Strings

These are the exact strings that must appear in the `"error"` field. Any deviation (capitalization, punctuation, wording) constitutes a spec violation.

1. `"Content-Type must be application/json"`
2. `"Invalid JSON body"`
3. `"Both a and b are required"`
4. `"Both a and b must be integers"`
5. `"Values must be between -1000000 and 1000000"`
6. `"Division by zero is not allowed"`

---

## 4. Integer Floor Division Requirement

The spec states:

> "Division result should be an integer. If the result is not a whole number (e.g. 10 / 3), return the floored integer value (e.g. 3)."

The word "floored" is used. In JavaScript, `Math.floor()` is the canonical implementation. This is critical for negative dividend or divisor cases (see Ambiguity #1 below).

---

## 5. Ambiguities, Gaps, and Contradictions

### AMBIGUITY #1 — Floor division behavior with negative numbers (CRITICAL)

The spec says to return the "floored integer value" but only gives a positive example (`10 / 3 = 3`). For negative numbers, `Math.floor()` and `Math.trunc()` produce different results:

| Expression | `Math.floor()` | `Math.trunc()` |
|------------|----------------|-----------------|
| `-7 / 2` | `-4` | `-3` |
| `7 / -2` | `-4` | `-3` |
| `-7 / -2` | `3` | `3` |

The spec literally says "floored," so `Math.floor()` is the correct interpretation. However, many developers conflate "floor" with "truncate toward zero." The implementation **must** use `Math.floor()` to comply with the literal spec. The CISO and Adversary agents should write tests specifically for negative-dividend and negative-divisor division to verify this.

### AMBIGUITY #2 — Content-Type header matching strictness

The spec requires `Content-Type: application/json`. It does not specify:

- Whether `application/json; charset=utf-8` is acceptable (Express's `express.json()` middleware accepts this by default).
- Whether the check is case-insensitive (HTTP headers are case-insensitive per RFC 7230, so `Application/JSON` should arguably be accepted).
- Whether `text/json` or other JSON-compatible media types are accepted.

**Recommendation:** Accept `application/json` with any parameters (e.g., charset). This matches Express default behavior and HTTP conventions. The check should be case-insensitive.

### AMBIGUITY #3 — What constitutes "missing" for Rule 3 vs Rule 4

The spec says:
- Rule 3: "Both `a` and `b` must be present"
- Rule 4: "Both `a` and `b` must be integers — floats, strings, booleans, and null are all invalid"

Consider the input `{ "a": 10 }` — `b` is absent (undefined). This clearly triggers Rule 3.

But what about `{ "a": 10, "b": null }`? The key `b` is syntactically present in the JSON, but its value is `null`. The spec lists `null` as an invalid type in Rule 4, but one could argue `null` means "not provided" and thus triggers Rule 3.

**Recommendation:** Treat `undefined` (key absent) as triggering Rule 3 ("missing"). Treat `null` (key present, value is null) as triggering Rule 4 ("not an integer"). This is the most defensible interpretation: the key is present so it is not "missing," but its value is not an integer.

### AMBIGUITY #4 — Handling of extra/unknown fields in the body

The spec does not say whether extra fields (e.g., `{ "a": 1, "b": 2, "c": 3 }`) should be rejected or silently ignored. Standard REST practice is to ignore unknown fields.

**Recommendation:** Ignore extra fields. Do not reject them.

### AMBIGUITY #5 — GET, PUT, DELETE, PATCH on defined paths

The spec says all endpoints are `POST` only. It does not specify what happens if a client sends a `GET /add` or `DELETE /divide` request.

**Recommendation:** Express will return a 404 by default for unregistered method+path combinations. Alternatively, a 405 Method Not Allowed could be returned, but since the spec is silent, accepting Express's default 404 behavior is adequate. This is not a compliance risk.

### AMBIGUITY #6 — Behavior for undefined routes

The spec does not specify what happens for `POST /modulo`, `POST /`, or any other unregistered path.

**Recommendation:** Return Express's default 404 behavior. No custom handling required.

### AMBIGUITY #7 — Integer type checking edge cases in JavaScript

JavaScript has no separate integer type. `Number.isInteger()` is the correct check, which:
- Returns `false` for `1.5`, `NaN`, `Infinity`, `-Infinity`, `"5"`, `true`, `false`, `null`, `undefined`
- Returns `true` for `1`, `0`, `-1`, `1.0` (since `1.0 === 1` in JS and is stored as integer)

The spec explicitly lists floats, strings, booleans, and null as invalid. It does not mention `NaN`, `Infinity`, or `-Infinity`, but `Number.isInteger()` correctly rejects all of these.

**Recommendation:** Use `Number.isInteger()` for the type check. This is consistent with all spec examples and edge cases.

### AMBIGUITY #8 — Range boundary inclusivity

The spec says: "values outside `-1,000,000` to `1,000,000`". The Accepted Integer Range section says:
- Minimum: `-1,000,000`
- Maximum: `1,000,000`

This implies the boundaries are **inclusive** (i.e., `-1000000` and `1000000` are valid). The error message confirms this: "Values must be between -1000000 and 1000000" — the word "between" is ambiguous in English, but combined with the min/max listing, inclusive is the only reasonable reading.

**Recommendation:** Accept values where `-1000000 <= value <= 1000000`.

### AMBIGUITY #9 — Empty body or non-object JSON body

What happens if the body is valid JSON but not an object? For example:
- `[]` — valid JSON, array
- `"hello"` — valid JSON, string
- `42` — valid JSON, number
- `true` — valid JSON, boolean
- `null` — valid JSON, null

In all these cases, `a` and `b` are absent. This should pass Rule 2 (valid JSON) and fail at Rule 3 (both a and b are required).

**Recommendation:** After JSON parsing succeeds, check for presence of `a` and `b` regardless of the body's type. Arrays, primitives, and null will all fail Rule 3.

### AMBIGUITY #10 — Division: floor direction wording vs. "nearest integer"

The Step 2 suggested prompt says: "Division results should be floored to the nearest integer." This is a contradictory phrase — "floor" means round toward negative infinity, while "nearest integer" means round to the closest integer. The actual spec section (Section 4, under the `/divide` endpoint) says "return the floored integer value," which is unambiguous.

**Recommendation:** Use `Math.floor()`. The "nearest integer" phrasing in the suggested prompt is an editorial error in the spec; the normative text is the endpoint definition, not the prompt suggestions.

---

## 6. Confirmed Spec Requirements Summary

| Requirement | Confirmed |
|-------------|-----------|
| 4 POST endpoints only | Yes |
| JSON request body with `a` and `b` fields | Yes |
| 6 validation rules in strict priority order | Yes |
| 6 verbatim error messages (exact strings) | Yes |
| All errors return HTTP 400 | Yes |
| All successes return HTTP 200 | Yes |
| Division uses `Math.floor()` for non-integer results | Yes |
| Accepted range: [-1000000, 1000000] inclusive | Yes |
| Negative integers fully supported | Yes |
| Tech stack: Node.js, Express.js, JavaScript | Yes |
| Server listens on port 3000 | Yes |

---

## 7. Recommendations for Build Agent

1. Use `express.json()` middleware but configure a custom error handler to catch JSON parse errors and return Rule 2's error message verbatim.
2. For the Content-Type check, inspect the request before `express.json()` runs, or use a custom middleware that checks the header first. Express's `express.json()` will itself reject non-JSON content types, but it may not return the spec-mandated error message.
3. Use `Number.isInteger()` for the integer type check.
4. Use `Math.floor()` for division — not `Math.trunc()`, not the bitwise OR trick (`| 0`), and not `parseInt()`.
5. Implement validation as a middleware chain or a shared validation function to ensure all six rules are checked in the exact specified order across all four endpoints.
6. Echo `a` and `b` back in the success response exactly as received (after validation).

---

## 8. Recommendations for CISO / Adversary Agents

The following test cases are critical for catching common implementation errors:

- **Negative floor division:** `POST /divide { "a": -7, "b": 2 }` must return `result: -4` (not `-3`).
- **Content-Type omission:** Send a request with no Content-Type header. Must return Rule 1's error.
- **Content-Type with charset:** Send `Content-Type: application/json; charset=utf-8`. Should be accepted.
- **Null values:** `{ "a": null, "b": 5 }` — verify whether Rule 3 or Rule 4 fires (see Ambiguity #3).
- **Boundary values:** `-1000000`, `1000000`, `-1000001`, `1000001` — verify inclusive boundaries.
- **Validation order:** Send `{ "a": "hello", "b": 2000000 }` — must return Rule 4 error (not Rule 5), because Rule 4 is checked before Rule 5.
- **Malformed JSON:** Send `{a: 10}` (unquoted keys) — must return Rule 2 error.
- **Empty body:** Send empty string with correct Content-Type — must return Rule 2 error.
- **Non-object JSON:** Send `[1, 2]` — must return Rule 3 error (valid JSON, but `a` and `b` are missing).
- **Float that looks like integer:** Send `{ "a": 1.0, "b": 2 }` — in JSON, `1.0` parses to `1` in JavaScript, so this should be accepted. Test for `1.5` which must be rejected.
- **Division b=0 with out-of-range a:** Send `POST /divide { "a": 2000000, "b": 0 }` — must return Rule 5 error (not Rule 6), because range check precedes divide-by-zero check.
