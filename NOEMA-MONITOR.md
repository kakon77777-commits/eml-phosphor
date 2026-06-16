# Noema PHOSPHOR Monitor Channel

This file documents the lightweight PHOSPHOR-style monitor channel used by Noema.

## Channel File

`noema-monitor.jsonl`

Each line is one JSON event:

```json
{
  "stream": "noema",
  "proto": "phosphor-jsonl-v1",
  "seq": 1,
  "ts": "2026-06-12T08:00:00.000Z",
  "type": "file:read"
}
```

## Event Types

- `agent:detect`
- `agent:start`
- `agent:done`
- `agent:error`
- `workspace:list`
- `workspace:error`
- `file:read`
- `file:write`
- `file:error`

## Purpose

The channel is meant for AI debugging and handoff. It records the app's observable behavior around local files, workspaces, and local-agent execution, so another agent can inspect what actually happened instead of guessing from UI state.

It is intentionally append-only and best-effort. Monitor failure must not break Noema.
