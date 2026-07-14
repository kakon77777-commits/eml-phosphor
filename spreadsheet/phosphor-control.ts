/**
 * PHOSPHOR-SHEET control plane.
 *
 * Spreadsheet rows express command intent. They never call VM operations
 * directly. A host supplies an explicit handler map, and every decision can be
 * emitted back to phosphor-stream for deterministic audit.
 */

import type { EventLike, SheetCell, SheetModel, WorkbookModel } from './phosphor-sheet.ts';

export const CONTROL_SHEET_ID = 'control';
export const CONTROL_SHEET_NAME = '09_Control';

export const CONTROL_COMMANDS = [
  'vm:inspect', 'vm:run', 'vm:pause', 'vm:step', 'vm:reset', 'vm:call',
  'stream:replay', 'sheet:export',
] as const;
export type ControlCommandName = typeof CONTROL_COMMANDS[number];
export type ControlStatus = 'DRAFT' | 'QUEUED' | 'APPROVED' | 'EXECUTED' | 'REJECTED' | 'FAILED';

export interface ControlRow {
  command_id: string;
  command: string;
  target: string;
  args_json: string;
  requested_by: string;
  approved: boolean;
  status: ControlStatus;
  created_at: string;
  executed_at: string;
  result_json: string;
  error: string;
}

export interface ValidatedControlCommand extends ControlRow {
  command: ControlCommandName;
  args: Record<string, unknown>;
}

export interface ControlPolicy {
  allowed?: readonly ControlCommandName[];
  requireApprovalForMutations?: boolean;
}

export type ControlHandler = (command: ValidatedControlCommand) => unknown | Promise<unknown>;
export type ControlHandlers = Partial<Record<ControlCommandName, ControlHandler>>;
export type ControlEmit = (type: string, fields: Record<string, unknown>) => void;

const MUTATING = new Set<ControlCommandName>(['vm:run', 'vm:pause', 'vm:step', 'vm:reset', 'vm:call']);
const TERMINAL = new Set<ControlStatus>(['EXECUTED', 'REJECTED', 'FAILED']);

export const CONTROL_COLUMNS = [
  { key: 'command_id', label: 'Command ID' },
  { key: 'command', label: 'Command' },
  { key: 'target', label: 'Target' },
  { key: 'args_json', label: 'Args JSON', kind: 'json' as const },
  { key: 'requested_by', label: 'Requested By' },
  { key: 'approved', label: 'Approved', kind: 'boolean' as const },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Created At', kind: 'timestamp' as const },
  { key: 'executed_at', label: 'Executed At', kind: 'timestamp' as const },
  { key: 'result_json', label: 'Result JSON', kind: 'json' as const },
  { key: 'error', label: 'Error' },
];

export function blankControlRow(id = 'cmd-001'): ControlRow {
  return {
    command_id: id, command: '', target: '', args_json: '{}', requested_by: '',
    approved: false, status: 'DRAFT', created_at: '', executed_at: '', result_json: '', error: '',
  };
}

export function controlSheet(rows: ControlRow[] = [blankControlRow()]): SheetModel {
  return {
    id: CONTROL_SHEET_ID,
    name: CONTROL_SHEET_NAME,
    description: 'Validated command intent. Mutating commands require approval and host-provided handlers.',
    columns: CONTROL_COLUMNS,
    rows: rows.map(row => CONTROL_COLUMNS.map(column => row[column.key as keyof ControlRow] as SheetCell)),
  };
}

export function withControlSheet(workbook: WorkbookModel, rows?: ControlRow[]): WorkbookModel {
  const sheets = workbook.sheets.filter(sheet => sheet.id !== CONTROL_SHEET_ID);
  return { ...workbook, sheets: [...sheets, controlSheet(rows)] };
}

function rowObject(sheet: SheetModel, row: SheetCell[]): Record<string, SheetCell> {
  return Object.fromEntries(sheet.columns.map((column, index) => [column.key, row[index] ?? null]));
}

function status(value: unknown): ControlStatus {
  const normalized = String(value || 'DRAFT').toUpperCase();
  return ['DRAFT', 'QUEUED', 'APPROVED', 'EXECUTED', 'REJECTED', 'FAILED'].includes(normalized)
    ? normalized as ControlStatus : 'DRAFT';
}

export function parseControlSheet(workbook: WorkbookModel): ControlRow[] {
  const sheet = workbook.sheets.find(item => item.id === CONTROL_SHEET_ID || item.name === CONTROL_SHEET_NAME);
  if (!sheet) return [];
  return sheet.rows.map(row => {
    const value = rowObject(sheet, row);
    return {
      command_id: String(value.command_id ?? '').trim(),
      command: String(value.command ?? '').trim(),
      target: String(value.target ?? '').trim(),
      args_json: String(value.args_json ?? '{}').trim() || '{}',
      requested_by: String(value.requested_by ?? '').trim(),
      approved: value.approved === true || String(value.approved).toLowerCase() === 'true' || value.approved === 1,
      status: status(value.status),
      created_at: String(value.created_at ?? ''),
      executed_at: String(value.executed_at ?? ''),
      result_json: String(value.result_json ?? ''),
      error: String(value.error ?? ''),
    };
  }).filter(row => row.command_id || row.command);
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  command?: ValidatedControlCommand;
}

export function validateControlCommand(row: ControlRow, policy: ControlPolicy = {}): ValidationResult {
  const errors: string[] = [];
  const allowed = new Set(policy.allowed ?? CONTROL_COMMANDS);
  if (!row.command_id) errors.push('command_id is required');
  if (!CONTROL_COMMANDS.includes(row.command as ControlCommandName)) errors.push(`unsupported command: ${row.command || '(blank)'}`);
  else if (!allowed.has(row.command as ControlCommandName)) errors.push(`command blocked by policy: ${row.command}`);
  if (!row.target && row.command.startsWith('vm:')) errors.push('target is required for vm commands');
  let args: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.args_json || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) errors.push('args_json must be a JSON object');
    else args = parsed as Record<string, unknown>;
  } catch { errors.push('args_json is not valid JSON'); }
  const name = row.command as ControlCommandName;
  if ((policy.requireApprovalForMutations ?? true) && MUTATING.has(name) && !row.approved) {
    errors.push(`approval required for mutating command: ${name}`);
  }
  return errors.length ? { valid: false, errors } : {
    valid: true,
    errors: [],
    command: { ...row, command: name, args },
  };
}

function event(type: string, row: ControlRow, extra: Record<string, unknown> = {}): EventLike {
  return {
    stream: 'phosphor-sheet-control', proto: 'phosphor-jsonl-v1', seq: 0,
    ts: new Date().toISOString(), type,
    command_id: row.command_id, command: row.command, target: row.target,
    requested_by: row.requested_by, approved: row.approved, ...extra,
  };
}

export interface ControlExecutionResult {
  workbook: WorkbookModel;
  events: EventLike[];
  processed: number;
}

export async function executeControlSheet(
  workbook: WorkbookModel,
  handlers: ControlHandlers,
  policy: ControlPolicy = {},
  emit?: ControlEmit,
  now: () => string = () => new Date().toISOString(),
): Promise<ControlExecutionResult> {
  const rows = parseControlSheet(workbook);
  const seen = new Set<string>();
  const events: EventLike[] = [];
  const output: ControlRow[] = [];
  let processed = 0;

  const push = (type: string, row: ControlRow, fields: Record<string, unknown> = {}) => {
    const item = { ...event(type, row, fields), ts: now(), seq: events.length + 1, mono: events.length + 1 };
    events.push(item);
    emit?.(type, Object.fromEntries(Object.entries(item).filter(([key]) => !['stream', 'proto', 'seq', 'ts', 'type', 'mono'].includes(key))));
  };

  for (const original of rows) {
    const row = { ...original };
    if (!row.command || TERMINAL.has(row.status)) { output.push(row); continue; }
    processed++;
    push('sheet:command_requested', row);

    if (seen.has(row.command_id)) {
      row.status = 'REJECTED'; row.error = 'duplicate command_id'; row.executed_at = now();
      push('sheet:command_rejected', row, { errors: [row.error] }); output.push(row); continue;
    }
    seen.add(row.command_id);

    const validation = validateControlCommand(row, policy);
    if (!validation.valid || !validation.command) {
      row.status = 'REJECTED'; row.error = validation.errors.join('; '); row.executed_at = now();
      push('sheet:command_rejected', row, { errors: validation.errors }); output.push(row); continue;
    }

    const handler = handlers[validation.command.command];
    if (!handler) {
      row.status = 'REJECTED'; row.error = `no host handler for ${row.command}`; row.executed_at = now();
      push('sheet:command_rejected', row, { errors: [row.error] }); output.push(row); continue;
    }

    try {
      const result = await handler(validation.command);
      row.status = 'EXECUTED'; row.error = ''; row.executed_at = now();
      row.result_json = JSON.stringify(result ?? null);
      push('sheet:command_executed', row, { result });
    } catch (error) {
      row.status = 'FAILED'; row.executed_at = now();
      row.error = error instanceof Error ? error.message : String(error);
      push('sheet:command_failed', row, { error: row.error });
    }
    output.push(row);
  }

  return { workbook: withControlSheet(workbook, output), events, processed };
}
