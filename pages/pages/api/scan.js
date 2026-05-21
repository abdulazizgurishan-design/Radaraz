const POLYGON_KEY = process.env.POLYGON_API_KEY;
const STOCKS = ["NVDA","AMD","TSLA","PLTR","SOFI","RIVN","SOUN","ASTS","AFRM","NIO","HIMS","IONQ","RKLB","HOOD","UPST","BNGO","MVIS","GOVX","CETX","SPWR"];

function calcEMA(p,n){if(p.length<n)return null;const k=2/(n+1);let e=p.slice(0,n).reduce((a,b)=>a+b,0)/n;for(let i=n;i<p.length;i++)e=p[i]*k+e*(1-k);return e;}
function calcATR(c,n=10){if(c.length<n+1)return null;const t=[];for(let i=1;i<c.length;i++){const h=c[i].h,l=c[i].l,p=c[i-1].c;t.push(Math.max(h-l,Math.abs(h-p),Math.abs(l-p)));}return t.slice(-n).reduce((a,b)=>a+b,0)/n;}
function analyze(sym,candles){
  if(!candles||candles.length<25)return null;
  const cl=candles.map(c=>c.c),last=candles[candles.length-1],prev=candles[candles.length-2],price=last.c;
  if(Math.abs(last.c-last.o)/last.o*100>15||price<0.5)return null;
  const e20=calcEMA(cl,20),pe=calcEMA(cl.slice(0,-1),20);
  if(!e20||!pe||!(prev.c<=pe&&last.c>e20))return null;
  const avg=candles.slice(-21,-1).map(c=>c.v).reduce((a,b)=>a+b,0)/20;
  const vr=avg>0?last.v/avg:1;
  if(vr<0.8)return null;
  const sl=Math.max(e20-(calcATR(candles)||price*0.01)*0.3,last.l*0.998);
  const risk=price-sl;if(risk<=0)return null;
  const open=candles.find(c=>{const d=new Date(c.t);return d.getHours()>=9&&d.getMinutes()>=30})?.o||candles[0].o;
  return{symbol:sym,price,change_pct:((price-open)/open)*100,volRatio:vr,ema20:e20,
    levels:{sl,slPct:((sl-price)/price)*100,risk,t1:price+risk,t1Pct:(risk/price)*100,t2:price+risk*2,t2Pct:(risk*2/price)*100,t3:price+risk*3,t3Pct:(risk*3/price)*100},
    candles:candles.slice(-20)};
}
async function fetch15min(sym){
  const now=new Date(),to=now.toISOString().split("T")[0],from=new Date(now-5*86400000).toISOString().split("T")[0];
  const r=await fetch(`https://api.polygon.io/v2/aggs/ticker/${sym}/range/15/minute/${from}/${to}?adjusted=true&sort=asc&limit=80&apiKey=${POLYGON_KEY}`);
  if(!r.ok)return null;const d=await r.json();return d.results?.length>=25?d.results:null;
}
export default async function handler(req,res){
  if(!POLYGON_KEY)return res.status(500).json({error:"No API key"});
  const results=[];
  for(let i=0;i<STOCKS.length;i+=5){
    const batch=STOCKS.slice(i,i+5);
    const br=await Promise.allSettled(batch.map(async s=>{const c=await fetch15min(s);if(!c)return null;return analyze(s,c);}));
    br.forEach(r=>{if(r.status==="fulfilled"&&r.value)results.push(r.value);});
    if(i+5<STOCKS.length)await new Promise(r=>setTimeout(r,61000));
  }
  res.status(200).json({results,total:STOCKS.length,scannedAt:new Date().toISOString()});
}
