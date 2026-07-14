import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPhosphorWorkbook } from './phosphor-sheet.ts';
import { workbookToXlsxBytes } from './phosphor-xlsx.ts';
import {
  executeControlSheet, parseControlSheet, validateControlCommand, withControlSheet,
  type ControlRow,
} from './phosphor-control.ts';
import { readControlCommandsFromXlsx, readControlCommandsFromXlsxBytes } from './phosphor-control-xlsx-node.ts';

let checks = 0;
function ok(value: unknown, message: string) { assert.ok(value, message); checks++; }
function eq<T>(actual: T, expected: T, message: string) { assert.deepEqual(actual, expected, message); checks++; }

const base = buildPhosphorWorkbook({ events: [], generatedAt: '2026-07-14T00:00:00Z' });
eq(base.sheets.length, 10, 'canonical workbook includes control sheet');
eq(base.sheets.at(-1)?.name, '09_Control', 'control sheet is final canonical sheet');

const rows: ControlRow[] = [
  {
    command_id: 'cmd-read', command: 'vm:inspect', target: 'vm0', args_json: '{}',
    requested_by: 'tester', approved: false, status: 'DRAFT', created_at: '', executed_at: '', result_json: '', error: '',
  },
  {
    command_id: 'cmd-step', command: 'vm:step', target: 'vm0', args_json: '{"count":2}',
    requested_by: 'tester', approved: true, status: 'APPROVED', created_at: '', executed_at: '', result_json: '', error: '',
  },
  {
    command_id: 'cmd-denied', command: 'vm:reset', target: 'vm0', args_json: '{}',
    requested_by: 'tester', approved: false, status: 'DRAFT', created_at: '', executed_at: '', result_json: '', error: '',
  },
];
const workbook = withControlSheet(base, rows);
eq(parseControlSheet(workbook).length, 3, 'control rows parse from workbook model');
ok(validateControlCommand(rows[0]).valid, 'read-only inspect does not require approval');
ok(validateControlCommand(rows[1]).valid, 'approved mutating command validates');
ok(!validateControlCommand(rows[2]).valid, 'unapproved mutating command is rejected');

const bytes = workbookToXlsxBytes(workbook);
eq(String.fromCharCode(bytes[0], bytes[1]), 'PK', 'real XLSX starts with ZIP signature');
ok(bytes.length > 5000, 'XLSX package has OOXML payload');
const imported = readControlCommandsFromXlsxBytes(bytes);
eq(imported.map(row => row.command_id), ['cmd-read', 'cmd-step', 'cmd-denied'], 'XLSX control rows round-trip');
eq(imported[1].approved, true, 'boolean approval round-trips');
eq(imported[1].args_json, '{"count":2}', 'JSON args round-trip');

const dir = mkdtempSync(join(tmpdir(), 'phosphor-sheet-'));
const file = join(dir, 'control.xlsx');
writeFileSync(file, bytes);
eq(readControlCommandsFromXlsx(file).length, 3, 'Node path reader imports XLSX');
ok(readFileSync(file).length === bytes.length, 'XLSX persisted without mutation');
rmSync(dir, { recursive: true, force: true });

const emitted: { type: string; fields: Record<string, unknown> }[] = [];
const executed = await executeControlSheet(
  workbook,
  {
    'vm:inspect': command => ({ target: command.target, state: 'halted' }),
    'vm:step': command => ({ target: command.target, steps: command.args.count }),
  },
  {},
  (type, fields) => emitted.push({ type, fields }),
  (() => { let n = 0; return () => `2026-07-14T00:00:0${n++}Z`; })(),
);
eq(executed.processed, 3, 'three non-terminal commands processed');
const finalRows = parseControlSheet(executed.workbook);
eq(finalRows[0].status, 'EXECUTED', 'read-only command executed');
eq(finalRows[1].status, 'EXECUTED', 'approved mutation executed');
eq(finalRows[2].status, 'REJECTED', 'unapproved mutation rejected');
ok(finalRows[0].result_json.includes('halted'), 'handler result stored in ledger');
ok(finalRows[2].error.includes('approval required'), 'rejection reason stored');
ok(emitted.some(item => item.type === 'sheet:command_executed'), 'execution audit event emitted');
ok(emitted.some(item => item.type === 'sheet:command_rejected'), 'rejection audit event emitted');
eq(executed.events.every(event => event.proto === 'phosphor-jsonl-v1'), true, 'control audit reuses phosphor stream envelope');

console.log(`PHOSPHOR-SHEET control/XLSX verification: ${checks} checks passed`);
