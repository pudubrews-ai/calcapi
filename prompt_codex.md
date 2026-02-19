# prompt.md — Codex Local Multi‑Agent Build Orchestration

This file is the **single master instruction** for running this project with **Codex on your local machine** (Codex CLI or Codex app in Local mode).

It orchestrates a **multi‑agent, file‑laned workflow** to build and verify the Calculator API using the two specs below.

## Sources of truth

These are **authoritative**. Do not contradict them.

- `./calculator-app-spec.md` — implementation contract
- `./calculator-testing-spec.md` — black‑box test contract

`./prompt.md` (this file) is orchestration only.

---

## Goal

Implement the Calculator API exactly per `calculator-app-spec.md`, then verify it strictly per `calculator-testing-spec.md`, using an isolated multi‑agent workflow:

- **Developer** builds the app **without seeing test/security/adversary outputs**
- **Tester** validates **only through HTTP** and **never reads source code**
- **Architect** synthesizes findings and controls iteration
- **CISO** reviews security posture (spec + code)
- **Adversary** actively probes the running service for bypasses/edge cases

Stop only when the severity gate is satisfied (see below).

---

## Required repo structure

Create these directories if missing:

```
./reports/
  iteration-1/
  iteration-2/
  ...
```

Within each `iteration-n/`, write:

- `architect-eval.md`
- `developer-instructions.md`
- `ciso.md`
- `adversary.md`
- `tester.md`

Do **not** overwrite prior iterations.

---

## Agents and file lanes

Codex: **spawn these agents** (or strictly role‑play them) and enforce the read/write lanes below.

### 0) Orchestrator (you)
**Purpose:** manage steps, enforce lanes, run parallel steps when independent, and keep an audit trail.  
**May read/write:** everything needed to coordinate, but must **not** rewrite other agents’ authored reports (only trigger them).

### 1) Architect
**Reads:**
- `./calculator-app-spec.md`
- `./calculator-testing-spec.md` (only to understand the test contract at a high level; do not rewrite it)
- outputs in `./reports/**` (including Tester/CISO/Adversary reports)

**Writes (only):**
- `./reports/iteration-n/architect-eval.md`
- `./reports/iteration-n/developer-instructions.md`

### 2) Developer
**Reads (only):**
- `./calculator-app-spec.md`
- `./reports/iteration-n/developer-instructions.md`

**Writes:**
- source code + project files (e.g., `index.js`, `package.json`, `README.md`, etc.)
- may write brief build notes in `./reports/iteration-n/dev-notes.md` (optional)

**Hard rule:** Developer must not read `tester.md`, `ciso.md`, or `adversary.md`.

### 3) Tester (Black box only)
**Reads (only):**
- `./calculator-testing-spec.md`

**May run:**
- HTTP requests against `http://localhost:3000` (curl / node scripts)
- no reading source code

**Writes (only):**
- `./reports/iteration-n/tester.md`

### 4) CISO
**Reads:**
- Spec phase: `./calculator-app-spec.md` (+ Architect initial eval if available)
- Post-build: code + runtime behavior (may run curl)

**Writes (only):**
- `./reports/iteration-n/ciso.md`

### 5) Adversary
**Reads:**
- Spec phase: `./calculator-app-spec.md` (+ Architect initial eval if available)
- Post-build: may probe the running service with curl and other local commands

**Writes (only):**
- `./reports/iteration-n/adversary.md`

**Guardrails (cost control):**
- Prioritize **Critical/High/Medium** findings with repro steps.
- Put Lows in a short appendix.
- On later iterations, re‑probe only regressions + areas changed by fixes.

---

## Severity gate (ship criteria)

For each iteration, the Architect must tabulate findings by severity across:

- Tester report
- CISO report
- Adversary report

**COMPLETE only if:**
- **Critical = 0**
- **High = 0**
- **Medium = 0**

Lows may remain but must be documented.

### Severity definitions
- **Critical:** violates app spec in a way that can ship incorrect results or bypass mandatory validation (e.g., divide-by-zero bypass, wrong success/error codes, incorrect response shape).
- **High:** serious security exposure or contract violation likely to be exploited.
- **Medium:** missing required handlers or contract corner cases that violate the spec but are less severe than High.
- **Low:** best-practice hardening / non-blocking polish.

---

## Parallelism rule

Run independent steps in parallel when safe (e.g., CISO and Adversary can run simultaneously).  
Any step that depends on a file output must wait for that output.

---

## Workflow

### Phase A — Iteration 1 (end-to-end)

#### Step A1 — Architect (initial read)
Architect reads `calculator-app-spec.md` and writes:

`./reports/iteration-1/architect-eval.md` including:
- a brief contract summary (endpoints, validation order, response shapes)
- risks/ambiguities (should be none; if any, propose conservative interpretation aligned with the spec text)
- an initial build plan (high level)

#### Step A2 — CISO + Adversary (spec review) **in parallel**
- CISO writes `./reports/iteration-1/ciso.md` (spec-level risks + mitigations)
- Adversary writes `./reports/iteration-1/adversary.md` (spec-level bypass ideas / edge cases)

#### Step A3 — Architect synthesis → Developer instructions
Architect writes `./reports/iteration-1/developer-instructions.md`:
- a prioritized, unambiguous checklist for implementation
- **do not paste** raw CISO/Adversary text; synthesize into actions

#### Step A4 — Developer implements
Developer implements per:
- `calculator-app-spec.md`
- `developer-instructions.md`

Implementation expectations (must match app spec):
- Node + Express
- port **3000**
- 4 POST endpoints: `/add`, `/subtract`, `/multiply`, `/divide`
- validation rules **in the exact order** defined in the app spec
- standardized error response shape `{ "error": "..." }`
- divide uses `Math.floor(a / b)` (per spec)
- consistent success response format per endpoint (per spec)

Developer updates/creates README with:
- setup/run instructions
- curl examples for each endpoint (per spec)

#### Step A5 — Post-build review: CISO + Adversary **in parallel**
- CISO updates `./reports/iteration-1/ciso.md` with post-build findings (append a “Post-build” section)
- Adversary updates `./reports/iteration-1/adversary.md` with post-build probing results (append a “Post-build” section), including repro curl commands

#### Step A6 — Tester runs full black-box suite
Tester executes the complete suite in `calculator-testing-spec.md` against `http://localhost:3000` and writes results to:

`./reports/iteration-1/tester.md`

Include:
- environment info (OS/node version optional)
- for each test group: PASS/FAIL and any failing request/response excerpts

#### Step A7 — Architect verdict
Architect writes/updates `./reports/iteration-1/architect-eval.md` with:
- a severity table (Tester/CISO/Adversary vs Critical/High/Medium/Low)
- verdict: **COMPLETE** or **ITERATE**
- if ITERATE: create `./reports/iteration-2/developer-instructions.md` (next iteration fix list, prioritized)

---

### Phase B — Iteration n (repeat until COMPLETE)

For each next iteration `n = 2, 3, ...`:

1) Developer fixes using ONLY:
   - `calculator-app-spec.md`
   - `./reports/iteration-n/developer-instructions.md`

2) CISO + Adversary post-build in parallel → write `./reports/iteration-n/ciso.md` and `./reports/iteration-n/adversary.md`

3) Tester runs full suite → `./reports/iteration-n/tester.md`

4) Architect verdict → `./reports/iteration-n/architect-eval.md`
   - If ITERATE: create `./reports/iteration-(n+1)/developer-instructions.md`

Stop when the severity gate is satisfied.

---

## Operational constraints

- Use local commands only (npm/node/curl).
- Do not add features not specified in `calculator-app-spec.md`.
- The web interface is explicitly out of scope for this phase; keep the API contract stable.

---

## Start now (Orchestrator)

Execute Iteration 1 immediately using the workflow above, creating the `./reports/iteration-1/` folder and all required files.
