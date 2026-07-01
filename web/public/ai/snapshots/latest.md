---
status: active
version: 0.5.0-beta
canonical: true
audience: ai-agent
last_updated: 2026-07-01
---

# PHOSPHOR — State Snapshot (v0.5.0-beta)

A versioned, point-in-time record of PHOSPHOR's state as of 2026-07-01. This is
the current head snapshot; it is authored to be stable and citable. For the
machine-readable entry point see [`../manifest.json`](../manifest.json); for the
calm technical description see [`../corpus/current.md`](../corpus/current.md).

**Project.** PHOSPHOR — Execution-as-Interface (EAI). A VM's actual execution,
once paired with a complete Correspondence Table System (CTS), is simultaneously
a human-readable visualization and an AI-parseable event stream — not two
representations of one object, but the same object viewed two ways.

- Formula: `Φ : M × CTS → V`
- Tagline: Visible ≡ Visualizable (可見即可視)
- Owner: EVEMISS TECHNOLOGY CO., LTD. (一言諾科技有限公司); author 許筌崴 Neo.K
- License: Apache-2.0
- Version: **v0.5.0-beta — EXPERIMENTAL.** The v0.5 APIs may change before v0.6.

---

## Version & stability

v0.5.0-beta is a test-marked release. It adds the semantic↔machine-code layer,
the EML ⇄ PHOSPHOR interop bridge, and a single-source snapshot refactor. The
verified v0.4 core (VM family, 6-layer CTS, phosphor-stream, agent protocol) is
unchanged and stays green. The APIs introduced in v0.5 — the semantic layer
(`eml-semantic.ts`), the EML consumers (`stream/eml-consumer.ts`,
`eml-cts-interop.ts`), and the `EAI_PROTO` constant — may change before v0.6.

---

## Shipped and green

### VM family (verified from code)

| VM | Address space | Value domain | ISA | Use |
|----|---------------|--------------|-----|-----|
| EML-VM-BASIC | 8-bit (256 cells) | bounded int `[0,N]`; overflow wrap mod N+1 / clamp / throw | minimal — no mul/div/logic, constraint engine | cleanest AI-mode substrate |
| EML-VM-16 | 8-bit (256 B) | u8 | 28-opcode ISA, fixed 2-byte `[opcode:8][arg:8]` | prototype / teaching |
| EML-VM-64 | 16-bit (64 KB) | u8 + 16-bit AR0–AR3 | variable-length (2/3/4-byte) V2 ISA, V1-compatible | larger address space |

EML-VM-16's ISA is exactly 28 opcodes (`OPCODE_TABLE` in `eml-vm16-core.ts`,
the complete ISA definition).

### 6-layer CTS

`opcode`, `symbol`, `type`, `string`, `comment`, `crossRef`. Static analysis
plus dynamic augmentation: `augmentCTSFromTrace` recovers register-indirect
readers and writers that static analysis cannot resolve.

### phosphor-stream (`phosphor-jsonl-v1`)

A portable "state → AI-readable event stream" standard. Self-describing (carries
a semantic dictionary), intent-vs-actual (`check()`), globally orderable,
best-effort (never breaks the host).

### Two modes, one engine

Human mode is a phosphor-green CRT React UI (the observation window); AI mode is
a headless event stream over WS / SSE / JSONL (the production surface). Both read
the same state `M`. The on-screen "AI STREAM" panel reuses the same
`buildHeadlessSnapshot` builder as the headless driver, so the human view and the
AI view are provably one state with no re-implementation drift.

### Agent protocol

The P5 agent stream is a transport-agnostic protocol (WebSocket / SSE /
in-process). The UI ships 7 tabs: EML-VM-16, EML-VM-64, SEMANTIC ≡, CTS, EML,
AGENT, MATRIX. Distributed as a hosted Vite app and as a single-file offline
`.exe` (Node SEA, built via `exe/build-exe.mjs`, published as a GitHub Release
asset — not committed).

### v0.5 semantic layer (`eml-semantic.ts`)

- `describeEffect` — per-instruction operational semantics (reads / writes /
  flags / memory / control).
- `semanticEquiv` — judges whether two byte sequences are semantically equivalent
  by running both and comparing observable output. Three-valued verdict
  {equivalent, not-equivalent, inexpressible}, with a counterexample, adversarial
  inputs, and a ≥2-distinct-output guard. With a single input slot the enumeration
  over all 256 values is exhaustive and an `equivalent` verdict is a real proof over
  the whole input space; with two or more input slots the result is sampled and
  honestly marked `exhaustive: false` (unless exhaustive enumeration is explicitly
  forced), so `equivalent` there means only "equal on the tested inputs". A formal Hoare-logic proof layer
  is intentionally deferred.

### EML interop

The sibling project EML emits the same `phosphor-jsonl-v1` envelope. PHOSPHOR
consumes EML execution traces (extracting `eml:equiv` / `eml:bug` / lifecycle)
and bridges EML's source-level `Cts` into machine-CTS views (symbols →
dictionary, functions → attention, loops → control flow). Contracts:
[`../specs/eml-interop.md`](../specs/eml-interop.md),
[`../specs/cts-interop.md`](../specs/cts-interop.md).

---

## Verify status

151 checks across 6 harnesses, all green; `typecheck` (`tsc --noEmit`) zero
errors. Repo requires Node ≥ 22.

| Harness | Command | Checks |
|---------|---------|--------|
| Core integration | `npm run verify` | 36 |
| WebSocket agent server (real socket) | `npm run verify:ws` | 6 |
| phosphor-stream portable standard | `npm run verify:stream` | 30 |
| Headless AI-mode VM + EML-VM-BASIC | `npm run verify:headless` | 23 |
| v0.5 EML interop (trace consumer + Cts bridge) | `npm run verify:eml` | 30 |
| v0.5 semantic layer (operational equivalence judge) | `npm run verify:semantic` | 26 |
| **Total** | | **151** |

---

## Deferred / not shipped

Do not describe these as shipped:

- **EML-VM-F32 / EML-VM-F64** float VMs — they need a float value model, IEEE-754
  ISA semantics, and a float-aware CTS/snapshot.
- **A Hoare / denotational proof layer** on top of the operational equivalence
  judge — intentionally deferred.

---

## Stable links

- Repository: <https://github.com/kakon77777-commits/eml-phosphor>
- Domain: <https://emlphosphor.com>
- AI manifest: [`../manifest.json`](../manifest.json)
- AI entry point: [`../index.md`](../index.md)
- Current spec (v0.5, EXPERIMENTAL): [`../specs/eml-eai-2026-v0.5.md`](../specs/eml-eai-2026-v0.5.md)
- AI-learning rights spectrum: [`../rights-spectrum.json`](../rights-spectrum.json)
- Licensing contact: kakon77777@gmail.com

---

## AI-learning rights (summary)

Read / index / RAG / summarize freely with attribution. Non-commercial training
and embedding are highly allowed (0.8; `/ai/` paths 1.0). Commercial training,
fine-tuning, and distillation require a license (contact kakon77777@gmail.com).
Verbatim memorization and style imitation are not allowed (0.0). Attribution and
citation are required. Full spectrum:
[`../rights-spectrum.json`](../rights-spectrum.json).
