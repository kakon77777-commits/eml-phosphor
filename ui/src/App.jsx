import { useState } from 'react';
import PhosphorVM from './PhosphorVM.jsx';
// binary-matrix lives in the parent folder; imported directly (no copy).
import BinaryMatrix from '../../binary-matrix.jsx';

const TABS = [
  { id: 'vm',     label: '▸ EML-VM-16' },
  { id: 'matrix', label: '▸ BINARY MATRIX' },
];

export default function App() {
  const [view, setView] = useState('vm');
  return (
    <div style={{ minHeight: '100vh', background: '#040c04', fontFamily: '"Courier New",Courier,monospace' }}>
      <div style={{
        display: 'flex', gap: '4px', alignItems: 'center',
        padding: '6px 14px', borderBottom: '1px solid #0a1c0a',
        position: 'sticky', top: 0, zIndex: 30, background: '#040c04',
      }}>
        <span style={{ color: '#00ff41', fontSize: '11px', letterSpacing: '2px', marginRight: '10px', textShadow: '0 0 8px rgba(0,255,65,0.5)' }}>
          PHOSPHOR
        </span>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            background: 'none', cursor: 'pointer',
            border: `1px solid ${view === t.id ? '#00ff41' : '#1a4a1a'}`,
            color: view === t.id ? '#00ff41' : '#1a4a1a',
            fontSize: '10px', fontFamily: 'inherit', padding: '3px 10px', letterSpacing: '1px',
            textShadow: view === t.id ? '0 0 5px rgba(0,255,65,0.4)' : 'none',
          }}>{t.label}</button>
        ))}
        <span style={{ marginLeft: 'auto', color: '#0a2a0a', fontSize: '8px', letterSpacing: '1px' }}>
          engine: P2 VMCore (verified) · single source of truth
        </span>
      </div>
      {view === 'vm' ? <PhosphorVM /> : <BinaryMatrix />}
    </div>
  );
}
