الكود كامل مع الـ Key — الصقه في pages/api/scan.js:
const POLYGON_KEY = "ZNfkvVZ46f53LayyNmA7a2dcfkJEZQqG";

";

const HALAL_WATCHLIST = [
  "SOUN","BNGO","MVIS","GOVX","CETX","ATNF","BFRI","DARE","EYES","SURF",
  "CTIC","SGBX","SHOT","RNAZ","DTSS","AITX","BBAI","RGTI","QUBT","SEER",
  "CERE","CAPR","DVAX","EVGN","FOLD","HUMA","IOVA","JANX","KRTX","MNKD",
  "MORF","OCGN","ORIC","PCVX","PLRX","PRLD","PTGX","QURE","RCUS","RIGL",
  "RLAY","RPTX","RYTM","SANA","URGN","VCEL","VERV","XENE","YMAB","ZYME",
  "AUPH","ARCT","ATRA","AEYE","LIDR","CPTN","ASTR","ARQQ","QBTS","INVZ",
  "OUST","LAZR","BKSY","MNTS","SPCE","ZPTA","GFAI","WKHS","SOLO","IDEX",
  "ILUS","NURO","LPTX","AGEN","MMAT","MNMD","MGNI","HOFV","ADTX","AULT",
  "CODA","SIGA","CIDM","IMRN","ALBT","FRLN","NCTY","CUEN","MVST","REED",
  "BCDA","AVEO","AVIR","COGT","CRIS","DCPH","DICE","EIGR","FGEN","FOLD",
];

function calcEMA(p,n){if(p.length<n)return null;const k=2/(n+1);let e=p.slice(0,n).reduce((a,b)=>a+b,0)/n;for(let i=n;i<p.length;i++)e=p[i]*k+e*(1-k);return e;}
function calcVWAP(c){let tv=0,v=0;for(const x of c){const tp=(x.h+x.l+x.c)/3;tv+=tp*x.v;v+=x.v;}return v>0?tv/v:null;}

function analyze(sym,candles,mcM){
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
  const priceUp=last.c>prev.c&&last.c>last.o;
  if(!crossedEMA&&!(aboveVWAP&&rvol>2)&&!(priceUp&&rvol>3))return null;
  if(last.v<300000)return null;
  const dayOpen=candles.find(c=>{const d=new Date(c.t);return d.getHours()>=9&&d.getMinutes()>=30})?.o||candles[0].o;
  const change_pct=((price-dayOpen)/dayOpen)*100;
  const prevClose=candles.length>1?candles[candles.length-2].c:dayOpen;
  const preGap=((dayOpen-prevClose)/prevClose)*100;
  let score=25;
  if(crossedEMA)score+=20;
  if(aboveVWAP)score+=15;
  if(rvol>5)score+=20;else if(rvol>3)score+=12;else if(rvol>2)score+=6;
  if(preGap>10)score+=15;else if(preGap>5)score+=8;
  if(change_pct>10)score+=5;
  if(mcM&&mcM<50)score+=5;
  score=Math.min(score,100);
  if(score<40)return null;
  const confidence=score>=80?"💥 انفجاري":score>=60?"🔥 عالي":"👀 مراقبة";
  const dayLow=Math.min(...candles.slice(-5).map(c=>c.l));
  const sl=vwap&&aboveVWAP?Math.max(dayLow*0.995,vwap*0.997):dayLow*0.995;
  const risk=price-sl;
  if(risk<=0)return null;
  return{symbol:sym,price,score,confidence,change_pct,preGap,rvol,move:Math.abs(last.c-last.o)/last.o*100,ema9,ema20,vwap,aboveVWAP,crossedEMA,volume:last.v,avgVolume:avgVol,marketCap:mcM,levels:{sl,slPct:((sl-price)/price)*100,risk,t1:price*1.15,t1Pct:15,t2:price*1.30,t2Pct:30,t3:price*1.50,t3Pct:50}};
}

async function fetchCandles(sym){
  try{
    const now=new Date(),to=now.toISOString().split("T")[0];
    const from=new Date(now-4*86400000).toISOString().split("T")[0];
    const r=await fetch(`https://api.polygon.io/v2/aggs/ticker/${sym}/range/15/minute/${from}/${to}?adjusted=true&sort=asc&limit=80&apiKey=${POLYGON_KEY}`);
    if(!r.ok)return null;
    const d=await r.json();
    if(!d.results||d.results.length<20)return null;
    return d.results;
  }catch{return null;}
}

async function fetchMarketCap(sym){
  try{
    const r=await fetch(`https://api.polygon.io/v3/reference/tickers/${sym}?apiKey=${POLYGON_KEY}`);
    if(!r.ok)return null;
    const d=await r.json();
    const mc=d.results?.market_cap;
    return mc?mc/1e6:null;
  }catch{return null;}
}

export default async function handler(req,res){
  const results=await Promise.allSettled(
    HALAL_WATCHLIST.map(async sym=>{
      const[candles,mcM]=await Promise.all([fetchCandles(sym),fetchMarketCap(sym)]);
      if(!candles)return null;
      return analyze(sym,candles,mcM);
    })
  );
  const found=results.filter(r=>r.status==="fulfilled"&&r.value).map(r=>r.value).sort((a,b)=>b.score-a.score);
  res.status(200).json({results:found,total:HALAL_WATCHLIST.length,scannedAt:new Date().toISOString()});
}


الصقه في GitHub → Commit ✅
