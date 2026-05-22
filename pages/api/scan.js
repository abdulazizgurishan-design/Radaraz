const TIINGO_KEY = process.env.TIINGO_API_KEY;

// ✅ قائمة محققة يدوياً — شرعية + ماركت كاب < $200M
const WATCHLIST = [
  // Biotech صغيرة < $200M
  "GOVX","CETX","ATNF","BFRI","IMRN","DARE","EYES","SURF","CTIC","SGBX",
  "SHOT","RNAZ","DTSS","AITX","RGTI","QUBT","SEER","CERE","CAPR","DVAX",
  "EVGN","FOLD","HUMA","IOVA","JANX","KRTX","MNKD","MORF","OCGN","ORIC",
  "PCVX","PLRX","PRLD","PTGX","QURE","RCUS","RIGL","RLAY","RPTX","RYTM",
  "SANA","URGN","VCEL","VERV","XENE","YMAB","ZYME","AUPH","ARCT","ATRA",

  // Tech صغيرة < $200M
  "SOUN","BNGO","MVIS","AEYE","LIDR","CPTN","ASTR","BBAI","MIND","KGEI",
  "ZPTA","INVZ","VLDR","OUST","LAZR","BKSY","MNTS","SPCE","ARQQ","QBTS",

  // Energy / Cleantech < $200M
  "GFAI","WKHS","SOLO","IDEX","ILUS","REED","NURO","LPTX","AGEN","MMAT",
];

function calcEMA(p,n){if(p.length<n)return null;const k=2/(n+1);let e=p.slice(0,n).reduce((a,b)=>a+b,0)/n;for(let i=n;i<p.length;i++)e=p[i]*k+e*(1-k);return e;}
function calcVWAP(c){let tv=0,v=0;for(const x of c){const tp=(x.h+x.l+x.c)/3;tv+=tp*x.v;v+=x.v;}return v>0?tv/v:null;}

function analyze(sym,candles){
  if(!candles||candles.length<20)return null;
  const last=candles[candles.length-1],prev=candles[candles.length-2],price=last.c;
  if(!price||price<0.5||price>50)return null;
  const cl=candles.map(c=>c.c);
  const ema9=calcEMA(cl,9),ema20=calcEMA(cl,20),prevEma20=calcEMA(cl.slice(0,-1),20);
  if(!ema20||!prevEma20)return null;
  const vwap=calcVWAP(candles);
  const avgVol=candles.slice(-11,-1).map(c=>c.v).reduce((a,b)=>a+b,0)/10;
  const rvol=avgVol>0?last.v/avgVol:1;
  const crossedEMA=prev.c<=prevEma20&&last.c>ema20;
  const aboveVWAP=vwap?price>vwap:false;
  if(!crossedEMA&&!(aboveVWAP&&rvol>2)&&!(last.c>prev.c&&rvol>3))return null;
  if(last.v<500000)return null;
  const dayOpen=candles.find(c=>{const d=new Date(c.t);return d.getHours()>=9&&d.getMinutes()>=30})?.o||candles[0].o;
  const change_pct=((price-dayOpen)/dayOpen)*100;
  const prevClose=candles[candles.length-2]?.c||dayOpen;
  const preGap=((dayOpen-prevClose)/prevClose)*100;
  let score=30;
  if(crossedEMA)score+=20;
  if(aboveVWAP)score+=15;
  if(rvol>3)score+=15;else if(rvol>2)score+=8;
  if(preGap>5)score+=15;
  if(change_pct>5)score+=5;
  score=Math.min(score,100);
  const confidence=score>=80?"💥 انفجاري":score>=60?"🔥 عالي":"👀 مراقبة";
  const dayLow=Math.min(...candles.slice(-5).map(c=>c.l));
  const sl=Math.max(dayLow*0.995,vwap?vwap*0.997:dayLow*0.995);
  const risk=price-sl;
  if(risk<=0)return null;
  return{
    symbol:sym,price,score,confidence,
    change_pct,preGap,rvol,
    move:Math.abs(last.c-last.o)/last.o*100,
    ema9,ema20,vwap,aboveVWAP,
    brokeResistance:crossedEMA,
    crossedEMA,newsGood:false,news:null,
    marketCap:null,float:null,isHalal:true,
    levels:{
      sl,slPct:((sl-price)/price)*100,risk,
      t1:price*1.15,t1Pct:15,
      t2:price*1.30,t2Pct:30,
      t3:price*1.50,t3Pct:50,
    },
    candles:candles.slice(-20),
  };
}

async function fetchCandles(sym){
  try{
    const now=new Date(),end=now.toISOString(),start=new Date(now-3*86400000).toISOString();
    const r=await fetch(`https://api.tiingo.com/iex/${sym}/prices?startDate=${start}&endDate=${end}&resampleFreq=15min&token=${TIINGO_KEY}`,{headers:{"Content-Type":"application/json"}});
    if(!r.ok)return null;
    const d=await r.json();
    if(!d||d.length<20)return null;
    return d.map(b=>({t:new Date(b.date).getTime(),o:b.open||b.close,h:b.high||b.close,l:b.low||b.close,c:b.close,v:b.volume||0}));
  }catch{return null;}
}

export default async function handler(req,res){
  if(!TIINGO_KEY)return res.status(500).json({error:"No TIINGO_API_KEY"});
  const results=await Promise.allSettled(WATCHLIST.map(async sym=>{
    const c=await fetchCandles(sym);
    if(!c)return null;
    return analyze(sym,c);
  }));
  const found=results.filter(r=>r.status==="fulfilled"&&r.value).map(r=>r.value).sort((a,b)=>b.score-a.score);
  res.status(200).json({results:found,total:WATCHLIST.length,scannedAt:new Date().toISOString()});
}
