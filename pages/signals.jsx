import { useState, useEffect } from "react";

export default function Signals() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState("");
  const [stats, setStats] = useState({ total: 0, leaders: 0, spec: 0 });

  useEffect(() => {
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formatted = today.toLocaleDateString('en-US', options);
    setDate(formatted);
    fetchSignals();
  }, []);

  const fetchSignals = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/scan");
      const data = await res.json();
      setSignals(data.results || []);
      setStats({
        total: data.total || 0,
        leaders: data.leaders?.length || 0,
        spec: data.speculation?.length || 0,
      });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const formatPrice = (n) => "$" + (+n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={S.container}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}>📡 Radar Signals</h1>
          <p style={S.date}>{date}</p>
        </div>
        <button style={S.refreshBtn} onClick={fetchSignals} disabled={loading}>
          {loading ? "⟳ Scanning..." : "🔄 Refresh"}
        </button>
      </div>

      <div style={S.statsGrid}>
        <div style={S.statBox("#6366f1")}>
          <div style={S.statValue}>{stats.total}</div>
          <div style={S.statLabel}>Total Scanned</div>
        </div>
        <div style={S.statBox("#818cf8")}>
          <div style={S.statValue}>{stats.leaders}</div>
          <div style={S.statLabel}>🏆 Leaders</div>
        </div>
        <div style={S.statBox("#f87171")}>
          <div style={S.statValue}>{stats.spec}</div>
          <div style={S.statLabel}>💥 Speculation</div>
        </div>
      </div>

      <div style={S.signalsContainer}>
        {signals.length === 0 ? (
          <div style={S.noSignals}>No signals available</div>
        ) : (
          signals.map((s, idx) => (
            <div key={s.symbol} style={S.signalCard}>
              <div style={S.cardTop}>
                <div style={S.symbolSection}>
                  <div style={S.number}>{String(idx + 1).padStart(2, "0")}</div>
                  <div>
                    <div style={S.symbol}>{s.symbol}</div>
                    <div style={S.type}>{s.type === "قيادي" ? "🏆 Leader" : "💥 Speculation"}</div>
                  </div>
                </div>
                <div style={S.scoreBox}>
                  <div style={S.score}>{s.score}</div>
                </div>
                <div style={S.priceBox}>
                  <div style={S.price}>{formatPrice(s.price)}</div>
                  <div style={S.change(s.change_pct >= 0)}>
                    {s.change_pct >= 0 ? "+" : ""}{s.change_pct.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div style={S.levelsRow}>
                <div style={S.levelBox("rgba(99,102,241,0.15)", "#6366f1")}>
                  <div style={S.levelLabel}>ENTRY</div>
                  <div style={S.levelPrice}>{formatPrice(s.price)}</div>
                </div>
                <div style={S.levelBox("rgba(96,165,250,0.15)", "#60a5fa")}>
                  <div style={S.levelLabel}>T1</div>
                  <div style={S.levelPrice}>{formatPrice(s.levels.t1)}</div>
                  <div style={S.levelPct}>+{s.levels.t1Pct.toFixed(1)}%</div>
                </div>
                <div style={S.levelBox("rgba(52,211,153,0.15)", "#34d399")}>
                  <div style={S.levelLabel}>T2</div>
                  <div style={S.levelPrice}>{formatPrice(s.levels.t2)}</div>
                  <div style={S.levelPct}>+{s.levels.t2Pct.toFixed(1)}%</div>
                </div>
                <div style={S.levelBox("rgba(251,191,36,0.15)", "#fbbf24")}>
                  <div style={S.levelLabel}>T3</div>
                  <div style={S.levelPrice}>{formatPrice(s.levels.t3)}</div>
                  <div style={S.levelPct}>+{s.levels.t3Pct.toFixed(1)}%</div>
                </div>
                <div style={S.levelBox("rgba(255,107,107,0.15)", "#ff6b6b")}>
                  <div style={S.levelLabel}>STOP</div>
                  <div style={S.levelPrice}>{formatPrice(s.levels.sl)}</div>
                  <div style={S.levelPct}>{s.levels.slPct.toFixed(1)}%</div>
                </div>
              </div>

              <div style={S.meta}>
                <span>📊 Vol: {(s.volume / 1e6).toFixed(1)}M</span>
                <span>💧 RVOL: {s.rvol ? s.rvol.toFixed(1) + "x" : "—"}</span>
                <span>📈 VWAP: {formatPrice(s.vwap)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={S.footer}>
        <p>⚡ These are technical signals, not investment advice</p>
        <p>🔗 <a href="/results">View Results →</a></p>
      </div>
    </div>
  );
}

const S = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    color: "#fff",
    fontFamily: "system-ui",
    padding: "20px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 900,
    margin: "0 0 8px 0",
    color: "#6366f1",
  },
  date: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    margin: 0,
  },
  refreshBtn: {
    padding: "10px 20px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginBottom: 24,
  },
  statBox: (color) => ({
    background: `${color}15`,
    border: `1px solid ${color}30`,
    borderRadius: 10,
    padding: 16,
    textAlign: "center",
  }),
  statValue: {
    fontSize: 24,
    fontWeight: 900,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },
  signalsContainer: {
    display: "grid",
    gap: 12,
    marginBottom: 24,
  },
  signalCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 16,
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  symbolSection: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  number: {
    fontSize: 14,
    fontWeight: 700,
    color: "#6366f1",
    minWidth: 30,
  },
  symbol: {
    fontSize: 18,
    fontWeight: 900,
    fontFamily: "monospace",
  },
  type: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
  },
  scoreBox: {
    textAlign: "center",
  },
  score: {
    fontSize: 24,
    fontWeight: 900,
    color: "#ff6b35",
  },
  priceBox: {
    textAlign: "right",
  },
  price: {
    fontSize: 18,
    fontWeight: 700,
    fontFamily: "monospace",
  },
  change: (isPositive) => ({
    fontSize: 12,
    color: isPositive ? "#00d4aa" : "#ff4757",
    fontWeight: 600,
  }),
  levelsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 8,
    marginBottom: 12,
  },
  levelBox: (bg, color) => ({
    background: bg,
    border: `1px solid ${color}40`,
    borderRadius: 8,
    padding: 10,
    textAlign: "center",
  }),
  levelLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 4,
  },
  levelPrice: {
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "monospace",
    marginBottom: 2,
  },
  levelPct: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
  },
  meta: {
    display: "flex",
    gap: 16,
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
  },
  noSignals: {
    textAlign: "center",
    padding: 40,
    color: "rgba(255,255,255,0.3)",
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    marginTop: 24,
  },
};
