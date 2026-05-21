import { useState } from "react";

export default function Radar() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(0);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);

  const scan = async () => {
    setLoading(true); setResults([]); setDone(false);
    try {
      const r = await fetch("/api/scan");
      const d = await r.json();
      setResults(d.results || []);
      setTotal(d.total || 0);
      setScanned(d.total || 0);
    } catch (e) { console.error(e); }
    setLoading(false); setDone(true);
  };

  const f$ = n => "$" + (+n).toFixed(2);
  const fp = n => (n >= 0 ? "+" : "") + (+n).toFixed(2) + "%";

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#f0f9ff,#f0fdf4)",fontFamily:"system-ui",padding:16}}>
      <div style={{maxWidth:860,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24,paddingBottom:16,borderBottom:"1px solid #e2e8f0"}}>
          <div>
            <h1 style={{margin:0,fontSize:22,fontWeight:800,color:"#0f172a"}}>Radar <span style={{color:"#10b981"}}>AZ</span></h1>
            <p style={{margin:0,fontSize:11,color:"#94a3b8"}}>أسهم أمريكية شرعية · جاهزة للارتفاع</p>
          </div>
          <span style={{fontSize:10,background:"#dcfce7",color:"#15803d",borderRadius:20,padding:"3px 10px",fontWeight:600}}>☪ شرعي</span>
        </div>
        <div style={{display:"flex",gap:10,marginBottom:16}}>
          <div style={{background:"#dcfce7",borderRadius:12,padding:"8px 16px",textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:800,color:"#15803d"}}>{results.length}</div>
            <div style={{fontSize:9,color:"#15803d",opacity:0.7}}>فرص</div>
          </div>
          <div style={{background:"#dbeafe",borderRadius:12,padding:"8px 16px",textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:800,color:"#1d4ed8"}}>{scanned}/{total||20}</div>
            <div style={{fontSize:9,color:"#1d4ed8",opacity:0.7}}>فُحص</div>
          </div>
        </div>
        <button onClick={scan} disabled={loading} style={{background:loading?"#f1f5f9":"linear-gradient(135deg,#10b981,#059669)",border:"none",borderRadius:10,padding:"12px 28px",color:loading?"#94a3b8":"#fff",fontWeight:700,fontSize:13,cursor:loading?"not-allowed":"pointer",marginBottom:20,boxShadow:loading?"none":"0 4px 16px rgba(16,185,129,0.3)"}}>
          {loading?"⟳ جاري المسح...":"▶ ابدأ المسح"}
        </button>
        {loading&&<div style={{height:4,background:"#f1f5f9",borderRadius:4,marginBottom:20,overflow:"hidden"}}><div style={{height:"100%",width:"60%",background:"linear-gradient(90deg,#10b981,#34d399)",borderRadius:4}}/></div>}
        {results.map((r)=>(
          <div key={r.symbol} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:16,marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div>
                <span style={{fontSize:18,fontWeight:700,color:"#0f172a",marginLeft:10}}>{r.symbol}</span>
                <span style={{fontSize:9,background:"#dcfce7",color:"#15803d",borderRadius:20,padding:"2px 8px",fontWeight:600}}>▲ جاهز للارتفاع</span>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:16,fontWeight:700}}>{f$(r.price)}</div>
                <div style={{fontSize:12,color:r.change_pct>=0?"#059669":"#dc2626",fontWeight:600}}>{fp(r.change_pct)}</div>
              </div>
            </div>
            {r.levels&&(
              <div style={{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
                <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 10px"}}>
                  <div style={{fontSize:8,color:"#b91c1c",marginBottom:3}}>🛑 وقف الخسارة</div>
                  <div style={{fontSize:13,fontWeight:700,color:"#dc2626"}}>{f$(r.levels.sl)}</div>
                  <div style={{fontSize:10,color:"#b91c1c"}}>{fp(r.levels.slPct)}</div>
                </div>
                {[{n:1,val:r.levels.t1,pct:r.levels.t1Pct,bg:"#eff6ff",border:"#bfdbfe",text:"#1d4ed8"},{n:2,val:r.levels.t2,pct:r.levels.t2Pct,bg:"#f0fdf4",border:"#bbf7d0",text:"#15803d"},{n:3,val:r.levels.t3,pct:r.levels.t3Pct,bg:"#fffbeb",border:"#fde68a",text:"#b45309"}].map(t=>(
                  <div key={t.n} style={{background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 10px"}}>
                    <div style={{fontSize:8,color:t.text,marginBottom:3}}>🎯 هدف {t.n}</div>
                    <div style={{fontSize:13,fontWeight:700,color:t.text}}>{f$(t.val)}</div>
                    <div style={{fontSize:10,color:t.text}}>+{t.pct.toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {done&&results.length===0&&<div style={{textAlign:"center",padding:60,color:"#94a3b8"}}>لا توجد فرص حالياً — جرب بعد فتح السوق 4:30م</div>}
        <p style={{textAlign:"center",fontSize:10,color:"#cbd5e1",marginTop:24}}>أسهم شرعية · ليست نصيحة استثمارية</p>
      </div>
    </div>
  );
}
