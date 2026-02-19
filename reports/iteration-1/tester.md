# Tester Report — Iteration 1

## Environment
- Target: `http://localhost:3000`
- Method: Black-box HTTP only
- Runtime used for test harness: Node.js (`http` client requests)

## Group Results
- GROUP 1 — Happy Path: PASS (4/4)
- GROUP 2 — Negative Numbers: PASS (4/4)
- GROUP 3 — Zero Behavior: PASS (4/4)
- GROUP 4 — Division Floor Behavior: PASS (3/3)
- GROUP 5 — Boundary Values: PASS (4/4)
- GROUP 6 — Divide by Zero: PASS (3/3)
- GROUP 7 — Invalid Input Types: PASS (7/7)
- GROUP 8 — Missing Fields: PASS (3/3)
- GROUP 9 — Malformed Requests: PASS (3/3)

## Request/Response Excerpts
- TEST 1.1 — Addition basic
  - Status: PASS
  - Expected: `200 {"operation":"addition","a":10,"b":5,"result":15}`
  - Received: `200 {"operation":"addition","a":10,"b":5,"result":15}`

- TEST 4.2 — Division floor with negative input
  - Status: PASS
  - Expected: `200 {"operation":"division","a":-10,"b":3,"result":-4}`
  - Received: `200 {"operation":"division","a":-10,"b":3,"result":-4}`

- TEST 9.1 — Invalid JSON body
  - Status: PASS
  - Expected: `400 {"error":"Invalid JSON body"}`
  - Received: `400 {"error":"Invalid JSON body"}`

- TEST 9.2 — Missing Content-Type
  - Status: PASS
  - Expected: `400 {"error":"Content-Type must be application/json"}`
  - Received: `400 {"error":"Content-Type must be application/json"}`

=====================================
RESULTS: 35 passed, 0 failed out of 35
=====================================
