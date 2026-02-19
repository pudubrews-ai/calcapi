const express = require('express');

const app = express();
const PORT = 3000;
const MIN = -1000000;
const MAX = 1000000;

const ROUTES = new Set(['/add', '/subtract', '/multiply', '/divide']);

function isCalculatorPost(req) {
  return req.method === 'POST' && ROUTES.has(req.path);
}

function error(res, message) {
  return res.status(400).json({ error: message });
}

// Validation rule 1: Content-Type must be application/json.
app.use((req, res, next) => {
  if (!isCalculatorPost(req)) {
    return next();
  }

  if (!req.is('application/json')) {
    return error(res, 'Content-Type must be application/json');
  }

  return next();
});

app.use(express.json());

// Validation rule 2: Body must be valid JSON.
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return error(res, 'Invalid JSON body');
  }
  return next(err);
});

function validateInputs(a, b, isDivide) {
  // Validation rule 3: both fields must be present.
  if (typeof a === 'undefined' || typeof b === 'undefined') {
    return 'Both a and b are required';
  }

  // Validation rule 4: both fields must be integers.
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    return 'Both a and b must be integers';
  }

  // Validation rule 5: both fields must be in range.
  if (a < MIN || a > MAX || b < MIN || b > MAX) {
    return 'Values must be between -1000000 and 1000000';
  }

  // Validation rule 6: for /divide, b must not be zero.
  if (isDivide && b === 0) {
    return 'Division by zero is not allowed';
  }

  return null;
}

function handleOperation(operation, compute, isDivide = false) {
  return (req, res) => {
    const { a, b } = req.body || {};
    const validationError = validateInputs(a, b, isDivide);

    if (validationError) {
      return error(res, validationError);
    }

    return res.status(200).json({
      operation,
      a,
      b,
      result: compute(a, b),
    });
  };
}

app.post('/add', handleOperation('addition', (a, b) => a + b));
app.post('/subtract', handleOperation('subtraction', (a, b) => a - b));
app.post('/multiply', handleOperation('multiplication', (a, b) => a * b));
app.post('/divide', handleOperation('division', (a, b) => Math.floor(a / b), true));

app.listen(PORT, () => {
  console.log(`Calculator API listening on port ${PORT}`);
});
