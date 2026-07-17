# PHOSPHOR

**Execution-as-Interface (EAI) — make machine-code execution legible to humans *and* AI agents at the same time.**

> 可見即可視 · **Visible ≡ Visualizable**

> [!WARNING]
> **v0.6.0-beta — EXPERIMENTAL / test release.** v0.6 adds Φ's first non-invented
> target — real WebAssembly bytecode ([`wasm/`](wasm/)) — and PHOSPHOR-SHEET, a
> third formal projection (spreadsheet). The WASM path is headless-only so far: no
> `ui/` or PHOSPHOR-SHEET wiring yet, and only an i32/structured-control-flow
> subset is supported (real modules outside that subset fail loudly rather than
> mis-execute — see [`wasm/wasm-binary.ts`](wasm/wasm-binary.ts)). An end-to-end
> case stringing all three projections together on one real scenario is still
> ahead. The verified v0.5 core (VM family, semantic layer, EML interop,
> single-source snapshot) is unchanged and stays green.

PHOSPHOR is a small, dependency-light infrastructure built on one claim: a VM's actual execution, once paired with a complete **Correspondence Table System (CTS)**, is simultaneously a human-readable visualization *and* an AI-parseable event stream — not two representations of one object, but the *same* object viewed two ways.

The projection is deterministic:

> `Φ : M × CTS → V` — where `M` is the VM state at tick *t*, `CTS` is its semantic table set, and `V` is a representation that is directly readable by a human and structurally parseable by an agent.

---

## Two modes, one engine

```
                 VM Core (shared, UI-independent)
                /                               \
        Human mode                          AI mode
     P0 React UI (phosphor-green CRT)   Headless event stream (WS / SSE / JSONL)
        you watch it run                an agent subscribes and reasons
```

Both modes read the *same* state `M`. Human mode is the observation window; AI mode is the production surface.

---

## Quickstart

Requires Node.js ≥ 22.

```bash
npm install

npm run verify          # core integration (36 checks)
npm run verify:ws       # WebSocket agent server, end-to-end over a real socket (6)
npm run verify:stream   # phosphor-stream portable standard (30)
npm run verify:headless # headless AI-mode VM + EML-VM-BASIC (23)
npm run verify:eml      # v0.5 EML interop — trace consumer + Cts bridge (30)
npm run verify:semantic # v0.5 semantic layer — operational equivalence judge (26)
npm run verify:sheet    # v1.1 PHOSPHOR-SHEET workbook + real XLSX (29)
npm run verify:sheet-control # v1.2 interactive control-plane round trip (32)
npm run verify:wasm     # v0.6 real WebAssembly Φ target, cross-checked against Node's native engine (24)
npm run typecheck       # tsc --noEmit, zero errors
```

Run a program headless and watch the AI-mode snapshot stream:

```bash
npm run phosphor -- run --program fibonacci --max 40
# JSONL: one VMSnapshot per tick — {mode:"ai", pc, instruction, registers, changed_this_tick, ...}
```

The human-mode UI (Vite + React, drives the verified core directly):

```bash
cd ui && npm install && npm run dev      # http://localhost:5173
```

A self-contained double-click binary (no Node required) can be built with `node exe/build-exe.mjs` and is published as a **GitHub Release** asset — it is not committed to the repo.

---

## What's inside

| Module | Role |
|--------|------|
| `eml-vm16-core.ts` | VM-16 core — functional step engine, the 6-layer CTS, static cross-ref + dynamic `augmentCTSFromTrace`, `buildStringTable` |
| `eml-vm16-callable.ts` | CallableVM — ECC-1 calling convention, function-call semantics over the VM |
| `eml-vm16-window.ts` | Multi-VM windows + directed memory channels (cross-VM data flow) |
| `eml-vm16-agent.ts` | **P5 agent stream** — transport-agnostic protocol (WebSocket / SSE / in-process) |
| `eml-vm64-core.ts` | EML-VM-64 — 16-bit / 64 KB address space, variable-length ISA, V1-compatible |
| `eml-vm64-window.ts` | V2 window layer + 16-bit memory channels |
| `eml-vm-basic.ts` | **EML-VM-BASIC** — bounded-integer profile `[0,N]`, no mul/div, constraint engine |
| `headless-vm.ts` | `createHeadlessVM` factory + `phosphor run` CLI (AI mode), emits `vm:tick` events |
| `headless-snapshot.ts` | **v0.5** — browser-safe, single-source AI snapshot builder (shared by `headless-vm.ts` *and* the UI) |
| `eml-semantic.ts` | **v0.5** — semantic↔machine-code layer: `describeEffect` (per-instruction operational semantics) + `semanticEquiv` (three-valued equivalence judge) |
| `stream/eml-consumer.ts` | **v0.5** — ingest an EML `phosphor-jsonl-v1` trace; extract `eml:equiv`/`eml:bug`/lifecycle ([interop contract](stream/EML-INTEROP.md)) |
| `eml-cts-interop.ts` | **v0.5** — bridge EML's source-level `Cts` into PHOSPHOR-side views (dictionary / attention / loops) ([contract](CTS-INTEROP.md)) |
| `stream/` | **phosphor-stream** — a portable "state → AI-readable event stream" standard ([spec](stream/PHOSPHOR-STREAM.md)) |
| `spreadsheet/` | **PHOSPHOR-SHEET** — spreadsheet projection + governed XLSX control plane ([spec](spreadsheet/PHOSPHOR-SHEET.md)) |
| `wasm/` | **v0.6** — Φ over real WebAssembly bytecode: binary parser, functional-step interpreter, CTS mapping, headless snapshot builder (`wasm-binary.ts` / `wasm-interp.ts` / `wasm-cts.ts` / `wasm-snapshot.ts`) |
| `ui/` | Human-mode React UI (single engine = the verified core; renders the CTS live) |
| `exe/` | Node SEA packaging → a double-click `PHOSPHOR.exe` |

`eml-vm16.jsx` / `binary-matrix.jsx` are standalone single-file artifacts (reference / aesthetic prototype).

---

## phosphor-stream — the portable standard

The AI-mode idea generalized: any app can emit a `phosphor-jsonl-v1` event stream so an agent can see **what actually happened** instead of guessing from UI or source. Self-describing (a semantic dictionary), intent-vs-actual (`check()`), globally orderable, best-effort (never breaks the host). See [`stream/PHOSPHOR-STREAM.md`](stream/PHOSPHOR-STREAM.md).

```ts
import { createEmitter } from './stream/phosphor-stream';
import { fileSink } from './stream/sink-node';
const mon = createEmitter({ stream: 'myapp', sink: fileSink('./myapp-monitor.jsonl') });
mon.emit('agent:done', { agent: 'codex', code });   // code !== 0 is auto-flagged by findAnomalies()
```

---

## VM family

| VM | Address space | Value domain | ISA | Use |
|----|---------------|--------------|-----|-----|
| EML-VM-BASIC | 8-bit (256 cells) | bounded int `[0,N]` | minimal (no mul/div/logic) | cleanest AI-mode substrate |
| EML-VM-16 | 8-bit (256 B) | u8 | full 28-op ISA | prototype / teaching |
| EML-VM-64 | 16-bit (64 KB) | u8 + 16-bit AR | full V2 ISA | larger address space |
| EML-VM-F32 / F64 | TBD | float | TBD | **deferred (post-v0.5)** |

---

## Documentation

- **[EML-EAI-2026-v0.5.md](EML-EAI-2026-v0.5.md)** — the current spec (v0.5 EXPERIMENTAL): semantic layer, EML interop, version strategy.
- **[EML-EAI-2026-v0.4.md](EML-EAI-2026-v0.4.md)** — the v0.4 spec (dual-mode architecture, AI-mode applications, headless VM, EML-VM-BASIC).
- **[stream/EML-INTEROP.md](stream/EML-INTEROP.md)** — PHOSPHOR ⇄ EML `phosphor-jsonl-v1` envelope diff + what PHOSPHOR extracts from an EML trace.
- **[CTS-INTEROP.md](CTS-INTEROP.md)** — PHOSPHOR ⇄ EML CTS reconciliation contract (altitude / key-space differences, what transfers).
- **[INTEGRATION.md](INTEGRATION.md)** — integration log: what was built, what was fixed, how it's verified.
- **[stream/PHOSPHOR-STREAM.md](stream/PHOSPHOR-STREAM.md)** — the phosphor-stream protocol + API.
- `NOEMA-MONITOR.md` — a real-world example of phosphor-stream instrumenting an app.

## Roadmap

**v0.6 (this release) — shipped:**

- **Φ's first non-invented target — real WebAssembly** ([`wasm/`](wasm/)): a spec-conformant `.wasm` binary parser + a functional-step interpreter (i32 core, structured control flow, `call`, one linear memory) + a CTS mapping over the linear-memory address space + a headless snapshot builder — all the same roles VM-16/64/BASIC already fill, now over an architecture nobody had to invent. Cross-checked against Node's own native `WebAssembly` engine on the same bytes: not internal self-consistency, agreement with an independent, spec-conformant implementation.
- **PHOSPHOR-SHEET** ([`spreadsheet/`](spreadsheet/PHOSPHOR-SHEET.md)): a third formal Φ projection — Human UI / AI stream / now Spreadsheet — with a real dependency-free OOXML `.xlsx` writer/reader and a governed, untrusted command-intent control plane (draft → validated → approved → executed, idempotent terminal states). Framed as legibility and an audit trail for what an agent proposes and what a human approved — not as a containment/governance boundary; a soft approval gate cannot guarantee that against an increasingly capable model, and branding it as one would invite exactly that misplaced trust.

**Next:**

- An end-to-end flagship case strung across all three projections at once (Human CRT / AI stream / Sheet) on a real scenario, instead of three projections proven separately.
- A generalized retrofit methodology: the CTS six layers restated as domain-agnostic roles, an explicit determinism/observability tier system, and a guided (not fully automated) adoption path for other codebases.
- **EML-VM-F32 / F64** float VMs — deferred (they need a float value model, IEEE-754 ISA semantics, and a float-aware CTS/snapshot; see the v0.5 spec).
- A **Hoare/denotational** proof layer on top of the operational judge.

**v0.5 — shipped:**

- **Semantic↔machine-code layer, operational form** ([`eml-semantic.ts`](eml-semantic.ts)): `describeEffect` maps each instruction to its state-transition meaning; `semanticEquiv` judges whether two byte sequences are semantically equivalent by *running both and comparing observable output* — with adversarial inputs, a ≥2-distinct-output guard, and a three-valued `equivalent` / `not-equivalent` / `inexpressible` verdict (the discipline ported from EML's execution-truth gate). A formal **Hoare-logic** proof layer is intentionally deferred.
- **EML ⇄ PHOSPHOR interop**: PHOSPHOR consumes EML's `phosphor-jsonl-v1` traces and bridges EML's source-`Cts` into machine-CTS views.

---

## License

[Apache License 2.0](LICENSE) · Copyright 2026 **EveMissLab (一言諾科技有限公司)** · author Neo.K (許筌崴)
