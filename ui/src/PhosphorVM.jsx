import { useState, useEffect } from 'react';
// Single engine: the verified P2 VMCore + the v0.4 EML-VM-BASIC profile.
import {
  makeVMState, stepOnce, stepN, decode,
  hex2 as h, bin8, REG_NAMES as REG,
  PROGRAM_FIBONACCI, PROGRAM_COUNTER, PROGRAM_XOR_CIPHER,
} from '../../eml-vm16-core';
import {
  makeBasicState, stepOnceBasic, stepNBasic,
  validateProgramConstraints, DEFAULT_BASIC_CONSTRAINTS, PROGRAM_BASIC_SUM,
  ConstraintViolation,
} from '../../eml-vm-basic';

// ─── Program registry ────────────────────────────────────────────────────────
const PROGRAMS = {
  FIBONACCI:  PROGRAM_FIBONACCI,
  COUNTER:    PROGRAM_COUNTER,
  XOR_CIPHER: PROGRAM_XOR_CIPHER,
  BASIC_SUM:  PROGRAM_BASIC_SUM,   // v0.4 EML-VM-BASIC: bounded-int, value reaches 300 (>255)
};
const BASIC_NAMES = new Set(['BASIC_SUM']);
const CONSTRAINTS = DEFAULT_BASIC_CONSTRAINTS;

const SPEEDS = {
  SLOW:  { ms: 480, n: 1 },
  NORM:  { ms: 110, n: 1 },
  FAST:  { ms: 35,  n: 1 },
  TURBO: { ms: 40,  n: 6 },
};

const C = {
  bg: '#040c04', fg: '#1aee44', bright: '#00ff41', dim: '#0a1c0a',
  pc: '#00ff41', pcBg: 'rgba(0,255,65,0.15)', pcGlow: '0 0 8px rgba(0,255,65,0.7)',
  pcArg: '#00bb2e', pcArgBg: 'rgba(0,187,46,0.07)',
  sp: '#ff6600', spBg: 'rgba(255,102,0,0.12)', spGlow: '0 0 5px rgba(255,102,0,0.5)',
  flash: '#ffffff', flashBg: 'rgba(255,255,255,0.13)', flashGlow: '0 0 8px rgba(255,255,255,0.6)',
  amber: '#ffaa00', border: '#0a1c0a', muted: '#0a2a0a',
  ai: '#00d2ff', aiDim: '#0a2230',   // AI-mode accent (cyan) — distinct from the human green
};

function cellColor(val, isPC, isPCa, isSP, isFl) {
  if (isFl)  return { color: C.flash, bg: C.flashBg, shadow: C.flashGlow };
  if (isPC)  return { color: C.pc,    bg: C.pcBg,    shadow: C.pcGlow    };
  if (isPCa) return { color: C.pcArg, bg: C.pcArgBg, shadow: 'none'      };
  if (isSP)  return { color: C.sp,    bg: C.spBg,    shadow: C.spGlow    };
  if (val === 0) return { color: C.dim, bg: 'transparent', shadow: 'none' };
  const opacity = Math.min(1, val / 255 * 0.82 + 0.18);
  return { color: `rgba(20,${Math.min(255, val + 35)},20,${opacity.toFixed(2)})`, bg: 'transparent', shadow: 'none' };
}

function regionOf(typeTable, addr) {
  if (!typeTable) return null;
  return typeTable.find(r => addr >= r.start && addr <= r.end) ?? null;
}

/**
 * Build the AI-mode projection (V_AI) of the current state M — the exact
 * HeadlessSnapshot an agent receives per tick. Same engine, decoupled output.
 */
function buildAISnapshot(vm, prog, isBasic, cts) {
  const op  = vm.memory[vm.pc] & 0xFF;
  const arg = vm.memory[(vm.pc + 1) & 0xFF] & 0xFF;
  const registers = {};
  REG.forEach((n, i) => { registers[n] = vm.regs[i]; });
  const changed = [...vm.changed].map(addr => ({
    addr:   `0x${h(addr)}`,
    symbol: cts.symbolTable?.get(addr)?.name ?? null,
    after:  vm.memory[addr],
  }));
  return {
    mode:  'ai',
    arch:  isBasic ? 'EML-VM-BASIC' : 'EML-VM-16',
    vm_id: prog.id,
    tick:  vm.ticks,
    pc:    `0x${h(vm.pc)}`,
    pc_symbol:  cts.symbolTable?.get(vm.pc)?.name ?? null,
    pc_comment: cts.commentTable?.get(vm.pc) ?? null,
    instruction: decode(op, arg, cts),
    registers,
    flags: { Z: vm.flags.z, N: vm.flags.neg, G: vm.flags.gt },
    changed_this_tick: changed,
    halted: vm.halted,
  };
}

function Btn({ onClick, active, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: 'none',
      border: `1px solid ${disabled ? '#0a1c0a' : active ? C.bright : '#1a4a1a'}`,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '10px', fontFamily: 'inherit', padding: '2px 9px',
      color: disabled ? '#0a1c0a' : active ? C.bright : '#1a4a1a',
      letterSpacing: '1px', transition: 'all 0.1s',
    }}>{children}</button>
  );
}

const panelHead = {
  color: C.muted, fontSize: '8.5px', letterSpacing: '1px',
  borderBottom: `1px solid ${C.border}`, paddingBottom: '2px', marginBottom: '5px',
};

export default function PhosphorVM() {
  const [progName, setProgName] = useState('FIBONACCI');
  const [vm, setVM]           = useState(() => makeVMState(PROGRAMS.FIBONACCI));
  const [running, setRunning] = useState(false);
  const [speed, setSpeed]     = useState('NORM');
  const [flash, setFlash]     = useState(new Set());
  const [violation, setViolation] = useState(null);

  const prog    = PROGRAMS[progName];
  const cts     = prog.cts ?? {};
  const isBasic = BASIC_NAMES.has(progName);
  const arch    = isBasic ? 'EML-VM-BASIC' : 'EML-VM-16';

  const makeVM   = (name) => BASIC_NAMES.has(name)
    ? makeBasicState(PROGRAMS[name], CONSTRAINTS)
    : makeVMState(PROGRAMS[name]);
  const stepOnceAny = (s) => isBasic ? stepOnceBasic(s, CONSTRAINTS, cts) : stepOnce(s, cts);
  const stepNAny    = (s, n) => isBasic ? stepNBasic(s, n, CONSTRAINTS, cts) : stepN(s, n, cts);

  // Auto-step — drives the verified core (VM-16 or BASIC). A ConstraintViolation
  // halts and is surfaced, never crashes the UI.
  useEffect(() => {
    if (!running) return;
    const { ms, n } = SPEEDS[speed];
    const id = setInterval(() => {
      setVM(prev => {
        if (prev.halted) { setRunning(false); return prev; }
        try {
          return stepNAny(prev, n);
        } catch (e) {
          const msg = e instanceof ConstraintViolation ? e.message : String(e?.message ?? e);
          queueMicrotask(() => { setRunning(false); setViolation(msg); });
          return { ...prev, halted: true };
        }
      });
    }, ms);
    return () => clearInterval(id);
  }, [running, speed, progName]);

  // Flash management
  useEffect(() => {
    if (!vm.changed.size) return;
    setFlash(vm.changed);
    const id = setTimeout(() => setFlash(new Set()), 260);
    return () => clearTimeout(id);
  }, [vm.ticks]);

  const pcAddr    = vm.pc;
  const pcArgAddr = (vm.pc + 1) & 0xFF;
  const op  = vm.memory[pcAddr] & 0xFF;
  const arg = vm.memory[pcArgAddr] & 0xFF;

  const pcSymbol  = cts.symbolTable?.get(vm.pc) ?? null;
  const pcComment = cts.commentTable?.get(vm.pc) ?? null;
  const pcRegion  = regionOf(cts.typeTable, vm.pc);

  const constraintCheck = isBasic ? validateProgramConstraints(prog, CONSTRAINTS) : null;
  const snapshot = buildAISnapshot(vm, prog, isBasic, cts);

  function stepOne() {
    setViolation(null);
    setVM(s => { try { return stepOnceAny(s); } catch (e) { setViolation(e?.message ?? String(e)); return { ...s, halted: true }; } });
  }
  function loadProg(name) {
    setProgName(name);
    setRunning(false);
    setFlash(new Set());
    setViolation(null);
    setVM(makeVM(name));
  }

  return (
    <div style={{
      background: C.bg, minHeight: 'calc(100vh - 34px)', color: C.fg,
      fontFamily: '"Courier New",Courier,monospace',
      padding: '12px 14px', overflowX: 'auto', position: 'relative',
    }}>
      {/* CRT overlays */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 20,
        background: 'repeating-linear-gradient(to bottom,transparent 0,transparent 1px,rgba(0,0,0,0.1) 1px,rgba(0,0,0,0.1) 2px)' }} />
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 19,
        background: 'radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(0,0,0,0.45) 100%)' }} />

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginBottom: '10px', position: 'relative', zIndex: 1 }}>
        <span style={{ color: C.bright, fontSize: '13px', letterSpacing: '2px', textShadow: '0 0 10px rgba(0,255,65,0.5)', marginRight: '4px' }}>
          ▸ {arch}
        </span>
        <span style={{ color: C.border }}>│</span>

        {Object.keys(PROGRAMS).map(p => (
          <button key={p} onClick={() => loadProg(p)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '10px', fontFamily: 'inherit', padding: '2px 6px',
            color: progName === p ? (BASIC_NAMES.has(p) ? C.amber : C.bright) : '#1a3a1a',
            borderBottom: progName === p ? `1px solid ${BASIC_NAMES.has(p) ? C.amber : C.bright}` : '1px solid transparent',
            textShadow: progName === p ? `0 0 5px rgba(0,255,65,0.4)` : 'none',
          }}>{PROGRAMS[p].label}{BASIC_NAMES.has(p) ? ' ◇' : ''}</button>
        ))}

        <span style={{ color: C.border }}>│</span>
        <Btn onClick={stepOne} disabled={vm.halted || running}>STEP</Btn>
        <Btn onClick={() => { setViolation(null); setRunning(r => !r); }} disabled={vm.halted} active={running}>
          {running ? '■ HALT' : '▶ RUN'}
        </Btn>
        <Btn onClick={() => loadProg(progName)}>↺ RST</Btn>

        <span style={{ color: C.border }}>│</span>
        {Object.keys(SPEEDS).map(s => (
          <button key={s} onClick={() => setSpeed(s)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '9px', fontFamily: 'inherit',
            color: speed === s ? C.bright : '#1a3a1a',
            textShadow: speed === s ? `0 0 5px rgba(0,255,65,0.4)` : 'none',
          }}>{speed === s ? '◉' : '○'} {s}</button>
        ))}
      </div>

      {/* Main layout: [memory grid] [state/CTS] [AI stream] */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>

        {/* Memory grid */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ color: C.muted, fontSize: '8.5px', letterSpacing: '1px', marginBottom: '3px' }}>
            MEMORY  0x00–0xFF  [256 CELLS]
          </div>

          <div style={{ display: 'flex', marginLeft: '28px', marginBottom: '1px' }}>
            {Array.from({ length: 16 }, (_, c) => (
              <span key={c} style={{ width: '24px', textAlign: 'center', fontSize: '7.5px', color: '#0a1e0a' }}>
                _{h(c)[1]}
              </span>
            ))}
          </div>

          {Array.from({ length: 16 }, (_, row) => (
            <div key={row} style={{ display: 'flex', alignItems: 'center', marginBottom: '1px' }}>
              <span style={{ width: '26px', fontSize: '7.5px', color: '#0a1e0a', flexShrink: 0 }}>
                {h(row)}x
              </span>
              {Array.from({ length: 16 }, (_, col) => {
                const addr = row * 16 + col;
                const val  = vm.memory[addr];
                const isPC  = addr === pcAddr;
                const isPCa = addr === pcArgAddr;
                const isSP  = addr === vm.sp;
                const isFl  = flash.has(addr);
                const { color, bg, shadow } = cellColor(val, isPC, isPCa, isSP, isFl);
                const region = regionOf(cts.typeTable, addr);
                const baseBg = bg === 'transparent' && region ? region.colorHint : bg;
                // Wide BASIC cells (>255) show a 3-char hex; clamp display so the grid stays aligned.
                const txt = val > 0xFF ? (val & 0xFFFF).toString(16).toUpperCase().slice(-3) : h(val);
                return (
                  <span key={col}
                    title={`[0x${h(addr)}]  hex:${val.toString(16).toUpperCase()}  dec:${val}${val <= 0xFF ? `  bin:${bin8(val)}` : ''}${region ? `  ·  ${region.kind}` : ''}`}
                    style={{
                      width: '24px', textAlign: 'center', fontSize: '10px', lineHeight: '15px',
                      display: 'inline-block', color, background: baseBg, textShadow: shadow,
                      borderRadius: '1px',
                    }}>
                    {txt}
                  </span>
                );
              })}
            </div>
          ))}

          <div style={{ marginTop: '6px', display: 'flex', gap: '10px', fontSize: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: C.pc }}>■ PC</span>
            <span style={{ color: C.pcArg }}>■ ARG</span>
            <span style={{ color: C.sp }}>■ SP</span>
            <span style={{ color: C.flash }}>■ WRITE</span>
            <span style={{ color: '#0a3a0a' }}>■ ZERO</span>
            <span style={{ color: '#1a4a1a' }}>▦ region = CTS typeTable</span>
          </div>
        </div>

        {/* Middle column: registers / NEXT+CTS / constraints / log */}
        <div style={{ flex: '1 1 220px', maxWidth: '320px', minWidth: '200px' }}>

          {/* Registers */}
          <div style={{ marginBottom: '12px' }}>
            <div style={panelHead}>REGISTERS{isBasic ? '  (bounded int [0,N])' : '  (u8)'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 6px' }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ fontSize: '10.5px' }}>
                  <span style={{ color: '#1a4a1a' }}>{REG[i]}: </span>
                  {isBasic
                    ? <><span style={{ color: vm.regs[i] > 255 ? C.amber : C.fg }}>{vm.regs[i]}</span>
                        <span style={{ color: '#0a2a0a', fontSize: '8px', marginLeft: '3px' }}>0x{h(vm.regs[i])}</span></>
                    : <><span style={{ color: C.fg }}>0x{h(vm.regs[i])}</span>
                        <span style={{ color: '#0a2a0a', fontSize: '8px', marginLeft: '3px' }}>({vm.regs[i]})</span></>}
                </div>
              ))}
            </div>
            <div style={{ marginTop: '5px', fontSize: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span><span style={{ color: '#1a4a1a' }}>PC </span><span style={{ color: C.pc, textShadow: '0 0 4px rgba(0,255,65,0.5)' }}>0x{h(vm.pc)}</span></span>
              <span><span style={{ color: '#1a4a1a' }}>SP </span><span style={{ color: C.sp }}>0x{h(vm.sp)}</span></span>
              <span style={{ color: '#1a3a1a', fontSize: '9px' }}>
                Z={vm.flags.z ? '1' : '0'} N={vm.flags.neg ? '1' : '0'} G={vm.flags.gt ? '1' : '0'}
              </span>
            </div>
          </div>

          {/* Current instruction + CTS */}
          <div style={{ marginBottom: '12px' }}>
            <div style={panelHead}>
              NEXT  @  0x{h(vm.pc)}
              {pcSymbol && <span style={{ color: C.amber, marginLeft: '6px' }}>&lt;{pcSymbol.name}&gt;</span>}
              {pcRegion && <span style={{ color: '#1a4a1a', marginLeft: '6px' }}>[{pcRegion.kind}]</span>}
            </div>
            <div style={{ fontSize: '12.5px', color: C.bright, marginBottom: '4px', textShadow: '0 0 5px rgba(0,255,65,0.35)', letterSpacing: '0.5px' }}>
              {decode(op, arg, cts)}
            </div>
            {pcComment && (
              <div style={{ fontSize: '9.5px', color: '#3a7a3a', marginBottom: '6px', fontStyle: 'italic' }}>
                ; {pcComment}
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px' }}>
              {[op, arg].map((byte, bi) => (
                <div key={bi}>
                  <div style={{ fontSize: '9px', color: C.muted, textAlign: 'center', marginBottom: '3px' }}>
                    {h(byte)}  <span style={{ color: '#0a1c0a' }}>({bi === 0 ? 'opcode' : 'arg'})</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5px' }}>
                    {[...Array(8)].map((_, b) => {
                      const bit = (byte >> (7 - b)) & 1;
                      return (
                        <span key={b} style={{
                          display: 'inline-block', width: '11px', height: '11px',
                          background: bit ? C.bright : '#0a1c0a', borderRadius: '1px',
                          boxShadow: bit ? '0 0 4px rgba(0,255,65,0.45)' : 'none',
                          marginRight: b === 3 ? '3px' : '0',
                        }} />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* BASIC constraints (v0.4) */}
          {isBasic && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ ...panelHead, color: C.amber }}>EML-VM-BASIC CONSTRAINTS</div>
              <div style={{ fontSize: '9.5px', lineHeight: '1.5', color: '#7a6a3a' }}>
                <div>bound: <span style={{ color: C.amber }}>[0, {CONSTRAINTS.maxValue.toLocaleString()}]</span> · overflow: <span style={{ color: C.amber }}>{CONSTRAINTS.overflow}</span> (mod N+1)</div>
                <div>allowed ops: {CONSTRAINTS.allowedOps.length} <span style={{ color: '#4a4030' }}>(no mul/div/logic/stack)</span></div>
                <div>static check: <span style={{ color: constraintCheck?.valid ? C.bright : '#ff4444' }}>
                  {constraintCheck?.valid ? '✓ valid' : `✗ ${constraintCheck?.violations.length} violation(s)`}
                </span></div>
              </div>
            </div>
          )}

          {/* Execution log */}
          <div>
            <div style={panelHead}>EXECUTION LOG</div>
            {vm.log.length === 0 ? (
              <div style={{ fontSize: '9px', color: C.dim }}>— awaiting execution —</div>
            ) : vm.log.map((e, i) => {
              const alpha = Math.max(0.15, 1 - i * 0.09);
              const grn   = Math.max(80, 238 - i * 18);
              return (
                <div key={i} style={{
                  fontSize: '9.5px', marginBottom: '2px',
                  color: i === 0 ? C.fg : `rgba(20,${grn},20,${alpha})`,
                  display: 'flex', gap: '5px',
                }}>
                  <span style={{ color: i === 0 ? '#00cc33' : '#142514', flexShrink: 0 }}>{h(e.pc)}:</span>
                  <span>{e.decoded}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: AI STREAM — the V_AI projection of the same state M */}
        <div style={{ flex: '1 1 300px', maxWidth: '380px', minWidth: '260px' }}>
          <div style={{ ...panelHead, color: C.ai, borderColor: C.aiDim, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ textShadow: '0 0 6px rgba(0,210,255,0.5)' }}>▸ AI STREAM</span>
            <span style={{ color: '#1a3a44', fontSize: '8px', letterSpacing: '0.5px' }}>what the agent reads</span>
          </div>
          <div style={{ fontSize: '8px', color: '#1a3a44', marginBottom: '5px', letterSpacing: '0.5px' }}>
            Φ : M × CTS → V_AI  ·  same state M as the grid, AI's projection
          </div>
          <pre style={{
            margin: 0, fontSize: '10px', lineHeight: '1.45', color: C.ai,
            fontFamily: 'inherit', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            background: 'rgba(0,40,60,0.18)', border: `1px solid ${C.aiDim}`,
            borderRadius: '2px', padding: '8px 10px',
            maxHeight: '420px', overflowY: 'auto',
            textShadow: '0 0 3px rgba(0,210,255,0.25)',
          }}>{JSON.stringify(snapshot, null, 2)}</pre>
          <div style={{ fontSize: '8px', color: '#1a3a44', marginTop: '5px' }}>
            this is the per-tick VMSnapshot a headless AI-mode VM streams over WS/SSE
          </div>
        </div>
      </div>

      {/* Constraint-violation banner */}
      {violation && (
        <div style={{
          marginTop: '10px', padding: '6px 10px', borderRadius: '2px',
          border: '1px solid #ff4444', background: 'rgba(255,68,68,0.08)',
          color: '#ff7777', fontSize: '10px', position: 'relative', zIndex: 1,
        }}>
          ⚠ ConstraintViolation — {violation}
        </div>
      )}

      {/* Status bar */}
      <div style={{
        marginTop: '12px', borderTop: `1px solid ${C.border}`, paddingTop: '5px',
        display: 'flex', gap: '14px', fontSize: '9px', color: C.muted, flexWrap: 'wrap',
        position: 'relative', zIndex: 1,
      }}>
        <span>T: {vm.ticks.toLocaleString()}</span>
        <span style={{ color: '#0a1e0a' }}>│</span>
        <span>{prog.description}</span>
        <span style={{ color: '#0a1e0a' }}>│</span>
        <span style={{ color: vm.halted ? '#ff4444' : running ? C.bright : '#1a4a1a' }}>
          {vm.halted ? '■ HALTED' : running ? `● ${speed}` : '○ PAUSED'}
        </span>
        <span style={{ color: '#0a1e0a' }}>│</span>
        <span>ISA: {arch} · 256 cells · {prog.code.length}B PROG · engine: {isBasic ? 'eml-vm-basic' : 'P2 VMCore'}</span>
      </div>
    </div>
  );
}
