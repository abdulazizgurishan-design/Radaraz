import { useState } from "react";

function ScoreBar({score}){
 const color=score>=80?"#ff6b35":score>=60?"#ffd700":"#00d4aa";
 return(
   <div style={{position:"relative",height:3,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden",marginTop:6}}>
     <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${score}%`,background:color,borderRadius:3,boxShadow:`0 0 8px ${color}`}}/>
   </div>
 );
}

function Card({r,idx}){
 const[open,setOpen]=useState(false);
 const f$=n=>"$"+(+n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
 const fp=n=>(n>=0?"+":"")+((+n).toFixed(2))+"%";
 const scoreColor=r.score>=80?"#ff6b35":r.score>=60?"#ffd700":"#00d4aa";
 const glowColor=r.score>=80?"rgba(255,107,53,0.15)":r.score>=60?"rgba(255,215,0,0.1)":"rgba(0,212,170,0.1)";
 return(
   <div style={{background:"linear-gradient(135deg,rgba(15,20,35,0.95),rgba(20,28,48,0.95))",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,marginBottom:10,overflow:"hidden",transition:"all 0.3s",boxShadow:open?`0 8px 32px ${glowColor}`:"0 2px 8px rgba(0,0,0,0.3)"}}>
     <div onClick={()=>setOpen(o=>!o)} style={{padding:"16px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
       <span style={{fontSize:10,color:"rgba(255,255,255,0.2)",minWidth:22,fontFamily:"monospace"}}>{String(idx+1).padStart(2,"0")}</span>
       <div style={{minWidth:64}}>
         <div style={{fontSize:17,fontWeight:700,color:"#fff",letterSpacing:1,fontFamily:"monospace"}}>{r.symbol}</div>
         <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",marginTop:1}}>{r.marketCap?`$${r.marketCap.toFixed(0)}M · `:""}☪</div>
       </div>
       <div style={{display:"flex",gap:5,flexWrap:"wrap",flex:1}}>
         <span style={{fontSize:9,padding:"3px 8px",borderRadius:20,background:"rgba(255,107,53,0.15)",color:"#ff6b35",fontWeight:600,border:"1px solid rgba(255,107,53,0.2)"}}>{r.confidence}</span>
         {r.rvol>3&&<span style={{fontSize:9,padding:"3px 8px",borderRadius:20,background:"rgba(255,215,0,0.1)",color:"#ffd700",fontWeight:600,border:"1px solid rgba(255,215,0,0.2)"}}>⚡ {r.rvol.toFixed(1)}x</span>}
         {r.aboveVWAP&&<span style={{fontSize:9,padding:"3px 8px",borderRadius:20,background:"rgba(0,212,170,0.1)",color:"#00d4aa",border:"1px solid rgba(0,212,170,0.2)"}}>VWAP ↑</span>}
         {r.preGap>5&&<span style={{fontSize:9,padding:"3px 8px",borderRadius:20,background:"rgba(100,200,255,0.1)",color:"#64c8ff",border:"1px solid rgba(100,200,255,0.2)"}}>Gap +{r.preGap.toFixed(0)}%</span>}
       </div>
       <div style={{textAlign:"right",minWidth:80}}>
         <div style={{fontSize:18,fontWeight:700,color:"#fff",fontFamily:"monospace"}}>{f$(r.price)}</div>
         <div style={{fontSize:12,color:r.change_pct>=0?"#00d4aa":"#ff4757",fontWeight:600}}>{fp(r.change_pct)}</div>
       </div>
       <div style={{textAlign:"center",minWidth:44}}>
         <div style={{fontSize:20,fontWeight:800,color:scoreColor,fontFamily:"monospace",lineHeight:1}}>{r.score}</div>
         <ScoreBar score={r.score}/>
       </div>
       <span style={{color:"rgba(255,255,255,0.2)",fontSize:10,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block"}}>▼</span>
     </div>
     {open&&(
       <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",padding:"16px 18px"}}>
         <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
           {[{l:"EMA 9",v:r.ema9?f$(r.ema9):"—",c:"#a78bfa"},{l:"EMA 20",v:r.ema20?f$(r.ema20):"—",c:"#fbbf24"},{l:"VWAP",v:r.vwap?f$(r.vwap):"—",c:"#60a5fa"},{l:"RVOL",v:r.rvol.toFixed(1)+"x",c:"#fb923c"},{l:"حجم",v:((r.volume||0)/1e6).toFixed(1)+"M",c:"#34d399"}].map(i=>(
             <div key={i.l} style={{flex:1,minWidth:60,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"8px 10px"}}>
               <div style={{fontSize:8,color:"rgba(255,255,255,0.3)",marginBottom:3}}>{i.l}</div>
               <div style={{fontSize:13,color:i.c,fontWeight:700,fontFamily:"monospace"}}>{i.v}</div>
             </div>
           ))}
         </div>
         <div style={{background:"linear-gradient(135deg,rgba(255,71,87,0.1),rgba(255,71,87,0.05))",border:"1px solid rgba(255,71,87,0.2)",borderRadius:12,padding:"14px 16px",marginBottom:10}}>
           <div style={{fontSize:10,color:"#ff6b81",fontWeight:600,marginBottom:8}}>🛑 وقف الخسارة</div>
           <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
             <span style={{fontSize:22,fontWeight:700,color:"#ff4757",fontFamily:"monospace"}}>{f$(r.levels.sl)}</span>
             <div style={{textAlign:"right"}}>
               <div style={{fontSize:14,color:"#ff6b81",fontWeight:600}}>{(r.levels.slPct).toFixed(2)}%</div>
               <div style={{fontSize:9,color:"rgba(255,107,129,0.5)"}}>مخاطرة: {f$(r.levels.risk)}</div>
             </div>
           </div>
         </div>
         <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
           {[{n:1,v:r.levels.t1,p:15,l:"TP1",c:"#60a5fa",bg:"rgba(96,165,250,0.08)",border:"rgba(96,165,250,0.2)"},{n:2,v:r.levels.t2,p:30,l:"TP2",c:"#34d399",bg:"rgba(52,211,153,0.08)",border:"rgba(52,211,153,0.2)"},{n:3,v:r.levels.t3,p:50,l:"TP3",c:"#fbbf24",bg:"rgba(251,191,36,0.08)",border:"rgba(251,191,36,0.2)"}].map(t=>(
             <div key={t.n} style={{background:t.bg,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px"}}>
               <div style={{fontSize:9,color:t.c,fontWeight:600,marginBottom:4}}>{t.l} <span style={{opacity:0.6}}>+{t.p}%</span></div>
               <div style={{fontSize:16,fontWeight:700,color:t.c,fontFamily:"monospace"}}>{f$(t.v)}</div>
             </div>
           ))}
         </div>
       </div>
     )}
   </div>
 );
}

export default function Radar(){
 const[results,setResults]=useState([]);
 const[loading,setLoading]=useState(false);
 const[total,setTotal]=useState(0);
 const[done,setDone]=useState(false);
 const[filter,setFilter]=useState("all");
 const[status,setStatus]=useState(null); // null | "ok" | "error" | "closed"
 const[lastUpdate,setLastUpdate]=useState(null);

 const scan=async()=>{
   setLoading(true);setResults([]);setDone(false);setStatus(null);
   try{
     const r=await fetch("/api/scan");
     if(!r.ok){setStatus("error");setLoading(false);setDone(true);return;}
     const d=await r.json();
     if(d.error){setStatus("error");setLoading(false);setDone(true);return;}
     setResults(d.results||[]);
     setTotal(d.total||0);
     setLastUpdate(new Date());
     // تحقق من وقت السوق
     const now=new Date();
     const et=new Date(now.toLocaleString("en-US",{timeZone:"America/New_York"}));
     const h=et.getHours(),m=et.getMinutes(),day=et.getDay();
     const isWeekend=day===0||day===6;
     const isMarketHours=!isWeekend&&(h>9||(h===9&&m>=30))&&h<16;
     const isPreMarket=!isWeekend&&h>=4&&(h<9||(h===9&&m<30));
     if(isWeekend||(h>=16||h<4))setStatus("closed");
     else if(isPreMarket)setStatus("premarket");
     else setStatus("ok");
   }catch(e){
     setStatus("error");
   }
   setLoading(false);setDone(true);
 };

 const filtered=results.filter(r=>{
   if(filter==="explosive")return r.score>=80;
   if(filter==="high")return r.score>=60&&r.score<80;
   if(filter==="watch")return r.score<60;
   return true;
 });
 const explosive=results.filter(r=>r.score>=80).length;
 const high=results.filter(r=>r.score>=60&&r.score<80).length;

 const statusBanner=()=>{
   if(!done&&!loading)return null;
   if(status==="error")return(
     <div style={{background:"rgba(255,71,87,0.1)",border:"1px solid rgba(255,71,87,0.3)",borderRadius:10,padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
       <span style={{fontSize:16}}>🔴</span>
       <div>
         <div style={{fontSize:12,color:"#ff4757",fontWeight:700}}>خطأ في الاتصال</div>
         <div style={{fontSize:10,color:"rgba(255,71,87,0.7)"}}>تعذر الاتصال بـ Polygon API — تحقق من الـ Key</div>
       </div>
     </div>
   );
   if(status==="closed")return(
     <div style={{background:"rgba(255,215,0,0.08)",border:"1px solid rgba(255,215,0,0.2)",borderRadius:10,padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
       <span style={{fontSize:16}}>🟡</span>
       <div>
         <div style={{fontSize:12,color:"#ffd700",fontWeight:700}}>السوق مغلق</div>
         <div style={{fontSize:10,color:"rgba(255,215,0,0.7)"}}>يفتح 4:30م بتوقيت الرياض — البيانات من آخر جلسة</div>
       </div>
     </div>
   );
   if(status==="premarket")return(
     <div style={{background:"rgba(100,200,255,0.08)",border:"1px solid rgba(100,200,255,0.2)",borderRadius:10,padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
       <span style={{fontSize:16}}>🔵</span>
       <div>
         <div style={{fontSize:12,color:"#64c8ff",fontWeight:700}}>Pre-Market نشط</div>
         <div style={{fontSize:10,color:"rgba(100,200,255,0.7)"}}>بيانات محدودة — أفضل النتائج بعد 4:30م</div>
       </div>
     </div>
   );
   if(status==="ok")return(
     <div style={{background:"rgba(0,212,170,0.08)",border:"1px solid rgba(0,212,170,0.2)",borderRadius:10,padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
       <div style={{display:"flex",alignItems:"center",gap:8}}>
         <span style={{fontSize:16}}>🟢</span>
         <div>
           <div style={{fontSize:12,color:"#00d4aa",fontWeight:700}}>متصل — أسعار حية</div>
           <div style={{fontSize:10,color:"rgba(0,212,170,0.7)"}}>Polygon API يعمل بشكل طبيعي</div>
         </div>
       </div>
       {lastUpdate&&<div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>آخر تحديث: {lastUpdate.toLocaleTimeString("ar")}</div>}
     </div>
   );
   return null;
 };

 return(
   <div style={{minHeight:"100vh",background:"#080c18",fontFamily:"system-ui",color:"#fff",position:"relative",overflow:"hidden"}}>
     <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none"}}>
       <div style={{position:"absolute",top:"10%",left:"50%",transform:"translateX(-50%)",width:600,height:600,background:"radial-gradient(circle,rgba(99,102,241,0.06) 0%,transparent 70%)",borderRadius:"50%"}}/>
       <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)",backgroundSize:"50px 50px"}}/>
     </div>
     <div style={{position:"relative",zIndex:1,maxWidth:920,margin:"0 auto",padding:"24px 16px"}}>
       <div style={{textAlign:"center",marginBottom:32,paddingBottom:24,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
         <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:10}}>
           <div style={{width:10,height:10,borderRadius:"50%",background:loading?"#ffd700":status==="ok"?"#00d4aa":status==="error"?"#ff4757":"#6366f1",boxShadow:`0 0 16px ${loading?"#ffd700":status==="ok"?"#00d4aa":status==="error"?"#ff4757":"#6366f1"}`}}/>
           <h1 style={{margin:0,fontSize:28,fontWeight:900,letterSpacing:2,color:"#fff"}}>
             RADAR <span style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>AZ</span>
           </h1>
           <span style={{fontSize:10,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:4,padding:"3px 8px",color:"#fff",fontWeight:700,letterSpacing:1}}>PRO</span>
         </div>
         <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.35)",letterSpacing:1}}>أسهم أمريكية شرعية · ماركت كاب &lt; $500M · تحليل لحظي</p>
       </div>
       <div style={{display:"flex",gap:10,marginBottom:24,flexWrap:"wrap"}}>
         {[{l:"نطاق الفحص",v:total||100,c:"#6366f1",bg:"rgba(99,102,241,0.1)",border:"rgba(99,102,241,0.2)"},{l:"💥 انفجاري",v:explosive,c:"#ff6b35",bg:"rgba(255,107,53,0.1)",border:"rgba(255,107,53,0.2)"},{l:"🔥 عالي",v:high,c:"#ffd700",bg:"rgba(255,215,0,0.1)",border:"rgba(255,215,0,0.2)"},{l:"✅ الكل",v:results.length,c:"#00d4aa",bg:"rgba(0,212,170,0.1)",border:"rgba(0,212,170,0.2)"}].map(s=>(
           <div key={s.l} style={{flex:1,minWidth:80,background:s.bg,border:`1px solid ${s.border}`,borderRadius:14,padding:"14px 16px",textAlign:"center"}}>
             <div style={{fontSize:26,fontWeight:900,color:s.c,fontFamily:"monospace",lineHeight:1}}>{s.v}</div>
             <div style={{fontSize:9,color:s.c,opacity:0.7,marginTop:4}}>{s.l}</div>
           </div>
         ))}
       </div>
       <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
         <button onClick={scan} disabled={loading} style={{flex:1,background:loading?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#6366f1,#8b5cf6)",border:loading?"1px solid rgba(255,255,255,0.1)":"none",borderRadius:14,padding:"14px 28px",color:loading?"rgba(255,255,255,0.3)":"#fff",fontWeight:800,fontSize:14,cursor:loading?"not-allowed":"pointer",letterSpacing:1,boxShadow:loading?"none":"0 8px 32px rgba(99,102,241,0.4)"}}>
           {loading?"⟳  جاري المسح اللحظي...":"📡  ابدأ مسح السوق الفوري"}
         </button>
         {results.length>0&&(
           <div style={{display:"flex",gap:6}}>
             {[{id:"all",l:"الكل"},{id:"explosive",l:"💥"},{id:"high",l:"🔥"},{id:"watch",l:"👀"}].map(f=>(
               <button key={f.id} onClick={()=>setFilter(f.id)} style={{background:filter===f.id?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.05)",border:`1px solid ${filter===f.id?"rgba(99,102,241,0.5)":"rgba(255,255,255,0.08)"}`,borderRadius:10,padding:"10px 14px",color:filter===f.id?"#a5b4fc":"rgba(255,255,255,0.4)",fontSize:12,fontWeight:600,cursor:"pointer"}}>{f.l}</button>
             ))}
           </div>
         )}
       </div>
       {loading&&<div style={{height:2,background:"rgba(255,255,255,0.05)",borderRadius:2,marginBottom:16,overflow:"hidden"}}><div style={{height:"100%",width:"65%",background:"linear-gradient(90deg,#6366f1,#8b5cf6)",borderRadius:2}}/></div>}
       {statusBanner()}
       {filtered.length>0&&(
         <>
           <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
             <div style={{height:1,flex:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.08))"}}/>
             <span style={{fontSize:11,color:"rgba(255,255,255,0.25)",letterSpacing:1}}>{filtered.length} فرصة</span>
             <div style={{height:1,flex:1,background:"linear-gradient(90deg,rgba(255,255,255,0.08),transparent)"}}/>
           </div>
           {filtered.map((r,i)=><Card key={r.symbol} r={r} idx={i}/>)}
         </>
       )}
       {done&&results.length===0&&(
         <div style={{textAlign:"center",padding:"64px 20px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:20}}>
           <div style={{fontSize:48,marginBottom:16}}>📡</div>
           <div style={{fontSize:16,fontWeight:700,color:"rgba(255,255,255,0.7)",marginBottom:8}}>لا توجد فرص حالياً</div>
           <div style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>السوق يفتح 4:30م بتوقيت الرياض</div>
         </div>
       )}
       <div style={{marginTop:32,paddingTop:16,borderTop:"1px solid rgba(255,255,255,0.04)",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
         <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.2)",letterSpacing:2,fontFamily:"monospace"}}>RADAR AZ PRO</span>
         <span style={{fontSize:10,color:"rgba(255,255,255,0.15)",fontStyle:"italic"}}>أسهم شرعية · ليست نصيحة استثمارية</span>
       </div>
     </div>
     <style>{`*{box-sizing:border-box;}::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#080c18;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px;}button:hover:not(:disabled){filter:brightness(1.1);}`}</style>
   </div>
 );
}
