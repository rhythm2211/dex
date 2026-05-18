// dex-chat-preview.jsx — Chat / ask-anything product mockup
// Animated typing of the question, then the answer reveals with citations + retrieval trace.

const { useEffect: _cp_useEffect, useState: _cp_useState } = React;

function useTyped(text, speed = 28, startDelay = 600) {
  const [out, setOut] = _cp_useState('');
  _cp_useEffect(() => {
    setOut('');
    let i = 0;
    const start = setTimeout(() => {
      const id = setInterval(() => {
        i++;
        setOut(text.slice(0, i));
        if (i >= text.length) clearInterval(id);
      }, speed);
    }, startDelay);
    return () => clearTimeout(start);
  }, [text, speed, startDelay]);
  return out;
}

function ChatPreview() {
  const question = 'How does the scheduler decide which node a pod lands on?';
  const typed = useTyped(question, 22, 400);
  const done = typed.length >= question.length;

  return (
    <div className="glass" style={{
      borderRadius: 18,
      padding: 28,
      background: 'rgba(10,10,11,0.55)',
    }}>
      {/* meta row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
        fontFamily: 'var(--mono)', fontSize: 11, color: 'rgba(255,255,255,0.45)',
      }}>
        <span className="dot-pulse" />
        <span>kubernetes/kubernetes</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>main</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>4.1M loc indexed</span>
        <span style={{ flex: 1 }} />
        <span className="code-chip">⌘K</span>
      </div>

      {/* user question */}
      <div style={{
        fontFamily: 'var(--serif)',
        fontSize: 30,
        color: '#fff',
        lineHeight: 1.25,
        marginBottom: 28,
        minHeight: 44,
      }}>
        {typed}
        <span style={{
          display: 'inline-block', width: 2, height: 24,
          background: '#fff', marginLeft: 2,
          verticalAlign: 'middle',
          animation: 'blink 1s steps(2, end) infinite',
          opacity: done ? 0 : 1,
        }} />
      </div>

      {/* divider */}
      <div style={{
        height: 1, background: 'rgba(255,255,255,0.08)',
        margin: '0 -28px 22px',
      }} />

      {/* answer */}
      <div style={{ opacity: done ? 1 : 0.25, transition: 'opacity 0.6s ease' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--mono)', fontSize: 11,
          color: 'rgba(255,255,255,0.45)', marginBottom: 14,
        }}>
          <span style={{
            width: 18, height: 18, borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.2)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9,
          }}>{'{}'}</span>
          <span>dex · answered in 1.4s</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>llama-3.3-70b · groq</span>
        </div>

        <div style={{
          fontSize: 16, lineHeight: 1.65, color: 'rgba(255,255,255,0.85)',
          marginBottom: 18,
        }}>
          The scheduler runs a two-phase loop in <span className="code-chip">pkg/scheduler/scheduler.go</span>.
          First, the <em style={{ fontFamily: 'var(--serif)', color: '#fff' }}>filter</em> phase eliminates
          nodes that violate hard constraints — resource availability, taints, affinity rules. Then
          the <em style={{ fontFamily: 'var(--serif)', color: '#fff' }}>score</em> phase ranks
          remaining candidates using pluggable plugins (NodeResourcesFit, ImageLocality, …) and
          picks the highest. The decision is bound to the pod via the API server.
        </div>

        {/* code citation */}
        <div style={{
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8,
          padding: 14,
          marginBottom: 18,
          overflow: 'hidden',
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10,
            color: 'rgba(255,255,255,0.4)', marginBottom: 8,
          }}>
            pkg/scheduler/scheduler.go · L412–428
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.55 }}>
            <div style={{ color: '#a6e3a1' }}>func (sched *Scheduler) schedulePod(ctx ...) Result {`{`}</div>
            <div style={{ color: 'rgba(255,255,255,0.7)' }}>{'\u00A0\u00A0'}feasibleNodes, _ := sched.<span style={{ color: '#f5d878' }}>findNodesThatFitPod</span>(ctx, pod)</div>
            <div style={{ color: 'rgba(255,255,255,0.7)' }}>{'\u00A0\u00A0'}if len(feasibleNodes) == 0 {`{`} return Result{`{`}Err: ErrNoNodesAvailable{`}}`}</div>
            <div style={{ color: 'rgba(255,255,255,0.7)' }}>{'\u00A0\u00A0'}priorityList, _ := sched.<span style={{ color: '#f5d878' }}>prioritizeNodes</span>(ctx, ...)</div>
            <div style={{ color: 'rgba(255,255,255,0.7)' }}>{'\u00A0\u00A0'}host, _ := sched.<span style={{ color: '#f5d878' }}>selectHost</span>(priorityList)</div>
            <div style={{ color: 'rgba(255,255,255,0.7)' }}>{'\u00A0\u00A0'}<span style={{ color: '#cba6f7' }}>return</span> Result{`{`}SuggestedHost: host{`}`}</div>
            <div style={{ color: '#a6e3a1' }}>{`}`}</div>
          </div>
        </div>

        {/* citations row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="eyebrow" style={{ marginRight: 4 }}>CITED</span>
          {[
            'scheduler.go',
            'plugins/noderesources/',
            'framework/v1.go',
            'extender.go',
          ].map(c => (
            <span key={c} className="code-chip">{c}</span>
          ))}
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
            vector(k=12) + graph 2-hop
          </span>
        </div>
      </div>

      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </div>
  );
}

window.ChatPreview = ChatPreview;
