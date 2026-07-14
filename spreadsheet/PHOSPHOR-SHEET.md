# PHOSPHOR-SHEET

**Spreadsheet projection for Execution-as-Interface.**

PHOSPHOR currently exposes one execution state through two first-class surfaces:

- Human mode: the React CRT interface.
- AI mode: `phosphor-jsonl-v1`.

PHOSPHOR-SHEET adds a third deterministic projection:

```text
Φsheet : Snapshot × EventLedger × CTS → WorkbookModel
```

It does not rebuild VM state and it does not put spreadsheet logic inside the VM core. It consumes the canonical `HeadlessSnapshot` shape and the existing event envelope.

## Canonical workbook

| Sheet | Meaning |
|---|---|
| `00_Manifest` | protocol and run identity |
| `01_Tick_Ledger` | one row per VM tick |
| `02_Registers` | register values aligned by tick |
| `03_Memory_Changes` | address, symbol, before, after, delta |
| `04_Event_Stream` | deterministic `phosphor-jsonl-v1` ledger |
| `05_Semantic_Dictionary` | event vocabulary and field meanings |
| `06_Anomalies` | intent/actual and error signals |
| `07_Intent_Actual` | explicit checks |
| `08_CTS` | generic CTS flattening without schema replacement |

## Design boundaries

1. **Single source of truth.** Snapshot rows come from the same shape used by the headless driver and UI.
2. **Dependency-free core.** `WorkbookModel`, CSV, and SpreadsheetML work in Node and browsers.
3. **Read-only first.** This version exports execution. Spreadsheet-to-command control is deferred until command validation, permissions, and audit events are specified.
4. **Structural compatibility.** The projector uses structural interfaces, so Veritaxa and other `phosphor-jsonl-v1` applications can reuse it.
5. **Excel is a projection, not the database.** Large artifacts remain outside the workbook and are referenced by path/hash in domain-specific extensions.

## API

```ts
import {
  buildPhosphorWorkbook,
  workbookToCsvMap,
  workbookToSpreadsheetML,
} from './spreadsheet/phosphor-sheet';

const workbook = buildPhosphorWorkbook({
  snapshots,
  events,
  dictionary,
  cts,
  manifest: { eai_proto: EAI_PROTO, program: 'fibonacci' },
});

const excelXml = workbookToSpreadsheetML(workbook); // opens in Excel
const csvFiles = workbookToCsvMap(workbook);         // one CSV per sheet
```

A true `.xlsx` Node adapter can be added later without changing `WorkbookModel`.
