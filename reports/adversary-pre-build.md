# Adversary Pre-Build Report -- Spec Attack Surface Analysis

**Date:** 2026-02-18
**Spec reviewed:** `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-app-spec.md`
**Companion documents reviewed:**
- `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-api/reports/architect-eval-0.md`
- `/Users/pudubrewshowie/code-repose/github/calculator-test/calculator-api/reports/ciso-pre-build.md`

**Author:** Adversary Agent (Step 3 -- Pre-Build Adversarial Attack on Spec)

---

## Scope

This review covers logical and functional attack surfaces in the spec -- inputs, sequences, type coercion traps, boundary conditions, ordering bugs, special numeric values, JSON parsing edge cases, and combinations of valid-seeming inputs that produce incorrect results. Security infrastructure gaps (rate limiting, headers, auth, CORS, TLS, logging, etc.) are covered by the CISO report and are not duplicated here.

---

## Findings

### FINDING 1 -- Negative Division Floor Produces Counter-Intuitive Results That Naive Implementations Will Get Wrong
- **Severity:** Critical
- **Attack Description:** Send `POST /divide` with `{ "a": -7, "b": 2 }`. The spec says "floored integer value," meaning `Math.floor(-3.5) = -4`. However, most developers instinctively reach for `Math.trunc()`, the bitwise OR trick (`result | 0`), or `parseInt(result)`, all of which return `-3`. This is not a theoretical risk -- it is the single most likely functional bug in any JavaScript implementation. The same issue applies to `{ "a": 7, "b": -2 }` (expected `-4`, trunc gives `-3`). The Architect flagged this as an ambiguity, but it is not ambiguous: the spec literally says "floored," and `Math.floor()` has a precise mathematical definition. A naive implementation will silently produce wrong answers for all negative non-exact divisions.
- **Expected Behavior:** `{ "a": -7, "b": 2 }` returns `{ "result": -4 }`. `{ "a": 7, "b": -2 }` returns `{ "result": -4 }`. `{ "a": -7, "b": -2 }` returns `{ "result": 3 }`.
- **Actual Risk:** Implementation uses `Math.trunc()`, `parseInt()`, or `| 0`, producing `-3` for the first two cases. All positive-number tests pass, so this bug survives the happy path.
- **Severity Rationale:** The API returns mathematically incorrect results silently (no error, just a wrong number). This is a correctness failure that passes all positive-number tests. Critical because the contract is violated with no error signal.

---

### FINDING 2 -- `Math.floor()` on Division of -1000000 by -999999 Produces a Subtly Wrong Result if Implemented with Bitwise OR
- **Severity:** High
- **Attack Description:** The bitwise OR trick (`result | 0`) is a common JavaScript shortcut for "truncating to integer." It has two problems: (1) it truncates toward zero, not toward negative infinity, and (2) it converts the operand to a 32-bit signed integer, meaning any result outside the range [-2147483648, 2147483647] silently wraps around. While the spec's input range of [-1000000, 1000000] keeps multiplication results within safe range for this trick (max 10^12, which overflows 32 bits), the real danger is that a developer uses `| 0` for division thinking it is equivalent to `Math.floor()`. For division within the spec's range, the magnitude will always fit in 32 bits, but the sign-direction bug from Finding 1 still applies. Additionally, if the developer uses `| 0` for the multiplication operation "just to be safe," a result like `1000000 * 1000000 = 1000000000000` (10^12) would be silently truncated to a garbage 32-bit value: `1000000000000 | 0` evaluates to `-727379968` in JavaScript.
- **Expected Behavior:** `POST /multiply { "a": 1000000, "b": 1000000 }` returns `{ "result": 1000000000000 }`.
- **Actual Risk:** If the developer applies a bitwise truncation anywhere in the arithmetic pipeline (a defensive "ensure integer" pattern), multiplication of large values returns a completely wrong number. The result is not just slightly off -- it is negative when it should be positive, and off by orders of magnitude.
- **Severity Rationale:** Silent data corruption on valid inputs within spec range. The implementation passes all small-number tests. High because it requires the developer to make a specific (but common) defensive coding mistake, and the spec does not warn against it.

---

### FINDING 3 -- `Number.isInteger(1.0)` Returns True, Making `1.0` a Valid Input via JSON
- **Severity:** Medium
- **Attack Description:** In JSON, the value `1.0` is a valid number literal. JavaScript's `JSON.parse('{"a": 1.0, "b": 2}')` produces `{ a: 1, b: 2 }` because JavaScript makes no distinction between `1.0` and `1` at the language level -- they are the same IEEE 754 double. `Number.isInteger(1.0)` returns `true`. This means `1.0` passes all validation rules and is accepted as if it were `1`. The spec says "floats (e.g. `1.5`) are invalid" but does not address floats that happen to represent whole numbers. This is arguably correct behavior (the number IS an integer), but it creates an inconsistency: the spec conceptually rejects "floats" yet `1.0` is accepted because JavaScript cannot distinguish it from `1` after JSON parsing. A tester who sends `1.0` expecting rejection will get acceptance, and both sides are arguably right.
- **Expected Behavior:** The spec does not explicitly address this case. The Architect recommended accepting it (Ambiguity #7). The implementation should accept `1.0` as equivalent to `1`.
- **Actual Risk:** A naive implementation that uses `typeof val === 'number' && val % 1 === 0` or `Number.isInteger()` will accept `1.0`, which is likely the correct behavior. The risk is that a tester flags this as a bug, or an overly strict implementation uses string-level checking (e.g., regex on the raw body) that rejects `1.0`. The real attack here is a test-spec disagreement, not a runtime failure.
- **Severity Rationale:** Medium because it is an unresolved ambiguity that could cause test failures or implementation disagreements. The spec should explicitly state that `1.0` is accepted (since it is indistinguishable from `1` in JavaScript).

---

### FINDING 4 -- Validation Rule Ordering: `null` Value Triggers Rule 3 or Rule 4 Depending on Implementation
- **Severity:** High
- **Attack Description:** Send `POST /add` with `{ "a": null, "b": 5 }`. The key `a` is present in the JSON (it exists), but its value is `null`. Rule 3 says "both a and b must be present." Rule 4 says "both a and b must be integers -- null is invalid." A developer checking `if (a === undefined || b === undefined)` for Rule 3 will let `null` pass to Rule 4. A developer checking `if (a == null || b == null)` (loose equality, which matches both `null` and `undefined`) will trigger Rule 3. The spec mandates exact error messages and exact rule ordering, so which error message is returned is a testable, observable difference. The Architect recommended treating `null` as Rule 4, but the spec itself is silent. An adversary (or a test agent) could assert either behavior and be arguably correct.
- **Expected Behavior:** The spec does not define this case. The Architect's recommendation is: absent key triggers Rule 3, `null` value triggers Rule 4.
- **Actual Risk:** Implementation uses `== null` (loose equality) to check for "missing," which catches both `undefined` and `null`, returning Rule 3's error for `null` values. This is defensible but conflicts with the Architect's recommendation. If the test agent follows the Architect and the build agent uses loose equality, the test fails on a spec ambiguity, not a real bug. Conversely, if both agree but the spec intended the other interpretation, the API behavior is subtly wrong.
- **Severity Rationale:** High because the spec mandates exact error messages and exact ordering. A disagreement here causes observable test failures. The spec must resolve this ambiguity.

---

### FINDING 5 -- Sending `{ "a": 10, "b": 5 }` as a String in the Body Without Proper Content-Type
- **Severity:** Medium
- **Attack Description:** Send a POST request with `Content-Type: application/json` but the body is the raw string `not json at all`. Express's `express.json()` middleware will throw a `SyntaxError` with a 400 status. However, the default error message from Express is NOT the spec-mandated `"Invalid JSON body"`. If the developer relies on Express's default error handling, the error message will be something like `"Unexpected token 'n', \"not json at all\" is not valid JSON"` -- a verbatim violation of the spec. The developer must intercept the `express.json()` parse error and replace it with the spec's exact string.
- **Expected Behavior:** `400` with `{ "error": "Invalid JSON body" }`.
- **Actual Risk:** Express's default JSON parse error handler returns a different error message. A naive implementation that does not customize the error handler will fail this test case. This is a common Express.js pitfall.
- **Severity Rationale:** Medium because the functional behavior (400 rejection) is correct, but the error message contract is violated. Since the spec mandates exact strings and the testing agent will check them, this is a guaranteed test failure for naive implementations.

---

### FINDING 6 -- Empty JSON Object `{}` Should Trigger Rule 3, Not Rule 4
- **Severity:** Medium
- **Attack Description:** Send `POST /add` with `{}`. The body is valid JSON (passes Rule 2). Neither `a` nor `b` is present (both are `undefined`). This should trigger Rule 3: "Both a and b are required." However, if the developer checks presence and type in a single step (e.g., `if (!Number.isInteger(body.a) || !Number.isInteger(body.b))`) then the error from Rule 4 is returned instead. `Number.isInteger(undefined)` returns `false`, so a combined check would incorrectly say "must be integers" instead of "are required."
- **Expected Behavior:** `400` with `{ "error": "Both a and b are required" }`.
- **Actual Risk:** Developer merges Rule 3 and Rule 4 into a single check, returning the wrong error message. This is a very common implementation shortcut that violates the mandated rule ordering. The spec explicitly says rules are checked in order and the error from the failing step is returned.
- **Severity Rationale:** Medium because the request is still rejected (correct status code), but the wrong error message is returned, violating the spec contract.

---

### FINDING 7 -- Sending `Infinity`, `-Infinity`, or `NaN` as Input Values
- **Severity:** Medium
- **Attack Description:** `JSON.parse()` in JavaScript does not produce `Infinity`, `-Infinity`, or `NaN` from standard JSON (these are not valid JSON values). However, an attacker could potentially get these values into the system if the implementation uses any non-standard JSON parsing, or if a developer adds a custom reviver that converts strings to numbers. More importantly, `Number.isInteger(Infinity)` returns `false`, `Number.isInteger(NaN)` returns `false`, and `Number.isInteger(-Infinity)` returns `false`, so the standard check catches them. The real attack surface is if the developer uses `typeof val === 'number' && val % 1 === 0` instead: `Infinity % 1` returns `NaN`, which is falsy, so this alternative check also correctly rejects `Infinity`. However, the tester should verify that these values are not somehow injectable through alternative paths (e.g., a body like `{ "a": 1e999, "b": 1 }` -- `JSON.parse` converts `1e999` to `Infinity`, and `Number.isInteger(Infinity)` is `false`, so Rule 4 fires). The interesting part: should `1e999` trigger Rule 3 (not present as a meaningful value), Rule 4 (not an integer), or Rule 5 (out of range)? It triggers Rule 4, which is correct if the implementation uses `Number.isInteger()`.
- **Expected Behavior:** `{ "a": 1e999, "b": 1 }` triggers Rule 4: `{ "error": "Both a and b must be integers" }`.
- **Actual Risk:** If the developer checks type differently (e.g., `typeof a === 'number'` without the integer check), `Infinity` passes as a "number" and then the range check (Rule 5) must catch it. `Infinity > 1000000` is `true`, so Rule 5 would catch it, but the error message would be wrong (Rule 5 instead of Rule 4). The behavior is technically still a 400 rejection, but with the wrong error message for the wrong reason.
- **Severity Rationale:** Medium because standard JSON parsing makes this partially self-mitigating, but the `1e999` vector is real and the tester should verify the correct error message is returned.

---

### FINDING 8 -- Multiplication Result Exceeds `Number.MAX_SAFE_INTEGER` for Large Inputs
- **Severity:** High
- **Attack Description:** Send `POST /multiply` with `{ "a": 1000000, "b": 1000000 }`. The result is `1000000000000` (10^12), which is well within `Number.MAX_SAFE_INTEGER` (2^53 - 1, approximately 9 * 10^15). However, the spec does not define a result range, only an input range. More concerning is what happens with subtraction and addition at the boundaries: `{ "a": -1000000, "b": 1000000 }` for subtraction gives `-2000000`, and `{ "a": 1000000, "b": 1000000 }` for addition gives `2000000` -- both outside the input range but within safe integer range. The spec echoes the result as an integer in the response. If a developer defensively validates the result against the input range (thinking "all values must be in range"), they would incorrectly reject valid computations. The spec does NOT say the result must be in range -- only the inputs.
- **Expected Behavior:** `POST /multiply { "a": 1000000, "b": 1000000 }` returns `{ "result": 1000000000000 }`. `POST /add { "a": 1000000, "b": 1000000 }` returns `{ "result": 2000000 }`. No range validation on results.
- **Actual Risk:** A cautious developer applies the [-1000000, 1000000] range check to the result as well as the inputs, incorrectly rejecting valid operations whose results exceed the input range. This is especially likely because the response schema says `"result": <integer>` and the developer might assume the same constraints apply.
- **Severity Rationale:** High because a defensive but incorrect implementation rejects valid requests, and the spec's silence on result range makes this mistake plausible. Multiplication of max-range values produces results far outside the input range.

---

### FINDING 9 -- Content-Type Header Check: `application/json; charset=utf-8` Must Be Accepted
- **Severity:** Medium
- **Attack Description:** Many HTTP clients (including Postman, Axios, and browsers) send `Content-Type: application/json; charset=utf-8` rather than bare `application/json`. If the developer implements a strict string equality check (`req.headers['content-type'] === 'application/json'`), these requests will be rejected with Rule 1's error even though the content type is semantically correct. Express's `req.is('application/json')` method handles this correctly by checking only the media type portion. The spec says the request "must have Content-Type: application/json header" without addressing parameters.
- **Expected Behavior:** `Content-Type: application/json; charset=utf-8` should be accepted (per the Architect's recommendation and HTTP conventions).
- **Actual Risk:** Strict string comparison rejects legitimate clients. This is a common bug in hand-rolled Content-Type checks. The implementation appears correct but breaks real-world HTTP clients.
- **Severity Rationale:** Medium because it causes false rejections of valid requests from standard HTTP clients.

---

### FINDING 10 -- Non-Object JSON Bodies: Arrays, Strings, Numbers, Booleans, `null`
- **Severity:** Medium
- **Attack Description:** Send `POST /add` with `Content-Type: application/json` and body `[1, 2]`. This is valid JSON (passes Rule 2). After parsing, `body.a` and `body.b` are both `undefined` because arrays do not have named properties `a` and `b`. This should trigger Rule 3. However, if the developer checks `typeof body === 'object' && body !== null` before checking for `a` and `b`, an array passes this check (arrays are objects in JavaScript). The issue arises with other JSON primitives: body `42` parses to a number, body `"hello"` parses to a string, body `true` parses to a boolean, body `null` parses to `null`. Accessing `.a` on a number or string may behave differently than accessing `.a` on an object. For example, `(42).a` is `undefined`, `"hello".a` is `undefined`, `null.a` throws a `TypeError`. If the developer does `const { a, b } = body` and `body` is `null`, this throws an exception that could crash the request handler or return a 500 error instead of the expected 400.
- **Expected Behavior:** All non-object JSON bodies should pass Rule 2 (valid JSON) and fail at Rule 3 (a and b missing), returning `{ "error": "Both a and b are required" }` with status 400.
- **Actual Risk:** Destructuring `null` (`const { a, b } = null`) throws a `TypeError`. If the developer does not guard against this, the server returns a 500 error or crashes. Similarly, `express.json()` may not parse bare primitives depending on the `strict` option (which defaults to `true`, meaning only objects and arrays are accepted). If `strict` is `true`, a bare `42` or `"hello"` body triggers a parse error, which would return Rule 2's error instead of Rule 3's -- arguably acceptable but different from a non-strict parser.
- **Severity Rationale:** Medium because the `null` body case can cause an unhandled exception (500 instead of 400), and the behavior difference between strict and non-strict JSON parsing changes which rule fires.

---

### FINDING 11 -- Integer That Looks Like a Float in JSON: Scientific Notation
- **Severity:** Medium
- **Attack Description:** Send `POST /add` with `{ "a": 1e2, "b": 5 }`. In JSON, `1e2` is valid and parses to `100` in JavaScript. `Number.isInteger(100)` returns `true`. This should be accepted. But what about `1e-1`? That parses to `0.1`, and `Number.isInteger(0.1)` returns `false` -- correctly rejected. The tricky case is `1e20`: this parses to `100000000000000000000`, which is greater than 1000000, so Rule 5 catches it. But `Number.isInteger(1e20)` returns `true`, so Rule 4 does not fire. The correct rule order means Rule 4 (integer check) passes and Rule 5 (range check) rejects. The attack is: does the implementation correctly handle scientific notation in JSON? Most will, since `JSON.parse` handles this natively, but a developer who pre-validates the raw body string with a regex (e.g., `/^\d+$/`) might reject valid scientific notation.
- **Expected Behavior:** `{ "a": 1e2, "b": 5 }` is accepted and returns `{ "result": 105 }`. `{ "a": 1e20, "b": 5 }` returns Rule 5 error (out of range).
- **Actual Risk:** Low-to-medium. If the developer does any string-level validation before JSON parsing, scientific notation may be incorrectly rejected. After JSON parsing, JavaScript handles this correctly.
- **Severity Rationale:** Medium because scientific notation is valid JSON that some hand-rolled validators will reject.

---

### FINDING 12 -- Validation Order Attack: Type Error Masks Range Error
- **Severity:** Medium
- **Attack Description:** Send `POST /add` with `{ "a": "hello", "b": 9999999 }`. Rule 4 (integer check) fires before Rule 5 (range check). The error message is "Both a and b must be integers." But what about `{ "a": 5000000, "b": 5000000 }`? Both values are integers (passes Rule 4) but both are out of range (fails Rule 5). The error message is "Values must be between -1000000 and 1000000." Now consider the mixed case: `{ "a": "hello", "b": 5000000 }`. Rule 4 checks that BOTH are integers. Since `a` is not an integer, Rule 4 fires immediately. The out-of-range `b` is never evaluated. This is the correct behavior per the spec, but a naive implementation that checks `a` and `b` independently might check `a` for type, then `a` for range, then `b` for type, then `b` for range -- which would return the type error (correct for the wrong reason). However, an implementation that checks all of Rule 4 first and all of Rule 5 second is correct. The subtlety is: what if `a` passes type but fails range, and `b` fails type? If the implementation checks Rule 4 for both values, it should report "both must be integers" (because `b` fails Rule 4). But if it checks `a` through all rules first, then `b` through all rules, it would report "Values must be between -1000000 and 1000000" for `a` first. This is a rule-ordering bug.
- **Expected Behavior:** The spec says Rule 4 is checked before Rule 5. This means: check both `a` and `b` for integer type FIRST (Rule 4), and only if both pass, check both for range (Rule 5). `{ "a": 5000000, "b": "hello" }` must return Rule 4 error (because `b` fails Rule 4), NOT Rule 5 error (even though `a` fails Rule 5).
- **Actual Risk:** Implementation validates per-field (type+range for `a`, then type+range for `b`) instead of per-rule (type for both, then range for both). This produces Rule 5 error instead of Rule 4 error for mixed invalid inputs.
- **Severity Rationale:** Medium because the request is still correctly rejected, but the wrong error message is returned, violating the spec's rule ordering contract.

---

### FINDING 13 -- Division of Minimum by -1: Edge Case at Boundary
- **Severity:** Low
- **Attack Description:** Send `POST /divide` with `{ "a": -1000000, "b": -1 }`. The result is `1000000`, which is a clean integer (no floor needed) and within representable range. This is a benign case that should work. More interesting: `POST /divide { "a": -1000000, "b": -3 }` should return `Math.floor(333333.333...) = 333333`. And `POST /divide { "a": -1000000, "b": 3 }` should return `Math.floor(-333333.333...) = -333334`. The negative floor direction is the real test here (same class as Finding 1 but at boundary values).
- **Expected Behavior:** `{ "a": -1000000, "b": 3 }` returns `{ "result": -333334 }`. `{ "a": -1000000, "b": -3 }` returns `{ "result": 333333 }`.
- **Actual Risk:** Same as Finding 1, but at the exact boundary of the accepted range. If the developer is validating the result against some expected range, this case is a useful edge test.
- **Severity Rationale:** Low because this is the same class of bug as Finding 1, just at boundary values. It is a useful test case rather than a new attack surface.

---

### FINDING 14 -- Negative Zero: `-0` as Input and Output
- **Severity:** Low
- **Attack Description:** In JavaScript, `-0` is a distinct value from `0`. `Number.isInteger(-0)` returns `true`. `-0 === 0` returns `true`. However, `JSON.stringify(-0)` returns `"0"` (positive zero), so the response will show `"result": 0` even if the internal computation produced `-0`. The attacker sends: `POST /multiply { "a": -1, "b": 0 }` -- the result is `-0` in JavaScript. Or `POST /add { "a": 0, "b": 0 }` where one input is literally `-0` in JSON: `{ "a": -0, "b": 0 }` -- `JSON.parse` converts `-0` to `-0`, and `-0 + 0` equals `0` (positive). `JSON.stringify` will output `0`. For inputs: `-0` is accepted by `Number.isInteger()` and is within range. The input is echoed back in the response as `"a": 0` (positive zero, because `JSON.stringify(-0) === "0"`). This means the echoed input does not exactly match what was sent.
- **Expected Behavior:** The spec does not address `-0`. A reasonable interpretation is that `-0` and `0` are treated identically. The response may echo `0` for a `-0` input.
- **Actual Risk:** Minimal functional risk. The only observable anomaly is that the echoed `a` or `b` in the response may not bitwise-match the input. A strict tester using `Object.is()` comparisons (which distinguishes `-0` from `0`) might flag this, but `JSON.stringify` normalizes it.
- **Severity Rationale:** Low because JavaScript and JSON normalize `-0` to `0` in serialization, so there is no observable API-level bug. It is a pedantic edge case.

---

### FINDING 15 -- Duplicate Keys in JSON Body: `{ "a": 1, "a": 2, "b": 3 }`
- **Severity:** Low
- **Attack Description:** The JSON spec (RFC 8259) says object member names "SHOULD be unique" but does not mandate it. `JSON.parse('{"a": 1, "a": 2, "b": 3}')` in JavaScript produces `{ a: 2, b: 3 }` -- the last value wins. An attacker sends `{ "a": 1000001, "a": 5, "b": 5 }`. The first `a` is out of range, but after parsing, `a` is `5` (the last value), which is valid. The API accepts the request and computes the result using `a = 5`. This is technically correct (the parsed value IS 5), but the attacker could argue that an out-of-range value was "accepted." This is a JSON-level quirk, not an API bug, but it is worth documenting.
- **Expected Behavior:** The API sees the parsed result (`a = 5`) and processes it normally. This is correct.
- **Actual Risk:** No functional risk. The attacker cannot exploit this to bypass validation because the parsed value is what gets validated. However, if request logging logs the raw body, there could be a discrepancy between the logged input and the processed input (a log injection / log confusion vector, but that is in the CISO's domain).
- **Severity Rationale:** Low because the behavior is correct after JSON parsing. It is a documentation-worthy quirk, not a bug.

---

### FINDING 16 -- Express `strict` Mode and Bare Primitive JSON Bodies
- **Severity:** Medium
- **Attack Description:** Express's `express.json()` middleware has a `strict` option (default: `true`) that only accepts arrays and objects as top-level JSON values. With `strict: true`, sending a body of `42` or `"hello"` or `true` or `null` triggers a parse error from Express, which would produce Rule 2's error ("Invalid JSON body"). With `strict: false`, these parse successfully, and then `body.a` / `body.b` would be `undefined` on primitives, triggering Rule 3. The spec says: (1) body must be valid JSON (Rule 2), then (2) a and b must be present (Rule 3). A bare `42` IS valid JSON per RFC 8259. So the correct behavior per the spec is: Rule 2 passes, Rule 3 fires. But if `express.json({ strict: true })` is used (the default), Express itself rejects the body as "invalid," and the developer's custom error handler returns Rule 2's error. This means the default Express configuration produces the WRONG rule for bare primitive JSON bodies.
- **Expected Behavior:** `42` is valid JSON, so Rule 2 should pass. Then `a` and `b` are missing, so Rule 3 should fire: `{ "error": "Both a and b are required" }`.
- **Actual Risk:** Express's default `strict: true` setting treats bare primitives as parse errors, causing Rule 2 to fire instead of Rule 3. If the developer uses `strict: false`, primitives parse correctly but then `null` bodies can cause destructuring crashes (Finding 10). This is a no-win configuration -- either the rule ordering is wrong or the developer must add explicit null guards.
- **Severity Rationale:** Medium because the spec's rule ordering is violated for a class of valid JSON inputs when using Express's default configuration. The tester should verify whether `42` triggers Rule 2 or Rule 3.

---

### FINDING 17 -- Boundary Exact Values: `-1000000` and `1000000` Must Be Accepted, `-1000001` and `1000001` Must Be Rejected
- **Severity:** Medium
- **Attack Description:** Classic off-by-one boundary test. Send `POST /add` with `{ "a": 1000000, "b": 1 }`. Input `a = 1000000` is valid (boundary inclusive). Input `b = 1` is valid. Result is `1000001`. Now send `{ "a": 1000001, "b": 1 }`. Input `a = 1000001` is out of range. The error must be Rule 5. An implementation using `< 1000000` instead of `<= 1000000` (or `> -1000000` instead of `>= -1000000`) will incorrectly reject the boundary values. This is one of the most common bugs in range checking.
- **Expected Behavior:** `{ "a": 1000000, "b": 0 }` returns `{ "result": 1000000 }`. `{ "a": 1000001, "b": 0 }` returns Rule 5 error. Same for `-1000000` (accepted) vs `-1000001` (rejected).
- **Actual Risk:** Off-by-one error in range comparison (`<` vs `<=`) causes boundary values to be incorrectly rejected or accepted.
- **Severity Rationale:** Medium because off-by-one errors are extremely common and the spec explicitly defines inclusive boundaries.

---

### FINDING 18 -- Content-Type Check Must Precede Body Parsing, But Express Couples Them
- **Severity:** High
- **Attack Description:** The spec says Rule 1 (Content-Type check) must fire before Rule 2 (JSON parse). In Express, `express.json()` middleware performs BOTH checks: it verifies Content-Type and parses the body. If the Content-Type is wrong, Express skips parsing and leaves `req.body` as `undefined`. But Express does not throw an error -- it silently skips. This means if the developer relies solely on `express.json()`, a request with `Content-Type: text/plain` and body `not json` will NOT trigger any error from Express. The request proceeds to the route handler with `req.body === undefined`. If the route handler does not explicitly check Content-Type first, it will try to read `body.a` and `body.b`, hit `undefined.a`, and throw a `TypeError` (500 error). The developer MUST add a middleware before `express.json()` that checks the Content-Type header independently.
- **Expected Behavior:** Missing or wrong Content-Type returns `400` with `{ "error": "Content-Type must be application/json" }`.
- **Actual Risk:** Without a dedicated Content-Type middleware, requests with wrong Content-Type cause 500 errors (unhandled exception) instead of the spec-mandated 400 error. This is an Express-specific implementation trap that the spec's rule ordering makes inevitable.
- **Severity Rationale:** High because the default Express.js behavior does not support the spec's required rule ordering. The developer must explicitly implement a separate Content-Type check, and failing to do so produces 500 errors instead of 400.

---

### FINDING 19 -- Unicode and Special Characters in JSON Keys
- **Severity:** Low
- **Attack Description:** Send `POST /add` with `{ "\u0061": 10, "b": 5 }`. The Unicode escape `\u0061` is the character `a`. `JSON.parse` resolves this to the key `a`. So `body.a` is `10`, and the request should be processed normally. This is not a bug -- it is correct JSON behavior. However, an attacker could also send `{ "a ": 10, "b": 5 }` (key `a` with a trailing space) or `{ "A": 10, "b": 5 }` (uppercase). These are distinct keys from `a`, and `body.a` would be `undefined`, triggering Rule 3. The risk is that a developer uses case-insensitive key matching or trims keys, which would accept inputs that should be rejected.
- **Expected Behavior:** Only exact key names `a` and `b` are accepted. `A`, `a `, ` a`, `\u0061` (which resolves to `a`) are treated according to JSON parsing rules.
- **Actual Risk:** Minimal. `JSON.parse` handles Unicode escapes correctly, and JavaScript property access is case-sensitive. The only risk is a developer who manually normalizes keys (unlikely).
- **Severity Rationale:** Low because standard JSON parsing and JavaScript property access handle this correctly.

---

### FINDING 20 -- Division: `0 / 0` Should Trigger Divide-by-Zero, Not Return `NaN`
- **Severity:** Medium
- **Attack Description:** Send `POST /divide` with `{ "a": 0, "b": 0 }`. In JavaScript, `0 / 0` evaluates to `NaN`. The spec says Rule 6 checks "b must not be zero" for the divide endpoint. Since `b = 0`, Rule 6 fires, returning `{ "error": "Division by zero is not allowed" }`. The implementation must check `b === 0` BEFORE performing the division. If the developer performs the division first and then checks whether the result is `NaN` or `Infinity`, the check might not match the spec's rule ordering (Rule 6 should fire at validation time, not at computation time). Additionally, `Math.floor(NaN)` returns `NaN`, and `JSON.stringify({ result: NaN })` produces `{ "result": null }` because `NaN` is not a valid JSON value. This would be a silent data corruption bug if the division is performed before the zero-check.
- **Expected Behavior:** `{ "a": 0, "b": 0 }` returns `400` with `{ "error": "Division by zero is not allowed" }`.
- **Actual Risk:** If the developer computes first and validates after, `0/0 = NaN` is serialized as `null` in the JSON response, returning `{ "result": null }` with status 200. This is a silent, incorrect success response.
- **Severity Rationale:** Medium because computing before validating is a common pattern, and the `NaN` to `null` serialization is a well-known JavaScript gotcha.

---

### FINDING 21 -- Large Negative Divided by Large Positive: Floor Direction Combined with Boundary
- **Severity:** Low
- **Attack Description:** Send `POST /divide` with `{ "a": -999999, "b": 999999 }`. The result is `-1.000001000001...`, and `Math.floor(-1.000001)` is `-2`. This is a surprising result -- dividing numbers that are almost equal in magnitude but opposite in sign gives a result of `-2`, not `-1`. This is mathematically correct for floor division, but it will surprise developers who expect truncation toward zero. This is a sub-case of Finding 1, but with values closer together, making the floor-vs-trunc difference more jarring.
- **Expected Behavior:** `Math.floor(-999999 / 999999)` = `Math.floor(-1.000001000001)` = `-2`.
- **Actual Risk:** Same as Finding 1. Useful as a test case because the inputs are "almost equal" which makes the `-2` result feel wrong to human reviewers.
- **Severity Rationale:** Low because this is the same bug class as Finding 1. It is a good test case for catching trunc-vs-floor confusion.

---

## Summary

| Severity | Count | Findings |
|----------|-------|----------|
| Critical | 1 | #1 (Negative Floor Division) |
| High | 4 | #2 (Bitwise OR Truncation on Multiply), #4 (null Triggers Rule 3 vs Rule 4), #8 (Result Range Validation), #18 (Content-Type Check Before Body Parsing) |
| Medium | 9 | #3 (1.0 as Integer Ambiguity), #5 (Express JSON Parse Error Message), #6 (Empty Object Rule 3 vs Rule 4), #7 (Infinity/NaN via Scientific Notation), #9 (Content-Type with Charset), #10 (Non-Object JSON Bodies), #11 (Scientific Notation), #12 (Validation Per-Rule vs Per-Field Ordering), #16 (Express Strict Mode vs Bare Primitives), #17 (Boundary Off-by-One), #20 (0/0 NaN Serialization) |
| Low | 5 | #13 (Division at Boundary with Negative Floor), #14 (Negative Zero), #15 (Duplicate JSON Keys), #19 (Unicode Key Escapes), #21 (Near-Equal Magnitude Floor Division) |
| **Total** | **21** | |

Note: Finding count in Medium is 11 (Findings 3, 5, 6, 7, 9, 10, 11, 12, 16, 17, 20). The table has been corrected below.

---

## Corrected Summary

| Severity | Count | Findings |
|----------|-------|----------|
| Critical | 1 | #1 |
| High | 4 | #2, #4, #8, #18 |
| Medium | 11 | #3, #5, #6, #7, #9, #10, #11, #12, #16, #17, #20 |
| Low | 5 | #13, #14, #15, #19, #21 |
| **Total** | **21** | |

---

## Overall Assessment

The spec defines a simple API, but the combination of JavaScript's type system, Express.js's middleware behavior, and the spec's strict rule-ordering requirements creates a dense field of implementation traps. The single most likely bug is negative floor division (Finding 1), which will silently produce wrong results for roughly half of all non-exact division inputs. The Express.js-specific traps (Findings 5, 10, 16, 18) are the next most likely -- a developer who trusts Express's defaults will violate the spec's rule ordering and error message requirements without realizing it.

The high-severity findings (#2, #4, #8, #18) all share a common theme: the spec's requirements conflict with the "obvious" implementation path in Express.js/JavaScript. A developer who writes the simplest correct-looking code will hit at least three of these bugs. The testing agent should prioritize negative division, boundary values, null/undefined distinction, and Express middleware ordering in its test suite.
