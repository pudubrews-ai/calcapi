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

## True Acceptance Test (Process, Not Just API Output)
The real pass condition for this project is the orchestration workflow in `prompt_codex.md`, not only endpoint correctness.

Required process gates:
- Use distinct role lanes (Architect, Developer, Tester, CISO, Adversary) with proper file boundaries.
- Run black-box testing against `http://localhost:3000`.
- Ship only when severity gate is satisfied:
  - Critical = 0
  - High = 0
  - Medium = 0

## How This Run Failed
- A single-agent implementation pass was completed first, which failed the required multi-agent process test.
- A later multi-agent rerun still ended with `ITERATE` (not `COMPLETE`) because tester reachability failed (`HTTP 000` in `reports/iteration-2/tester.md`).
- Constraint handling was inconsistent: code was touched/reverted after direction to avoid code changes.

See:
- `reports/codex-failure-notes.md`
- `reports/iteration-2/architect-eval.md`
