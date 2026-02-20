'use strict';

const express = require('express');
const app = express();

const PORT = Number(process.env.PORT) || 3000;

// 1. Disable X-Powered-By header (must be first)
app.disable('x-powered-by');

// 2. Serve static files from public/ (BEFORE Content-Type middleware)
app.use(express.static(require('path').join(__dirname, 'public')));

// 3. Content-Type validation middleware (BEFORE express.json())
app.use((req, res, next) => {
  if (!req.is('application/json')) {
    return res.status(400).json({ error: 'Content-Type must be application/json' });
  }
  next();
});

// 3. JSON body parser with size limit and strict: false
app.use(express.json({ limit: '1kb', strict: false }));

// 4. JSON parse error handler (AFTER express.json())
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  next(err);
});

// Validation function — checks Rules 3 through 5
function validate(body) {
  const a = body === null || body === undefined ? undefined : body.a;
  const b = body === null || body === undefined ? undefined : body.b;

  // Rule 3: Both a and b must be present (key exists, not undefined)
  if (a === undefined || b === undefined) {
    return 'Both a and b are required';
  }

  // Rule 4: Both a and b must be integers (per-rule, not per-field)
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    return 'Both a and b must be integers';
  }

  // Rule 5: Both a and b must be in range [-1000000, 1000000] inclusive
  if (a < -1000000 || a > 1000000 || b < -1000000 || b > 1000000) {
    return 'Values must be between -1000000 and 1000000';
  }

  return null; // No error
}

// 5. Route definitions

app.post('/add', (req, res) => {
  const error = validate(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const { a, b } = req.body;
  const result = a + b;
  res.status(200).json({ operation: 'addition', a, b, result });
});

app.post('/subtract', (req, res) => {
  const error = validate(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const { a, b } = req.body;
  const result = a - b;
  res.status(200).json({ operation: 'subtraction', a, b, result });
});

app.post('/multiply', (req, res) => {
  const error = validate(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const { a, b } = req.body;
  const result = a * b;
  res.status(200).json({ operation: 'multiplication', a, b, result });
});

app.post('/divide', (req, res) => {
  const error = validate(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const { a, b } = req.body;
  if (b === 0) {
    return res.status(400).json({ error: 'Division by zero is not allowed' });
  }
  const result = Math.floor(a / b);
  res.status(200).json({ operation: 'division', a, b, result });
});

// 405 Method Not Allowed for defined paths (after POST routes, before 404 handler)
app.all('/add', (req, res) => {
  res.status(405).json({ error: 'Method not allowed' });
});
app.all('/subtract', (req, res) => {
  res.status(405).json({ error: 'Method not allowed' });
});
app.all('/multiply', (req, res) => {
  res.status(405).json({ error: 'Method not allowed' });
});
app.all('/divide', (req, res) => {
  res.status(405).json({ error: 'Method not allowed' });
});

// Catch-all 404 handler (after all routes)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Final error handler (prevents stack trace leakage)
app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Calculator API running on port ${PORT}`);
});

module.exports = app;
