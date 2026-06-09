// pages/api/scan.js — RadarAZ v3
// 1200 سهم (100 قيادي + 1100 مضاربة) · EP Model · أخبار · HOT Alerts · Supabase

const POLYGON_KEY  = process.env.POLYGON_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const BASE         = "https://api.polygon.io";

// ─── القائمة ──────────────────────────────────────────────────────

// 100 قيادي (فوق 500M)
const LEADERS = [
  "NVDA","AMD","MSFT","META","GOOGL","AMZN","AAPL","TSLA","PLTR","SMCI",
  "CRWD","DDOG","SNOW","RBLX","UBER","LYFT","ABNB","DASH","COIN","HOOD",
  "SOFI","UPST","MSTR","NET","ZS","OKTA","CFLT","MDB","GTLB","DOCN",
  "SHOP","SQ","PYPL","AFRM","BILL","HUBS","TEAM","TWLO","ZI","ASAN",
  "BRZE","DUOL","ESTC","MNDY","SMAR","LSPD","FROG","JAMF","BASE","COUR",
  "VRTX","REGN","ILMN","BIIB","GILD","BMRN","ALNY","IONS","INCY","EXEL",
  "ACAD","SGEN","PCVX","RXRX","ROIV","TGTX","KYMR","RARE","FOLD","RCUS",
  "ENPH","FSLR","SEDG","RUN","NOVA","ARRY","CSIQ","SPWR","BE","PLUG",
  "MRVL","QCOM","AVGO","MU","INTC","ON","WOLF","OLED","COHR","AMBA",
  "SPOT","SNAP","PINS","RDDT","BMBL","MTCH","ZG","EXPI","OPEN","HIMS",
];

// 1100 مضاربة (أقل من 500M)
const SPECULATION = [
  // Crypto/Blockchain
  "MARA","RIOT","CLSK","IREN","BTBT","ARBK","CIFR","CORZ","BTDR","WULF",
  "HUT","HIVE","BITF","MIGI","BKKT","BTCS","BTCM","SMLR","BSRT","WULF",
  // AI/Tech صغير
  "SOUN","BBAI","KULR","CRKN","AIXI","AEYE","GFAI","AIMD","AINC","AISP",
  "ARBE","ADCT","ADTX","AIRS","AIRT","ADAP","ADIL","ADMA","ADMP","ADMT",
  // Biotech/Pharma
  "SIGA","GOVX","NKLA","MULN","WISA","CBAT","BFRI","ATXS","ABOS","ACER",
  "ACHL","ACRX","ACST","ADVM","ADXN","AEHR","AERI","AFMD","AGEN","AGFY",
  "AGIO","AGNS","AGPX","AHPI","AKBA","AKCA","AKLI","AKRO","AKTS","AKTX",
  "AKUS","ALBT","ALDX","ALEC","ALGS","ALIM","ALKS","ALLK","ALPN","ALRS",
  "ALSA","ALTO","ALVO","ALXO","ALYA","ALZN","AMBO","AMCI","AMPE","AMPH",
  "AMRN","AMRS","AMSC","ANAB","ANAC","ANEB","ANIK","ANIP","ANIX","ANNX",
  "ANPC","ANTX","ANVS","APCA","APDN","APGE","APLM","APLS","APLT","APOP",
  "APPH","APTO","APTX","APVO","APYX","AQST","ARAV","ARCE","ARCT","AREC",
  "ARMP","ARQT","ARVN","ARWR","ARZN","ASEP","ASLN","ASND","ASNS","ASPI",
  "ASRT","ASTC","ASTL","ASTR","ASTS","ASUR","ATAI","ATEC","ATEN","ATEX",
  "ATHA","ATHE","ATHX","ATIP","ATIS","ATLO","ATNX","ATOM","ATOS","ATRA",
  "ATRC","ATRI","ATRM","ATRS","ATYR","AUDC","AUGX","AUID","AUPH","AURA",
  "AUTL","AUVI","AVAH","AVDL","AVGR","AVID","AVIR","AVNW","AVPT","AVRO",
  "AVTE","AVTX","AVXL","AXDX","AXGN","AXGT","AXLA","AXNX","AXSM","AYRO",
  "AYTU","AZRE","BACK","BAOS","BBCP","BBIO","BBLG","BCAB","BCAL","BCAN",
  "BCDA","BCEL","BCLI","BCTX","BCYC","BDSX","BDTX","BEAM","BEEM","BFLY",
  "BGRY","BHIL","BIAF","BILI","BIMI","BIOX","BIRD","BIVI","BJDX","BLFS",
  "BLPH","BLRX","BLUE","BNGO","BNIX","BNTC","BOCN","BOLT","BONE","BPMC",
  "BPRN","BPTS","BPTH","BRDS","BREA","BRTX","BSGM","BTAI","BTTX","BXRX",
  "BYSI","CAPR","CARV","CASM","CBIO","CCCC","CDAK","CDMO","CDNA","CDRE",
  "CDRO","CDTX","CDXS","CEAD","CELC","CELH","CELU","CELZ","CEMI","CERO",
  "CERS","CERT","CGEM","CGNT","CGTX","CHEK","CKPT","CLBS","CLGN","CLIR",
  "CLMT","CLNE","CLNN","CLNV","CLPR","CLPS","CLRB","CLRO","CLSD","CLVR",
  "CMBT","CMPS","CMRX","CNSP","CNTB","CNTG","COCH","COCP","CODX","COEP",
  "CPIX","CPLP","CPRX","CRBU","CRCT","CRDF","CRDL","CRDO","CRDX","CREV",
  "CRGX","CRIS","CRMD","CRNC","CRNT","CRNX","CRSP","CRVS","CSCW","CTGO",
  "CTIC","CTLT","CTMX","CTON","CTXR","DARE","DBGI","DBVT","DCGO","DCTH",
  "DELT","DERA","DGHI","DGLY","DGNX","DHIL","DHTX","DIBS","DIST","DLTX",
  "DMAC","DMAR","DMEI","DMRC","DMTK","DNLI","DNMR","DNUT","DRCT","DRNA",
  "DRRX","DSPC","DTIL","DTSS","DYAI","DYNS","EACO","EARN","EDIT","EDSA",
  "EFOI","EFSH","EGLT","EGRX","EKSO","ELEV","ELSE","ELVA","EMBC","EMKR",
  "EMTX","ENER","ENFN","ENLT","ENLV","ENOV","ENSC","ENVB","ENVX","EOLS",
  "EOSE","EPAZ","EPIX","EPOW","EPZM","ERAS","ERES","ERII","ESEA","ESPR",
  "ESSA","ETNB","EVAX","EVBG","EVGO","EVIO","EVLV","EVMO","EVOK","EVTL",
  "EVTV","FBIO","FBLG","FCEL","FDMT","FEIM","FGEN","FHTX","FINV","FIXX",
  "FLGC","FLME","FLNC","FLNT","FMNB","FNKO","FNTX","FORE","FRGE","FRGT",
  "FRLN","FRPT","FRSX","FTCI","FTFT","FTHM","FTRE","FUBO","GALT","GATO",
  "GBOX","GDEN","GDYN","GENI","GEOS","GERN","GGAL","GHRS","GHSI","GIFI",
  "GILT","GIMI","GLBE","GLBS","GLDD","GLMD","GLNG","GLPG","GLRE","GLSI",
  "GLTO","GLTX","GLUE","GMBL","GMDA","GMRE","GNLN","GNMK","GNPX","GNSS",
  "GNUS","GOEV","GOED","GOGL","GOGO","GOPI","GORV","GOSS","GPCR","GPMT",
  "GPOR","GPRE","GPRO","GRAM","GREE","GRIL","GRIN","GRPN","GRTS","GRTX",
  "GRVY","GRWG","GSAT","GSIT","GSMG","HAIN","HALL","HALO","HARP","HAYN",
  "HBIO","HCAT","HCCI","HCSG","HCWB","HDSN","HEAR","HEPA","HEPS","HERO",
  "HEXO","HGEN","HIBB","HIFS","HIIQ","HIPO","HITI","HIVE","HKIT","HLLY",
  "HLTH","HLVX","HNRG","HOLO","HONE","HOOK","HOTH","HPCO","HPSN","HRMY",
  "HROW","HSKA","HSON","HTGM","HTLD","HUDI","HUMA","HURC","HWKN","HYLN",
  "HYMC","HYPR","IDEX","SENS","ZKIN","NRDY","ALLR","TYGO","AGRI","NVFY",
  "XELA","IMPP","SBET","INPX","ATNF","AULT","TAOP","KPLT","SHOT","JOBY",
  "RKLB","LCID","MARK","SPCE","WKHS","RIDE","PTRA","SOLO","KNDI","AGRX",
  "AHCO","AIFU","AIRI","AIRJ","ALCE","ALCO","ALPA","ALPP","ALTU","AMCX",
  "AMID","AMIX","AMKR","AMMO","AMNB","AMOT","AMPL","AMRK","AMST","AMTB",
  "AMTX","AMWL","APEI","APEN","APLD","APMO","APOG","APPF","APPN","APPS",
  "APRL","APRT","ARCO","ARIB","ARIZ","ARKO","ARKR","ARMT","AROC","AROW",
  "ARQQ","ARTE","ARTL","ARTW","ASAI","ASAL","ASCA","ASET","ASIX","ASPC",
  "ASPS","ASRV","ASTE","ASYS","ATCX","ATLC","ATPC","ATSG","ATTO","AUST",
  "AVAV","AWRE","AXTI","AZEK","AZPN","AZTA","AZUL","BAND","BANF","BANR",
  "BARK","BBSI","BCOV","BCPC","BECN","BGFV","BIGC","BKCC","BKFG","BKSY",
  "BKTI","BLBD","BLBX","BLDP","BLDR","BLKB","BLMN","BLNK","BLTE","BLZE",
  "BMRA","BMRC","BMTX","BNRG","BNSO","BOOM","BORR","BOTJ","BPOP","BRAC",
  "BRAG","BRDG","BRFS","BRID","BRKH","BRLT","BRMK","BROG","BRWC","BRWS",
  "BSFC","BSRR","BSVN","BURU","BWMN","BWSN","BYFC","BYNO","BYRN","BZFD",
  "CAAS","CABA","CATO","CBFV","CBNK","CBRN","CBSH","CBTX","CCAP","CCEP",
  "CCIX","CCLP","CCNC","CCOJ","CCSI","CCTS","DCFC","DCOM","DGII","DGNU",
  "DGTI","DIOD","DJCO","DKNG","DLHC","DLPN","DLTH","DNOW","DOMO","DOOO",
  "DORM","DOUG","DOVA","DPCS","DPSI","DRAY","DRVN","DSAQ","DSGN","DSGX",
  "DSKE","DSON","DSSI","DSWL","DTEA","DURO","DXPE","DXYN","EBTC","ECBK",
  "ECOR","ECPG","EDBL","EDRY","EGAN","EGBN","EGHT","EGIO","ENGS","ENVA",
  "EQBK","ERIC","ESMT","ESNT","ETSY","EXFY","FBMS","FBNC","FBRT","FCAP",
  "FCPT","FDBC","FDEF","FELE","FIBK","FKWL","FLIC","FLLD","FLWS","FLXS",
  "FNLC","FNMA","FONR","FORM","FORR","FOSL","FRBA","FRBK","FRPH","FRST",
  "FRTA","FSFG","FSTR","FTSI","FULT","GCBC","GDOT","GLAD","GNTY","GOOD",
  "GSBC","GTLS","HBCP","HCDI","HEES","HFWA","HOMB","HTBK","HTLF","HVBC",
  "HWBK","HYAC","ACMR","ACRS","ADSE","ADUS","AENT","AFAR","AFBI","AFCG",
  "AFIB","AFRI","AFYA","AGBA","AGIL","AGMH","AGTI","AGYS","AIRC","AKYA",
  "ALHC","ALIT","ALOT","ALSN","ALTR","AMHC","AOSL","ARKK","ATRA","BAND",
  "BLZE","BMBL","BNIX","BOLT","BRAC","BYSI","CBRL","CEVA","CFFI","CFLT",
  "CHCI","CHCT","CHDN","CHMG","CHRD","CHRA","CHRW","CIGI","CIMN","CINC",
  "CING","CINT","CIVB","CIZN","CJET","CKVN","CLBK","CLDT","CLFD","CLMT",
  "CLNV","CLPR","CLST","CLVT","CLWT","CMDV","CMLS","CMMB","CMND","CMPO",
  "CMTS","CNDB","CNET","CNEY","CNFR","CNGL","CNGX","CNOB","CNSL","CNXT",
  "COOL","COOP","COPS","COPT","CORR","CORT","COSM","COWI","CPBI","CPOP",
  "CPRT","CPSH","CPSI","CPSS","CPTK","CPTN","CRAW","CRKN","CROX","CRSS",
  "CRTO","CRUS","CRWD","CRWS","CSGP","CSGS","CSIA","CSII","CSIQ","CSPI",
  "CSSE","CSTA","CSTE","CSTL","CSTR","CSWC","CSWI","CTIB","CTRL","CTSO",
  "CUBS","CUEN","DCBO","DEMO","DENN","DGNU","DIGS","DLPN","DMAR","DOMO",
  "DOUG","DPCS","DSAQ","DSGN","DTEA","DUET","DURO","EAST","EBIX","EBMT",
  "EDBL","EDRY","EGBN","EMMS","EPOW","EPZM","EVBG","EXFY","FBRT","FDEF",
];

const WATCHLIST = [...new Set([...LEADERS, ...SPECULATION])].slice(0, 1200);

// ─── EP Model ────────────────────────────────────────────────────
const EP_W   = { float:22, rvol:20, news:15, short:12, breakout:13, gap:8, mcap:10 };
const EP_MAX = Object.values(EP_W).reduce((a,b)=>a+b, 0);

function calcEP(s) {
  let t = 0;
  const fl = s.float;
  if (fl) t += fl<5e6?EP_W.float:fl<10e6?EP_W.float*.90:fl<25e6?EP_W.float*.75:fl<50e6?EP_W.float*.40:0;
  const rv = s.rvol||0;
  t += rv>=15?EP_W.rvol*1.1:rv>=10?EP_W.rvol:rv>=5?EP_W.rvol*.85:rv>=3?EP_W.rvol*.65:rv>=2?EP_W.rvol*.35:0;
  const nh = s.newsAgeHours;
  if (nh!=null) t += nh<=6?EP_W.news*1.2:nh<=24?EP_W.news:nh<=48?EP_W.news*.55:0;
  const sp = s.shortPct||0;
  t += sp>=40?EP_W.short*1.1:sp>=30?EP_W.short:sp>=20?EP_W.short*.70:0;
  let bk=0;
  if (s.high52&&s.price){const d=(s.price-s.high52)/s.high52*100; bk+=d>=0?7:d>=-2?6:d>=-5?5:d>=-15?2:0;}
  if (s.weekHigh&&s.price>s.weekHigh) bk+=6;
  t+=Math.min(bk,EP_W.breakout);
  const g=s.gapPct||0;
  t+=g>=30?EP_W.gap*1.2:g>=20?EP_W.gap:g>=10?EP_W.gap*.75:g>=5?EP_W.gap*.45:0;
  const mc=s.mcap;
  if(mc) t+=mc<50e6?EP_W.mcap:mc<150e6?EP_W.mcap*.85:mc<300e6?EP_W.mcap*.60:mc<500e6?EP_W.mcap*.30:0;
  if((s.gapPct||0)>=10&&(s.newsAgeHours||999)<=12&&(s.rvol||0)>=5) t+=8;
  return Math.min(Math.round((t/EP_MAX)*100),99);
}

const isHot = s => s.ep>=85 && (s.rvol||0)>=5 && s.newsAgeHours!=null && s.newsAgeHours<=24;

// ─── Helpers ─────────────────────────────────────────────────────
const sleep = ms => new Promise(r=>setTimeout(r,ms));

async function polyGet(path, params={}) {
  const qs = new URLSearchParams({...params, apiKey:POLYGON_KEY}).toString();
  const r  = await fetch(`${BASE}${path}?${qs}`);
  if (!r.ok) throw new Error(`Polygon ${r.status}`);
  return r.json();
}

// ─── Bulk snapshots (50 per chunk, parallel) ─────────────────────
async function fetchSnapshots(tickers) {
  const chunks = [];
  for (let i=0;i<tickers.length;i+=50) chunks.push(tickers.slice(i,i+50));
  const results = await Promise.all(chunks.map(async chunk => {
    try {
      const d = await polyGet("/v2/snapshot/locale/us/markets/stocks/tickers", { tickers: chunk.join(",") });
      return d.tickers||[];
    } catch(_){ return []; }
  }));
  const out={};
  results.flat().forEach(t=>{
    const day=t.day||{}, prev=t.prevDay||{};
    out[t.ticker]={
      ticker:    t.ticker,
      price:     day.c||0,
      open:      day.o||0,
      volume:    day.v||0,
      vwap:      day.vw||0,
      high:      day.h||0,
      low:       day.l||0,
      prevClose: prev.c||0,
      changePct: t.todaysChangePerc||0,
      prevVol:   prev.v||0,
    };
  });
  return out;
}

// ─── News ─────────────────────────────────────────────────────────
async function fetchNews(ticker) {
  try {
    const d = await polyGet("/v2/reference/news", { ticker, limit:1, order:"desc" });
    const item = (d.results||[])[0];
    if (!item) return null;
    return {
      ageHours: (Date.now()-new Date(item.published_utc).getTime())/3600000,
      headline: item.title,
    };
  } catch(_){ return null; }
}

// ─── Supabase save ────────────────────────────────────────────────
async function saveSignals(signals) {
  if (!SUPABASE_URL||!SUPABASE_KEY||!signals.length) return { skipped:true };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/signals`, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "apikey":SUPABASE_KEY,
      "Authorization":`Bearer ${SUPABASE_KEY}`,
      "Prefer":"resolution=ignore-duplicates",
    },
    body: JSON.stringify(signals),
  });
  return { status:r.status, body:(await r.text()).slice(0,200) };
}

// ═══════════════════════════════════════════════════════════════════
//  HANDLER
// ═══════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  const isCron  = req.headers["x-vercel-cron"] === "true";
  const isAdmin = req.headers["x-admin-scan"]  === "true";
  const secret  = req.headers["x-cron-secret"];
  const validSecret = secret && secret === process.env.CRON_SECRET;
  const canSave = isCron || isAdmin || validSecret;

  try {
    // ── 1. Snapshots لكل القائمة دفعة واحدة متوازية ──────────────
    const snaps = await fetchSnapshots(WATCHLIST);

    // ── 2. فلتر أولي ─────────────────────────────────────────────
    const now = new Date();
    const et  = new Date(now.toLocaleString("en-US",{timeZone:"America/New_York"}));
    const h=et.getHours(), m=et.getMinutes(), day=et.getDay();
    const isWeekend   = day===0||day===6;
    const isPreMarket = !isWeekend&&h>=4&&(h<9||(h===9&&m<30));
    const MIN_VOL     = isPreMarket ? 5000 : 50000;

    const candidates = Object.values(snaps).filter(s =>
      s.price>=0.5 && s.price<=500 &&
      s.volume>=MIN_VOL &&
      s.changePct>=-30 && s.changePct<=100
    );

    // ── 3. حساب المقاييس الأساسية ─────────────────────────────────
    const processed = candidates.map(s => {
      const prevClose = s.prevClose || s.price;
      const aboveVWAP = s.vwap && s.price > s.vwap;
      const gapPct    = prevClose && s.open ? ((s.open-prevClose)/prevClose)*100 : 0;
      const tr        = Math.max(s.high-s.low, Math.abs(s.high-prevClose), Math.abs(s.low-prevClose));
      const atr       = Math.max(tr, s.price*0.02);
      const rvol      = s.prevVol>0 ? parseFloat((s.volume/s.prevVol).toFixed(1)) : null;
      const isLeader  = LEADERS.includes(s.ticker);
      return {
        ...s, prevClose, aboveVWAP, gapPct, atr, rvol,
        type: isLeader ? "قيادي" : "مضاربة",
        newsAgeHours: null, newsHeadline: null,
        float: null, mcap: null, shortPct: null,
        high52: null, weekHigh: null, ep: 0,
      };
    });

    // ── 4. EP أولي + فلتر + أفضل 150 للأخبار ─────────────────────
    const withEP = processed
      .map(s => ({ ...s, ep: calcEP(s) }))
      .filter(s => s.ep >= 30 || s.rvol >= 3 || s.changePct >= 5)
      .sort((a,b) => b.ep-a.ep)
      .slice(0, 150);

    // ── 5. أخبار لأفضل 150 بالتوازي ──────────────────────────────
    const newsResults = await Promise.all(withEP.map(s => fetchNews(s.ticker)));

    // ── 6. EP نهائي ───────────────────────────────────────────────
    const final = withEP
      .map((s,i) => {
        const news = newsResults[i];
        const enriched = { ...s, newsAgeHours: news?.ageHours??null, newsHeadline: news?.headline??null };
        enriched.ep = calcEP(enriched);
        return enriched;
      })
      .filter(s => s.ep >= 40 || (s.changePct >= 3 && (s.rvol||0) >= 2))
      .sort((a,b) => { if(isHot(b)!==isHot(a)) return isHot(b)?1:-1; return b.ep-a.ep; });

    // ── 7. بناء النتائج مع الأهداف ────────────────────────────────
    const results = final.map(s => {
      const entry = parseFloat(s.price.toFixed(2));
      const atr   = s.atr;
      const score = s.ep;
      return {
        symbol:       s.ticker,
        price:        entry,
        change_pct:   parseFloat(s.changePct.toFixed(2)),
        volume:       s.volume,
        score,
        ep:           score,
        signal:       score>=80?"💥 انفجاري":score>=60?"🔥 عالي":"👀 مراقبة",
        confidence:   score>=80?"💥 قوة قصوى":score>=65?"🔥 إشارة ممتازة":"👀 مراقبة",
        type:         s.type,
        rvol:         s.rvol,
        vwap:         parseFloat((s.vwap||0).toFixed(2)),
        is_hot:       isHot(s),
        newsAgeHours: s.newsAgeHours!=null ? Math.round(s.newsAgeHours) : null,
        newsHeadline: s.newsHeadline,
        marketCap:    null,
        ema9:         null,
        ema20:        null,
        levels: {
          t1:    parseFloat((entry+atr*0.5).toFixed(2)),
          t1Pct: parseFloat(((atr*0.5/entry)*100).toFixed(2)),
          t2:    parseFloat((entry+atr*1.0).toFixed(2)),
          t2Pct: parseFloat(((atr*1.0/entry)*100).toFixed(2)),
          t3:    parseFloat((entry+atr*1.8).toFixed(2)),
          t3Pct: parseFloat(((atr*1.8/entry)*100).toFixed(2)),
          sl:    parseFloat(Math.max(entry-atr*0.8, entry*0.90).toFixed(2)),
          slPct: parseFloat((((Math.max(entry-atr*0.8,entry*0.90)-entry)/entry)*100).toFixed(2)),
          risk:  parseFloat((entry-Math.max(entry-atr*0.8,entry*0.90)).toFixed(2)),
        },
      };
    });

    const leaders     = results.filter(s=>s.type==="قيادي");
    const speculation = results.filter(s=>s.type!=="قيادي");

    // ── 8. حفظ Supabase (أدمن/cron فقط) ─────────────────────────
    let saveResult = { skipped:true, reason:"subscriber scan" };
    if (canSave) {
      const rows = results.filter(s=>s.ep>=60).map(s=>({
        symbol:         s.symbol,
        entry_price:    s.price,
        target1:        s.levels.t1,
        target2:        s.levels.t2,
        target3:        s.levels.t3,
        stop_loss:      s.levels.sl,
        score:          s.ep,
        ep:             s.ep,
        rvol:           s.rvol!=null ? parseFloat(s.rvol.toFixed(2)) : null,
        volume:         s.volume,
        change_pct:     s.change_pct,
        news_age_hours: s.newsAgeHours,
        is_hot:         s.is_hot,
        type:           s.type,
        status:         "OPEN",
      }));
      saveResult = await saveSignals(rows);
    }

    return res.status(200).json({
      success:     true,
      total:       results.length,
      hot:         results.filter(isHot).length,
      saved:       canSave ? results.filter(s=>s.ep>=60).length : 0,
      saveResult,
      results,
      leaders,
      speculation,
    });

  } catch(err) {
    return res.status(500).json({ success:false, error:err.message });
  }
}
