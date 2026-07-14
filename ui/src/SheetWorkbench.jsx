import { useMemo, useState } from 'react';
import { createHeadlessVM } from '../../headless-driver';
import { PROGRAM_FIBONACCI, PROGRAM_COUNTER, PROGRAM_XOR_CIPHER } from '../../eml-vm16-core';
import { createEmitter, memorySink } from '../../stream/phosphor-stream';
import {
  buildPhosphorWorkbook,
  sheetToCsv,
  workbookToSpreadsheetML,
} from '../../spreadsheet/phosphor-sheet';
import { C, panelHead, Screen, TabTitle } from './theme.jsx';

const PROGRAMS = { fibonacci: PROGRAM_FIBONACCI, counter: PROGRAM_COUNTER, xor: PROGRAM_XOR_CIPHER };

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function SheetWorkbench() {
  const [program, setProgram] = useState('fibonacci');
  const [maxSteps, setMaxSteps] = useState(120);
  const [workbook, setWorkbook] = useState(null);
  const [sheetId, setSheetId] = useState('manifest');
  const [busy, setBusy] = useState(false);

  const active = useMemo(
    () => workbook?.sheets.find(s => s.id === sheetId) ?? workbook?.sheets[0] ?? null,
    [workbook, sheetId],
  );

  async function run() {
    setBusy(true);
    try {
      const sink = memorySink();
      const emitter = createEmitter({ stream: 'phosphor-sheet-ui', sink });
      const runner = createHeadlessVM({
        program: PROGRAMS[program], mode: 'ai', emitter,
        maxSteps: Math.max(1, Math.min(50000, maxSteps | 0)),
      });
      await runner.run();
      const model = buildPhosphorWorkbook({
        events: sink.events,
        manifest: {
          eai_proto: 'EML-EAI-2026-v0.5', stream_proto: 'phosphor-jsonl-v1',
          program, source: 'PHOSPHOR UI',
        },
      });
      setWorkbook(model);
      setSheetId('manifest');
    } finally { setBusy(false); }
  }

  return (
    <Screen>
      <TabTitle accent={C.ai} title="SHEET · WORKBOOK"
        sub="Third EAI projection · the same execution becomes a human/agent-readable workbook — read-only, deterministic, exportable" />

      <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
        {Object.keys(PROGRAMS).map(name => (
          <button key={name} onClick={() => setProgram(name)} style={button(program === name)}>{name}</button>
        ))}
        <span style={{ color: '#2a5a4a', fontSize: '9px' }}>max steps</span>
        <input value={maxSteps} onChange={e => setMaxSteps(Number(e.target.value) || 0)} style={input} />
        <button onClick={run} disabled={busy} style={action}>{busy ? '…' : '▶ BUILD WORKBOOK'}</button>
        {workbook && <>
          <button onClick={() => download('phosphor-workbook.xml', workbookToSpreadsheetML(workbook), 'application/xml')} style={exportBtn}>↓ EXCEL XML</button>
          {active && <button onClick={() => download(`${active.name}.csv`, sheetToCsv(active), 'text/csv;charset=utf-8')} style={exportBtn}>↓ CURRENT CSV</button>}
        </>}
      </div>

      {!workbook ? (
        <div style={{ ...panelHead, color: '#2a5a4a' }}>Run a verified VM program to project its snapshots and event ledger into PHOSPHOR-SHEET.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,220px) minmax(0,1fr)', gap: '12px' }}>
          <div style={{ border: `1px solid ${C.aiDim}`, padding: '7px', minHeight: '420px' }}>
            <div style={{ ...panelHead, color: C.ai, borderColor: C.aiDim }}>WORKBOOK · {workbook.proto}</div>
            {workbook.sheets.map(s => (
              <button key={s.id} onClick={() => setSheetId(s.id)} style={{
                display: 'block', width: '100%', textAlign: 'left', marginBottom: '4px',
                background: s.id === active?.id ? 'rgba(0,210,255,0.09)' : 'none',
                border: `1px solid ${s.id === active?.id ? C.ai : '#12333a'}`,
                color: s.id === active?.id ? C.ai : '#2a6670', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '9px', padding: '5px 7px',
              }}>{s.name} <span style={{ float: 'right', opacity: 0.6 }}>{s.rows.length}</span></button>
            ))}
          </div>

          {active && <div style={{ minWidth: 0 }}>
            <div style={{ ...panelHead, color: C.ai, borderColor: C.aiDim }}>{active.name} · {active.description}</div>
            <div style={{ overflow: 'auto', maxHeight: '520px', border: `1px solid ${C.aiDim}` }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '9px' }}>
                <thead><tr>{active.columns.map(c => <th key={c.key} style={th}>{c.label}</th>)}</tr></thead>
                <tbody>{active.rows.slice(0, 250).map((row, i) => (
                  <tr key={i}>{active.columns.map((c, j) => <td key={c.key} style={td}>{format(row[j])}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
            {active.rows.length > 250 && <div style={{ color: '#2a5a4a', fontSize: '8px', marginTop: '4px' }}>UI preview capped at 250 rows; exports contain all rows.</div>}
          </div>}
        </div>
      )}
    </Screen>
  );
}

function format(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}
const button = active => ({
  background: active ? 'rgba(0,210,255,0.08)' : 'none', border: `1px solid ${active ? C.ai : '#1a3a44'}`,
  color: active ? C.ai : '#1a3a44', cursor: 'pointer', fontSize: '9px', fontFamily: 'inherit', padding: '3px 8px',
});
const action = { background: 'rgba(0,210,255,0.08)', border: `1px solid ${C.ai}`, color: C.ai, cursor: 'pointer', fontSize: '10px', fontFamily: 'inherit', padding: '4px 12px' };
const exportBtn = { ...action, color: C.sem, border: `1px solid ${C.sem}`, background: 'rgba(90,240,200,0.06)' };
const input = { width: '58px', background: '#040c04', color: C.ai, border: '1px solid #13313a', fontFamily: 'inherit', fontSize: '10px', padding: '3px 5px' };
const th = { position: 'sticky', top: 0, background: '#07130c', color: C.ai, border: '1px solid #12333a', padding: '4px 6px', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { color: '#58a88a', border: '1px solid #0e2a25', padding: '3px 6px', verticalAlign: 'top', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: '420px' };
