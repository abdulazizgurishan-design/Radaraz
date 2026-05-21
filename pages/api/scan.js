// ══════════════════════════════════════════════════════

// API Route — يشتغل على السيرفر (بدون CORS)

// الـ Key مخفي تماماً عن العميل

// ══════════════════════════════════════════════════════

const POLYGON_KEY = process.env.POLYGON_API_KEY;

const HALAL_STOCKS = [

  "NVDA","AMD","TSLA","AMZN","META","PLTR","SOFI","RIVN","SOUN","ASTS",

  "AFRM","NIO","XPEV","HIMS","IONQ","RKLB","HOOD","UPST","STEM","BLNK",

  "PLUG","SPWR","GFAI","WKHS","CLOV","NKLA","BNGO","MVIS","GOVX","CETX",

];

function calcEMA(prices, p) {

  if (prices.length < p) return null;

  const k = 2/(p+1);

  let e = prices.slice(0,p).reduce((a,b)=>a+b,0)/p;

  for(let i=p;i<prices.length;i++) e=prices[i]*k+e*(1-k);

  return e;

}

function calcATR(candles, p=10) {

  if(candles.length<p+1) return null;

  const trs=[];

  for(let i=1;i<candles.length;i++){

    const h=candles[i].h,l=candles[i].l,pc=candles[i-1].c;

    trs.push(Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc)));

  }

  return trs.slice(-p).reduce((a,b)=>a+b,0)/p;

}

function detectDowntrend(candles, lb=20) {

  const r=candles.slice(-lb), peaks=[];

  for(let i=1;i<r.length-1;i++)

    if(r[i].h>r[i-1].h&&r[i].h>r[i+1].h) peaks.push({idx:i,price:r[i].h});

  if(peaks.length<2) return null;

  const p1=peaks[peaks.length-2], p2=peaks[peaks.length-1];

  if(p2.price>=p1.price) return null;

  const slope=(p2.price-p1.price)/(p2.idx-p1.idx);

  return {trendLine:p2.price+slope*(r.length-1-p2.idx), peaks};

}

function findResistances(candles, price) {

  const r=candles.slice(-40), peaks=[];

  for(let i=2;i<r.length-2;i++)

    if(r[i].h>r[i-1].h&&r[i].h>r[i-2].h&&r[i].h>r[i+1].h&&r[i].h>r[i+2].h&&r[i].h>price)

      peaks.push(r[i].h);

  return peaks.sort((a,b)=>a-b).filter((v,i,arr)=>i===0||(v-arr[i-1])/arr[i-1]>0.01).slice(0,3);

}

function analyze(symbol, candles) {

  if(!candles||candles.length<25) return null;

  const closes=candles.map(c=>c.c);

  const last=candles[candles.length-1], prev=candles[candles.length-2];

  const price=last.c;

  if(Math.abs(last.c-last.o)/last.o*100>15) return null;

  if(price<0.50) return null;

  const ema20=calcEMA(closes,20), prevEma=calcEMA(closes.slice(0,-1),20);

  if(!ema20||!prevEma) return null;

  if(!(prev.c<=prevEma&&last.c>ema20)) return null;

  const avgVol=candles.slice(-21,-1).map(c=>c.v).reduce((a,b)=>a+b,0)/20;

  const volRatio=avgVol>0?last.v/avgVol:1;

  if(volRatio<0.8) return null;

  const ema2=calcEMA(closes.slice(0,-2),20);

  const emaTurning=ema20>prevEma&&prevEma>=(ema2||prevEma);

  const trendData=detectDowntrend(candles);

  const brokeDowntrend=trendData?prev.c<=trendData.trendLine&&last.c>trendData.trendLine:false;

  const score=Math.min(10,2+(volRatio>1.5?3:volRatio>1?2:1)+(brokeDowntrend?3:0)+(emaTurning?2:0));

  const slEMA=ema20-(calcATR(candles)||price*0.01)*0.3, slLow=last.l*0.998;

  const sl=Math.max(slEMA,slLow), risk=price-sl;

  if(risk<=0) return null;

  const res=findResistances(candles,price);

  const swingLow=Math.min(...candles.slice(-30).map(c=>c.l));

  const swingHigh=trendData?.peaks?.length?Math.max(...trendData.peaks.map(p=>p.price)):Math.max(...candles.slice(-30).map(c=>c.h));

  const t1=res[0]||price+risk, t2=res[1]||swingHigh||price+risk*2;

  const t3=res[2]||(swingHigh+(swingHigh-swingLow)*0.618)||price+risk*3;

  const dayOpen=candles.find(c=>{const d=new Date(c.t);return d.getHours()>=9&&d.getMinutes()>=30})?.o||candles[0].o;

  return {

    symbol, price, score:+score.toFixed(1),

    change_pct:((price-dayOpen)/dayOpen)*100,

    volume:last.v, avg_volume:avgVol, volRatio,

    ema_turning:emaTurning, broke_downtrend:brokeDowntrend,

    levels:{

      sl, slPct:((sl-price)/price)*100, risk,

      t1, t1Pct:((t1-price)/price)*100, t1_type:res[0]?"مقاومة":"1:1",

      t2, t2Pct:((t2-price)/price)*100, t2_type:res[1]?"قمة الترند":"1:2",

      t3, t3Pct:((t3-price)/price)*100, t3_type:res[2]?"فيبو 161.8%":"فيبو",

    },

    candles: candles.slice(-20),

    marketCapM: null, volatility: null,

  };

}

async function fetchCandles(symbol) {

  const now=new Date(), to=now.toISOString().split("T")[0];

  const from=new Date(now-5*86400000).toISOString().split("T")[0];

  const url=`https://api.polygon.io/v2/aggs/ticker/${symbol}/range/15/minute/${from}/${to}?adjusted=true&sort=asc&limit=80&apiKey=${POLYGON_KEY}`;

  const r=await fetch(url);

  if(!r.ok) return null;

  const d=await r.json();

  return d.results?.length>=25?d.results:null;

}

async function fetchMarketCap(symbol) {

  try {

    const r=await fetch(`https://api.polygon.io/v3/reference/tickers/${symbol}?apiKey=${POLYGON_KEY}`);

    if(!r.ok) return null;

    const d=await r.json();

    const mc=d.results?.market_cap;

    return mc?mc/1e6:null;

  } catch { return null; }

}

function getVolatilityTier(mcM) {

  if(!mcM||mcM<=0) return null;

  if(mcM<100)  return {label:"⚡ عالية التذبذب",  short:"عالية",  bg:"#fef3c7",text:"#b45309",border:"#fde68a",dot:"#f59e0b"};

  if(mcM<500)  return {label:"〰 متوسطة التذبذب", short:"متوسطة", bg:"#eff6ff", text:"#1d4ed8",border:"#bfdbfe",dot:"#3b82f6"};

  return               {label:"🏦 مستقرة · للاستثمار",short:"مستقرة",bg:"#f0fdf4", text:"#15803d",border:"#bbf7d0",dot:"#10b981"};

}

export default async function handler(req, res) {

  if(req.method!=="GET") return res.status(405).end();

  if(!POLYGON_KEY) return res.status(500).json({error:"POLYGON_API_KEY not set"});

  const results=[];

  // نفحص الأسهم بالتوازي بدفعات (5 في المرة للخطة المجانية)

  for(let i=0;i<HALAL_STOCKS.length;i+=5){

    const batch=HALAL_STOCKS.slice(i,i+5);

    const batchResults=await Promise.allSettled(

      batch.map(async sym=>{

        const candles=await fetchCandles(sym);

        if(!candles) return null;

        const analysis=analyze(sym,candles);

        if(!analysis) return null;

        const mcM=await fetchMarketCap(sym);

        analysis.marketCapM=mcM;

        analysis.volatility=getVolatilityTier(mcM);

        return analysis;

      })

    );

    batchResults.forEach(r=>{ if(r.status==="fulfilled"&&r.value) results.push(r.value); });

    if(i+5<HALAL_STOCKS.length) await new Promise(r=>setTimeout(r,61000)); // انتظر دقيقة بين كل دفعة

  }

  res.status(200).json({results, scannedAt:new Date().toISOString(), total:HALAL_STOCKS.length});

}
 
