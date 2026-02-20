# CISO Pre-Build Security Review

**Date:** 2026-02-18
**Spec reviewed:** `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-app-spec.md`
**Companion document reviewed:** `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-api/reports/architect-eval-0.md`
**Author:** CISO Agent (Step 2 -- Pre-Build Security Review)

---

## Scope

This review covers the API specification from a security perspective only. Functional correctness, logical edge cases, and behavioral ambiguities are deferred to the Adversary agent. The focus areas are: input validation design, error message information leakage, missing security constraints, HTTP security headers, payload abuse vectors, and spec-level gaps that would make any conforming implementation inherently insecure.

---

## Findings

### FINDING 1 -- No Rate Limiting Specified
- **Severity:** High
- **Description:** The spec defines no rate limiting on any endpoint. All four endpoints perform computation and return results immediately. Without rate limiting, the API is trivially vulnerable to denial-of-service (DoS) attacks. An attacker can send thousands of requests per second to exhaust server resources (CPU, memory, event loop, file descriptors). Even for a simple calculator, an unprotected public Express.js server on port 3000 can be overwhelmed with minimal effort. Multiplication of large values (e.g., `999999 * 999999`) is negligible computationally, but the sheer volume of connections is the real threat.
- **Recommended Fix:** The spec must mandate a rate limiting strategy. At minimum, specify a per-IP request limit (e.g., 100 requests per minute) using middleware such as `express-rate-limit`. The rate limit response should return HTTP 429 (Too Many Requests) with a defined error body shape consistent with the existing error response contract.

---

### FINDING 2 -- No Request Payload Size Limit Specified
- **Severity:** High
- **Description:** The spec does not define a maximum request body size. While `express.json()` has a default limit of 100KB, this is an implementation detail that is not codified in the spec. An attacker could send extremely large JSON payloads (e.g., megabytes of nested objects, deeply nested structures, or enormous string values for `a` and `b`) to consume server memory and CPU during JSON parsing. A 50MB JSON body with deeply nested arrays would be parsed before any validation rule is evaluated, creating a pre-validation resource exhaustion vector.
- **Recommended Fix:** The spec must explicitly mandate a maximum request body size. A limit of 1KB is more than sufficient for this API (a valid request body is under 100 bytes). This should be enforced at the middleware layer before JSON parsing. Example: `express.json({ limit: '1kb' })`.

---

### FINDING 3 -- No HTTP Security Headers Specified
- **Severity:** Medium
- **Description:** The spec does not mention any HTTP security headers. A conforming implementation would serve responses with no security headers, making the API vulnerable to several classes of attack, especially once the planned web interface is added (as noted in the spec: "A web interface will be added in a future phase"). Missing headers include:
  - `X-Content-Type-Options: nosniff` -- prevents MIME sniffing attacks
  - `X-Frame-Options: DENY` -- prevents clickjacking (relevant once a UI exists)
  - `Strict-Transport-Security` -- enforces HTTPS connections
  - `Content-Security-Policy` -- controls resource loading (critical for future UI phase)
  - `X-XSS-Protection: 0` -- disables browser XSS filter (modern recommendation)
  - `Cache-Control: no-store` -- prevents caching of API responses
- **Recommended Fix:** The spec should mandate the use of the `helmet` middleware (or equivalent) to set standard security headers on all responses. At minimum, specify `X-Content-Type-Options: nosniff` and `Cache-Control: no-store` for the API phase, and document that additional headers will be required for the UI phase.

---

### FINDING 4 -- No CORS Policy Specified
- **Severity:** Medium
- **Description:** The spec does not define a CORS (Cross-Origin Resource Sharing) policy. Since the spec explicitly states a web interface will be added in a future phase, the CORS configuration is security-critical. Without a spec-level CORS policy, an implementer might set `Access-Control-Allow-Origin: *` for convenience, allowing any website to make requests to the calculator API from a user's browser. This is a classic misconfiguration that enables cross-site request abuse.
- **Recommended Fix:** The spec must define an explicit CORS policy. For the API-only phase, CORS should be disabled entirely (no CORS headers sent, which is Express's default). When the web UI phase begins, the spec should mandate an allowlist of specific permitted origins. The CORS configuration should never use wildcard (`*`) origins.

---

### FINDING 5 -- Express.js Server Fingerprinting via X-Powered-By Header
- **Severity:** Medium
- **Description:** Express.js sends an `X-Powered-By: Express` header on every response by default. The spec does not instruct the implementer to disable this. This header discloses the server technology, giving attackers information to target Express-specific vulnerabilities. Security best practice (OWASP) is to remove or suppress technology-identifying headers.
- **Recommended Fix:** The spec should mandate disabling the `X-Powered-By` header. In Express, this is done with `app.disable('x-powered-by')` or by using `helmet`, which disables it automatically.

---

### FINDING 6 -- No HTTPS/TLS Requirement Specified
- **Severity:** Medium
- **Description:** The spec instructs the server to listen on port 3000 over plain HTTP. There is no mention of TLS/HTTPS. While this may be acceptable for local development, the spec does not distinguish between development and production configurations. Any deployment of this API over plain HTTP exposes all request and response data to network-level interception (man-in-the-middle attacks). The future web interface phase makes this more critical, as users would be interacting via browsers.
- **Recommended Fix:** The spec should explicitly state that production deployments must use HTTPS (either via a reverse proxy like nginx or by configuring Node.js with TLS certificates). The current port 3000 HTTP configuration should be documented as development-only.

---

### FINDING 7 -- Error Messages Facilitate Validation Oracle Attacks
- **Severity:** Medium
- **Description:** The spec defines six distinct, highly specific error messages that are returned in strict priority order. While this is good for developer experience, it creates a validation oracle: an attacker can systematically probe the API with crafted inputs and use the specific error messages to reverse-engineer exactly which validation step failed and in what order. For example:
  - Sending `{ "a": "x", "b": 2000000 }` returns "Both a and b must be integers" (Rule 4), confirming that the type check runs before the range check.
  - This ordered error disclosure allows an attacker to map the complete validation pipeline, which is useful for crafting bypass attempts in more complex systems.

  For this simple calculator, the practical risk is low. However, since the spec says the "API contract defined here must remain stable" for future phases, this pattern will be inherited by more complex endpoints.
- **Recommended Fix:** This is an accepted risk for this spec given the simplicity of the API. However, the spec should include a note that future endpoints with authentication or authorization must not follow this pattern of ordered, specific error messages. For security-sensitive endpoints, a single generic "Invalid request" error message is preferable.

---

### FINDING 8 -- No Authentication or Authorization Framework
- **Severity:** Medium
- **Description:** The spec defines a completely unauthenticated API. Any client that can reach port 3000 can use all endpoints without restriction. The spec notes that "A web interface will be added in a future phase" and that "The API contract defined here must remain stable when that happens." This means the API will likely be exposed to browser-based clients without any authentication layer. While authentication may not be needed for a simple calculator, the absence of any auth framework in the spec means there is no mechanism to add per-user rate limiting, audit logging, or access control in the future without breaking the API contract.
- **Recommended Fix:** The spec should acknowledge that the API is intentionally unauthenticated for this phase and document that the future web interface phase must introduce an authentication layer (e.g., API keys, session tokens, or OAuth) as a separate middleware concern that does not alter the existing endpoint contracts.

---

### FINDING 9 -- No Request Logging or Audit Trail Specified
- **Severity:** Low
- **Description:** The spec does not mention any request logging. Without logging, there is no way to detect, investigate, or respond to abuse, attacks, or anomalous usage patterns. For a production API, access logs (method, path, status code, timestamp, client IP) are the minimum baseline for security observability. The absence of logging means a DoS attack, input fuzzing campaign, or exploitation attempt would leave no trace.
- **Recommended Fix:** The spec should mandate structured request logging (e.g., via `morgan` middleware or a custom logger). Logs should include: timestamp, HTTP method, path, response status code, response time, and client IP. Sensitive data (request bodies) should not be logged by default. Log output should go to stdout for container-friendly deployment.

---

### FINDING 10 -- No Specification of Behavior for Prototype Pollution Payloads
- **Severity:** Low
- **Description:** The spec does not address prototype pollution, a JavaScript-specific attack vector. An attacker could send a JSON body such as `{ "a": 1, "b": 2, "__proto__": { "isAdmin": true } }` or `{ "a": 1, "b": 2, "constructor": { "prototype": { "isAdmin": true } } }`. Express's `express.json()` (which uses the `body-parser` library internally) is not vulnerable to prototype pollution in current versions because `JSON.parse()` does not invoke setters on `__proto__`. However, the spec does not specify that extra fields should be ignored (the Architect flagged this as Ambiguity #4), and a custom parser or future middleware change could introduce this vulnerability.
- **Recommended Fix:** The spec should explicitly state that only the `a` and `b` fields are read from the request body, and all other fields are ignored. The implementation should destructure only `a` and `b` from the parsed body and never pass the raw body object to other functions or middleware.

---

### FINDING 11 -- No Timeout or Request Deadline Specified
- **Severity:** Low
- **Description:** The spec does not define a maximum request processing time. While the arithmetic operations are trivially fast, the absence of a timeout means that if a middleware or error handler hangs (e.g., due to a bug in JSON parsing with a pathological payload), the connection will remain open indefinitely, consuming server resources. A slow loris attack (sending headers very slowly) would also be effective because no connection timeout is specified.
- **Recommended Fix:** The spec should mandate a request timeout (e.g., 5 seconds) at the server level. Node.js's `server.timeout` or `server.requestTimeout` should be configured. For production, a reverse proxy with connection timeouts is also recommended.

---

### FINDING 12 -- Spec Does Not Mandate Response Content-Type Header
- **Severity:** Low
- **Description:** The spec mandates that requests must have `Content-Type: application/json` but does not explicitly require that responses also include `Content-Type: application/json`. While Express's `res.json()` sets this automatically, the absence of this requirement in the spec means an implementation could use `res.send()` with a stringified JSON body and a wrong or missing Content-Type, leading to MIME confusion in clients. Combined with the missing `X-Content-Type-Options: nosniff` header (Finding 3), this could enable MIME sniffing attacks in older browsers.
- **Recommended Fix:** The spec should explicitly state that all responses must include `Content-Type: application/json`. This ensures that any conforming implementation, regardless of framework, sets the correct response content type.

---

### FINDING 13 -- No Protection Against JSON Parsing Denial-of-Service
- **Severity:** Low
- **Description:** The spec does not address protections against pathological JSON inputs that are technically valid but designed to exhaust parser resources. Examples include:
  - Deeply nested objects: `{"a":{"a":{"a":...}}}` (thousands of levels deep)
  - Very long string values: `{"a": "<100MB string>", "b": 1}`
  - Large numbers of keys: `{"a": 1, "b": 2, "c1": 0, "c2": 0, ... "c999999": 0}`

  These inputs would pass the Content-Type check (Rule 1) and be processed by the JSON parser before any validation rule rejects them. This is partially mitigated by a body size limit (Finding 2), but nesting depth is independent of payload size.
- **Recommended Fix:** Enforce a strict body size limit (Finding 2). This is the primary mitigation. Nesting depth attacks against `JSON.parse()` in V8 are limited by the call stack size and are unlikely to cause issues with payloads under 1KB. No additional nesting-depth check is needed if the body size limit is sufficiently restrictive.

---

### FINDING 14 -- Method Override Attacks Not Addressed
- **Severity:** Low
- **Description:** The spec states all endpoints are POST-only but does not address the `X-HTTP-Method-Override` header or the `_method` query parameter, which some middleware (e.g., `method-override`) uses to rewrite the HTTP method. If such middleware is present (or added later), a GET request with `X-HTTP-Method-Override: POST` could bypass method restrictions. While Express does not enable method override by default, the spec should explicitly prohibit this pattern.
- **Recommended Fix:** The spec should state that HTTP method override headers and query parameters must not be honored. The implementation must not use the `method-override` middleware or any equivalent.

---

## Summary

| Severity | Count | Findings |
|----------|-------|----------|
| Critical | 0 | -- |
| High | 2 | #1 (Rate Limiting), #2 (Payload Size Limit) |
| Medium | 5 | #3 (Security Headers), #4 (CORS), #5 (Server Fingerprinting), #6 (HTTPS/TLS), #7 (Error Oracle), #8 (Auth Framework) |
| Low | 6 | #9 (Logging), #10 (Prototype Pollution), #11 (Timeouts), #12 (Response Content-Type), #13 (JSON Parsing DoS), #14 (Method Override) |
| **Total** | **13** | |

---

## Overall Assessment

The spec defines a functionally clear API but is written purely from a functional correctness perspective with no security considerations. There are no critical vulnerabilities -- the API performs simple arithmetic with no data persistence, authentication, or external integrations -- but there are two high-severity gaps (rate limiting and payload size) that would make any conforming deployment vulnerable to denial-of-service attacks.

The medium-severity findings primarily address missing defense-in-depth measures (security headers, CORS policy, server fingerprinting, HTTPS) that become increasingly important as the spec evolves toward the planned web interface phase. The spec's commitment to API contract stability means these security gaps will persist into future phases unless addressed now.

The low-severity findings are hardening recommendations that reflect security best practices but are not exploitable attack vectors in the current minimal scope.

**Recommendation:** Address the two High findings (rate limiting and payload size limit) before build. The Medium findings should be addressed before any production deployment or before beginning the web interface phase. Low findings are at the Architect's discretion.
