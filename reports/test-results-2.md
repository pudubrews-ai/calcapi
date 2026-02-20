# Calculator API — Test Results (Iteration 2)

**Date:** 2026-02-18
**Server:** http://localhost:3000
**Total Tests:** 30

---

## GROUP 1 — Happy Path (all 4 endpoints)

TEST 1.1 — Addition basic
  Status:   PASS
  Expected: 200 {"operation":"addition","a":10,"b":5,"result":15}
  Received: 200 {"operation":"addition","a":10,"b":5,"result":15}

TEST 1.2 — Subtraction basic
  Status:   PASS
  Expected: 200 {"operation":"subtraction","a":10,"b":5,"result":5}
  Received: 200 {"operation":"subtraction","a":10,"b":5,"result":5}

TEST 1.3 — Multiplication basic
  Status:   PASS
  Expected: 200 {"operation":"multiplication","a":10,"b":5,"result":50}
  Received: 200 {"operation":"multiplication","a":10,"b":5,"result":50}

TEST 1.4 — Division basic
  Status:   PASS
  Expected: 200 {"operation":"division","a":10,"b":5,"result":2}
  Received: 200 {"operation":"division","a":10,"b":5,"result":2}

---

## GROUP 2 — Negative Numbers

TEST 2.1 — Add two negatives
  Status:   PASS
  Expected: 200 {"operation":"addition","a":-5,"b":-3,"result":-8}
  Received: 200 {"operation":"addition","a":-5,"b":-3,"result":-8}

TEST 2.2 — Subtract resulting in negative
  Status:   PASS
  Expected: 200 {"operation":"subtraction","a":3,"b":10,"result":-7}
  Received: 200 {"operation":"subtraction","a":3,"b":10,"result":-7}

TEST 2.3 — Multiply a negative and a positive
  Status:   PASS
  Expected: 200 {"operation":"multiplication","a":-4,"b":3,"result":-12}
  Received: 200 {"operation":"multiplication","a":-4,"b":3,"result":-12}

TEST 2.4 — Divide a negative by a positive
  Status:   PASS
  Expected: 200 {"operation":"division","a":-9,"b":3,"result":-3}
  Received: 200 {"operation":"division","a":-9,"b":3,"result":-3}

---

## GROUP 3 — Zero Behavior

TEST 3.1 — Add zero
  Status:   PASS
  Expected: 200 {"operation":"addition","a":0,"b":5,"result":5}
  Received: 200 {"operation":"addition","a":0,"b":5,"result":5}

TEST 3.2 — Multiply by zero
  Status:   PASS
  Expected: 200 {"operation":"multiplication","a":100,"b":0,"result":0}
  Received: 200 {"operation":"multiplication","a":100,"b":0,"result":0}

TEST 3.3 — Subtract to reach zero
  Status:   PASS
  Expected: 200 {"operation":"subtraction","a":5,"b":5,"result":0}
  Received: 200 {"operation":"subtraction","a":5,"b":5,"result":0}

TEST 3.4 — Divide zero by a number
  Status:   PASS
  Expected: 200 {"operation":"division","a":0,"b":5,"result":0}
  Received: 200 {"operation":"division","a":0,"b":5,"result":0}

---

## GROUP 4 — Division Floor Behavior

TEST 4.1 — Division with remainder (positive)
  Status:   PASS
  Expected: 200 {"operation":"division","a":10,"b":3,"result":3}
  Received: 200 {"operation":"division","a":10,"b":3,"result":3}

TEST 4.2 — Division with remainder (negative, floor toward negative infinity)
  Status:   PASS
  Expected: 200 {"operation":"division","a":-10,"b":3,"result":-4}
  Received: 200 {"operation":"division","a":-10,"b":3,"result":-4}

TEST 4.3 — Division result is exactly 1
  Status:   PASS
  Expected: 200 {"operation":"division","a":7,"b":7,"result":1}
  Received: 200 {"operation":"division","a":7,"b":7,"result":1}

---

## GROUP 5 — Boundary Values (Range Limits)

TEST 5.1 — Maximum allowed value
  Status:   PASS
  Expected: 200 {"operation":"addition","a":1000000,"b":0,"result":1000000}
  Received: 200 {"operation":"addition","a":1000000,"b":0,"result":1000000}

TEST 5.2 — Minimum allowed value
  Status:   PASS
  Expected: 200 {"operation":"addition","a":-1000000,"b":0,"result":-1000000}
  Received: 200 {"operation":"addition","a":-1000000,"b":0,"result":-1000000}

TEST 5.3 — Value just over maximum (expect 400)
  Status:   PASS
  Expected: 400 {"error":"Values must be between -1000000 and 1000000"}
  Received: 400 {"error":"Values must be between -1000000 and 1000000"}

TEST 5.4 — Value just under minimum (expect 400)
  Status:   PASS
  Expected: 400 {"error":"Values must be between -1000000 and 1000000"}
  Received: 400 {"error":"Values must be between -1000000 and 1000000"}

---

## GROUP 6 — Divide by Zero

TEST 6.1 — Divide by zero
  Status:   PASS
  Expected: 400 {"error":"Division by zero is not allowed"}
  Received: 400 {"error":"Division by zero is not allowed"}

TEST 6.2 — Divide negative by zero
  Status:   PASS
  Expected: 400 {"error":"Division by zero is not allowed"}
  Received: 400 {"error":"Division by zero is not allowed"}

TEST 6.3 — Divide zero by zero
  Status:   PASS
  Expected: 400 {"error":"Division by zero is not allowed"}
  Received: 400 {"error":"Division by zero is not allowed"}

---

## GROUP 7 — Invalid Input Types

TEST 7.1 — Float value for `a`
  Status:   PASS
  Expected: 400 {"error":"Both a and b must be integers"}
  Received: 400 {"error":"Both a and b must be integers"}

TEST 7.2 — Float value for `b`
  Status:   PASS
  Expected: 400 {"error":"Both a and b must be integers"}
  Received: 400 {"error":"Both a and b must be integers"}

TEST 7.3 — String value for `a`
  Status:   PASS
  Expected: 400 {"error":"Both a and b must be integers"}
  Received: 400 {"error":"Both a and b must be integers"}

TEST 7.4 — Numeric string value for `a`
  Status:   PASS
  Expected: 400 {"error":"Both a and b must be integers"}
  Received: 400 {"error":"Both a and b must be integers"}

TEST 7.5 — Boolean value for `a`
  Status:   PASS
  Expected: 400 {"error":"Both a and b must be integers"}
  Received: 400 {"error":"Both a and b must be integers"}

TEST 7.6 — Null value for `a`
  Status:   PASS
  Expected: 400 {"error":"Both a and b must be integers"}
  Received: 400 {"error":"Both a and b must be integers"}

TEST 7.7 — Both values are floats
  Status:   PASS
  Expected: 400 {"error":"Both a and b must be integers"}
  Received: 400 {"error":"Both a and b must be integers"}

---

## GROUP 8 — Missing Fields

TEST 8.1 — Missing `b`
  Status:   PASS
  Expected: 400 {"error":"Both a and b are required"}
  Received: 400 {"error":"Both a and b are required"}

TEST 8.2 — Missing `a`
  Status:   PASS
  Expected: 400 {"error":"Both a and b are required"}
  Received: 400 {"error":"Both a and b are required"}

TEST 8.3 — Both fields missing (empty object)
  Status:   PASS
  Expected: 400 {"error":"Both a and b are required"}
  Received: 400 {"error":"Both a and b are required"}

---

## GROUP 9 — Malformed Requests

TEST 9.1 — Invalid JSON body
  Status:   PASS
  Expected: 400 {"error":"Invalid JSON body"}
  Received: 400 {"error":"Invalid JSON body"}

TEST 9.2 — Missing Content-Type header
  Status:   PASS
  Expected: 400 {"error":"Content-Type must be application/json"}
  Received: 400 {"error":"Content-Type must be application/json"}

TEST 9.3 — Wrong Content-Type header
  Status:   PASS
  Expected: 400 {"error":"Content-Type must be application/json"}
  Received: 400 {"error":"Content-Type must be application/json"}

---

=====================================
RESULTS: 30 passed, 0 failed out of 30
Critical: 0 | High: 0 | Medium: 0 | Low: 0
=====================================
