---
status: active
version: 0.1.0
canonical: true
audience: ai-agent, human
last_updated: 2026-07-01
---

# Versioning policy

Which document wins when versions conflict.

## Current version

PHOSPHOR is at **v0.5.0-beta — EXPERIMENTAL**. v0.5 APIs may change before v0.6.
When a claim is version-sensitive, state that it is experimental and may change.

## Precedence on conflict

When two sources disagree, resolve in this order (highest wins):

1. **Repository spec** — `github.com/kakon77777-commits/eml-phosphor` is the
   origin and canonical (see [provenance.md](./provenance.md)).
2. **`/ai/specs/` copies** — the formal specs and schemas published from the
   repository. Canonical for republished content on this site.
3. **`/ai/corpus/current.md`** and the rest of `/ai/corpus/` — canonical prose
   description of the current state.
4. **Marketing SPA at `/`** — reference only; never authoritative for technical
   or version claims.

The repository spec and the `/ai/specs/` copies are canonical. If a published
copy has drifted from the repository, the repository is correct.

## Version signals

- Every published document declares `version` and `last_updated` in front-matter.
- The corpus and specs are versioned alongside the code; `last_updated` reflects
  the most recent republish.
- Historical documents (origin, design history) describe past states by design
  and are not superseded as history — but `current.md` and `/ai/specs/` govern
  the present.

See also: [provenance.md](./provenance.md) · [usage-policy.md](./usage-policy.md) ·
[crawler-policy.md](./crawler-policy.md).
