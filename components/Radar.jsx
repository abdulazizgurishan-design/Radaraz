const TIINGO_KEY = process.env.TIINGO_API_KEY;
const FMP_KEY    = process.env.FMP_API_KEY;

const HARAM_KEYWORDS = ["bank","casino","gambling","alcohol","tobacco","adult","porn","mortgage","insurance","lending","credit","financial","reit","brewery","winery","spirits"];
const BAD_NEWS  = ["offering","dilution","reverse split","bankruptcy","investigation","fraud","sec probe"];
const GOOD_NEWS = ["fda","approval","contract","merger","acquisition","earnings beat","partnership","ai","defense","grant","breakthrough","debt reduction"];

const WATCHLIST = [
  "SOUN","BNGO","MVIS","EYES","DARE","GOVX","CETX","ATNF","ALBT","BFRI",
  "IMRN","SGBX","SHOT","ADTX","AULT","CODA","SIGA","IDEX","SOLO","MGNI",
  "AGEN","MMAT","MNMD","NURO","LPTX","GFAI","WKHS","INKW","CLOV","NKLA",
  "ILUS","EDTK","CRTX","ADXN","HOFV","SURF","CTIC","FRLN","MVST","NCTY",
  "RNAZ","REED","AEYE","LIDR","VLDR","INVZ","OUST","LAZR","CPTN","ASTR",
  "MNTS","BKSY","SPCE","ZPTA","DTSS","AITX","BBAI","MIND","RGTI","ARQQ",
  "QBTS","IQM","QUBT","SEER","CERE","REPL","RXRX","BEAM","NTLA","EDIT",
  "SAGE","ACAD","AXSM","PRAX","KROS","ARQT","IMVT","FULC","VERA","RCKT",
  "AKRO","ARWR","AVXL","BBIO","CAPR","CLDX","COGT","CRIS","DCPH","DICE",
  "DVAX","EIGR","EVGN","EVLO","FGEN","FOLD","GRCL","GRTS","HUMA","IBRX",
  "IOVA","IPSC","ISEE","ITCI","JANX","KALA","KDNY","KRTX","KYMR","LBPH",
  "MGNX","MIRM","MNKD","MORF","MRNS","MRTX","NRIX","NUVL","OCGN","ONCR",
  "ORIC","ORPH","ORTX","OSUR","PCVX","PLRX","PMVP","PRLD","PTGX","QURE",
  "RAPT","RCEL","RCUS","RETA","RIGL","RLAY","RLMD","RPTX","RVNC","RXDX",
  "RYTM","SANA","SNDX","SRPT","STOK","TWST","TYRA","URGN","VCEL","VCNX",
  "VERV","VKTX","VNDA","VRNA","VSTM","XBIT","XENE","XERS","YMAB","ZGEN",
  "ZLAB","ZNTL","ZYME","AMRX","ANIK","ANIP","APLS","ARCT","ARDX","ARVN",
  "ASRT","ATNX","ATRA","ATTX","AUPH","AVEO","AVIR","AZTA","BAND","BCDA",
  "BEAM","BCRX","BDTX","BGNE","BNTX","BTAI","BYSI","CADL","CCCC","CDTX",
  "CELC","CGEM","CHRS","CLLS","CMPS","CNTA","CNTG","COCP","CRDF","CRVS",
];

function calcEMA(p,n){if(p.length<n)return null;const k=2/(n+1);let e=p.slice(0,n).reduce((a,b)=>a+b,0)/n;for(let i=n;i<p.length;i++)e=p[i]*k+e*(1-k);return e;}
function calcVWAP(c){let tv=0,v=0;for(const x of c){const tp=(x.h+x.l+x.c)/3;tv+=tp*x.v;v+=x.v;}return v>0?tv/v:null;}
function calcATR(c,n=10){if(c.length<n+1)return null;const t=[];for(let i=1;i<c.length;i++){const h=c[i].h,l=c[i].l,p=c[i-1].c;t.push(Math.max(h-l,Math.abs(h-p),Math.abs(l-p)));}return t.slice(-n).reduce((a,b)=>a+b,0)/n;}
function findRes(c,price){const h=c.slice(-30).map(x=>x.h).filter(x=>x>price);return h.length?Math.min(...h):null;}

function isHalal(f){
  if(!f)return true;
  if(f.isOTC)return false;
  if(!f.revenue||f.revenue<=0)return false;
  if(f.debtRatio>0.3)return false;
  const t=`${f.sector||""} ${f.industry||""} ${f.description||""}`;
  return !HARAM_KEYWORDS.some(k=>t.includes(k));
}

function calcScore({halal,float,news,rvol,aboveVWAP,brokeRes,preGap,marketCap}){
  let s=0;
  if(halal)s+=25;
  if(float&&float<5)s+=20;else if(float&&float<10)s+=10;
  if(news?.good)s+=20;
  if(rvol>5)s+=15;else if(rvol>3)s+=10;
  if(aboveVWAP)s+=10;
  if(brokeRes)s+=10;
  if(preGap>10)s+=10;
  if(marketCap&&marketCap<50)s+=5;
  return Math.min(s,100);
}

function analyze(sym,candles,fund,news){
  if(!candles||candles.length<25)return null;
  const last=candles[candles.length-1],prev=candles[candles.length-2],price=last.c;
  if(price<1||price>15)return null;
  const move=Math.abs(last.c-last.o)/last.o*100;
  if(move>40||move<5)return null;
  const cl=candles.map(c=>c.c);
  const ema9=calcEMA(cl,9),ema20=calcEMA(cl,20),prevEma20=calcEMA(cl.slice(0,-1),20);
  if(!ema20||!prevEma20)return null;
  const vwap=calcVWAP(candles);
  const avgVol=candles.slice(-21,-1).map(c=>c.v).reduce((a,b)=>a+b,0)/20;
  const rvol=avgVol>0?last.v/avgVol:1;
  const aboveVWAP=vwap?price>vwap:false;
  const res=findRes(candles,price);
  const brokeRes=res?prev.c<=res&&last.c>res:false;
  const crossedEMA=prev.c<=prevEma20&&last.c>ema20;
  if(!crossedEMA&&!(aboveVWAP&&rvol>3)&&!brokeRes)return null;
  if(last.v<1000000||rvol<3)return null;
  if(news?.bad)return null;
  const dayOpen=candles.find(c=>{const d=new Date(c.t);return d.getHours()>=9&&d.getMinutes()>=30})?.o||candles[0].o;
  const prevClose=candles[candles.length-2]?.c||dayOpen;
  const preGap=((dayOpen-prevClose)/prevClose)*100;
  const halal=isHalal(fund);
  const score=calcScore({halal,float:fund?.float,news,rvol,aboveVWAP,brokeRes,preGap,marketCap:fund?.marketCap});
  if(score<50)return null;
  const dayLow=Math.min(...candles.slice(-8).map(c=>c.l));
  const sl=vwap?Math.max(dayLow*0.998,vwap*0.998):dayLow*0.998;
  const risk=price-sl;if(risk<=0)return null;
  const confidence=score>=90?"💥 انفجاري":score>=70?"🔥 عالي":"👀 مراقبة";
  return{symbol:sym,price,score,confidence,change_pct:((price-dayOpen)/dayOpen)*100,
    preGap,rvol,move,ema9,ema20,vwap,aboveVWAP,brokeResistance:brokeRes,crossedEMA,
    news:news?.headline,newsGood:news?.good,marketCap:fund?.marketCap,float:fund?.float,isHalal:halal,
    levels:{sl,slPct:((sl-price)/price)*100,risk,t1:price*1.15,t1Pct:15,t2:price*1.30,t2Pct:30,t3:price*1.50,t3Pct:50},
    candles:candles.slice(-20)};
}

async function fetchCandles(sym){
  try{
    const now=new Date(),end=now.toISOString(),start=new Date(now-3*86400000).toISOString();
    const r=await fetch(`https://api.tiingo.com/iex/${sym}/prices?startDate=${start}&endDate=${end}&resampleFreq=15min&token=${TIINGO_KEY}`,{headers:{"Content-Type":"application/json"}});
    if(!r.ok)return null;
    const d=await r.json();
    if(!d||d.length<25)return null;
    return d.map(b=>({t:new Date(b.date).getTime(),o:b.open||b.close,h:b.high||b.close,l:b.low||b.close,c:b.close,v:b.volume||0}));
  }catch{return null;}
}

async function fetchNews(sym){
  try{
    const r=await fetch(`https://api.tiingo.com/tiingo/news?tickers=${sym}&limit=3&token=${TIINGO_KEY}`,{headers:{"Content-Type":"application/json"}});
    if(!r.ok)return{good:false,bad:false,headline:null};
    const d=await r.json();
    if(!d?.length)return{good:false,bad:false,headline:null};
    const text=(d[0].title||"").toLowerCase();
    return{good:GOOD_NEWS.some(k=>text.includes(k)),bad:BAD_NEWS.some(k=>text.includes(k)),headline:d[0].title};
  }catch{return{good:false,bad:false,headline:null};}
}

async function fetchFund(sym){
  if(!FMP_KEY)return null;
  try{
    const r=await fetch(`https://financialmodelingprep.com/api/v3/profile/${sym}?apikey=${FMP_KEY}`);
    if(!r.ok)return null;
    const d=await r.json();
    if(!d?.[0])return null;
    return{marketCap:d[0].mktCap/1e6,float:(d[0].sharesOutstanding*d[0].price)/1e6,sector:(d[0].sector||"").toLowerCase(),industry:(d[0].industry||"").toLowerCase(),revenue:d[0].revenueTTM,debtRatio:d[0].debtToEquity,isOTC:d[0].exchangeShortName==="OTC",description:(d[0].description||"").toLowerCase()};
  }catch{return null;}
}

export default async function handler(req,res){
  if(!TIINGO_KEY)return res.status(500).json({error:"No TIINGO_API_KEY"});
  const results=await Promise.allSettled(WATCHLIST.map(async sym=>{
    const[candles,news,fund]=await Promise.allSettled([fetchCandles(sym),fetchNews(sym),fetchFund(sym)]).then(r=>r.map(x=>x.status==="fulfilled"?x.value:null));
    if(!candles)return null;
    return analyze(sym,candles,fund,news);
  }));
  const found=results.filter(r=>r.status==="fulfilled"&&r.value).map(r=>r.value).sort((a,b)=>b.score-a.score);
  res.status(200).json({results:found,total:WATCHLIST.length,scannedAt:new Date().toISOString()});
}
