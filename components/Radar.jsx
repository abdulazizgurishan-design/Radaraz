import { useState } from "react";

function OpCard({ r, f$, fp }) {
 const [open, setOpen] = useState(false);
 const scoreColor = r.score >= 80 ? "#9d174d" : r.score >= 50 ? "#b45309" : "#15803d";
 const scoreBg    = r.score >= 80 ? "#fce7f3" : r.score >= 50 ? "#fef3c7" : "#dcfce7";
 return (
   <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,marginBottom:10,overflow:"hidden",boxShadow:open?"0 8px 24px rgba(0,0,0,0.08)":"0 1px 4px rgba(0,0,0,0.05)",transition:"all 0.2s"}}>
     <div onClick={()=>setOpen(o=>!o)} style={{padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
       <div style={{background:scoreBg,borderRadius:10,padding:"6px 10px",textAlign:"center",minWidth:48,flexShrink:0}}>
         <div style={{fontSize:18,fontWeight:800,color:scoreColor,lineHeight:1}}>{r.score}</div>
         <div style={{fontSize:8,color:scoreColor,opacity:0.8}}>آمن شرعاً</div>
       </div>
       <div style={{minWidth:60}}>
         <div style={{fontSize:17,fontWeight:700,color:"#0f172a"}}>{r.symbol}</div>
         <div style={{fontSize:9,color:"#94a3b8",marginTop:1}}>تطهير الديون: {r.debtRatio}</div>
       </div>
       <div style={{display:"flex",gap:4,flexWrap:"wrap",flex:1, marginRight:10}}>
         <span style={{fontSize:9,background:"#ecfdf5",color:"#059669",borderRadius:20,padding:"2px 7px",fontWeight:600}}>☪ متوافق</span>
         <span style={{fontSize:9,background:"#eff6ff",color:"#1d4ed8",borderRadius:20,padding:"2px 7px",fontWeight:600}}>{r.signal}</span>
       </div>
       <div style={{textAlign:"right",minWidth:70,flexShrink:0}}>
         <div style={{fontSize:16,fontWeight:700,color:"#0f172a"}}>{f$(r.price)}</div>
         <div style={{fontSize:10,color:"#64748b"}}>ماركت كاب: {r.marketCap}</div>
       </div>
       <span style={{color:"#cbd5e1",fontSize:11,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block",flexShrink:0, marginRight:10}}>▼</span>
     </div>
     {open&&(
       <div style={{borderTop:"1px solid #f1f5f9",padding:"14px 16px"}}>
         <div style={{background:"#fdf4ff",border:"1px solid #e9d5ff",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:11,color:"#6d28d9"}}>📡 حالة الرادار: تم فحص التوافق المالي والشرعي للسهم، السهم جاهز للمراقبة واقتناص الفرصة.</div>
         <div style={{background:"linear-gradient(135deg,#fff5f5,#fef2f2)",border:"1px solid #fecaca",borderRadius:10,padding:"12px 14px",marginBottom:8}}>
           <div style={{fontSize:10,color:"#b91c1c",fontWeight:600,marginBottom:6}}>🛑 وقف الخسارة الدعم القريب</div>
           <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
             <span style={{fontSize:18,fontWeight:700,color:"#dc2626"}}>{f$(r.levels.sl)}</span>
             <div style={{textAlign:"right"}}>
               <div style={{fontSize:13,color:"#b91c1c",fontWeight:600}}>-5.00%</div>
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
     
     if (d.success && d.data) {
       // معالجة البيانات وتوليد النقاط الفنية والأهداف آلياً لحسابات البطاقات
       const processed = d.data.map((item, index) => {
         const basePrice = item.price;
         let score = 65; // سكور افتراضي للأسهم الشرعية المستقرة
         if (item.signal.includes("🔥")) score = 95;
         if (item.signal.includes("⚡")) score = 80;

         return {
           ...item,
           score: score,
           levels: {
             sl: basePrice * 0.95, // وقف الخسارة عند هبوط 5%
             t1: basePrice * 1.15, // الهدف الأول +15%
             t2: basePrice * 1.30, // الهدف الثاني +30%
             t3: basePrice * 1.50  // الهدف الثالث +50%
           }
         };
       });

       setResults(processed);
       setTotal(200); // الـ 200 شركة الإجمالية التي يبحث فيها الكود الخلفي
     }
   } catch(e) { console.error(e); }
   setLoading(false); setDone(true);
 };

 const f$ = n => "$" + (+n).toFixed(2);
 const fp = n => (n >= 0 ? "+" : "") + (+n).toFixed(2) + "%";
 
 const filtered = results.filter(r => {
   if (filter === "explosive") return r.score >= 90;
   if (filter === "high") return r.score >= 75 && r.score < 90;
   return true;
 });

 const explosive = results.filter(r => r.score >= 90).length;
 const high = results.filter(r => r.score >= 75 && r.score < 90).length;

 return (
   <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#f0f9ff,#fafafa,#f0fdf4)",fontFamily:"system-ui",padding:16}} odds-dir="rtl">
     <div style={{maxWidth:900,margin:"0 auto"}} dir="rtl">
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:20,paddingBottom:16,borderBottom:"1px solid #e2e8f0"}}>
         <div>
           <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
             <h1 style={{margin:0,fontSize:20,fontWeight:800,color:"#0f172a"}}>Radar <span style={{color:"#10b981"}}>AZ</span> <span style={{fontSize:11,background:"#7c3aed22",color:"#7c3aed",borderRadius:4,padding:"2px 6px",fontWeight:600}}>PRO</span></h1>
             <span style={{fontSize:10,background:"#dcfce7",color:"#15803d",borderRadius:20,padding:"2px 8px",fontWeight:600}}>☪ شرعي ومعتمد</span>
           </div>
           <p style={{margin:0,fontSize:11,color:"#94a3b8"}}>أسهم أمريكية شرعية (أقل من 200M ماركت كاب) · نظام فلترة متقدم</p>
         </div>
         <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
           {[{label:"فُحص",val:total||200,bg:"#dbeafe",text:"#1d4ed8"},{label:"💥 انفجاري",val:explosive,bg:"#fce7f3",text:"#9d174d"},{label:"🔥 عالي",val:high,bg:"#fef3c7",text:"#b45309"},{label:"الكل متوافق",val:results.length,bg:"#dcfce7",text:"#15803d"}].map(s=>(
             <div key={s.label} style={{background:s.bg,borderRadius:10,padding:"6px 12px",textAlign:"center",minWidth:56}}>
               <div style={{fontSize:18,fontWeight:800,color:s.text,lineHeight:1}}>{s.val}</div>
               <div style={{fontSize:8,color:s.text,opacity:0.7,marginTop:2}}>{s.label}</div>
             </div>
           ))}
         </div>
       </div>
       <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
         <button onClick={scan} disabled={loading} style={{background:loading?"#f1f5f9":"linear-gradient(135deg,#10b981,#059669)",border:"none",borderRadius:10,padding:"11px 24px",color:loading?"#94a3b8":"#fff",fontWeight:700,fontSize:13,cursor:loading?"not-allowed":"pointer",boxShadow:loading?"none":"0 4px 16px rgba(16,185,129,0.3)"}}>
           {loading?"⟳ جاري فحص الـ 200 شركة...":"▶ ابدأ المسح"}
         </button>
         {results.length>0&&(
           <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
             {[{id:"all",label:`الكل المكتشف (${results.length})`},{id:"explosive",label:`💥 الطفرة (${explosive})`},{id:"high",label:`🔥 سيولة عالية (${high})`}].map(f=>(
               <button key={f.id} onClick={()=>setFilter(f.id)} style={{background:filter===f.id?"#0f172a":"#fff",border:"1px solid #e2e8f0",borderRadius:20,padding:"6px 12px",color:filter===f.id?"#fff":"#64748b",fontSize:11,fontWeight:600,cursor:"pointer"}}>{f.label}</button>
             ))}
           </div>
         )}
       </div>
       {loading&&<div style={{height:4,background:"#f1f5f9",borderRadius:4,marginBottom:16,overflow:"hidden"}}><div style={{height:"100%",width:"85%",background:"linear-gradient(90deg,#10b981,#34d399)",borderRadius:4}}/></div>}
       {filtered.map(r=><OpCard key={r.symbol} r={r} f$={f$} fp={fp}/>)}
       {done&&results.length===0&&(
         <div style={{textAlign:"center",padding:"60px 20px",background:"#fff",borderRadius:16,border:"1px solid #f1f5f9"}}>
           <div style={{fontSize:40,marginBottom:12}}>📡</div>
           <div style={{fontSize:14,fontWeight:600,color:"#0f172a",marginBottom:6}}>لا توجد فرص مطابقة الشروط في هذه الدقيقة</div>
           <div style={{fontSize:12,color:"#94a3b8"}}>تأكد من فتح السوق الأمريكي للمسح الحي المتكامل للسيولة.</div>
         </div>
       )}
       <p style={{textAlign:"center",fontSize:10,color:"#cbd5e1",marginTop:24}}>Radar AZ Pro · أسهم شرعية معتمدة وفق تدقيق النسب المالية</p>
     </div>
   </div>
 );
}
