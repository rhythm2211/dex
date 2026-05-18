'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { ArrowLeft, BarChart3, AlertTriangle, Flame } from 'lucide-react';
import { dexApi, LeadershipInsights } from '@/lib/api';

export default function LeadershipInsightsPage() {
  const [data, setData] = useState<LeadershipInsights | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = await dexApi.getLeadershipInsights();
        setData(d);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AppShell>
      <main className="relative z-10 min-h-screen bg-[#020202] text-white pb-20">
        <div className="max-w-6xl mx-auto px-6 pt-6">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-indigo-400 mb-6"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <BarChart3 size={20} />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">Leadership intelligence</h1>
              <p className="text-slate-400 text-sm mt-1">
                Org-wide risk, ownership concentration, and architecture drift signals.
              </p>
            </div>
          </div>

          {loading && <p className="text-slate-500">Loading…</p>}
          {err && <p className="text-red-400">{err}</p>}

          {data && !loading && (
            <div className="space-y-8">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-slate-500 uppercase">Unowned surface</p>
                  <p className="text-3xl font-bold text-white mt-1">{data.unowned_surface_pct}%</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-slate-500 uppercase">Architecture violations</p>
                  <p className="text-3xl font-bold text-amber-400 mt-1 flex items-center gap-2">
                    <AlertTriangle size={22} />
                    {data.architecture_violations_this_week}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-slate-500 uppercase">Prod incidents index (7d)</p>
                  <p className="text-3xl font-bold text-rose-400 mt-1 flex items-center gap-2">
                    <Flame size={22} />
                    {data.incidents_this_week}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-6">
                <h2 className="text-lg font-semibold mb-4">Top risk files</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-white/10">
                        <th className="py-2 pr-4">File</th>
                        <th className="py-2 pr-4">Owner</th>
                        <th className="py-2 pr-4">Score</th>
                        <th className="py-2">Incidents 7d</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.top_risk_files || []).map((r) => (
                        <tr key={r.file} className="border-b border-white/5">
                          <td className="py-2 pr-4 font-mono text-xs text-indigo-200">{r.file}</td>
                          <td className="py-2 pr-4">{r.owner || '—'}</td>
                          <td className="py-2 pr-4">{r.score}</td>
                          <td className="py-2">{r.incidents_7d ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-6">
                  <h2 className="text-lg font-semibold mb-3">Ownership heatmap</h2>
                  <ul className="space-y-2 text-sm">
                    {(data.ownership_heatmap || []).map((z) => (
                      <li key={z.zone} className="flex justify-between border-b border-white/5 py-2">
                        <span className="text-slate-300">{z.zone}</span>
                        <span className="text-slate-500">
                          {z.files} files · {z.distinct_owners} owners · conc. {z.concentration}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
                  <h2 className="text-lg font-semibold mb-3 text-amber-200">Concentration alerts</h2>
                  <ul className="space-y-2 text-sm text-amber-100/90">
                    {(data.concentration_alerts || []).map((a) => (
                      <li key={a.zone}>{a.message}</li>
                    ))}
                    {!(data.concentration_alerts || []).length && (
                      <li className="text-slate-500">No alerts — ownership looks distributed.</li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-6">
                <h2 className="text-lg font-semibold mb-3">Commit cadence (proxy)</h2>
                <p className="text-xs text-slate-500 mb-2">Weekly buckets from ingested git history</p>
                <ul className="flex flex-wrap gap-3 text-xs">
                  {(data.bus_factor_trend || []).map((w) => (
                    <li key={w.week} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                      <span className="text-indigo-300">{w.week}</span>: {w.commits} commits, top author{' '}
                      {(w.top_author_share * 100).toFixed(0)}%
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
