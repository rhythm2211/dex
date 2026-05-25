// dex-landing.jsx — main composition

const { useEffect: _l_useEffect, useRef: _l_useRef, useState: _l_useState } = React;

// ─────────────────────────────────────────────────────────────────
// scroll reveal
function useReveal() {
  _l_useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
}

// ─────────────────────────────────────────────────────────────────
// NAV
function Nav() {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      zIndex: 50, padding: '22px 32px',
      pointerEvents: 'none',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <a href="#" style={{
        display: 'flex', alignItems: 'center', gap: 14,
        textDecoration: 'none', color: '#fff',
        pointerEvents: 'auto',
      }}>
        <span style={{
          width: 28, height: 28, borderRadius: 7,
          background: 'linear-gradient(135deg, #22d3ee 0%, #a78bfa 100%)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700,
          color: '#06060b',
          boxShadow: '0 0 20px rgba(167,139,250,0.4)',
        }}>D</span>
        <span style={{
          fontFamily: 'var(--sans)', fontSize: 19, fontWeight: 600,
          letterSpacing: '0.02em', textTransform: 'uppercase',
        }}>dex</span>
        <span style={{
          paddingLeft: 14,
          borderLeft: '1px solid rgba(255,255,255,0.12)',
          fontSize: 11.5, color: 'rgba(255,255,255,0.5)',
          lineHeight: 1.35, maxWidth: 180,
        }}>
          AI that understands<br />your entire codebase
        </span>
      </a>

      <div style={{ flex: 1 }} />

      <div className="glass" style={{
        borderRadius: 999,
        padding: '8px 8px 8px 22px',
        display: 'flex', alignItems: 'center', gap: 22,
        pointerEvents: 'auto',
      }}>
        <div style={{ display: 'flex', gap: 22 }}>
          {['Product', 'Pricing', 'Docs'].map(l => (
            <a key={l} href="#" style={{
              fontSize: 13, color: 'rgba(255,255,255,0.65)',
              textDecoration: 'none', transition: 'color .15s',
            }}
            onMouseEnter={e => e.target.style.color = '#fff'}
            onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.65)'}>
              {l}
            </a>
          ))}
        </div>
        <a href="#" style={{
          fontSize: 13, color: 'rgba(255,255,255,0.7)', textDecoration: 'none',
        }}>Sign in</a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// HERO — animated isometric "code city"
function GhIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
    </svg>
  );
}

function HudPanel({ title, children, style = {}, w = 240 }) {
  return (
    <div className="glass" style={{
      borderRadius: 12,
      padding: '14px 16px',
      width: w,
      background: 'rgba(8, 8, 14, 0.55)',
      ...style,
    }}>
      {title && (
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10,
          letterSpacing: '0.22em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.45)',
          marginBottom: 12,
        }}>{title}</div>
      )}
      {children}
    </div>
  );
}

function HudAIAnalyzing() {
  const [pct, setPct] = _l_useState(12);
  const [stage, setStage] = _l_useState(0);
  const stages = [
    'Building dependency graph',
    'Detecting relationships',
    'Finding hidden coupling',
    'Calculating impact',
  ];
  _l_useEffect(() => {
    let raf, base = performance.now();
    const tick = (now) => {
      const elapsed = (now - base) / 1000;
      // 0→92 over ~12s, then loop
      const p = (elapsed * 8) % 100;
      setPct(Math.round(Math.max(8, p)));
      setStage(Math.min(3, Math.floor(p / 25)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <HudPanel title="AI Analyzing…" w={250}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
        {stages.map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 9,
            fontFamily: 'var(--sans)', fontSize: 12.5,
            color: i <= stage ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.35)',
            transition: 'color 0.4s',
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: 99,
              background: i < stage ? '#67e8f9' :
                          i === stage ? '#c4b5fd' :
                          'rgba(255,255,255,0.2)',
              boxShadow: i === stage ? '0 0 8px #c4b5fd' : 'none',
              transition: 'all 0.4s',
            }} />
            <span>{s}</span>
          </div>
        ))}
      </div>
      <div style={{
        height: 4, background: 'rgba(255,255,255,0.06)',
        borderRadius: 99, overflow: 'hidden', position: 'relative',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #22d3ee, #a78bfa)',
          borderRadius: 99,
          boxShadow: '0 0 14px rgba(167,139,250,0.6)',
          transition: 'width 0.4s linear',
        }} />
      </div>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 8, textAlign: 'right',
      }}>{pct}%</div>
    </HudPanel>
  );
}

function HudImpact() {
  const rows = [
    { label: 'High Risk',   n: 4,  color: '#f87171' },
    { label: 'Medium Risk', n: 12, color: '#fbbf24' },
    { label: 'Low Risk',    n: 28, color: '#86efac' },
  ];
  return (
    <HudPanel title="Impact Analysis" w={232}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {rows.map(r => (
          <div key={r.label} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 12.5, color: 'rgba(255,255,255,0.85)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: 99,
              background: r.color,
              boxShadow: `0 0 6px ${r.color}`,
            }} />
            <span style={{ flex: 1 }}>{r.label}</span>
            <span style={{ fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.95)' }}>{r.n}</span>
          </div>
        ))}
      </div>
      <div style={{
        height: 1, background: 'rgba(255,255,255,0.08)',
        margin: '12px -4px 10px',
      }} />
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 12, color: 'rgba(255,255,255,0.55)',
      }}>
        <span>Total Modules</span>
        <span style={{ fontFamily: 'var(--mono)', color: '#fff' }}>182</span>
      </div>
    </HudPanel>
  );
}

function HudHealth() {
  const t = _l_useState(0);
  // animate the sparkline via a simple state tick
  const [tick, setTick] = _l_useState(0);
  _l_useEffect(() => {
    const id = setInterval(() => setTick(x => x + 1), 80);
    return () => clearInterval(id);
  }, []);
  const W = 130, H = 32;
  const points = [];
  for (let i = 0; i < 28; i++) {
    const x = (i / 27) * W;
    const y = H / 2 + Math.sin((i + tick * 0.4) * 0.5) * 7 + Math.sin((i + tick * 0.4) * 0.13) * 4;
    points.push(`${x},${y}`);
  }
  return (
    <HudPanel title="System Health" w={236}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <svg width={W} height={H} style={{ flex: '0 0 auto' }}>
          <polyline
            points={points.join(' ')}
            fill="none"
            stroke="#86efac"
            strokeWidth="1.4"
            strokeLinecap="round" />
        </svg>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--serif)', fontSize: 28,
            color: '#fff', lineHeight: 1,
          }}>92%</div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10,
            color: '#86efac', marginTop: 4,
          }}>● healthy</div>
        </div>
      </div>
    </HudPanel>
  );
}

function Hero() {
  return (
    <section style={{
      position: 'relative',
      minHeight: '100vh',
      overflow: 'hidden',
      paddingTop: 90,
    }}>
      {/* deep atmospheric backdrop */}
      <div style={{
        position: 'absolute', inset: 0,
        background:
          'radial-gradient(ellipse 70% 60% at 60% 55%, rgba(60,30,120,0.35), transparent 60%),' +
          'radial-gradient(ellipse 50% 40% at 40% 40%, rgba(8,40,80,0.3), transparent 70%),' +
          'linear-gradient(180deg, #06060b 0%, #08070f 100%)',
        pointerEvents: 'none',
      }} />

      {/* The city scene */}
      <div style={{
        position: 'absolute',
        inset: 0,
      }}>
        <HeroCity viewW={1600} viewH={900} />
      </div>

      {/* Floor fade (mask the bottom edge into the page) */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: 140,
        background: 'linear-gradient(180deg, transparent, #06060b 80%)',
        pointerEvents: 'none',
      }} />

      {/* Top vignette */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0,
        height: 140,
        background: 'linear-gradient(180deg, rgba(6,6,11,0.6), transparent)',
        pointerEvents: 'none',
      }} />

      {/* AI Analyzing — top-right (offset below nav) */}
      <div style={{
        position: 'absolute', top: 92, right: 32, zIndex: 30,
      }}>
        <HudAIAnalyzing />
      </div>

      {/* Headline + CTA — left center */}
      <div style={{
        position: 'absolute',
        left: '5%', top: '38%',
        transform: 'translateY(-50%)',
        zIndex: 20,
        maxWidth: 520,
      }}>
        <h1 style={{
          fontFamily: 'var(--serif)',
          fontSize: 'clamp(56px, 7vw, 104px)',
          lineHeight: 1.0,
          margin: 0, fontWeight: 400,
          letterSpacing: '-0.02em',
          paddingBottom: '0.08em',
        }}>
          <span style={{ display: 'block', color: '#fff' }}>Your codebase.</span>
          <span style={{
            display: 'block',
            background: 'linear-gradient(95deg, #c4b5fd 0%, #a78bfa 40%, #818cf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>Understood.</span>
        </h1>
        <p style={{
          marginTop: 22, marginBottom: 30,
          fontSize: 17, lineHeight: 1.5,
          color: 'rgba(255,255,255,0.62)',
          maxWidth: 440,
        }}>
          dex maps every module, surfaces every relationship,
          and answers anything about your repo —
          <em style={{ fontFamily: 'var(--serif)', color: 'rgba(255,255,255,0.9)' }}> in plain English.</em>
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '12px 22px',
            background: '#fff',
          }}>
            <GhIcon size={16} />
            Connect GitHub
          </button>
          <button className="btn btn-ghost glass" style={{ padding: '12px 22px' }}>
            Live demo →
          </button>
        </div>
        <div style={{
          marginTop: 18,
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--mono)', fontSize: 11,
          color: 'rgba(255,255,255,0.45)',
        }}>
          <span className="dot-pulse" />
          <span>private repo ready · self-host on docker</span>
        </div>
      </div>

      {/* Impact — bottom-left */}
      <div style={{
        position: 'absolute', bottom: 56, left: 32, zIndex: 30,
      }}>
        <HudImpact />
      </div>

      {/* Health — bottom-right */}
      <div style={{
        position: 'absolute', bottom: 56, right: 32, zIndex: 30,
      }}>
        <HudHealth />
      </div>

      {/* scroll marker */}
      <div style={{
        position: 'absolute', bottom: 18, left: '50%',
        transform: 'translateX(-50%)',
        fontFamily: 'var(--mono)', fontSize: 10,
        letterSpacing: '0.3em', color: 'rgba(255,255,255,0.3)',
        zIndex: 20,
      }}>
        SCROLL ↓
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// CLAIMS — three stat blocks, subtle counter on reveal
function CountUp({ to, suffix = '', duration = 1400 }) {
  const [n, setN] = _l_useState(0);
  const ref = _l_useRef(null);
  _l_useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        const start = performance.now();
        const tick = (now) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setN(Math.round(to * eased));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        io.disconnect();
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);
  return <span ref={ref}>{n}{suffix}</span>;
}

function Claims() {
  return (
    <section style={{ padding: '120px 0 80px' }}>
      <div className="wrap">
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1, background: 'rgba(255,255,255,0.06)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {[
            { num: <><CountUp to={80} suffix="+" /></>, label: 'languages parsed', sub: 'python AST · tree-sitter · regex fallback' },
            { num: <><CountUp to={3} duration={1000} /><span style={{ opacity: 0.4 }}>s</span></>, label: 'p95 hybrid query', sub: 'pgvector HNSW + 2-hop Neo4j' },
            { num: <><CountUp to={100} suffix="%" /></>, label: 'self-hostable', sub: 'docker compose · your VPC · your keys' },
          ].map((s, i) => (
            <div key={i} className="reveal" style={{
              padding: '36px 32px',
              background: '#0a0a0b',
            }}>
              <div style={{
                fontFamily: 'var(--serif)',
                fontSize: 72, lineHeight: 1, letterSpacing: '-0.02em',
                color: '#fff',
              }}>{s.num}</div>
              <div style={{
                marginTop: 14,
                fontSize: 14, color: 'rgba(255,255,255,0.85)',
              }}>{s.label}</div>
              <div style={{
                marginTop: 4,
                fontFamily: 'var(--mono)', fontSize: 11,
                color: 'rgba(255,255,255,0.4)',
              }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// SECTION HEADER — reusable
function SectionHead({ eyebrow, children, sub, align = 'left' }) {
  return (
    <div className="reveal" style={{ textAlign: align, marginBottom: 56 }}>
      <div className="eyebrow" style={{ marginBottom: 16 }}>{eyebrow}</div>
      <h2 style={{
        fontFamily: 'var(--serif)',
        fontSize: 'clamp(40px, 5.4vw, 76px)',
        lineHeight: 1.05,
        margin: 0,
        letterSpacing: '-0.02em',
        fontWeight: 400,
        maxWidth: 900,
        ...(align === 'center' ? { marginLeft: 'auto', marginRight: 'auto' } : {}),
      }}>{children}</h2>
      {sub && (
        <p style={{
          marginTop: 22,
          fontSize: 17, lineHeight: 1.55,
          color: 'rgba(255,255,255,0.55)',
          maxWidth: 560,
          ...(align === 'center' ? { marginLeft: 'auto', marginRight: 'auto' } : {}),
        }}>{sub}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SEE THE SHAPE — graph dashboard preview
function SeeShape() {
  return (
    <section style={{ padding: '100px 0' }}>
      <div className="wrap">
        <SectionHead
          eyebrow="See the shape"
          sub="Every file, every class, every function — and every edge between them. Imports. Inheritance. Git blame. Architecture layers. One graph you can click."
        >
          Not just text.<br /><em style={{ fontStyle: 'italic' }}>Structure.</em>
        </SectionHead>

        <div className="reveal reveal-d1">
          <GraphPreview />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// ASK ANYTHING — chat preview
function AskAnything() {
  return (
    <section style={{ padding: '100px 0', position: 'relative' }}>
      <div className="wrap-narrow">
        <SectionHead
          eyebrow="Ask anything"
          align="center"
          sub="Hybrid retrieval feeds Llama 3.3 70B. Every answer cites a file path and a line range — backed by the retrieval trace you can inspect."
        >
          Cites the file.<br />
          <em style={{ fontStyle: 'italic' }}>Cites the line.</em>
        </SectionHead>

        <div className="reveal reveal-d1">
          <ChatPreview />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// CAPABILITIES — 4 cards in a 2x2 grid
const CAPS = [
  {
    n: '01',
    title: 'Knowledge graph',
    body: 'CONTAINS, DEPENDS_ON, DEFINES, IMPORTS, OWNS — every relationship is a first-class edge in Neo4j. Click any node, see its world.',
    glyph: 'graph',
  },
  {
    n: '02',
    title: 'Hybrid RAG',
    body: 'pgvector finds semantically similar code. Neo4j adds 2-hop structural context. Both go in the prompt. Cohere reranks. Llama 3.3 answers.',
    glyph: 'rag',
  },
  {
    n: '03',
    title: 'Blast radius',
    body: 'Pick a file. Get every downstream caller, a 0-100 risk score, a CI test checklist, and a reviewer suggestion. Wired into your PR bot.',
    glyph: 'blast',
  },
  {
    n: '04',
    title: 'Code health',
    body: 'Auto-detects circular deps, god objects, orphan files, bus-factor risk. Compares against dex.architecture.yaml — drift you can see.',
    glyph: 'health',
  },
];

function CapGlyph({ kind }) {
  // small SVG glyph per capability
  if (kind === 'graph') {
    return (
      <svg width="56" height="56" viewBox="0 0 56 56">
        <line x1="28" y1="28" x2="10" y2="14" stroke="rgba(255,255,255,0.4)" />
        <line x1="28" y1="28" x2="46" y2="14" stroke="rgba(255,255,255,0.4)" />
        <line x1="28" y1="28" x2="46" y2="42" stroke="rgba(255,255,255,0.4)" />
        <line x1="28" y1="28" x2="10" y2="42" stroke="rgba(255,255,255,0.4)" />
        <circle cx="28" cy="28" r="5" fill="#fff" />
        <circle cx="10" cy="14" r="3" fill="rgba(255,255,255,0.8)" />
        <circle cx="46" cy="14" r="3" fill="rgba(255,255,255,0.8)" />
        <circle cx="46" cy="42" r="3" fill="rgba(255,255,255,0.8)" />
        <circle cx="10" cy="42" r="3" fill="rgba(255,255,255,0.8)" />
      </svg>
    );
  }
  if (kind === 'rag') {
    return (
      <svg width="56" height="56" viewBox="0 0 56 56">
        <rect x="6" y="10" width="20" height="36" rx="3" stroke="rgba(255,255,255,0.4)" fill="none" />
        <rect x="30" y="10" width="20" height="36" rx="3" stroke="rgba(255,255,255,0.4)" fill="none" />
        <line x1="26" y1="20" x2="30" y2="20" stroke="#fff" />
        <line x1="26" y1="28" x2="30" y2="28" stroke="#fff" />
        <line x1="26" y1="36" x2="30" y2="36" stroke="#fff" />
        <circle cx="14" cy="18" r="2" fill="rgba(255,255,255,0.8)" />
        <circle cx="18" cy="26" r="2" fill="rgba(255,255,255,0.8)" />
        <circle cx="14" cy="34" r="2" fill="rgba(255,255,255,0.8)" />
        <circle cx="38" cy="18" r="2" fill="rgba(255,255,255,0.8)" />
        <circle cx="42" cy="26" r="2" fill="rgba(255,255,255,0.8)" />
        <circle cx="38" cy="34" r="2" fill="rgba(255,255,255,0.8)" />
      </svg>
    );
  }
  if (kind === 'blast') {
    return (
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="22" stroke="rgba(255,255,255,0.18)" fill="none" />
        <circle cx="28" cy="28" r="14" stroke="rgba(255,255,255,0.32)" fill="none" />
        <circle cx="28" cy="28" r="6" stroke="rgba(255,255,255,0.5)" fill="none" />
        <circle cx="28" cy="28" r="3" fill="#fff" />
        <circle cx="50" cy="28" r="2" fill="rgba(255,255,255,0.7)" />
        <circle cx="6" cy="28" r="2" fill="rgba(255,255,255,0.7)" />
        <circle cx="28" cy="6" r="2" fill="rgba(255,255,255,0.7)" />
        <circle cx="28" cy="50" r="2" fill="rgba(255,255,255,0.7)" />
        <circle cx="42" cy="14" r="2" fill="rgba(255,255,255,0.5)" />
        <circle cx="14" cy="42" r="2" fill="rgba(255,255,255,0.5)" />
      </svg>
    );
  }
  // health — bar chart with pulse
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <line x1="8" y1="46" x2="48" y2="46" stroke="rgba(255,255,255,0.3)" />
      <rect x="10" y="32" width="6" height="14" fill="rgba(255,255,255,0.4)" />
      <rect x="20" y="22" width="6" height="24" fill="rgba(255,255,255,0.6)" />
      <rect x="30" y="14" width="6" height="32" fill="#fff" />
      <rect x="40" y="26" width="6" height="20" fill="rgba(255,255,255,0.4)" />
      <circle cx="33" cy="10" r="3" fill="#ffb070" />
    </svg>
  );
}

function Capabilities() {
  return (
    <section style={{ padding: '100px 0' }}>
      <div className="wrap">
        <SectionHead
          eyebrow="What's inside"
          sub="Four primitives over one indexed graph. Use what you need — they share the same backend."
        >
          Four ways to <em style={{ fontStyle: 'italic' }}>look.</em>
        </SectionHead>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 16,
        }}>
          {CAPS.map((c, i) => (
            <div key={c.n} className={`reveal reveal-d${i + 1} glass`} style={{
              borderRadius: 18,
              padding: 36,
              minHeight: 260,
              display: 'flex', flexDirection: 'column',
              transition: 'transform 0.5s cubic-bezier(.2,.7,.2,1), background 0.4s',
              cursor: 'default',
            }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <CapGlyph kind={c.glyph} />
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 11,
                  color: 'rgba(255,255,255,0.3)',
                }}>{c.n}</span>
              </div>
              <h3 style={{
                fontFamily: 'var(--serif)',
                fontSize: 34, lineHeight: 1.1,
                margin: '0 0 14px',
                letterSpacing: '-0.01em',
                fontWeight: 400,
              }}>{c.title}</h3>
              <p style={{
                fontSize: 15.5, lineHeight: 1.55,
                color: 'rgba(255,255,255,0.6)',
                margin: 0,
              }}>{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// PIPELINE — horizontal 5 steps
function Pipeline() {
  const steps = [
    { n: '01', t: 'Clone', s: 'with progress + timeout' },
    { n: '02', t: 'Parse', s: 'AST · tree-sitter · regex' },
    { n: '03', t: 'Embed', s: 'pgvector · HNSW' },
    { n: '04', t: 'Graph', s: 'Neo4j edges + scopes' },
    { n: '05', t: 'Serve', s: 'FastAPI · RAG · /graph' },
  ];
  return (
    <section style={{ padding: '100px 0' }}>
      <div className="wrap">
        <SectionHead eyebrow="Under the hood" sub="Streams every stage. Never holds the repo in RAM.">
          Five stages.<br /><em style={{ fontStyle: 'italic' }}>One pipeline.</em>
        </SectionHead>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 16, position: 'relative',
        }}>
          {/* connecting line */}
          <div style={{
            position: 'absolute', top: 38, left: '10%', right: '10%',
            height: 1, background: 'rgba(255,255,255,0.08)',
            zIndex: 0,
          }} />
          {steps.map((s, i) => (
            <div key={s.n} className={`reveal reveal-d${i + 1}`} style={{
              textAlign: 'center',
              position: 'relative', zIndex: 1,
            }}>
              <div style={{
                width: 56, height: 56,
                margin: '0 auto 18px',
                borderRadius: 14,
                background: '#0a0a0b',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--mono)', fontSize: 13,
                color: 'rgba(255,255,255,0.7)',
              }}>{s.n}</div>
              <div style={{
                fontFamily: 'var(--serif)', fontSize: 26,
                color: '#fff', marginBottom: 6,
              }}>{s.t}</div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 11,
                color: 'rgba(255,255,255,0.4)',
              }}>{s.s}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// CTA + FOOTER
function CTA() {
  return (
    <section style={{
      padding: '160px 0 120px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 60% 80% at 50% 100%, rgba(255,255,255,0.08), transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div className="wrap" style={{ position: 'relative', textAlign: 'center' }}>
        <h2 className="reveal" style={{
          fontFamily: 'var(--serif)',
          fontSize: 'clamp(56px, 8vw, 112px)',
          lineHeight: 1, letterSpacing: '-0.02em',
          margin: 0, fontWeight: 400,
        }}>
          Read your code,
          <br /><em style={{ fontStyle: 'italic' }}>for once.</em>
        </h2>
        <p className="reveal reveal-d1" style={{
          maxWidth: 520, margin: '28px auto 36px',
          fontSize: 17, color: 'rgba(255,255,255,0.55)',
        }}>
          Private repo ready. Self-host on docker-compose. No credit card.
        </p>
        <div className="reveal reveal-d2" style={{ display: 'inline-flex', gap: 12 }}>
          <button className="btn btn-primary">Connect GitHub →</button>
          <button className="btn btn-ghost glass" style={{ padding: '10px 22px' }}>
            Read the docs
          </button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{
      padding: '40px 32px 60px',
      borderTop: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div className="wrap" style={{ padding: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              width: 22, height: 22, borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.18)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--mono)', fontSize: 11,
            }}>{'{}'}</span>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>
              dex · 2026 · built on Neo4j, pgvector, Groq
            </span>
          </div>
          <div style={{ display: 'flex', gap: 22, fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>GitHub</a>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Docs</a>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Discord</a>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────
// APP
function App() {
  useReveal();
  return (
    <>
      <Nav />
      <Hero />
      <Claims />
      <SeeShape />
      <AskAnything />
      <Capabilities />
      <Pipeline />
      <CTA />
      <Footer />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
