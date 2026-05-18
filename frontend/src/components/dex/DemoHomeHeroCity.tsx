"use client";

import React, { useEffect, useMemo, useState } from "react";

/**
 * DemoHomeHeroCity
 *
 * Animated isometric "code city" — five towers + arcing data flows
 * + HUD module labels. Ported from `frontend/src/dex-hero-city.jsx`
 * into a Next.js / TypeScript React component.
 *
 * The scene assumes a dark backdrop is rendered by the parent.
 * Pass `viewW`/`viewH` to control the SVG viewBox aspect.
 */

// Iso projection helpers (30° camera).
const COS30 = 0.866;
const SIN30 = 0.5;
const ORIGIN = { x: 880, y: 540 };

const iso = (X: number, Y: number, Z: number) => ({
  x: ORIGIN.x + (X - Z) * COS30,
  y: ORIGIN.y + (X + Z) * SIN30 - Y,
});

type Hue = "cyan" | "violet" | "magenta";

interface TowerDef {
  id: string;
  X: number;
  Z: number;
  w: number;
  d: number;
  h: number;
  hue: Hue;
  label: string;
  files: number;
  fns: number;
  big?: boolean;
}

const TOWERS: TowerDef[] = [
  { id: "core",  X: 0,    Z: 0,    w: 96, d: 96, h: 230, hue: "cyan",    label: "/core",      files: 124, fns: 612, big: true },
  { id: "api",   X: 200,  Z: -120, w: 70, d: 70, h: 190, hue: "violet",  label: "/api",       files: 156, fns: 812 },
  { id: "auth",  X: -220, Z: -90,  w: 70, d: 70, h: 160, hue: "magenta", label: "/auth",      files: 87,  fns: 320 },
  { id: "pay",   X: 230,  Z: 130,  w: 70, d: 70, h: 170, hue: "cyan",    label: "/payments",  files: 63,  fns: 278 },
  { id: "front", X: -240, Z: 150,  w: 70, d: 70, h: 140, hue: "violet",  label: "/frontend",  files: 128, fns: 532 },
];

interface FlowDef {
  from: string;
  to: string;
  delay: number;
}

const FLOWS: FlowDef[] = [
  { from: "core", to: "api",   delay: 0.0 },
  { from: "core", to: "auth",  delay: 0.5 },
  { from: "core", to: "pay",   delay: 1.0 },
  { from: "core", to: "front", delay: 1.5 },
  { from: "api",  to: "pay",   delay: 0.8 },
  { from: "auth", to: "front", delay: 1.3 },
];

const HUE_VALUES: Record<Hue, { light: string; mid: string; dark: string; shadow: string; window: string; crown: string }> = {
  cyan:    { light: "#67e8f9", mid: "#22d3ee", dark: "#0e7490", shadow: "#0a3b4d", window: "#a5f3fc", crown: "#22d3ee" },
  violet:  { light: "#c4b5fd", mid: "#a78bfa", dark: "#6d28d9", shadow: "#2a1466", window: "#ddd6fe", crown: "#a78bfa" },
  magenta: { light: "#f0abfc", mid: "#e879f9", dark: "#a21caf", shadow: "#4a0a52", window: "#f5d0fe", crown: "#e879f9" },
};

function useFrame(enabled: boolean = true): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      setT((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);
  return t;
}

// Round a float to a fixed precision so SSR/CSR Math.sin/cos drift at the
// 15th/16th decimal place doesn't trigger React hydration mismatches.
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

interface TowerProps {
  tower: TowerDef;
  t: number;
}

const Tower: React.FC<TowerProps> = ({ tower, t }) => {
  const { X, Z, w, d, h, hue, big } = tower;
  const palette = HUE_VALUES[hue];

  const c = {
    blf: iso(X - w / 2, 0, Z + d / 2),
    brf: iso(X + w / 2, 0, Z + d / 2),
    brb: iso(X + w / 2, 0, Z - d / 2),
    blb: iso(X - w / 2, 0, Z - d / 2),
    tlf: iso(X - w / 2, h, Z + d / 2),
    trf: iso(X + w / 2, h, Z + d / 2),
    trb: iso(X + w / 2, h, Z - d / 2),
    tlb: iso(X - w / 2, h, Z - d / 2),
  };

  const pts = (...names: (keyof typeof c)[]) =>
    names.map((n) => `${c[n].x},${c[n].y}`).join(" ");

  const breath = 0.7 + 0.3 * Math.sin(t * 0.8 + X * 0.01);
  const topCenter = iso(X, h, Z);
  const floorCenter = iso(X, 0, Z);

  const windowRows = Math.floor(h / 22);
  const windowCols = 3;

  const windows: { x: number; y: number; key: string }[] = [];
  for (let row = 0; row < windowRows; row++) {
    for (let col = 0; col < windowCols; col++) {
      if ((row * 7 + col * 3 + X) % 5 === 0) continue;
      const wx = X - w / 2 + (col + 0.5) * (w / windowCols);
      const wy = (row + 0.5) * 22;
      const wz = Z + d / 2;
      const wpos = iso(wx, wy, wz);
      windows.push({ ...wpos, key: `f-${row}-${col}` });
    }
  }

  const windowsR: { x: number; y: number; key: string }[] = [];
  for (let row = 0; row < windowRows; row++) {
    for (let col = 0; col < windowCols; col++) {
      if ((row * 11 + col * 5 + X) % 5 === 0) continue;
      const wx = X + w / 2;
      const wy = (row + 0.5) * 22;
      const wz = Z - d / 2 + (col + 0.5) * (d / windowCols);
      const wpos = iso(wx, wy, wz);
      windowsR.push({ ...wpos, key: `r-${row}-${col}` });
    }
  }

  return (
    <g>
      <ellipse
        cx={floorCenter.x}
        cy={floorCenter.y + 6}
        rx={w * 1.4 * COS30}
        ry={d * 0.55}
        fill={`url(#halo-${hue})`}
        opacity={r4(0.55 * breath)}
      />

      <polygon
        points={pts("brf", "brb", "trb", "trf")}
        fill={`url(#face-r-${hue})`}
        stroke={`url(#edge-${hue})`}
        strokeWidth="1"
      />
      <polygon
        points={pts("blf", "brf", "trf", "tlf")}
        fill={`url(#face-f-${hue})`}
        stroke={`url(#edge-${hue})`}
        strokeWidth="1"
      />
      <polygon
        points={pts("tlf", "trf", "trb", "tlb")}
        fill={`url(#face-t-${hue})`}
        stroke={`url(#edge-${hue})`}
        strokeWidth="1.2"
      />

      {windows.map((wp) => (
        <rect
          key={wp.key}
          x={wp.x - 1.5}
          y={wp.y - 3}
          width={3}
          height={6}
          fill={palette.window}
          opacity={r4(0.6 + 0.4 * Math.sin(t * 2 + wp.x * 0.05))}
        />
      ))}
      {windowsR.map((wp) => (
        <rect
          key={wp.key}
          x={wp.x - 1.2}
          y={wp.y - 3}
          width={2.5}
          height={6}
          fill={palette.window}
          opacity={r4(0.35 + 0.25 * Math.sin(t * 2 + wp.y * 0.05))}
        />
      ))}

      <ellipse
        cx={topCenter.x}
        cy={topCenter.y - 4}
        rx={w * COS30 * 0.95}
        ry={d * 0.42}
        fill={palette.crown}
        opacity={0.95}
      />

      <rect
        x={topCenter.x - 1.5}
        y={topCenter.y - 90}
        width={3}
        height={90}
        fill={`url(#beam-${hue})`}
        opacity={r4(0.85 * breath)}
      />

      {big && (
        <circle
          cx={topCenter.x}
          cy={topCenter.y - 10}
          r={r4(26 + breath * 6)}
          fill={palette.crown}
          opacity={0.18}
          filter="url(#dhc-blurBig)"
        />
      )}
    </g>
  );
};

interface FlowProps {
  from: string;
  to: string;
  t: number;
  delay: number;
  byId: Record<string, TowerDef>;
  hue: Hue;
}

const Flow: React.FC<FlowProps> = ({ from, to, t, delay, byId, hue }) => {
  const A = byId[from];
  const B = byId[to];
  if (!A || !B) return null;

  const a = iso(A.X, A.h, A.Z);
  const b = iso(B.X, B.h, B.Z);

  const mx = (a.x + b.x) / 2;
  const my = Math.min(a.y, b.y) - Math.abs(a.x - b.x) * 0.25 - 80;

  const path = `M ${a.x},${a.y} Q ${mx},${my} ${b.x},${b.y}`;

  const period = 3.2;
  const p = ((((t - delay) % period) / period) + 1) % 1;
  const omp = 1 - p;
  const px = omp * omp * a.x + 2 * omp * p * mx + p * p * b.x;
  const py = omp * omp * a.y + 2 * omp * p * my + p * p * b.y;
  const pulseAlpha = Math.sin(p * Math.PI);

  const palette = HUE_VALUES[hue];

  return (
    <g>
      <path d={path} stroke={`url(#flowStroke-${hue})`} strokeWidth="1.2" fill="none" opacity={0.6} />
      <path d={path} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" strokeDasharray="2 4" fill="none" />
      <circle cx={r4(px)} cy={r4(py)} r={3.5} fill="white" opacity={r4(pulseAlpha)} />
      <circle
        cx={r4(px)}
        cy={r4(py)}
        r={8}
        fill={palette.crown}
        opacity={r4(pulseAlpha * 0.4)}
        filter="url(#dhc-blurSmall)"
      />
    </g>
  );
};

const FloorGrid: React.FC = () => {
  const lines: React.ReactNode[] = [];
  const RANGE = 480;
  const STEP = 60;
  for (let v = -RANGE; v <= RANGE; v += STEP) {
    const aZ = iso(-RANGE, 0, v);
    const bZ = iso(RANGE, 0, v);
    const aX = iso(v, 0, -RANGE);
    const bX = iso(v, 0, RANGE);
    lines.push(
      <line key={"z" + v} x1={aZ.x} y1={aZ.y} x2={bZ.x} y2={bZ.y} stroke="url(#dhc-gridFade)" strokeWidth={0.5} />,
      <line key={"x" + v} x1={aX.x} y1={aX.y} x2={bX.x} y2={bX.y} stroke="url(#dhc-gridFade)" strokeWidth={0.5} />,
    );
  }
  return <g opacity={0.5}>{lines}</g>;
};

const Particles: React.FC<{ t: number }> = ({ t }) => {
  const seeds = useMemo(() => {
    const arr: { baseX: number; baseY: number; speed: number; phase: number; size: number }[] = [];
    for (let i = 0; i < 40; i++) {
      arr.push({
        baseX: (i * 173) % 1600,
        baseY: ((i * 91) % 700) + 100,
        speed: 0.05 + ((i * 17) % 20) / 200,
        phase: (i * 31) % 100,
        size: 0.8 + ((i * 7) % 12) / 10,
      });
    }
    return arr;
  }, []);

  return (
    <g opacity={0.35}>
      {seeds.map((s, i) => {
        const x = s.baseX + Math.sin(t * s.speed + s.phase) * 30;
        const y = s.baseY + Math.cos(t * s.speed * 0.7 + s.phase) * 20;
        return (
          <circle
            key={i}
            cx={r4(x)}
            cy={r4(y)}
            r={s.size}
            fill="white"
            opacity={r4(0.3 + 0.4 * Math.sin(t * 0.7 + s.phase))}
          />
        );
      })}
    </g>
  );
};

const ModuleLabel: React.FC<{ tower: TowerDef; viewW: number; viewH: number }> = ({ tower, viewW, viewH }) => {
  const top = iso(tower.X, tower.h, tower.Z);
  const offX = tower.X < -100 ? -130 : tower.X > 100 ? 24 : 0;
  const offY = tower.X < -100 || tower.X > 100 ? -10 : -76;
  const xPct = ((top.x + offX) / viewW) * 100;
  const yPct = ((top.y + offY) / viewH) * 100;

  const hueColor =
    tower.hue === "cyan" ? "#67e8f9" : tower.hue === "violet" ? "#c4b5fd" : "#f0abfc";

  return (
    <div
      style={{
        position: "absolute",
        left: `${xPct}%`,
        top: `${yPct}%`,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
      }}
    >
      <div
        className="rounded-lg backdrop-blur-md"
        style={{
          padding: "7px 11px",
          background: "rgba(8, 8, 14, 0.78)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 16px rgba(0,0,0,0.4)",
          minWidth: 110,
          whiteSpace: "nowrap",
        }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: 12,
            color: hueColor,
            fontWeight: 500,
            marginBottom: 1,
            letterSpacing: "0.01em",
          }}
        >
          {tower.label}
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.55)",
            lineHeight: 1.35,
          }}
        >
          {tower.files} files
          <br />
          {tower.fns} functions
        </div>
      </div>
    </div>
  );
};

export interface DemoHomeHeroCityProps {
  viewW?: number;
  viewH?: number;
  className?: string;
  /** When false, the floating "/core", "/api" … HUD chips are hidden. */
  showLabels?: boolean;
}

const DemoHomeHeroCity: React.FC<DemoHomeHeroCityProps> = ({
  viewW = 1600,
  viewH = 900,
  className,
  showLabels = true,
}) => {
  // `mounted` defers the animated SVG body until after hydration. The reason:
  // Math.sin/Math.cos in V8 can differ at the 15th/16th decimal between the
  // Node SSR runtime and the browser, which surfaces as a React hydration
  // mismatch on opacity/cx/cy props. Rendering the dynamic content only on
  // the client sidesteps the issue entirely without any visual flash because
  // the parent hero already paints a gradient backdrop.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const t = useFrame(mounted);
  const byId = useMemo(() => Object.fromEntries(TOWERS.map((tw) => [tw.id, tw])), []);

  const sorted = useMemo(
    () => [...TOWERS].sort((a, b) => a.X + a.Z - (b.X + b.Z)),
    [],
  );

  if (!mounted) {
    return <div className={`relative w-full h-full ${className ?? ""}`} aria-hidden />;
  }

  return (
    <div className={`relative w-full h-full ${className ?? ""}`}>
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <defs>
          {(["cyan", "violet", "magenta"] as Hue[]).map((name) => {
            const { light, mid, dark, shadow } = HUE_VALUES[name];
            return (
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
            );
          })}

          <linearGradient id="dhc-gridFade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(122,182,222,0)" />
            <stop offset="50%" stopColor="rgba(122,182,222,0.4)" />
            <stop offset="100%" stopColor="rgba(122,182,222,0)" />
          </linearGradient>

          <radialGradient id="dhc-skyGlow" cx="0.55" cy="0.55" r="0.55">
            <stop offset="0%" stopColor="#1a1438" stopOpacity="0.7" />
            <stop offset="60%" stopColor="#0c0a1e" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#06060b" stopOpacity="0" />
          </radialGradient>

          <filter id="dhc-blurBig" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="dhc-blurSmall" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        <rect x={0} y={0} width={viewW} height={viewH} fill="url(#dhc-skyGlow)" />
        <FloorGrid />
        <Particles t={t} />

        {sorted.map((tw) => (
          <Tower key={tw.id} tower={tw} t={t} />
        ))}

        {FLOWS.map((f, i) => {
          const A = byId[f.from];
          return (
            <Flow key={i} from={f.from} to={f.to} t={t} delay={f.delay} byId={byId} hue={A.hue} />
          );
        })}
      </svg>

      {showLabels &&
        TOWERS.map((tw) => (
          <ModuleLabel key={tw.id} tower={tw} viewW={viewW} viewH={viewH} />
        ))}
    </div>
  );
};

export default DemoHomeHeroCity;
