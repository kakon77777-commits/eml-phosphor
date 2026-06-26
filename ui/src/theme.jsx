// Shared CRT theme + brand — the phosphor-green identity, one source of truth.
export const VERSION = '0.5.0-beta.0';

export const C = {
  bg: '#040c04', fg: '#1aee44', bright: '#00ff41', dim: '#0a1c0a', muted: '#0a2a0a',
  amber: '#ffaa00', sp: '#ff6600', border: '#0a1c0a',
  ai: '#00d2ff', aiDim: '#0a2230',          // AI-mode / stream accent (cyan)
  sem: '#5af0c8', semDim: '#13312a',         // v0.5 semantic-layer accent (mint)
  ok: '#00ff41', okBg: 'rgba(0,255,65,0.10)',
  no: '#ff5a5a', noBg: 'rgba(255,90,90,0.09)',
  inx: '#ffaa00', inxBg: 'rgba(255,170,0,0.09)',
};

export const mono = '"Courier New",Courier,monospace';

export const panelHead = {
  color: C.muted, fontSize: '8.5px', letterSpacing: '1px',
  borderBottom: `1px solid ${C.border}`, paddingBottom: '2px', marginBottom: '6px',
};

// The two fixed full-viewport CRT overlays (scanline + vignette).
export function CrtOverlays() {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 20,
        background: 'repeating-linear-gradient(to bottom,transparent 0,transparent 1px,rgba(0,0,0,0.1) 1px,rgba(0,0,0,0.1) 2px)' }} />
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 19,
        background: 'radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(0,0,0,0.45) 100%)' }} />
    </>
  );
}

// Page wrapper used by the v2 tabs — CRT background + overlays + content layer.
export function Screen({ children }) {
  return (
    <div style={{
      background: C.bg, minHeight: 'calc(100vh - 34px)', color: C.fg,
      fontFamily: mono, padding: '12px 14px', position: 'relative', overflowX: 'auto',
    }}>
      <CrtOverlays />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}

export function TabTitle({ accent, title, sub }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <span style={{ color: accent, fontSize: '13px', letterSpacing: '2px', textShadow: `0 0 10px ${accent}80` }}>
        ▸ {title}
      </span>
      {sub && <span style={{ color: '#163a30', fontSize: '9px', marginLeft: '10px', letterSpacing: '0.5px' }}>{sub}</span>}
    </div>
  );
}

// Brand + version + formal attribution — shown under every tab.
export function BrandFooter() {
  return (
    <div style={{
      borderTop: `1px solid ${C.border}`, marginTop: '4px', padding: '7px 16px',
      display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center',
      fontSize: '8.5px', color: C.muted, fontFamily: mono, position: 'relative', zIndex: 1, background: C.bg,
    }}>
      <span style={{ color: '#1a4a1a', letterSpacing: '1px' }}>
        PHOSPHOR <span style={{ color: C.fg }}>v{VERSION}</span> · <span style={{ color: C.amber }}>EXPERIMENTAL</span>
      </span>
      <span style={{ color: '#0a2a0a' }}>│</span>
      <span>© 2026 <span style={{ color: '#1a4a1a' }}>EVEMISS TECHNOLOGY CO., LTD.</span>（一言諾科技有限公司）</span>
      <span style={{ color: '#0a2a0a' }}>│</span>
      <span>Author <span style={{ color: '#1a4a1a' }}>許筌崴 Neo.K</span></span>
      <span style={{ color: '#0a2a0a' }}>│</span>
      <span>Apache-2.0</span>
    </div>
  );
}

// A bordered hex byte field with optional accent — reused across tabs.
export function parseBytes(text) {
  return text
    .split(/[\s,]+/).map(t => t.trim()).filter(Boolean)
    .map(t => parseInt(t.replace(/^0x/i, ''), 16))
    .filter(n => Number.isFinite(n))
    .map(n => n & 0xFF);
}
