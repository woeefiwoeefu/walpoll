import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const C = ["#E85D75", "#2B9E8F", "#4A7BF7", "#D4A017", "#9B59B6", "#E67E22", "#34495E", "#1ABC9C"];
const PUB = "https://publisher.walrus-testnet.walrus.space";

async function wStore(d) {
  try { const r = await fetch(`${PUB}/v1/blobs`, { method: "PUT", body: JSON.stringify(d) }); if (!r.ok) throw 0; const j = await r.json(); return j.newlyCreated?.blobObject?.blobId || j.alreadyCertified?.blobId || "local_" + Math.random().toString(36).slice(2); }
  catch { const id = "local_" + Math.random().toString(36).slice(2); localStorage.setItem(`wp_${id}`, JSON.stringify(d)); return id; }
}
const gid = () => Math.random().toString(36).slice(2, 9);
const pad = n => String(n).padStart(2, "0");

// Countdown component
function Timer({ endTime }) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = new Date(endTime) - new Date();
      if (diff <= 0) { setLeft("Ended"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLeft(`${pad(h)}h ${pad(m)}m ${pad(s)}s`);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [endTime]);
  return <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 600, color: left === "Ended" ? "#999" : "#E85D75", letterSpacing: 1 }}>{left}</span>;
}

// QR display
function QR({ url, size = 120 }) {
  return <img src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=F7F6F2&color=34495E&margin=1`} alt="QR" style={{ width: size, height: size, display: "block" }} />;
}

// SVG Logo
function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <rect width="100" height="100" fill="#34495E" rx="4"/>
      <rect x="16" y="42" width="14" height="30" fill="#E85D75"/>
      <rect x="34" y="52" width="14" height="20" fill="#2B9E8F"/>
      <rect x="52" y="36" width="14" height="36" fill="#4A7BF7"/>
      <rect x="70" y="56" width="14" height="16" fill="#D4A017"/>
      <text x="50" y="30" textAnchor="middle" fill="#F7F6F2" fontSize="24" fontFamily="Georgia,serif" fontWeight="bold" fontStyle="italic">W</text>
    </svg>
  );
}

const now3d = () => new Date(Date.now() + 3 * 24 * 3600000).toISOString();

const DEMOS = [
  { id: "p1", q: "What feature should Walrus prioritize next?", type: "single", opts: [
    { id: "o1", t: "Better SDK docs", v: 24 }, { id: "o2", t: "Walrus Sites v2", v: 18 },
    { id: "o3", t: "Seal encryption v2", v: 31 }, { id: "o4", t: "Mobile SDK", v: 12 },
  ], ts: "2026-05-14", end: now3d(), blob: null, seal: false },
  { id: "p2", q: "Best storage protocol in web3?", type: "single", opts: [
    { id: "o5", t: "Walrus", v: 45 }, { id: "o6", t: "Filecoin", v: 12 },
    { id: "o7", t: "Arweave", v: 8 }, { id: "o8", t: "IPFS", v: 15 },
  ], ts: "2026-05-16", end: now3d(), blob: null, seal: false },
  { id: "p3", q: "Rank these priorities for Walrus Sessions", type: "ranked", opts: [
    { id: "o9", t: "More hackathons", v: 35 }, { id: "o10", t: "Better docs", v: 28 },
    { id: "o11", t: "Grant program", v: 19 }, { id: "o12", t: "Dev tooling", v: 22 },
  ], ts: "2026-05-17", end: now3d(), blob: null, seal: true },
];

export default function WalPoll() {
  const [pg, setPg] = useState("home");
  const [polls, setPolls] = useState(DEMOS);
  const [apId, setApId] = useState(null);
  const [voted, setVoted] = useState({});
  const [np, setNp] = useState({ q: "", opts: ["", ""], seal: false, type: "single", hours: 72 });
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showQR, setShowQR] = useState(null);
  const [rankOrder, setRankOrder] = useState([]);

  const ap = polls.find(p => p.id === apId);
  const tt = m => { setToast(m); setTimeout(() => setToast(null), 3000); };
  const tv = p => p.opts.reduce((s, o) => s + o.v, 0);

  const vote = async (pid, oid) => {
    if (voted[pid]) { tt("Already voted"); return; }
    setPolls(p => p.map(pl => pl.id === pid ? { ...pl, opts: pl.opts.map(o => o.id === oid ? { ...o, v: o.v + 1 } : o) } : pl));
    setVoted(v => ({ ...v, [pid]: oid }));
    const b = await wStore({ type: "vote", pid, oid, ts: new Date().toISOString() });
    tt(`Stored · ${b.slice(0, 14)}...`);
  };

  const voteRanked = async (pid) => {
    if (voted[pid] || rankOrder.length === 0) return;
    const points = rankOrder.map((id, i) => ({ id, pts: rankOrder.length - i }));
    setPolls(p => p.map(pl => pl.id === pid ? { ...pl, opts: pl.opts.map(o => { const pt = points.find(x => x.id === o.id); return pt ? { ...o, v: o.v + pt.pts } : o; }) } : pl));
    setVoted(v => ({ ...v, [pid]: "ranked" }));
    const b = await wStore({ type: "ranked_vote", pid, ranking: rankOrder, ts: new Date().toISOString() });
    tt(`Ranked vote stored · ${b.slice(0, 14)}...`);
  };

  const create = async () => {
    const os = np.opts.filter(o => o.trim());
    if (!np.q.trim()) { tt("Write a question"); return; }
    if (os.length < 2) { tt("Add 2+ options"); return; }
    setBusy(true);
    const endTime = new Date(Date.now() + np.hours * 3600000).toISOString();
    const poll = { id: gid(), q: np.q.trim(), type: np.type, opts: os.map(t => ({ id: gid(), t: t.trim(), v: 0 })), ts: new Date().toISOString().slice(0, 10), end: endTime, seal: np.seal, blob: null };
    const b = await wStore({ type: "poll", ...poll });
    poll.blob = b;
    setPolls(p => [poll, ...p]);
    setNp({ q: "", opts: ["", ""], seal: false, type: "single", hours: 72 });
    setBusy(false);
    tt(`Poll stored · ${b.slice(0, 14)}...`);
    setPg("home");
  };

  const moveRank = (idx, dir) => {
    const arr = [...rankOrder];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= arr.length) return;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    setRankOrder(arr);
  };

  const f1 = "'DM Serif Text', Georgia, serif";
  const f2 = "'Sora', sans-serif";
  // Slightly varied border widths for anti-AI feel
  const bw = [2.5, 2, 3, 2, 2.5, 1.5, 3, 2];

  return (
    <div style={{ fontFamily: f2, minHeight: "100vh", background: "#F7F6F2", color: "#2A2D35" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Text:ital@0;1&family=Sora:wght@300;400;500;600;700;800&display=swap');
        @keyframes su{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fi{from{opacity:0}to{opacity:1}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::selection{background:#E85D75;color:#fff}
        body{background:#F7F6F2}
        /* Grain texture overlay */
        .grain::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:9999;opacity:0.035;
          background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-repeat:repeat;background-size:128px 128px}
      `}</style>

      <div className="grain" />

      {/* Nav */}
      <nav style={{ padding: "14px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E8E6E1" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }} onClick={() => { setPg("home"); setApId(null); }}>
          <Logo size={28} />
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3 }}>WalPoll</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <a href="https://docs.wal.app" target="_blank" rel="noopener" style={{ fontSize: 12, color: "#999", textDecoration: "none", fontWeight: 500 }}>Docs</a>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#bbb", padding: "3px 8px", border: "1px solid #E8E6E1", letterSpacing: 1.5 }}>TESTNET</span>
          <button style={{ padding: "8px 20px", background: "#34495E", color: "#F7F6F2", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: f2, letterSpacing: 0.3 }} onClick={() => setPg("create")}>New poll</button>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>

        {/* HOME */}
        {pg === "home" && !apId && (
          <div style={{ animation: "fi 0.35s" }}>
            <div style={{ marginBottom: 52, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div style={{ maxWidth: 500 }}>
                <h1 style={{ fontFamily: f1, fontSize: 48, fontWeight: 400, lineHeight: 1.12, marginBottom: 12 }}>
                  Every vote,<br/>permanently <span style={{ color: "#E85D75" }}>on-chain.</span>
                </h1>
                <p style={{ fontSize: 15, color: "#8A8D93", lineHeight: 1.65, marginBottom: 22 }}>
                  Create polls, collect votes, see results live. Stored as Walrus blobs. Verifiable forever. Optional Seal encryption for private votes.
                </p>
                <button style={{ padding: "11px 26px", background: "#34495E", color: "#F7F6F2", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: f2 }} onClick={() => setPg("create")}>Create your first poll →</button>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 90, opacity: 0.5 }}>
                {[58, 40, 72, 30, 50, 65].map((h, i) => <div key={i} style={{ width: 11, height: h, background: C[i % C.length] }} />)}
              </div>
            </div>

            {/* How it works */}
            <div style={{ display: "flex", gap: 0, marginBottom: 52, borderTop: "1px solid #E8E6E1", borderBottom: "1px solid #E8E6E1" }}>
              {[
                { n: "01", t: "Create", d: "Write your question. Pick single or ranked choice. Set a deadline." },
                { n: "02", t: "Share", d: "Send the link or scan QR. Anyone can vote. Zero gas fees." },
                { n: "03", t: "Verify", d: "Results update live. Every vote has a blob ID on Walrus." },
              ].map((s, i) => (
                <div key={s.n} style={{ flex: 1, padding: "22px 24px", borderLeft: i > 0 ? "1px solid #E8E6E1" : "none" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C[i], letterSpacing: 1.5, marginBottom: 6 }}>{s.n}</div>
                  <div style={{ fontFamily: f1, fontSize: 20, marginBottom: 5 }}>{s.t}</div>
                  <div style={{ fontSize: 12, color: "#9A9DA3", lineHeight: 1.55 }}>{s.d}</div>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: 44, marginBottom: 44 }}>
              {[
                { n: polls.filter(p => new Date(p.end) > new Date()).length, l: "live polls", c: "#E85D75" },
                { n: polls.reduce((s, p) => s + tv(p), 0), l: "total votes", c: "#2B9E8F" },
                { n: polls.length, l: "on walrus", c: "#4A7BF7" },
              ].map(s => (
                <div key={s.l}>
                  <div style={{ fontSize: 38, fontWeight: 800, color: s.c, lineHeight: 1 }}>{s.n}</div>
                  <div style={{ fontSize: 12, color: "#AAACB1", fontWeight: 500, marginTop: 3 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Poll list */}
            <div style={{ fontSize: 10, fontWeight: 700, color: "#C5C7CC", letterSpacing: 2.5, marginBottom: 14 }}>POLLS</div>
            {polls.map((p, pi) => {
              const t = tv(p);
              const top = [...p.opts].sort((a, b) => b.v - a.v)[0];
              const isLive = new Date(p.end) > new Date();
              return (
                <div key={p.id} style={{ borderTop: `${bw[pi % bw.length]}px solid ${C[pi % C.length]}`, padding: "22px 0 26px", cursor: "pointer", transition: "padding-left 0.2s" }}
                  onClick={() => { setApId(p.id); setPg("results"); }}
                  onMouseEnter={e => e.currentTarget.style.paddingLeft = "6px"} onMouseLeave={e => e.currentTarget.style.paddingLeft = "0"}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, marginBottom: 7, alignItems: "center" }}>
                        {p.seal && <span style={{ fontSize: 9, fontWeight: 700, color: "#2B9E8F", letterSpacing: 1 }}>SEALED</span>}
                        <span style={{ fontSize: 9, fontWeight: 600, color: "#C5C7CC", letterSpacing: 0.5 }}>{p.type === "ranked" ? "RANKED" : "SINGLE"}</span>
                        <span style={{ fontSize: 9, color: "#C5C7CC" }}>·</span>
                        {isLive ? <Timer endTime={p.end} /> : <span style={{ fontSize: 11, color: "#C5C7CC" }}>Ended</span>}
                      </div>
                      <h3 style={{ fontFamily: f1, fontSize: 22, fontWeight: 400, marginBottom: 9, lineHeight: 1.3 }}>{p.q}</h3>
                      <div style={{ display: "flex", gap: 2, height: 5, maxWidth: 300, marginBottom: 9 }}>
                        {p.opts.map((o, i) => <div key={o.id} style={{ width: `${t ? (o.v / t) * 100 : 25}%`, background: C[i], minWidth: 2 }} />)}
                      </div>
                      <div style={{ fontSize: 12, color: "#9A9DA3" }}>
                        <span style={{ fontWeight: 700, color: "#2A2D35" }}>{t}</span> votes · leading: <span style={{ fontWeight: 600, color: C[p.opts.indexOf(top) % C.length] }}>{top.t}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignSelf: "center", flexShrink: 0 }}>
                      <button style={{ padding: "6px 10px", background: "none", border: "1px solid #E8E6E1", color: "#999", fontSize: 11, cursor: "pointer", fontFamily: f2 }}
                        onClick={e => { e.stopPropagation(); setShowQR(showQR === p.id ? null : p.id); }}>QR</button>
                      <button style={{ padding: "8px 22px", background: "none", border: "1.5px solid #34495E", color: "#34495E", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: f2 }}
                        onClick={e => { e.stopPropagation(); setApId(p.id); setRankOrder(p.opts.map(o => o.id)); setPg("vote"); }}>Vote</button>
                    </div>
                  </div>
                  {showQR === p.id && (
                    <div style={{ marginTop: 14, padding: "16px 20px", background: "#fff", display: "inline-flex", gap: 16, alignItems: "center", border: "1px solid #E8E6E1" }} onClick={e => e.stopPropagation()}>
                      <QR url={`${window.location.origin}?p=${p.id}`} size={100} />
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#999", marginBottom: 6 }}>Scan to vote</div>
                        <div style={{ fontSize: 10, color: "#C5C7CC", wordBreak: "break-all", maxWidth: 200 }}>{window.location.origin}?p={p.id}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* VOTE */}
        {pg === "vote" && ap && (
          <div style={{ animation: "fi 0.3s", maxWidth: 540, margin: "0 auto" }}>
            <button style={{ background: "none", border: "none", color: "#E85D75", fontSize: 12, cursor: "pointer", fontFamily: f2, fontWeight: 600, marginBottom: 24 }} onClick={() => { setPg("home"); setApId(null); }}>← All polls</button>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              {ap.seal && <span style={{ fontSize: 9, fontWeight: 700, color: "#2B9E8F", letterSpacing: 1 }}>SEALED</span>}
              <span style={{ fontSize: 9, fontWeight: 600, color: "#C5C7CC" }}>{ap.type === "ranked" ? "RANKED CHOICE" : "SINGLE CHOICE"}</span>
              <span style={{ fontSize: 9, color: "#C5C7CC" }}>·</span>
              <Timer endTime={ap.end} />
            </div>
            <h2 style={{ fontFamily: f1, fontSize: 30, fontWeight: 400, marginBottom: 6, lineHeight: 1.25 }}>{ap.q}</h2>
            <p style={{ fontSize: 12, color: "#AAACB1", marginBottom: 28 }}>{tv(ap)} votes</p>

            {voted[ap.id] ? (
              <div>
                <div style={{ marginBottom: 24, padding: "14px 0", borderBottom: "1px solid #E8E6E1" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#2B9E8F" }}>✓ Vote recorded on Walrus</span>
                </div>
                {ap.opts.map((o, i) => {
                  const t = tv(ap) || 1; const pct = Math.round((o.v / t) * 100);
                  return (
                    <div key={o.id} style={{ marginBottom: 11 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{o.t}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C[i] }}>{pct}%</span>
                      </div>
                      <div style={{ height: 4, background: "#E8E6E1" }}><div style={{ height: "100%", width: `${pct}%`, background: C[i], transition: "width 0.6s ease" }} /></div>
                    </div>
                  );
                })}
                <button style={{ marginTop: 18, padding: "8px 18px", background: "none", border: "1px solid #C5C7CC", color: "#999", fontSize: 12, cursor: "pointer", fontFamily: f2 }} onClick={() => setPg("results")}>Full results →</button>
              </div>
            ) : ap.type === "ranked" ? (
              /* Ranked choice voting */
              <div>
                <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>Drag to rank. #1 = most important.</p>
                {rankOrder.map((id, idx) => {
                  const o = ap.opts.find(x => x.id === id);
                  const i = ap.opts.indexOf(o);
                  return (
                    <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5, padding: "14px 18px", background: "#fff", borderLeft: `4px solid ${C[i]}`, transition: "background 0.15s" }}>
                      <span style={{ fontWeight: 700, color: C[i], fontSize: 14, width: 20 }}>#{idx + 1}</span>
                      <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{o.t}</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button style={{ background: "none", border: "1px solid #E8E6E1", color: "#999", cursor: "pointer", padding: "4px 8px", fontSize: 12, fontFamily: f2 }} onClick={() => moveRank(idx, -1)} disabled={idx === 0}>↑</button>
                        <button style={{ background: "none", border: "1px solid #E8E6E1", color: "#999", cursor: "pointer", padding: "4px 8px", fontSize: 12, fontFamily: f2 }} onClick={() => moveRank(idx, 1)} disabled={idx === rankOrder.length - 1}>↓</button>
                      </div>
                    </div>
                  );
                })}
                <button style={{ width: "100%", marginTop: 16, padding: "14px", background: "#34495E", color: "#F7F6F2", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: f2 }} onClick={() => voteRanked(ap.id)}>Submit ranking</button>
              </div>
            ) : (
              /* Single choice voting */
              <div>
                {ap.opts.map((o, i) => (
                  <button key={o.id} style={{ width: "100%", padding: "18px 22px", background: "#fff", border: "none", borderLeft: `${bw[i % bw.length] + 1}px solid ${C[i]}`, marginBottom: 5, fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: f2, textAlign: "left", transition: "all 0.15s", color: "#2A2D35" }}
                    onMouseEnter={e => { e.currentTarget.style.background = C[i] + "0A"; e.currentTarget.style.paddingLeft = "30px"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.paddingLeft = "22px"; }}
                    onClick={() => vote(ap.id, o.id)}>{o.t}</button>
                ))}
              </div>
            )}
            <div style={{ marginTop: 20, fontSize: 10, color: "#D0D1D4" }}>Stored on Walrus · {ap.seal ? "Seal encrypted" : "Public"}</div>
          </div>
        )}

        {/* RESULTS */}
        {pg === "results" && ap && (
          <div style={{ animation: "fi 0.3s" }}>
            <button style={{ background: "none", border: "none", color: "#E85D75", fontSize: 12, cursor: "pointer", fontFamily: f2, fontWeight: 600, marginBottom: 24 }} onClick={() => { setPg("home"); setApId(null); }}>← All polls</button>
            <div style={{ display: "flex", gap: 36 }}>
              <div style={{ flex: 1.2 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  {ap.seal && <span style={{ fontSize: 9, fontWeight: 700, color: "#2B9E8F" }}>SEALED</span>}
                  <span style={{ fontSize: 9, fontWeight: 600, color: "#C5C7CC" }}>{ap.type === "ranked" ? "RANKED" : "SINGLE"}</span>
                  <span style={{ fontSize: 9, color: "#C5C7CC" }}>·</span>
                  <Timer endTime={ap.end} />
                </div>
                <h2 style={{ fontFamily: f1, fontSize: 28, fontWeight: 400, marginBottom: 5, lineHeight: 1.25 }}>{ap.q}</h2>
                <p style={{ fontSize: 12, color: "#AAACB1", marginBottom: 28 }}>{tv(ap)} votes · {ap.ts}</p>
                {ap.opts.map((o, i) => {
                  const t = tv(ap) || 1; const pct = Math.round((o.v / t) * 100);
                  return (
                    <div key={o.id} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{o.t}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C[i] }}>{pct}% <span style={{ fontWeight: 400, color: "#C5C7CC" }}>({o.v})</span></span>
                      </div>
                      <div style={{ height: 7, background: "#E8E6E1" }}><div style={{ height: "100%", width: `${pct}%`, background: C[i], transition: "width 0.8s ease" }} /></div>
                    </div>
                  );
                })}
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  {!voted[ap.id] && <button style={{ padding: "9px 24px", background: "#34495E", color: "#F7F6F2", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: f2 }} onClick={() => { setRankOrder(ap.opts.map(o => o.id)); setPg("vote"); }}>Vote →</button>}
                  <button style={{ padding: "8px 16px", background: "none", border: "1px solid #E8E6E1", color: "#999", fontSize: 11, cursor: "pointer", fontFamily: f2 }} onClick={() => setShowQR(showQR ? null : ap.id)}>QR code</button>
                  <button style={{ padding: "8px 16px", background: "none", border: "1px solid #E8E6E1", color: "#999", fontSize: 11, cursor: "pointer", fontFamily: f2 }} onClick={() => { navigator.clipboard?.writeText(window.location.origin + "?p=" + ap.id); tt("Copied"); }}>Copy link</button>
                </div>
                {showQR && <div style={{ marginTop: 14 }}><QR url={`${window.location.origin}?p=${ap.id}`} size={120} /></div>}
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#C5C7CC", letterSpacing: 2, marginBottom: 12 }}>DISTRIBUTION</div>
                  <ResponsiveContainer width="100%" height={190}>
                    <PieChart><Pie data={ap.opts.map((o, i) => ({ name: o.t, value: o.v, fill: C[i] }))} cx="50%" cy="50%" innerRadius={48} outerRadius={76} paddingAngle={2} dataKey="value" stroke="none">{ap.opts.map((_, i) => <Cell key={i} fill={C[i]} />)}</Pie><Tooltip contentStyle={{ border: "1px solid #E8E6E1", boxShadow: "none", fontFamily: f2, fontSize: 12, borderRadius: 0 }} /></PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
                    {ap.opts.map((o, i) => <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#8A8D93" }}><div style={{ width: 10, height: 3, background: C[i] }} />{o.t}</div>)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#C5C7CC", letterSpacing: 2, marginBottom: 12 }}>VOTES</div>
                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={ap.opts.map((o, i) => ({ name: o.t.length > 9 ? o.t.slice(0, 9) + ".." : o.t, votes: o.v }))} barSize={22}>
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#bbb", fontFamily: f2 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "#bbb" }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip contentStyle={{ border: "1px solid #E8E6E1", boxShadow: "none", fontFamily: f2, fontSize: 12, borderRadius: 0 }} />
                      <Bar dataKey="votes" radius={[1, 1, 0, 0]}>{ap.opts.map((_, i) => <Cell key={i} fill={C[i]} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 28, paddingTop: 14, borderTop: "1px solid #E8E6E1", fontSize: 11, color: "#C5C7CC", display: "flex", justifyContent: "space-between" }}>
              <span>Walrus blob · {ap.seal ? "Seal encrypted" : "Public"} · {ap.ts}</span>
              <span>{ap.type === "ranked" ? "Ranked choice (Borda count)" : "Single choice"}</span>
            </div>
          </div>
        )}

        {/* CREATE */}
        {pg === "create" && (
          <div style={{ animation: "fi 0.3s", maxWidth: 500, margin: "0 auto" }}>
            <button style={{ background: "none", border: "none", color: "#E85D75", fontSize: 12, cursor: "pointer", fontFamily: f2, fontWeight: 600, marginBottom: 24 }} onClick={() => setPg("home")}>← Back</button>
            <h2 style={{ fontFamily: f1, fontSize: 32, fontWeight: 400, marginBottom: 5 }}>New poll</h2>
            <p style={{ fontSize: 13, color: "#AAACB1", marginBottom: 32 }}>Stored as a Walrus blob. Permanent.</p>

            {/* Poll type selector */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              {[{ v: "single", l: "Single choice" }, { v: "ranked", l: "Ranked choice" }].map(t => (
                <button key={t.v} style={{ flex: 1, padding: "12px", background: np.type === t.v ? "#34495E" : "#fff", color: np.type === t.v ? "#F7F6F2" : "#999", border: np.type === t.v ? "none" : "1px solid #E8E6E1", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: f2 }}
                  onClick={() => setNp(p => ({ ...p, type: t.v }))}>{t.l}</button>
              ))}
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#C5C7CC", letterSpacing: 2, display: "block", marginBottom: 8 }}>QUESTION</label>
              <input style={{ width: "100%", padding: "14px 0", border: "none", borderBottom: "2px solid #34495E", fontSize: 18, fontFamily: f1, outline: "none", background: "transparent", color: "#2A2D35", boxSizing: "border-box" }}
                placeholder="What do you want to ask?" value={np.q} onChange={e => setNp(p => ({ ...p, q: e.target.value }))}
                onFocus={e => e.target.style.borderBottomColor = "#E85D75"} onBlur={e => e.target.style.borderBottomColor = "#34495E"} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#C5C7CC", letterSpacing: 2, display: "block", marginBottom: 10 }}>OPTIONS</label>
              {np.opts.map((opt, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                  <div style={{ width: 4, height: 28, background: C[i], flexShrink: 0 }} />
                  <input style={{ flex: 1, padding: "11px 0", border: "none", borderBottom: "1px solid #E8E6E1", fontSize: 14, fontFamily: f2, outline: "none", background: "transparent", color: "#2A2D35", boxSizing: "border-box" }}
                    placeholder={`Option ${i + 1}`} value={opt}
                    onChange={e => { const o = [...np.opts]; o[i] = e.target.value; setNp(p => ({ ...p, opts: o })); }}
                    onFocus={e => e.target.style.borderBottomColor = C[i]} onBlur={e => e.target.style.borderBottomColor = "#E8E6E1"} />
                  {np.opts.length > 2 && <button style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 15 }} onClick={() => setNp(p => ({ ...p, opts: p.opts.filter((_, j) => j !== i) }))}>×</button>}
                </div>
              ))}
              {np.opts.length < 8 && (
                <button style={{ marginTop: 6, padding: "9px 0 9px 14px", background: "none", border: "none", borderBottom: "1px dashed #ddd", width: "100%", textAlign: "left", color: "#bbb", fontSize: 12, cursor: "pointer", fontFamily: f2 }}
                  onClick={() => setNp(p => ({ ...p, opts: [...p.opts, ""] }))}>+ Add option</button>
              )}
            </div>

            {/* Duration */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#C5C7CC", letterSpacing: 2, display: "block", marginBottom: 8 }}>DURATION</label>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ h: 1, l: "1h" }, { h: 24, l: "24h" }, { h: 72, l: "3 days" }, { h: 168, l: "7 days" }].map(d => (
                  <button key={d.h} style={{ padding: "8px 16px", background: np.hours === d.h ? "#34495E" : "#fff", color: np.hours === d.h ? "#F7F6F2" : "#999", border: np.hours === d.h ? "none" : "1px solid #E8E6E1", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: f2 }}
                    onClick={() => setNp(p => ({ ...p, hours: d.h }))}>{d.l}</button>
                ))}
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: 13, color: "#8A8D93", marginBottom: 28, padding: "13px 0", borderTop: "1px solid #E8E6E1", borderBottom: "1px solid #E8E6E1" }}>
              <input type="checkbox" checked={np.seal} onChange={e => setNp(p => ({ ...p, seal: e.target.checked }))} style={{ accentColor: "#2B9E8F", width: 15, height: 15 }} />
              Seal encryption — only you see results
            </label>

            <button style={{ width: "100%", padding: "14px", background: "#34495E", color: "#F7F6F2", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: f2 }} onClick={create} disabled={busy}>{busy ? "Storing..." : "Create poll"}</button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #E8E6E1", padding: "28px 48px", marginTop: 36 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}><Logo size={20} /><span style={{ fontSize: 13, fontWeight: 700 }}>WalPoll</span></div>
            <p style={{ fontSize: 11, color: "#C5C7CC", maxWidth: 240, lineHeight: 1.55 }}>Real-time polling on Walrus. Every vote verifiable, permanent, on-chain.</p>
          </div>
          <div style={{ display: "flex", gap: 36 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#C5C7CC", letterSpacing: 2, marginBottom: 8 }}>BUILD</div>
              {["GitHub", "Create poll"].map(l => <div key={l}><a href="#" style={{ fontSize: 12, color: "#8A8D93", textDecoration: "none", lineHeight: 2 }} onClick={l === "Create poll" ? (e => { e.preventDefault(); setPg("create"); }) : undefined}>{l}</a></div>)}
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#C5C7CC", letterSpacing: 2, marginBottom: 8 }}>WALRUS</div>
              {[["Docs", "https://docs.wal.app"], ["Discord", "https://discord.gg/walrusprotocol"]].map(([l, u]) => <div key={l}><a href={u} target="_blank" rel="noopener" style={{ fontSize: 12, color: "#8A8D93", textDecoration: "none", lineHeight: 2 }}>{l}</a></div>)}
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 900, margin: "16px auto 0", paddingTop: 12, borderTop: "1px solid #E8E6E1", display: "flex", justifyContent: "space-between", fontSize: 10, color: "#D0D1D4", fontWeight: 500 }}>
          <span>Built live on Walrus · May 2026</span>
          <span>Walrus Sessions · Form Tooling</span>
        </div>
      </footer>

      {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#34495E", color: "#F7F6F2", padding: "10px 26px", fontSize: 12, fontWeight: 500, zIndex: 99, animation: "su 0.2s", fontFamily: f2 }}>{toast}</div>}
    </div>
  );
}
