// dex-hero-city.jsx — Isometric "code city" hero scene.
// Minimal, animated, beautiful. SVG towers + arcing data flows + HUD overlays.

const { useEffect: _hc_useEffect, useState: _hc_useState, useRef: _hc_useRef, useMemo: _hc_useMemo } = React;

// ─── Iso projection helpers ─────────────────────────────────────
// World axes: X right, Y up, Z toward viewer.
// Camera: 30° iso. screen_x = (X - Z) * cos30, screen_y = (X + Z) * sin30 - Y
const COS30 = 0.866;
const SIN30 = 0.5;
const ORIGIN = { x: 880, y: 540 }; // where world (0,0,0) lands on the viewBox

function iso(X, Y, Z) {
  return {
    x: ORIGIN.x + (X - Z) * COS30,
    y: ORIGIN.y + (X + Z) * SIN30 - Y,
  };
}

// ─── Scene config ───────────────────────────────────────────────
// Five towers. Hues are paired with svg gradient ids.
const TOWERS = [
  { id: 'core',    X:   0,  Z:    0, w: 96, d: 96, h: 230, hue: 'cyan',    label: '/core',
    files: 124, fns: 612, big: true },
  { id: 'api',     X: 200,  Z: -120, w: 70, d: 70, h: 190, hue: 'violet',  label: '/api',
    files: 156, fns: 812 },
  { id: 'auth',    X: -220, Z:  -90, w: 70, d: 70, h: 160, hue: 'magenta', label: '/auth',
    files:  87, fns: 320 },
  { id: 'pay',     X: 230,  Z:  130, w: 70, d: 70, h: 170, hue: 'cyan',    label: '/payments',
    files:  63, fns: 278 },
  { id: 'front',   X: -240, Z:  150, w: 70, d: 70, h: 140, hue: 'violet',  label: '/frontend',
    files: 128, fns: 532 },
];

// Connections (data flows). Each arcs through the air between tower tops.
const FLOWS = [
  { from: 'core', to: 'api',   delay: 0.0 },
  { from: 'core', to: 'auth',  delay: 0.5 },
  { from: 'core', to: 'pay',   delay: 1.0 },
  { from: 'core', to: 'front', delay: 1.5 },
  { from: 'api',  to: 'pay',   delay: 0.8 },
  { from: 'auth', to: 'front', delay: 1.3 },
];

// ─── Animation tick (shared) ────────────────────────────────────
function useFrame() {
  const [t, setT] = _hc_useState(0);
  _hc_useEffect(() => {
    let raf;
    const start = performance.now();
    const loop = (now) => {
      setT((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return t;
}

// ─── Tower component ───────────────────────────────────────────
function Tower({ tower, t }) {
  const { X, Z, w, d, h, hue, big } = tower;

  // 8 corners
  const c = {
    blf: iso(X - w/2, 0, Z + d/2),
    brf: iso(X + w/2, 0, Z + d/2),
    brb: iso(X + w/2, 0, Z - d/2),
    blb: iso(X - w/2, 0, Z - d/2),
    tlf: iso(X - w/2, h, Z + d/2),
    trf: iso(X + w/2, h, Z + d/2),
    trb: iso(X + w/2, h, Z - d/2),
    tlb: iso(X - w/2, h, Z - d/2),
  };

  const pts = (...names) => names.map(n => `${c[n].x},${c[n].y}`).join(' ');

  // gentle breathing pulse on the glow
  const breath = 0.7 + 0.3 * Math.sin(t * 0.8 + (tower.X * 0.01));

  const topCenter = iso(X, h, Z);
  const floorCenter = iso(X, 0, Z);

  // colored window light positions on the front face
  const windowRows = Math.floor(h / 22);
  const windowCols = 3;
  const windows = [];
  for (let row = 0; row < windowRows; row++) {
    for (let col = 0; col < windowCols; col++) {
      // skip some randomly for organic feel
      if (((row * 7 + col * 3 + tower.X) % 5) === 0) continue;
      const wx = X - w/2 + (col + 0.5) * (w / windowCols);
      const wy = (row + 0.5) * 22;
      const wz = Z + d/2;
      const wpos = iso(wx, wy, wz);
      windows.push({ ...wpos, key: `${row}-${col}` });
    }
  }
  // and right face
  const windowsR = [];
  for (let row = 0; row < windowRows; row++) {
    for (let col = 0; col < windowCols; col++) {
      if (((row * 11 + col * 5 + tower.X) % 5) === 0) continue;
      const wx = X + w/2;
      const wy = (row + 0.5) * 22;
      const wz = Z - d/2 + (col + 0.5) * (d / windowCols);
      const wpos = iso(wx, wy, wz);
      windowsR.push({ ...wpos, key: `r${row}-${col}` });
    }
  }

  return (
    <g>
      {/* Floor halo */}
      <ellipse cx={floorCenter.x} cy={floorCenter.y + 6}
               rx={w * 1.4 * COS30} ry={d * 0.55}
               fill={`url(#halo-${hue})`} opacity={0.55 * breath} />

      {/* Right face (slightly darker) */}
      <polygon points={pts('brf', 'brb', 'trb', 'trf')}
               fill={`url(#face-r-${hue})`}
               stroke={`url(#edge-${hue})`} strokeWidth="1" />
      {/* Front face */}
      <polygon points={pts('blf', 'brf', 'trf', 'tlf')}
               fill={`url(#face-f-${hue})`}
               stroke={`url(#edge-${hue})`} strokeWidth="1" />
      {/* Top face (brightest, with slight gradient) */}
      <polygon points={pts('tlf', 'trf', 'trb', 'tlb')}
               fill={`url(#face-t-${hue})`}
               stroke={`url(#edge-${hue})`} strokeWidth="1.2" />

      {/* Windows — front */}
      {windows.map(wp => (
        <rect key={wp.key}
              x={wp.x - 1.5} y={wp.y - 3}
              width="3" height="6"
              fill={`var(--w-${hue})`}
              opacity={0.6 + 0.4 * Math.sin(t * 2 + wp.x * 0.05)} />
      ))}
      {/* Windows — right */}
      {windowsR.map(wp => (
        <rect key={wp.key}
              x={wp.x - 1.2} y={wp.y - 3}
              width="2.5" height="6"
              fill={`var(--w-${hue})`}
              opacity={0.35 + 0.25 * Math.sin(t * 2 + wp.y * 0.05)} />
      ))}

      {/* Top crown light + beam */}
      <ellipse cx={topCenter.x} cy={topCenter.y - 4}
               rx={w * COS30 * 0.95} ry={d * 0.42}
               fill={`var(--crown-${hue})`}
               opacity={0.95} />

      {/* upward beam (subtle) */}
      <rect x={topCenter.x - 1.5} y={topCenter.y - 90}
            width="3" height="90"
            fill={`url(#beam-${hue})`}
            opacity={0.85 * breath} />

      {big && (
        <>
          {/* extra core glow */}
          <circle cx={topCenter.x} cy={topCenter.y - 10}
                  r={26 + breath * 6}
                  fill={`var(--crown-${hue})`}
                  opacity={0.18}
                  filter="url(#blurBig)" />
        </>
      )}
    </g>
  );
}

// ─── Curved data-flow arcs ─────────────────────────────────────
function Flow({ from, to, t, delay = 0, byId, hue = 'cyan' }) {
  const A = byId[from];
  const B = byId[to];
  if (!A || !B) return null;

  // Endpoint = top of tower
  const a = iso(A.X, A.h, A.Z);
  const b = iso(B.X, B.h, B.Z);

  // Control point: midpoint lifted high into the sky
  const mx = (a.x + b.x) / 2;
  const my = Math.min(a.y, b.y) - Math.abs(a.x - b.x) * 0.25 - 80;

  const path = `M ${a.x},${a.y} Q ${mx},${my} ${b.x},${b.y}`;

  // pulse position along the curve (0→1, looping)
  const period = 3.2;
  const p = (((t - delay) % period) / period + 1) % 1;
  // De Casteljau for quadratic Bezier at parameter p
  const omp = 1 - p;
  const px = omp * omp * a.x + 2 * omp * p * mx + p * p * b.x;
  const py = omp * omp * a.y + 2 * omp * p * my + p * p * b.y;
  const pulseAlpha = Math.sin(p * Math.PI);

  return (
    <g>
      <path d={path}
            stroke={`url(#flowStroke-${hue})`}
            strokeWidth="1.2"
            fill="none"
            opacity="0.6" />
      {/* trailing dashed line */}
      <path d={path}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="0.5"
            strokeDasharray="2 4"
            fill="none" />
      {/* moving glow dot */}
      <circle cx={px} cy={py} r="3.5"
              fill="white"
              opacity={pulseAlpha} />
      <circle cx={px} cy={py} r="8"
              fill={`var(--crown-${hue})`}
              opacity={pulseAlpha * 0.4}
              filter="url(#blurSmall)" />
    </g>
  );
}

// ─── Ground grid ───────────────────────────────────────────────
function FloorGrid() {
  // Draw subtle iso grid radiating around origin.
  const lines = [];
  const RANGE = 480;
  const STEP = 60;
  for (let v = -RANGE; v <= RANGE; v += STEP) {
    const aZ = iso(-RANGE, 0, v);
    const bZ = iso( RANGE, 0, v);
    const aX = iso(v, 0, -RANGE);
    const bX = iso(v, 0,  RANGE);
    lines.push(
      <line key={'z'+v} x1={aZ.x} y1={aZ.y} x2={bZ.x} y2={bZ.y}
            stroke="url(#gridFade)" strokeWidth="0.5" />,
      <line key={'x'+v} x1={aX.x} y1={aX.y} x2={bX.x} y2={bX.y}
            stroke="url(#gridFade)" strokeWidth="0.5" />
    );
  }
  return <g opacity="0.5">{lines}</g>;
}

// ─── Ambient particles (slow floating motes) ───────────────────
function Particles({ t }) {
  const seeds = _hc_useMemo(() => {
    const arr = [];
    for (let i = 0; i < 40; i++) {
      arr.push({
        baseX: (i * 173) % 1600,
        baseY: (i * 91) % 700 + 100,
        speed: 0.05 + ((i * 17) % 20) / 200,
        phase: (i * 31) % 100,
        size: 0.8 + ((i * 7) % 12) / 10,
      });
    }
    return arr;
  }, []);

  return (
    <g opacity="0.35">
      {seeds.map((s, i) => {
        const x = s.baseX + Math.sin(t * s.speed + s.phase) * 30;
        const y = s.baseY + Math.cos(t * s.speed * 0.7 + s.phase) * 20;
        return (
          <circle key={i} cx={x} cy={y} r={s.size}
                  fill="white"
                  opacity={0.3 + 0.4 * Math.sin(t * 0.7 + s.phase)} />
        );
      })}
    </g>
  );
}

// ─── Module label (HTML overlay) ───────────────────────────────
function ModuleLabel({ tower, viewW, viewH }) {
  // Label appears slightly above & offset from the tower top.
  const top = iso(tower.X, tower.h, tower.Z);
  // Offset rules — push left labels left, right labels right
  const offX = tower.X < -100 ? -130 : tower.X > 100 ? 24 : 0;
  const offY = tower.X < -100 || tower.X > 100 ? -10 : -76;
  // Convert to percentages so labels track viewBox scaling.
  const xPct = ((top.x + offX) / viewW) * 100;
  const yPct = ((top.y + offY) / viewH) * 100;

  const hueColor = {
    cyan:    '#67e8f9',
    violet:  '#c4b5fd',
    magenta: '#f0abfc',
  }[tower.hue];

  return (
    <div style={{
      position: 'absolute',
      left: `${xPct}%`,
      top: `${yPct}%`,
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
    }}>
      <div style={{
        borderRadius: 8,
        padding: '7px 11px',
        background: 'rgba(8, 8, 14, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 16px rgba(0,0,0,0.4)',
        minWidth: 110,
        whiteSpace: 'nowrap',
      }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 12,
          color: hueColor,
          fontWeight: 500,
          marginBottom: 1,
          letterSpacing: '0.01em',
        }}>{tower.label}</div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10,
          color: 'rgba(255,255,255,0.55)',
          lineHeight: 1.35,
        }}>
          {tower.files} files<br />
          {tower.fns} functions
        </div>
      </div>
    </div>
  );
}

// ─── Main scene ────────────────────────────────────────────────
function HeroCity({ viewW = 1600, viewH = 900 }) {
  const t = useFrame();
  const byId = Object.fromEntries(TOWERS.map(tw => [tw.id, tw]));

  // Towers should render back-to-front for proper occlusion. Sort by world (Z desc → back first, but back is -Z which is smaller, hmm). Actually further from camera = smaller (X+Z), closer = larger. Render smaller (X+Z) first.
  const sorted = [...TOWERS].sort((a, b) => (a.X + a.Z) - (b.X + b.Z));

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <defs>
          {/* Per-hue gradients */}
          {[
            { name: 'cyan',    light: '#67e8f9', mid: '#22d3ee', dark: '#0e7490', shadow: '#0a3b4d' },
            { name: 'violet',  light: '#c4b5fd', mid: '#a78bfa', dark: '#6d28d9', shadow: '#2a1466' },
            { name: 'magenta', light: '#f0abfc', mid: '#e879f9', dark: '#a21caf', shadow: '#4a0a52' },
          ].map(({ name, light, mid, dark, shadow }) => (
            <React.Fragment key={name}>
              <linearGradient id={`face-f-${name}`} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={shadow} />
                <stop offset="30%" stopColor={dark} />
                <stop offset="100%" stopColor={mid} />
              </linearGradient>
              <linearGradient id={`face-r-${name}`} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#04040a" />
                <stop offset="40%" stopColor={shadow} />
                <stop offset="100%" stopColor={dark} />
              </linearGradient>
              <linearGradient id={`face-t-${name}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={light} />
                <stop offset="100%" stopColor={mid} />
              </linearGradient>
              <linearGradient id={`edge-${name}`} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={mid} stopOpacity="0.2" />
                <stop offset="100%" stopColor={light} stopOpacity="0.9" />
              </linearGradient>
              <radialGradient id={`halo-${name}`} cx="0.5" cy="0.5" r="0.5">
                <stop offset="0%" stopColor={mid} stopOpacity="0.55" />
                <stop offset="100%" stopColor={mid} stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`beam-${name}`} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={light} stopOpacity="1" />
                <stop offset="100%" stopColor={light} stopOpacity="0" />
              </linearGradient>
              <linearGradient id={`flowStroke-${name}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={mid} stopOpacity="0.1" />
                <stop offset="50%" stopColor={light} stopOpacity="0.7" />
                <stop offset="100%" stopColor={mid} stopOpacity="0.1" />
              </linearGradient>
            </React.Fragment>
          ))}

          {/* Grid line fade */}
          <linearGradient id="gridFade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(122,182,222,0)" />
            <stop offset="50%" stopColor="rgba(122,182,222,0.4)" />
            <stop offset="100%" stopColor="rgba(122,182,222,0)" />
          </linearGradient>

          {/* Sky gradient backdrop */}
          <radialGradient id="skyGlow" cx="0.55" cy="0.55" r="0.55">
            <stop offset="0%"  stopColor="#1a1438" stopOpacity="0.7" />
            <stop offset="60%" stopColor="#0c0a1e" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#06060b" stopOpacity="0" />
          </radialGradient>

          <filter id="blurBig" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="blurSmall" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {/* Sky / atmospheric backdrop */}
        <rect x="0" y="0" width={viewW} height={viewH} fill="url(#skyGlow)" />

        {/* Floor grid */}
        <FloorGrid />

        {/* Floating particles (behind towers) */}
        <Particles t={t} />

        {/* Towers (sorted back→front) */}
        {sorted.map(tw => <Tower key={tw.id} tower={tw} t={t} />)}

        {/* Data flows (in front of towers) */}
        {FLOWS.map((f, i) => {
          const A = byId[f.from];
          return (
            <Flow key={i}
                  from={f.from} to={f.to}
                  t={t} delay={f.delay}
                  byId={byId}
                  hue={A.hue} />
          );
        })}
      </svg>

      {/* HTML module labels (above SVG for backdrop-filter to work) */}
      {TOWERS.map(tw => (
        <ModuleLabel key={tw.id} tower={tw} viewW={viewW} viewH={viewH} />
      ))}
    </div>
  );
}

window.HeroCity = HeroCity;
