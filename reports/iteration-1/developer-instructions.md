# Developer Instructions — Iteration 1

Implement exactly per `calculator-app-spec.md` with the following prioritized checklist.

## Priority 1 — Contract correctness
1. Build Node + Express server on port `3000`.
2. Implement exactly four POST routes:
- `/add`
- `/subtract`
- `/multiply`
- `/divide`
3. Success body must always be:
`{ "operation": "<name>", "a": <int>, "b": <int>, "result": <int> }`
4. Error body must always be:
`{ "error": "<message>" }`
5. Success status `200`; invalid request status `400`.

## Priority 2 — Validation order (must be exact)
For every endpoint, enforce checks in this order:
1. `Content-Type` must be `application/json` else:
`{ "error": "Content-Type must be application/json" }`
2. Invalid JSON body else:
`{ "error": "Invalid JSON body" }`
3. Missing `a` or `b` else:
`{ "error": "Both a and b are required" }`
4. Non-integer `a` or `b` else:
`{ "error": "Both a and b must be integers" }`
5. Out-of-range value outside `[-1000000, 1000000]` else:
`{ "error": "Values must be between -1000000 and 1000000" }`
6. For `/divide` only, if `b === 0` else:
`{ "error": "Division by zero is not allowed" }`

## Priority 3 — Arithmetic behavior
- `add`: `a + b`
- `subtract`: `a - b`
- `multiply`: `a * b`
- `divide`: `Math.floor(a / b)`

## Priority 4 — Hardening/consistency
- Ensure all error responses are JSON (no HTML/framework default payloads for covered validation paths).
- Keep validation centralized to avoid per-route drift.
- Accept standard JSON media type forms such as `application/json; charset=utf-8`.

## Priority 5 — Documentation
Update `README.md` with:
- install/run steps
- curl examples for all 4 endpoints and at least one error example.
