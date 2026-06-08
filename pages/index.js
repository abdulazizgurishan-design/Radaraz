export default function Home() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080c18", color: "#fff", fontFamily: "system-ui" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 60, marginBottom: 20 }}>📡</div>
        <h1 style={{ fontSize: 32, marginBottom: 10, fontWeight: 900 }}>Radaraz</h1>
        <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 30, fontSize: 14 }}>Stock Market Radar</p>
        <a href="/admin" style={{ padding: "12px 32px", background: "#6366f1", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-block", fontSize: 16 }}>
          Admin Panel
        </a>
      </div>
    </div>
  );
}
