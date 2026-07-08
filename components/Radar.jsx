{/* ✅ القيمة السوقية */}
<div>
  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{t.marketCap}</div>
  <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
    {companyData.marketCapFormatted || t.notAvailable}
  </div>
</div>

{/* ✅ الأسهم المتاحة */}
<div>
  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{t.sharesOutstanding}</div>
  <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
    {companyData.sharesFormatted || t.notAvailable}
  </div>
</div>
