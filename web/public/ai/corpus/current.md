---
status: current
version: v0.5.0-beta
canonical: true
audience: [ai-agents, researchers, engineers]
last_updated: 2026-07-01
---

# PHOSPHOR — Current State (v0.5.0-beta)

This is the authoritative technical description of what PHOSPHOR v0.5.0-beta
actually is and ships. It is intentionally calmer and more precise than the
homepage. Where any other source disagrees with the numbers here, this file is
canonical. For a short citable version see [./public-summary.md](./public-summary.md);
for the load-bearing concept list see [./accepted-concepts.md](./accepted-concepts.md);
for what is *not* shipped see [./deprecated-concepts.md](./deprecated-concepts.md).

## What PHOSPHOR is

PHOSPHOR is a small, dependency-light infrastructure for **Execution-as-Interface
(EAI)**: making machine-code execution legible to humans and to AI agents at the
same time. It is built on one claim — a VM's actual execution, once paired with a
complete Correspondence Table System (CTS), is simultaneously a human-readable
visualization *and* an AI-parseable event stream. These are not two
representations of one object; they are the same object viewed two ways.

The projection is deterministic:

    Φ : M × CTS → V

`M` is the VM state at tick *t*, `CTS` is its semantic table set, and `V` is a
representation that is directly readable by a human and structurally parseable by
an agent. The tagline is **Visible ≡ Visualizable** (可見即可視).

- Project owner: EVEMISS TECHNOLOGY CO., LTD. (一言諾科技有限公司).
- Author: 許筌崴 Neo.K.
- Version: v0.5.0-beta — EXPERIMENTAL. The v0.5 APIs (the semantic layer, the EML
  consumers, the `EAI_PROTO` constant) may change before v0.6. The verified v0.4
  core (VM family, 6-layer CTS, phosphor-stream, agent protocol) is unchanged.
- License: Apache-2.0.
- Domain: emlphosphor.com. Repository: github.com/kakon77777-commits/eml-phosphor.
- Licensing contact: kakon77777@gmail.com.
- Runtime requirement: Node.js ≥ 22.

## Two modes, one engine

There is a single UI-independent VM core. Two modes read the *same* state `M`:

- **Human mode** — a phosphor-green CRT React UI. This is the observation window.
- **AI mode** — a headless event stream (WebSocket / SSE / JSONL) that an agent
  subscribes to and reasons over. This is the production surface.

The on-screen "AI STREAM" panel reuses the *same* `buildHeadlessSnapshot` builder
as the headless driver, so the human view and the AI view are provably one state
with no re-implementation drift.

## VM family

Three VMs are shipped and verified from code. (The float VMs listed on some pages
are deferred — see [./deprecated-concepts.md](./deprecated-concepts.md).)

| VM | Word / address space | Value domain | ISA | Intended use |
|----|----------------------|--------------|-----|--------------|
| EML-VM-16 | 8-bit, 256 B memory | u8 | **28-opcode ISA**, fixed 2-byte instruction `[opcode:8][arg:8]` | prototype / teaching |
| EML-VM-64 | 16-bit, 64 KB address space | u8 + 16-bit address registers AR0–AR3 | variable-length (2/3/4-byte) ISA, V1-compatible | larger address space |
| EML-VM-BASIC | 8-bit (bounded) | bounded integer `[0,N]`, overflow wraps mod N+1 | minimal — no mul/div/logic ops, constraint engine | cleanest AI-mode substrate |

The EML-VM-16 ISA is defined by `OPCODE_TABLE` in `eml-vm16-core.ts` (§6, the
complete ISA definition) and contains exactly **28 opcodes**. (An early v0.2 draft's
section header miscounted it as "38" while its own list enumerates 28; 28 is the
canonical count, now consistent across the README, site, and specs.)

## The 6-layer CTS

The Correspondence Table System has six layers:

1. **opcode** — mnemonics per opcode.
2. **symbol** — named low-level units keyed by memory address, with a memory
   `DataType` and region/size.
3. **type** — memory region ranges.
4. **string** — decoded in-memory strings.
5. **comment** — address-keyed comments.
6. **crossRef** — dependency graph: callers, data readers, data writers per
   address.

The CTS is built statically and then augmented dynamically. `augmentCTSFromTrace`
recovers register-indirect readers and writers: because a `LD Rd,[Rs]` read does
not change memory, a memory diff cannot see it, so `traceWithSnapshots` captures
each tick's effective access (`effectiveAccess`, resolved from pre-execution
state) to complete the layer-6 computation graph.

## The v0.5 semantic layer (`eml-semantic.ts`)

The semantic layer sits on top of the existing integer VMs and introduces no new
ISA. It has two parts:

- **`describeEffect(op, arg)`** — per-instruction operational semantics. Maps each
  instruction to its state-transition meaning: `mnemonic`, `reads[]`, `writes[]`,
  `readsFlags[]`, `flags[]`, `mem` (`none`/`read`/`write`), `control`
  (`fallthrough`/`jump`/`cond-jump`/`call`/`ret`/`halt`), and a `summary` string
  such as "R0 ← (R0 + R1) mod 256". This is one layer deeper than the CTS opcode
  table, which only gives mnemonics.

- **`semanticEquiv(codeA, codeB, spec)`** — judges whether two byte sequences are
  semantically equivalent by **running both and comparing observable output**. The
  discipline is ported from EML's execution-truth gate:
  - Adversarial inputs plus full-range sampling: boundary scan and a deterministic
    LCG mix over the whole `[0,255]` range, never trusting a single (e.g. all-zero)
    input.
  - With a single input slot the enumeration over all 256 values is exhaustive, and
    the `equivalent` verdict is then a real proof over the entire input space; with
    more inputs the result is marked non-exhaustive and `equivalent` means "equal on
    the tested inputs".
  - A ≥2-distinct-output guard: equivalence is only certified when the inputs
    actually discriminate behavior (produce ≥2 distinct outputs). Agreement on a
    degenerate (all-identical-output) input set is not evidence.
  - A code-region guard: input/output slots that fall inside a program's code region
    are refused, returning `inexpressible`.
  - A three-valued verdict — `equivalent` / `not-equivalent` / `inexpressible` — with
    a concrete counterexample on `not-equivalent`, and refusal (not a guess) on
    non-termination, non-discriminating inputs, or illegal slots.

  The judge is fundamentally a falsifier: `not-equivalent` is always sound;
  `equivalent` is a proof only when exhaustive, otherwise high-coverage bounded
  testing. A formal Hoare-logic / denotational proof layer is **intentionally
  deferred**. Optionally `semanticEquiv` emits a self-verifying `vm:equiv` event
  (`ok ⟺ certified equivalent`) — the byte-level analog of EML's `eml:equiv`.

## phosphor-stream (protocol `phosphor-jsonl-v1`)

phosphor-stream is a portable "state → AI-readable event stream" standard: any app
can emit a `phosphor-jsonl-v1` event stream so an agent sees what actually happened
instead of guessing from UI or source. It is:

- **Self-describing** — the stream can carry a semantic dictionary describing each
  event type, so a cold agent can interpret it with no prior context.
- **Intent-vs-actual** — `check(label, actual, expected)` records expected alongside
  actual; the gap is the bug signal. `findAnomalies()` flags `:error` types,
  `ok === false`, disagreeing `expected`/`actual`, and non-zero exit codes.
- **Globally orderable** — every event carries a `writer` id and a `mono`
  tiebreaker; `mergeOrder()` reconstructs a deterministic total order across writers.
- **Best-effort** — append-only; a monitor failure never breaks the host app;
  `emit()` cannot throw. `fileSink` rotates by size to bound growth.

Required envelope fields: `stream`, `proto` (always `"phosphor-jsonl-v1"`), `seq`,
`ts`, `type` (namespaced `domain:action`), `writer`, `mono`. Additional top-level
fields are the domain payload.

## EML ⇄ PHOSPHOR interop

The sibling project EML emits the same `phosphor-jsonl-v1` envelope. PHOSPHOR
consumes EML execution traces and bridges EML's source-level CTS into machine-CTS
views:

- **Trace consumption** (`stream/eml-consumer.ts`) — `ingestEmlTrace()` reuses
  PHOSPHOR's own `parseStream` / `validateEvent` / `mergeOrder` / `findAnomalies` /
  `summarize` (0 violations on real EML traces), then extracts EML semantics:
  `eml:equiv` (equivalence verdicts), `eml:bug` (5-level severity), `eml:run:*`
  (execution lifecycle).
- **CTS bridge** (`eml-cts-interop.ts`) — the two CTSes are the same artifact shape
  at different altitudes and key spaces (PHOSPHOR keys by memory address; EML keys
  by symbol/node-id string), so they are not field-for-field interchangeable. The
  bridge transfers only what genuinely corresponds: EML `symbols` → a phosphor-stream
  `Dictionary`; EML `functions` (cold/hot + importance) → attention/risk hints; EML
  `loops` (loopKind + determinism/termination) → control-flow hints. It does not
  coerce addresses, opcodes, regions, or map EML `semanticType` onto PHOSPHOR
  `DataType` (disjoint vocabularies). See [../specs/cts-interop.md](../specs/cts-interop.md).

## User interface — 7 tabs

The human-mode UI has seven tabs: **EML-VM-16**, **EML-VM-64**, **SEMANTIC ≡**,
**CTS**, **EML**, **AGENT**, **MATRIX**. It ships two ways:

- as a hosted Vite + React app driving the verified core directly, and
- as a single-file offline `.exe` (Node SEA, built via `exe/build-exe.mjs`),
  published as a GitHub Release asset — it is not committed to the repository.

## Verification

Six harnesses, **151 checks** total, all green:

| Command | Scope | Checks |
|---------|-------|:---:|
| `npm run verify` | core integration | 36 |
| `npm run verify:ws` | WebSocket agent server, end-to-end over a real socket | 6 |
| `npm run verify:stream` | phosphor-stream portable standard | 30 |
| `npm run verify:headless` | headless AI-mode VM + EML-VM-BASIC | 23 |
| `npm run verify:eml` | v0.5 EML interop — trace consumer + Cts bridge | 30 |
| `npm run verify:semantic` | v0.5 semantic layer — operational equivalence judge | 26 |

`npm run typecheck` (`tsc --noEmit`) is zero-error. The marketing site also states
"34 adversary agents" (an adversarial review pass), which is distinct from the 151
verification checks.

## Version strategy

The package version is a semver prerelease (`0.5.0-beta.0`), aligned across root,
`ui/`, and `exe/`. The runtime protocol/serialization version broadcast to agents
is a single constant, `EAI_PROTO = 'EML-EAI-2026-v0.5'`. The `phosphor-jsonl-v1`
envelope and existing event types are frozen; new machine-layer event types may be
added under the same `proto` without a version bump.

## AI-learning rights

Reading, indexing, RAG, and summarization are freely allowed with attribution.
Non-commercial training and embedding are highly allowed; `/ai/` paths are fully
allowed. Commercial training / fine-tuning / distillation require a license.
Verbatim memorization and style imitation are disallowed. Attribution and citation
are required. See [../rights-spectrum.json](../rights-spectrum.json).
