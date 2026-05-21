import { useState } from "react";

function OpCard({ r, f$, fp }) {
 const [open, setOpen] = useState(false);
 const scoreColor = r.score >= 90 ? "#9d174d" : r.score >= 70 ? "#b45309" : "#15803d";
 const scoreBg    = r.score >= 90 ? "#fce7f3" : r.score >= 70 ? "#fef3c7" : "#dcfce7";
 return (
   <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,marginBottom:10,overflow:"hidden",boxShadow:open?"0 8px 24px rgba(0,0,0,0.08)":"0 1px 4px rgba(0,0,0,0.05)",transition:"all 0.2s"}}>
     <div onClick={()=>setOpen(o=>!o)} style={{padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
       <div style={{background:scoreBg,borderRadius:10,padding:"6px 10px",textAlign:"center",minWidth:48,flexShrink:0}}>
         <div style={{fontSize:18,fontWeight:800,color:scoreColor,lineHeight:1}}>{r.score}</div>
         <div style={{fontSize:8,color:scoreColor,opacity:0.8}}>{r.confidence}</div>
       </div>
       <div style={{minWidth:60}}>
         <div style={{fontSize:17,fontWeight:700,color:"#0f172a"}}>{r.symbol}</div>
         <div style={{fontSize:9,color:"#94a3b8",marginTop:1}}>{r.marketCap?`$${r.marketCap.toFixed(0)}M`:""}{r.float?` · Float ${r.float.toFixed(1)}M`:""}</div>
       </div>
       <div style={{display:"flex",gap:4,flexWrap:"wrap",flex:1}}>
         {r.rvol>3&&<span style={{fontSize:9,background:"#fef3c7",color:"#b45309",borderRadius:20,padding:"2px 7px",fontWeight:600}}>🔥 RVOL {r.rvol.toFixed(1)}x</span>}
         {r.aboveVWAP&&<span style={{fontSize:9,background:"#eff6ff",color:"#1d4ed8",borderRadius:20,padding:"2px 7px",fontWeight:600}}>📈 فوق VWAP</span>}
         {r.brokeResistance&&<span style={{fontSize:9,background:"#f0fdf4",color:"#15803d",borderRadius:20,padding:"2px 7px",fontWeight:600}}>⚡ اختراق</span>}
         {r.newsGood&&<span style={{fontSize:9,background:"#fdf4ff",color:"#7c3aed",borderRadius:20,padding:"2px 7px",fontWeight:600}}>📰 خبر</span>}
         {r.preGap>10&&<span style={{fontSize:9,background:"#ecfdf5",color:"#059669",borderRadius:20,padding:"2px 7px",fontWeight:600}}>↑ Gap {r.preGap.toFixed(0)}%</span>}
       </div>
       <div style={{textAlign:"right",minWidth:70,flexShrink:0}}>
         <div style={{fontSize:16,fontWeight:700,color:"#0f172a"}}>{f$(r.price)}</div>
         <div style={{fontSize:12,color:r.change_pct>=0?"#059669":"#dc2626",fontWeight:600}}>{fp(r.change_pct)}</div>
       </div>
       <span style={{color:"#cbd5e1",fontSize:11,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block",flexShrink:0}}>▼</span>
     </div>
     {open&&(
       <div style={{borderTop:"1px solid #f1f5f9",padding:"14px 16px"}}>
         {r.news&&<div style={{background:"#fdf4ff",border:"1px solid #e9d5ff",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:11,color:"#6d28d9"}}>📰 {r.news}</div>}
         <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
           {[{label:"EMA 9",val:r.ema9?f$(r.ema9):"—",color:"#7c3aed"},{label:"EMA 20",val:r.ema20?f$(r.ema20):"—",color:"#b45309"},{label:"VWAP",val:r.vwap?f$(r.vwap):"—",color:"#1d4ed8"},{label:"حركة",val:fp(r.move),color:"#059669"}].map(i=>(
             <div key={i.label} style={{background:"#f8fafc",border:"1px solid #f1f5f9",borderRadius:8,padding:"7px 10px",flex:1,minWidth:64}}>
               <div style={{fontSize:8,color:"#94a3b8",marginBottom:2}}>{i.label}</div>
               <div style={{fontSize:12,color:i.color,fontWeight:700}}>{i.val}</div>
             </div>
           ))}
         </div>
         <div style={{background:"linear-gradient(135deg,#fff5f5,#fef2f2)",border:"1px solid #fecaca",borderRadius:10,padding:"12px 14px",marginBottom:8}}>
           <div style={{fontSize:10,color:"#b91c1c",fontWeight:600,marginBottom:6}}>🛑 وقف الخسارة</div>
           <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
             <span style={{fontSize:18,fontWeight:700,color:"#dc2626"}}>{f$(r.levels.sl)}</span>
             <div style={{textAlign:"right"}}>
               <div style={{fontSize:13,color:"#b91c1c",fontWeight:600}}>{fp(r.levels.slPct)}</div>
               <div style={{fontSize:9,color:"#fca5a5"}}>مخاطرة: {f$(r.levels.risk)}</div>
             </div>
           </div>
         </div>
         <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
           {[{n:1,val:r.levels.t1,label:"TP1 +15%",from:"#eff6ff",to:"#dbeafe",border:"#bfdbfe",text:"#1d4ed8"},{n:2,val:r.levels.t2,label:"TP2 +30%",from:"#f0fdf4",to:"#dcfce7",border:"#bbf7d0",text:"#15803d"},{n:3,val:r.levels.t3,label:"TP3 +50%",from:"#fffbeb",to:"#fef3c7",border:"#fde68a",text:"#b45309"}].map(t=>(
             <div key={t.n} style={{background:`linear-gradient(135deg,${t.from},${t.to})`,border:`1px solid ${t.border}`,borderRadius:10,padding:"10px 12px"}}>
               <div style={{fontSize:9,color:t.text,fontWeight:600,marginBottom:4}}>{t.label}</div>
               <div style={{fontSize:15,fontWeight:700,color:t.text}}>{f$(t.val)}</div>
             </div>
           ))}
         </div>
         <div style={{marginTop:10,background:"#f8fafc",borderRadius:8,padding:"8px 12px"}}>
           <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
             <span style={{fontSize:10,color:"#64748b"}}>Confidence Score</span>
             <span style={{fontSize:11,fontWeight:700,color:scoreColor}}>{r.score}/100</span>
           </div>
           <div style={{height:4,background:"#e2e8f0",borderRadius:4,overflow:"hidden"}}>
             <div style={{height:"100%",width:`${r.score}%`,background:r.score>=90?"#db2777":r.score>=70?"#d97706":"#10b981",borderRadius:4}}/>
           </div>
         </div>
       </div>
     )}
   </div>
 );
}

export default function Radar() {
 const [results, setResults] = useState([]);
 const [loading, setLoading] = useState(false);
 const [total, setTotal] = useState(0);
 const [done, setDone] = useState(false);
 const [filter, setFilter] = useState("all");

 const scan = async () => {
   setLoading(true); setResults([]); setDone(false);
   try {
     const r = await fetch("/api/scan");
     const d = await r.json();
     setResults(d.results || []);
     setTotal(d.total || 0);
   } catch(e) { console.error(e); }
   setLoading(false); setDone(true);
 };

 const f$ = n => "$" + (+n).toFixed(2);
 const fp = n => (n >= 0 ? "+" : "") + (+n).toFixed(2) + "%";
 const filtered = results.filter(r => {
   if (filter === "explosive") return r.score >= 90;
   if (filter === "high") return r.score >= 70 && r.score < 90;
   if (filter === "watch") return r.score >= 50 && r.score < 70;
   return true;
 });
 const explosive = results.filter(r => r.score >= 90).length;
 const high = results.filter(r => r.score >= 70 && r.score < 90).length;

 return (
   <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#f0f9ff,#fafafa,#f0fdf4)",fontFamily:"system-ui",padding:16}}>
     <div style={{maxWidth:900,margin:"0 auto"}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:20,paddingBottom:16,borderBottom:"1px solid #e2e8f0"}}>
         <div>
           <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
             <h1 style={{margin:0,fontSize:20,fontWeight:800,color:"#0f172a"}}>Radar <span style={{color:"#10b981"}}>AZ</span> <span style={{fontSize:11,background:"#7c3aed22",color:"#7c3aed",borderRadius:4,padding:"2px 6px",fontWeight:600}}>PRO</span></h1>
             <span style={{fontSize:10,background:"#dcfce7",color:"#15803d",borderRadius:20,padding:"2px 8px",fontWeight:600}}>☪ شرعي</span>
           </div>
           <p style={{margin:0,fontSize:11,color:"#94a3b8"}}>أسهم أمريكية شرعية · فلتر انفجاري · نظام سكور متقدم</p>
         </div>
         <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
           {[{label:"فُحص",val:total||200,bg:"#dbeafe",text:"#1d4ed8"},{label:"💥 انفجاري",val:explosive,bg:"#fce7f3",text:"#9d174d"},{label:"🔥 عالي",val:high,bg:"#fef3c7",text:"#b45309"},{label:"الكل",val:results.length,bg:"#dcfce7",text:"#15803d"}].map(s=>(
             <div key={s.label} style={{background:s.bg,borderRadius:10,padding:"6px 12px",textAlign:"center",minWidth:56}}>
               <div style={{fontSize:18,fontWeight:800,color:s.text,lineHeight:1}}>{s.val}</div>
               <div style={{fontSize:8,color:s.text,opacity:0.7,marginTop:2}}>{s.label}</div>
             </div>
           ))}
         </div>
       </div>
       <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
         <button onClick={scan} disabled={loading} style={{background:loading?"#f1f5f9":"linear-gradient(135deg,#10b981,#059669)",border:"none",borderRadius:10,padding:"11px 24px",color:loading?"#94a3b8":"#fff",fontWeight:700,fontSize:13,cursor:loading?"not-allowed":"pointer",boxShadow:loading?"none":"0 4px 16px rgba(16,185,129,0.3)"}}>
           {loading?"⟳ جاري المسح...":"▶ ابدأ المسح"}
         </button>
         {results.length>0&&(
           <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
             {[{id:"all",label:`الكل (${results.length})`},{id:"explosive",label:`💥 (${explosive})`},{id:"high",label:`🔥 (${high})`},{id:"watch",label:"👀"}].map(f=>(
               <button key={f.id} onClick={()=>setFilter(f.id)} style={{background:filter===f.id?"#0f172a":"#fff",border:"1px solid #e2e8f0",borderRadius:20,padding:"6px 12px",color:filter===f.id?"#fff":"#64748b",fontSize:11,fontWeight:600,cursor:"pointer"}}>{f.label}</button>
             ))}
           </div>
         )}
       </div>
       {loading&&<div style={{height:4,background:"#f1f5f9",borderRadius:4,marginBottom:16,overflow:"hidden"}}><div style={{height:"100%",width:"60%",background:"linear-gradient(90deg,#10b981,#34d399)",borderRadius:4}}/></div>}
       {filtered.map(r=><OpCard key={r.symbol} r={r} f$={f$} fp={fp}/>)}
       {done&&results.length===0&&(
         <div style={{textAlign:"center",padding:"60px 20px",background:"#fff",borderRadius:16,border:"1px solid #f1f5f9"}}>
           <div style={{fontSize:40,marginBottom:12}}>📡</div>
           <div style={{fontSize:14,fontWeight:600,color:"#0f172a",marginBottom:6}}>لا توجد فرص حالياً</div>
           <div style={{fontSize:12,color:"#94a3b8"}}>جرّب بعد فتح السوق 4:30م بتوقيت الرياض</div>
         </div>
       )}
       <p style={{textAlign:"center",fontSize:10,color:"#cbd5e1",marginTop:24}}>Radar AZ Pro · أسهم شرعية · ليست نصيحة استثمارية</p>
     </div>
   </div>
 );
}
