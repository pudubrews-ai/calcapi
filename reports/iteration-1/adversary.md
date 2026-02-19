# Adversary Report — Iteration 1

## Phase
Spec review (pre-build)

## Planned Bypass Attempts

### High-focus probes
1. Validation-order bypass attempts
- Send invalid JSON without/with wrong content-type to see if server leaks parser errors instead of contract errors.
- Send missing fields with non-integer payloads to verify "required" check runs before type check.

2. Type confusion attempts
- Numeric strings (`"10"`), booleans, null, arrays, objects.
- JSON values like `1e3` and `-0` to confirm integer policy.

3. Divide-by-zero edge attempts
- `b = 0`, `b = -0`, `b = "0"`, `b = null`.

4. Boundary evasion
- `1000001`, `-1000001`, decimals at boundaries (`1000000.0`, `999999.5`).

5. Content-type variants
- `text/plain`, missing header, and mixed forms (`application/json; charset=utf-8`).

## Expected Secure Behavior
- Exact error messages/status as spec states.
- No stack traces or framework HTML error pages.
- Only JSON responses for both success and failure paths.

## Post-build
### Probe outcomes
- No Critical/High/Medium bypass discovered for required contract.
- Validation-order probes behaved as expected.
- Type confusion probes returned integer-validation error.
- Divide-by-zero probes returned required divide-by-zero error.
- Out-of-range probes returned required range error.

### Representative repro commands
```bash
curl -X POST http://localhost:3000/add \
  -H "Content-Type: application/json" \
  -d 'not-json'
# Expected/Observed: 400 {"error":"Invalid JSON body"}

curl -X POST http://localhost:3000/add \
  -d '{"a":10,"b":5}'
# Expected/Observed: 400 {"error":"Content-Type must be application/json"}

curl -X POST http://localhost:3000/divide \
  -H "Content-Type: application/json" \
  -d '{"a":10,"b":0}'
# Expected/Observed: 400 {"error":"Division by zero is not allowed"}
```

### Severity summary
- Critical: 0
- High: 0
- Medium: 0
- Low: 1

### Low appendix
- Non-contract endpoints/methods rely on framework defaults; not a spec blocker.
