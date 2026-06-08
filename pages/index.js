import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <title>Radaraz</title>
      </Head>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "#fff", fontFamily: "system-ui" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📡</div>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>Radaraz</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>Stock Market Radar</p>
          <a href="/admin" style={{ padding: "10px 24px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-block" }}>
            Admin Panel →
          </a>
        </div>
      </div>
    </>
  );
}
