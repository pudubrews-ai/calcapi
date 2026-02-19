# Calculator API

A simple Express-based calculator API with four POST endpoints.

## Requirements
- Node.js 18+

## Setup
```bash
npm install
```

## Run
```bash
npm start
```

Server runs at `http://localhost:3000`.

## API Endpoints
All endpoints are `POST` and require `Content-Type: application/json`.

### Add
```bash
curl -X POST http://localhost:3000/add \
  -H "Content-Type: application/json" \
  -d '{"a": 10, "b": 5}'
```

### Subtract
```bash
curl -X POST http://localhost:3000/subtract \
  -H "Content-Type: application/json" \
  -d '{"a": 10, "b": 5}'
```

### Multiply
```bash
curl -X POST http://localhost:3000/multiply \
  -H "Content-Type: application/json" \
  -d '{"a": 10, "b": 5}'
```

### Divide
```bash
curl -X POST http://localhost:3000/divide \
  -H "Content-Type: application/json" \
  -d '{"a": 10, "b": 5}'
```

### Error example (divide by zero)
```bash
curl -X POST http://localhost:3000/divide \
  -H "Content-Type: application/json" \
  -d '{"a": 10, "b": 0}'
```
