/**
 * PHOSPHOR · Headless VM Runner
 * EML-EAI-2026-v0.4 · headless execution driver (AI-mode + human-mode)
 * EveMissLab (一言諾科技有限公司) · 2026
 *
 * A UI-free driver that runs an EML-VM-16 or EML-VM-BASIC program to completion
 * and emits AI-readable HeadlessSnapshots per tick. Two modes:
 *
 *   ai    — maximum throughput, no inter-tick delay (for agent consumption /
 *           batch verification). Yields to the event loop periodically so the
 *           process stays non-blocking.
 *   human — same snapshot shape, intended for paced/observed runs.
 *
 * AI-mode output integrates with the portable phosphor-stream protocol: pass an
 * Emitter and every tick becomes a `vm:tick` event, HALT becomes `vm:halt`.
 *
 *   run:  npm run phosphor -- run --program fibonacci [--mode ai] [--max N] …
 */

import {
  makeVMState, stepOnce, decode, hex2, REG_NAMES,
  PROGRAM_FIBONACCI, PROGRAM_COUNTER, PROGRAM_XOR_CIPHER,
  type ProgramDefinition, type VMState, type VMFlags, type CTS,
} from './eml-vm16-core';

import {
  type SpeedPreset,
} from './eml-vm16-window';

import {
  makeBasicState, stepOnceBasic, stepNBasic,
  validateProgramConstraints,
  type BasicConstraints, DEFAULT_BASIC_CONSTRAINTS,
} from './eml-vm-basic';

import {
  type Emitter,
} from './stream/phosphor-stream';

// ═══════════════════════════════════════════════════════════════════════════════
// § 1. Snapshot Types
// ═══════════════════════════════════════════════════════════════════════════════

export type VMMode = 'ai' | 'human';

/**
 * AI-readable per-tick snapshot. Architecture-neutral: works for both VM-16
 * (Uint8Array cells) and BASIC (Int32Array cells) since both expose
 * ArrayLike<number> memory/registers.
 */
export interface HeadlessSnapshot {
  mode:        VMMode;
  arch:        string;
  vm_id:       string;
  tick:        number;
  pc:          string;
  pc_symbol:   string | null;
  pc_comment:  string | null;
  instruction: string;
  registers:   Record<string, number>;
  flags:       { Z: boolean; N: boolean; G: boolean };
  changed_this_tick: { addr: string; symbol: string | null; before: number; after: number }[];
  halted:      boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 2. Snapshot Builder
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a HeadlessSnapshot from a VM state. The state shape is the structural
 * intersection of VMState (Uint8Array) and BasicState (Int32Array); both satisfy
 * ArrayLike<number> for memory/regs, so a single builder serves both archs.
 *
 * `prevMem` (if given) supplies the "before" value for changed cells; otherwise
 * the current value is used for both before/after.
 */
export function buildHeadlessSnapshot(args: {
  id:   string;
  state: {
    memory:  ArrayLike<number>;
    regs:    ArrayLike<number>;
    pc:      number;
    sp:      number;
    flags:   VMFlags;
    ticks:   number;
    halted:  boolean;
    changed: Set<number>;
  };
  mode:    VMMode;
  arch:    string;
  cts?:    Partial<CTS>;
  prevMem?: ArrayLike<number>;
}): HeadlessSnapshot {
  const { id, state, mode, arch, cts, prevMem } = args;
  const mem = state.memory;
  const op  = mem[state.pc];
  const arg = mem[(state.pc + 1) & 0xFF] & 0xFF;

  const sym = cts?.symbolTable;
  const cmt = cts?.commentTable;

  const changed = [...state.changed].map(addr => ({
    addr:   `0x${hex2(addr)}`,
    symbol: sym?.get(addr)?.name ?? null,
    before: prevMem ? prevMem[addr] : mem[addr],
    after:  mem[addr],
  }));

  const registers: Record<string, number> = {};
  REG_NAMES.forEach((n, i) => { registers[n] = state.regs[i]; });

  return {
    mode,
    arch,
    vm_id:       id,
    tick:        state.ticks,
    pc:          `0x${hex2(state.pc)}`,
    pc_symbol:   sym?.get(state.pc)?.name ?? null,
    pc_comment:  cmt?.get(state.pc) ?? null,
    instruction: decode(op, arg, cts),
    registers,
    flags:       { Z: state.flags.z, N: state.flags.neg, G: state.flags.gt },
    changed_this_tick: changed,
    halted:      state.halted,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 3. Headless VM Driver
// ═══════════════════════════════════════════════════════════════════════════════

export interface HeadlessOptions {
  program:      ProgramDefinition;
  mode?:        VMMode;
  speed?:       string;
  maxSteps?:    number;
  constraints?: BasicConstraints;
  id?:          string;
  onSnapshot?:  (s: HeadlessSnapshot) => void;
  onHalt?:      (s: HeadlessSnapshot) => void;
  emitter?:     Emitter;
}

const YIELD_EVERY = 2000;

/**
 * Create a headless VM runner. If `constraints` is present the BASIC path is
 * used (makeBasicState / stepOnceBasic, arch 'EML-VM-BASIC'); otherwise the
 * VM-16 path (makeVMState / stepOnce, arch 'EML-VM-16').
 *
 * Per tick: capture prevMem → step once → build snapshot → onSnapshot +
 * emitter.emit('vm:tick', …). On HALT: onHalt + emitter.emit('vm:halt', …).
 * AI mode runs at max throughput, yielding to the event loop every ~2000 steps.
 */
export function createHeadlessVM(opts: HeadlessOptions): {
  run(): Promise<{ steps: number; halted: boolean; finalSnapshot: HeadlessSnapshot; finalState: any }>;
  stop(): void;
} {
  const mode     = opts.mode ?? 'ai';
  const maxSteps = opts.maxSteps ?? 1_000_000;
  const id       = opts.id ?? opts.program.id;
  const cts      = opts.program.cts ?? {};
  const isBasic  = opts.constraints !== undefined;
  const arch     = isBasic ? 'EML-VM-BASIC' : 'EML-VM-16';
  const constraints = opts.constraints ?? DEFAULT_BASIC_CONSTRAINTS;

  let stopped = false;

  const run = async (): Promise<{ steps: number; halted: boolean; finalSnapshot: HeadlessSnapshot; finalState: any }> => {
    let state: VMState | ReturnType<typeof makeBasicState> =
      isBasic ? makeBasicState(opts.program, constraints) : makeVMState(opts.program);

    let steps = 0;
    // Snapshot fields helper: a flat record for the stream emitter.
    const snapToFields = (s: HeadlessSnapshot): Record<string, unknown> => ({
      arch:        s.arch,
      mode:        s.mode,
      vm_id:       s.vm_id,
      vm_tick:     s.tick,
      pc:          s.pc,
      pc_symbol:   s.pc_symbol,
      instruction: s.instruction,
      registers:   s.registers,
      flags:       s.flags,
      changed:     s.changed_this_tick,
      halted:      s.halted,
    });

    // Build an initial snapshot so finalSnapshot is always defined, even if the
    // program halts before the first step.
    let finalSnapshot: HeadlessSnapshot = buildHeadlessSnapshot({ id, state: state as any, mode, arch, cts });

    while (!stopped && !state.halted && steps < maxSteps) {
      const prevMem = state.memory;
      state = isBasic
        ? stepOnceBasic(state as ReturnType<typeof makeBasicState>, constraints, cts)
        : stepOnce(state as VMState, cts);
      steps++;

      const snap = buildHeadlessSnapshot({ id, state: state as any, mode, arch, cts, prevMem });
      finalSnapshot = snap;
      opts.onSnapshot?.(snap);
      opts.emitter?.emit('vm:tick', snapToFields(snap));

      if (state.halted) {
        opts.onHalt?.(snap);
        opts.emitter?.emit('vm:halt', snapToFields(snap));
        break;
      }

      // AI mode: max throughput, but yield periodically to stay non-blocking.
      if (mode === 'ai' && steps % YIELD_EVERY === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    return { steps, halted: state.halted, finalSnapshot, finalState: state };
  };

  return {
    run,
    stop() { stopped = true; },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 4. CLI
// ═══════════════════════════════════════════════════════════════════════════════

const PROGRAM_REGISTRY: Record<string, ProgramDefinition> = {
  fibonacci: PROGRAM_FIBONACCI,
  counter:   PROGRAM_COUNTER,
  xor:       PROGRAM_XOR_CIPHER,
};

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { out[key] = next; i++; }
      else out[key] = true;
    } else if (out._cmd === undefined) {
      out._cmd = a;
    }
  }
  return out;
}

async function cli(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  if (args._cmd !== 'run') {
    console.error('usage: tsx headless-vm.ts run --program <fibonacci|counter|xor> [--mode ai|human] [--speed TURBO] [--max N] [--basic] [--maxValue N] [--ws-port P]');
    process.exitCode = 1;
    return;
  }

  const progName = String(args.program ?? 'fibonacci');
  const program  = PROGRAM_REGISTRY[progName];
  if (!program) {
    console.error(`unknown program '${progName}'. Known: ${Object.keys(PROGRAM_REGISTRY).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const mode    = (args.mode === 'human' ? 'human' : 'ai') as VMMode;
  const speed   = (typeof args.speed === 'string' ? args.speed : 'TURBO') as SpeedPreset | string;
  const maxSteps = args.max !== undefined ? Number(args.max) : 1_000_000;
  const isBasic = args.basic === true;
  const wsPort  = args['ws-port'] !== undefined ? Number(args['ws-port']) : undefined;

  // ── WebSocket-server path: reuse the P5 stack ───────────────────────────────
  if (wsPort !== undefined) {
    const { createPipeline, buildProgramRegistry } = await import('./eml-vm16-window');
    const { bootstrapWSServer } = await import('./eml-vm16-agent');
    const { WebSocketServer } = await import('ws');

    const registry = buildProgramRegistry([program]);
    const mgr = createPipeline({
      id: 'headless-ws', label: 'headless ws', autoRun: false,
      windows: [{ id: program.id, title: program.label, program, speed: speed as SpeedPreset }],
      channels: [],
    }, registry);

    const wss = new WebSocketServer({ port: wsPort });
    await new Promise<void>(res => wss.on('listening', () => res()));
    bootstrapWSServer(wss, mgr);
    mgr.runWindow(program.id, speed as SpeedPreset);
    console.log(`ws://localhost:${wsPort}  (window '${program.id}' running, speed ${speed})`);
    return;
  }

  // ── Headless stdout path ────────────────────────────────────────────────────
  const constraints: BasicConstraints | undefined = isBasic
    ? { ...DEFAULT_BASIC_CONSTRAINTS, ...(args.maxValue !== undefined ? { maxValue: Number(args.maxValue) } : {}) }
    : undefined;

  if (constraints) {
    const { valid, violations } = validateProgramConstraints(program, constraints);
    if (!valid) {
      console.error(`program '${program.id}' violates BASIC constraints: ${violations.map(v => `${v.mnemonic}@0x${hex2(v.addr)}`).join(', ')}`);
      process.exitCode = 1;
      return;
    }
  }

  const runner = createHeadlessVM({
    program, mode, speed, maxSteps, constraints,
    onSnapshot: (snap) => { process.stdout.write(JSON.stringify(snap) + '\n'); },
  });

  await runner.run();
}

// Guarded entry: only run when executed directly (not when imported by tests).
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('headless-vm.ts')) {
  cli(process.argv.slice(2)).catch(err => {
    console.error('headless-vm crashed:', err);
    process.exitCode = 1;
  });
}
