import { useState, useEffect } from "react";

export default function Results() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formatted = today.toLocaleDateString('en-US', options);
    setDate(formatted);
    fetchResults();
  }, []);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/summary");
      const data = await res.json();
      setSummary(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const buildTweet = () => {
    if (!summary) return "";
    const lines = [`📊 Today's Radar Results — ${date}\n`];
    
    lines.push(`🎯 Performance:`);
    lines.push(`  ✅ T1 Targets Hit: ${summary.t1 || 0}`);
    lines.push(`  🎯 T2 Targets Hit: ${summary.t2 || 0}`);
    lines.push(`  🏆 T3 Targets Hit: ${summary.t3 || 0}`);
    lines.push(`  ❌ Stop Loss Hit: ${summary.stops || 0}\n`);

    lines.push(`📈 Statistics:`);
    lines.push(`  Total Signals: ${summary.total || 0}`);
    lines.push(`  Success Rate: ${summary.total ? ((summary.t1 + summary.t2 + summary.t3) / summary.total * 100).toFixed(1) : 0}%\n`);

    lines.push(`🔗 radaraz.com`);
    return lines.join("\n");
  };

  const copyTweet = () => {
    const tweet = buildTweet();
    navigator.clipboard.writeText(tweet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formatPrice = (n) => "$" + (+n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getResult = (s) => {
    if (s.status === "OPEN") return null;
    if (s.target3_hit) return { icon: "🏆", label: "T3 Hit", pct: s.max_gain_pct, color: "#fbbf24" };
    if (s.target2_hit) return { icon: "🎯", label: "T2 Hit", pct: s.max_gain_pct, color: "#34d399" };
    if (s.target1_hit) return { icon: "✅", label: "T1 Hit", pct: s.max_gain_pct, color: "#60a5fa" };
    if (s.stop_hit) return { icon: "❌", label: "Stop Hit", pct: s.close_gain_pct, color: "#ff4757" };
    return { icon: "⏳", label: "Pending", pct: s.close_gain_pct, color: "rgba(255,255,255,0.5)" };
  };

  if (!summary) {
    return (
      <div style={S.container}>
        <div style={S.loading}>
          {loading ? "⟳ Loading results..." : "No data available"}
        </div>
      </div>
    );
  }

  return (
    <div style={S.container}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}>📊 Results</h1>
          <p style={S.date}>{date}</p>
        </div>
        <button style={S.refreshBtn} onClick={fetchResults} disabled={loading}>
          {loading ? "⟳ Loading..." : "🔄 Refresh"}
        </button>
      </div>

      <div style={S.mainStatsGrid}>
        <div style={S.mainStatBox("#60a5fa")}>
          <div style={S.mainStatLabel}>T1 TARGETS</div>
          <div style={S.mainStatValue}>{summary.t1 || 0}</div>
          <div style={S.mainStatSub}>✅ Hit</div>
        </div>
        <div style={S.mainStatBox("#34d399")}>
          <div style={S.mainStatLabel}>T2 TARGETS</div>
          <div style={S.mainStatValue}>{summary.t2 || 0}</div>
          <div style={S.mainStatSub}>🎯 Hit</div>
        </div>
        <div style={S.mainStatBox("#fbbf24")}>
          <div style={S.mainStatLabel}>T3 TARGETS</div>
          <div style={S.mainStatValue}>{summary.t3 || 0}</div>
          <div style={S.mainStatSub}>🏆 Hit</div>
        </div>
        <div style={S.mainStatBox("#ff4757")}>
          <div style={S.mainStatLabel}>STOP LOSS</div>
          <div style={S.mainStatValue}>{summary.stops || 0}</div>
          <div style={S.mainStatSub}>❌ Hit</div>
        </div>
      </div>

      <div style={S.successRateBox}>
        <div style={S.successRateLabel}>SUCCESS RATE</div>
        <div style={S.successRateValue}>
          {summary.total ? ((summary.t1 + summary.t2 + summary.t3) / summary.total * 100).toFixed(1) : 0}%
        </div>
        <div style={S.successRateSub}>
          {(summary.t1 + summary.t2 + summary.t3)} of {summary.total} signals hit targets
        </div>
        <div style={S.progressBar}>
          <div style={S.progressFill(summary.total ? ((summary.t1 + summary.t2 + summary.t3) / summary.total * 100) : 0)}></div>
        </div>
      </div>

      <div style={S.resultsSection}>
        <h2 style={S.sectionTitle}>📈 Signal Details</h2>
        
        {(summary.signals || []).length === 0 ? (
          <div style={S.noResults}>Waiting for evaluation...</div>
        ) : (
          <div style={S.resultsList}>
            {(summary.signals || []).map((s) => {
              const result = getResult(s);
              return (
                <div key={s.id} style={S.resultCard}>
                  <div style={S.resultTop}>
                    <div style={S.resultSymbol}>
                      <span style={{ fontSize: 20 }}>{result?.icon || "📡"}</span>
                      <div>
                        <div style={S.resultSymbolText}>{s.symbol}</div>
                        <div style={S.resultScore}>({s.score})</div>
                      </div>
                    </div>
                    <div style={S.resultStatus(result?.color)}>
                      <div style={S.resultStatusLabel}>{result?.label}</div>
                      <div style={S.resultStatusPct}>
                        {result?.pct != null ? (result.pct >= 0 ? `+${result.pct}%` : `${result.pct}%`) : "—"}
                      </div>
                    </div>
                  </div>
                  
                  <div style={S.resultDetails}>
                    <div style={S.resultRow}>
                      <span style={S.resultLabel}>Entry:</span>
                      <span style={S.resultPrice}>{formatPrice(s.entry_price)}</span>
                    </div>
                    <div style={S.resultRow}>
                      <span style={S.resultLabel}>T1:</span>
                      <span style={{ ...S.resultPrice, color: s.target1_hit ? "#60a5fa" : "rgba(255,255,255,0.5)" }}>
                        {formatPrice(s.target1)} {s.target1_hit ? "✓" : ""}
                      </span>
                    </div>
                    <div style={S.resultRow}>
                      <span style={S.resultLabel}>T2:</span>
                      <span style={{ ...S.resultPrice, color: s.target2_hit ? "#34d399" : "rgba(255,255,255,0.5)" }}>
                        {formatPrice(s.target2)} {s.target2_hit ? "✓" : ""}
                      </span>
                    </div>
                    <div style={S.resultRow}>
                      <span style={S.resultLabel}>T3:</span>
                      <span style={{ ...S.resultPrice, color: s.target3_hit ? "#fbbf24" : "rgba(255,255,255,0.5)" }}>
                        {formatPrice(s.target3)} {s.target3_hit ? "✓" : ""}
                      </span>
                    </div>
                    <div style={S.resultRow}>
                      <span style={S.resultLabel}>Stop:</span>
                      <span style={{ ...S.resultPrice, color: s.stop_hit ? "#ff4757" : "rgba(255,255,255,0.5)" }}>
                        {formatPrice(s.stop_loss)} {s.stop_hit ? "🛑" : ""}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={S.tweetSection}>
        <h2 style={S.sectionTitle}>🐦 Share on X</h2>
        <button style={S.tweetBtn} onClick={copyTweet}>
          {copied ? "✅ Copied!" : "📋 Copy Tweet"}
        </button>
        <div style={S.tweetPreview}>
          <pre style={S.tweetText}>{buildTweet()}</pre>
        </div>
      </div>

      <div style={S.footer}>
        <p><a href="/signals">← Back to Signals</a></p>
        <p>⚡ Results updated at market close</p>
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
  mainStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    marginBottom: 20,
  },
  mainStatBox: (color) => ({
    background: `${color}15`,
    border: `2px solid ${color}40`,
    borderRadius: 12,
    padding: 16,
    textAlign: "center",
  }),
  mainStatLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  mainStatValue: {
    fontSize: 36,
    fontWeight: 900,
    marginBottom: 4,
  },
  mainStatSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
  },
  successRateBox: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  successRateLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  successRateValue: {
    fontSize: 48,
    fontWeight: 900,
    color: "#6366f1",
    marginBottom: 4,
  },
  successRateSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    background: "rgba(255,255,255,0.1)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: (pct) => ({
    height: "100%",
    background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
    width: `${Math.min(pct, 100)}%`,
    transition: "width 0.3s ease",
  }),
  resultsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 12,
    color: "#fff",
  },
  resultsList: {
    display: "grid",
    gap: 12,
  },
  resultCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 12,
  },
  resultTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  resultSymbol: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  resultSymbolText: {
    fontSize: 16,
    fontWeight: 700,
    fontFamily: "monospace",
  },
  resultScore: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
  },
  resultStatus: (color) => ({
    textAlign: "right",
    padding: "6px 12px",
    background: `${color}20`,
    border: `1px solid ${color}40`,
    borderRadius: 6,
  }),
  resultStatusLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.7)",
  },
  resultStatusPct: {
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
  },
  resultDetails: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 8,
    fontSize: 11,
  },
  resultRow: {
    background: "rgba(255,255,255,0.02)",
    padding: "6px 8px",
    borderRadius: 4,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultLabel: {
    color: "rgba(255,255,255,0.5)",
    fontWeight: 600,
  },
  resultPrice: {
    fontFamily: "monospace",
    fontWeight: 600,
    color: "#fff",
  },
  noResults: {
    textAlign: "center",
    padding: 40,
    color: "rgba(255,255,255,0.3)",
  },
  tweetSection: {
    marginBottom: 24,
  },
  tweetBtn: {
    width: "100%",
    padding: 12,
    background: "linear-gradient(135deg, #1da1f2, #0d8ecf)",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
    marginBottom: 12,
  },
  tweetPreview: {
    background: "rgba(29,161,242,0.1)",
    border: "1px solid rgba(29,161,242,0.2)",
    borderRadius: 8,
    padding: 12,
  },
  tweetText: {
    fontSize: 12,
    whiteSpace: "pre-wrap",
    margin: 0,
    color: "rgba(255,255,255,0.7)",
    fontFamily: "monospace",
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    marginTop: 24,
  },
  loading: {
    textAlign: "center",
    padding: 100,
    color: "rgba(255,255,255,0.3)",
  },
};
