export default function Home() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080c18", color: "#fff" }}>
      <div style={{ textAlign: "center" }}>
        <h1>📡 Radaraz</h1>
        <p style={{ marginBottom: 30, opacity: 0.6 }}>Stock Market Radar</p>
        <a href="/admin" style={{ padding: "10px 20px", background: "#6366f1", color: "#fff", textDecoration: "none", borderRadius: 8, display: "inline-block" }}>
          Go to Admin
        </a>
      </div>
    </div>
  );
}
