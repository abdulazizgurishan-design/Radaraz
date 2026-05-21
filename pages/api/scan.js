const TIINGO_KEY = process.env.TIINGO_API_KEY;

const STOCKS = [
 "SOUN","BNGO","MVIS","EYES","DARE","GOVX","CETX","ATNF","ALBT","BFRI",
 "IMRN","SGBX","SHOT","ADTX","AULT","CODA","SIGA","IDEX","CIDM","SOLO",
 "MGNI","AGEN","MMAT","MNMD","NURO","LPTX","GFAI","WKHS","INKW","TPVG",
 "CLOV","NKLA","ILUS","PEGY","EDTK","CRTX","ADXN","HOFV","PBAX","SURF",
 "CTIC","FRLN","MVST","NCTY","CUEN","BNXG","RNAZ","REED","AEYE","LIDR",
 "VLDR","INVZ","OUST","LAZR","CPTN","ASTR","MNTS","BKSY","SPCE","ZPTA",
 "DTSS","AITX","BBAI","MIND","KGEI","RGTI","ARQQ","QBTS","IQM","QUBT",
 "SEER","CERE","REPL","RXRX","BEAM","CRSP","NTLA","EDIT","FATE","BLUE",
 "SAGE","ACAD","AXSM","INVA","PRAX","KROS","ARQT","IMVT","FULC","VERA",
 "RCKT","IRON","TWST","AKRO","ALNY","ARWR","AVXL","BBIO","BCYC","BOLT",
 "CABA","CAPR","CLDX","CMRX","COGT","CRIS","CYTO","DCPH","DICE","DRIO",
 "DTIL","DVAX","EIGR","ELOX","ENLV","ETON","EVGN","EVLO","FFIE","FGEN",
 "FOLD","GOSS","GRCL","GRTS","GTHX","HALO","HOOK","HUMA","IBRX","IDRA",
 "IFRX","IGMS","IMAB","IMCR","IMGN","IMMP","IMTX","IOVA","IPSC","ISEE",
 "ITCI","ITOS","IVVD","JANX","JNCE","KALA","KCAL","KDNY","KRTX","KYMR",
 "LBPH","LGND","LNTH","LQDA","LRMR","MASS","MDXG","MGNX","MIRM","MNKD",
 "MORF","MRNS","MRSN","MRTX","NRIX","NUVL","OCGN","OLPX","ONCR","OPCH",
 "ORGO","ORIC","ORPH","ORTX","OSUR","OTLK","OWLT","PAHC","PASG","PCVX",
 "PHAT","PLRX","PMVP","PNTM","PRLD","PRME","PRTK","PTGX","PTLO","QURE",
 "RAPT","RBBN","RCEL","RCUS","RDUS","RETA","RIGL","RLAY","RLMD","RPTX",
];

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
const open=candles[0].o;
return{symbol:sym,price,change_pct:((price-open)/open)*100,volRatio:vr,ema20:e20,
levels:{sl,slPct:((sl-price)/price)*100,risk,t1:price+risk,t1Pct:(risk/price)*100,t2:price+risk*2,t2Pct:(risk*2/price)*100,t3:price+risk*3,t3Pct:(risk*3/price)*100},
candles:candles.slice(-20)};}

async function fetchTiingo(sym){
try{
const now=new Date();
const end=now.toISOString();
const start=new Date(now-3*86400000).toISOString();
const url=`https://api.tiingo.com/iex/${sym}/prices?startDate=${start}&endDate=${end}&resampleFreq=15min&token=${TIINGO_KEY}`;
const r=await fetch(url,{headers:{"Content-Type":"application/json"}});
if(!r.ok)return null;
const d=await r.json();
if(!d||d.length<25)return null;
return d.map(b=>({t:new Date(b.date).getTime(),o:b.open||b.close,h:b.high||b.close,l:b.low||b.close,c:b.close,v:b.volume||0}));
}catch{return null;}}

export default async function handler(req,res){
if(!TIINGO_KEY)return res.status(500).json({error:"No API key"});
const results=await Promise.allSettled(STOCKS.map(async s=>{
const c=await fetchTiingo(s);
if(!c)return null;
return analyze(s,c);
}));
const found=results.filter(r=>r.status==="fulfilled"&&r.value).map(r=>r.value);
res.status(200).json({results:found,total:STOCKS.length,scannedAt:new Date().toISOString()});}
