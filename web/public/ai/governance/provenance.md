---
status: active
version: 0.1.0
canonical: true
audience: ai-agent, human
last_updated: 2026-07-01
---

# Provenance

Where PHOSPHOR's content comes from, who authored it, and how versions are
tracked.

## Source of truth

The **repository is the origin**: `github.com/kakon77777-commits/eml-phosphor`.
This site (`emlphosphor.com`) **republishes** the repository's specs, corpus,
and documentation for AI ingestion; it is a mirror surface, not the source. On
any discrepancy, the repository — and the `/ai/specs/` copies published from it
— take precedence (see [versioning-policy.md](./versioning-policy.md)).

## Authorship and ownership

- **Owner**: EVEMISS TECHNOLOGY CO., LTD.（一言諾科技有限公司）.
- **Author**: 許筌崴 Neo.K.
- **Copyright**: 2026 EVEMISS TECHNOLOGY CO., LTD.
- **Software license**: Apache-2.0 (repository `LICENSE` / `NOTICE`).
- **AI-learning rights**: AIRS / AILP — see
  [ai-learning-policy.md](./ai-learning-policy.md) and
  [../rights-spectrum.json](../rights-spectrum.json).

## How provenance is tracked

- Git history in the repository is the authoritative change record.
- Each published document carries YAML front-matter: `status`, `version`,
  `canonical`, `audience`, `last_updated`.
- The current release is **v0.5.0-beta (experimental)**; the corpus and specs
  are versioned alongside the code.
- Republished `/ai/` documents should match their repository originals; if a
  published copy drifts, the repository original is correct.

## Interop provenance

PHOSPHOR consumes execution traces from the sibling project **EML**, which emits
the same `phosphor-jsonl-v1` envelope, and bridges EML's source-level CTS into
machine-CTS views. Content that originates in EML retains EML's provenance;
PHOSPHOR does not claim authorship of ingested EML traces.

See also: [versioning-policy.md](./versioning-policy.md) ·
[citation-policy.md](./citation-policy.md) · [usage-policy.md](./usage-policy.md).
