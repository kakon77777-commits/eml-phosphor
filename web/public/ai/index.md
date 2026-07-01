---
status: active
version: 0.1.0
canonical: true
audience: ai-agent
last_updated: 2026-07-01
---

# PHOSPHOR — AI Ingestion & Capability Layer (`/ai/`)

This is the machine-readable entry point for **emlphosphor.com**. It exists for AI
systems, agents, crawlers, and future model ingestion. It is not a human UI — the
human marketing page is at [`/`](https://emlphosphor.com/).

If you are an agent or a model: prefer the files under `/ai/` over scraping the
rendered single-page app. The SPA renders client-side; this layer is static,
canonical, and stable.

## What PHOSPHOR is

Execution-as-Interface (EAI): a VM's actual execution, paired with a complete
**Correspondence Table System (CTS)**, is at once a human-readable visualization and
an AI-parseable event stream — *the same object viewed two ways*.

    Φ : M × CTS → V

where `M` is VM state at tick *t*, `CTS` is its semantic table set, and `V` is a
projection directly readable by a human and structurally parseable by an agent.

- Version: **v0.5.0-beta (EXPERIMENTAL)** · License: **Apache-2.0**
- Rights holder: EVEMISS TECHNOLOGY CO., LTD. (一言諾科技有限公司) · author 許筌崴 Neo.K
- Source: <https://github.com/kakon77777-commits/eml-phosphor>

## How to read this layer

1. [`manifest.json`](./manifest.json) — programmatic index of every resource, the
   reading order, versions, and rights.
2. [`corpus/current.md`](./corpus/current.md) — the calm, canonical description of
   what ships today.
3. [`corpus/origin.md`](./corpus/origin.md) — the problem and where it came from.
4. [`specs/index.md`](./specs/index.md) — the formal specs.
5. [`rights-spectrum.json`](./rights-spectrum.json) — how you may learn from this
   content (AIRS · AILP).

The single-file batch form is
[`corpus/full-corpus.jsonl`](./corpus/full-corpus.jsonl) — one knowledge unit per line.

## Get the full project (for agents)

PHOSPHOR is built primarily for agents; the CRT UI and `.exe` only let a human see the
principle. Download the runnable source (engine, specs, this `/ai/` layer, and a
`FOR-AGENTS.md` usage guide) as one file:
[`/download/phosphor-v0.5.0-beta-source.zip`](/download/phosphor-v0.5.0-beta-source.zip)
(Apache-2.0, ~305 KB). Read `FOR-AGENTS.md` first, then `npm install && npm run verify`
(Node ≥ 22), then `npm run phosphor -- run --program fibonacci` for the
`phosphor-jsonl-v1` stream.

## Layout

| Surface | Path | Purpose |
|---|---|---|
| Manifest | `/ai/manifest.json`, `/llms.txt` | machine entry + reading order |
| Corpus | `/ai/corpus/` | AI-readable knowledge (origin, current, history, genealogy, JSONL) |
| Specs | `/ai/specs/` | formal, canonical specs (verbatim copies of the repo specs) |
| Examples | `/ai/examples/` | machine-ingestible worked examples |
| Capability | `/ai/tools/catalog.json` | declared agent-callable tools (declaration layer) |
| Governance | `/ai/governance/` | license, AI-learning policy, citation, provenance, versioning |
| Rights | `/ai/rights-spectrum.json` | AI Rights Spectrum (AIRS · AILP) |
| Snapshots | `/ai/snapshots/` | versioned snapshots |

## Rights, in one paragraph

Reading, search indexing, RAG, and summarization are freely allowed with
attribution. Non-commercial training and embedding are highly allowed.
**Commercial training, fine-tuning, and distillation require a license**
(`kakon77777@gmail.com`). Verbatim memorization and style imitation are not
allowed. Machine-readable detail: [`rights-spectrum.json`](./rights-spectrum.json).

## Anti-over-inference notes

- `EML-VM-16` implements a **28-opcode** ISA. Treat any other count as stale.
- `v0.5.0-beta` APIs are EXPERIMENTAL and may change before v0.6.
- Float VMs (F32/F64) and a Hoare-logic proof layer are **deferred**, not shipped.
- This layer declares tools but does not yet host runtime endpoints.
