const POLYGON_KEY = "Kv7F3MSRRgrH_8dOoFu4L0TpFO23Trix";
const BASE = "https://api.polygon.io";

const WATCHLIST = [
  // Batch 1
  "SOUN","BBAI","KULR","CRKN","NKLA","MULN","WISA","CBAT","BFRI","ATXS",
  "HOLO","BHAT","CLSK","MARA","RIOT","CIFR","BTBT","IREN","ARBK","MIGI",
  "ATER","CLOV","NAKD","IDEX","SENS","ZKIN","ENSC","BKKT","NRDY","SMFL",
  "ALLR","GFAI","TYGO","AGRI","NVFY","SIGA","GOVX","XELA","IMPP","AEYE",
  "PRPB","PBAX","SBET","INPX","CLRB","ATNF","AULT","TAOP","KPLT","SHOT",
  // Batch 2
  "ABOS","ACBA","ACER","ACHL","ACMR","ACRX","ACST","ACTG","ACTU",
  "ADAP","ADCT","ADIL","ADMA","ADMP","ADMT","ADSE","ADTX","ADUS",
  "ADVM","ADXN","AEHR","AEIS","AENT","AERI","AFAR",
  "AFBI","AFCG","AFIB","AFMD","AFRI","AFYA","AGBA","AGEN","AGFY","AGIL",
  "AGIO","AGMH","AGNS","AGPX","AGRO","AGTI","AGYS","AHCO","AHPI",
  "AIFU","AIMD","AINC","AIRC","AIRI","AIRJ","AIRS","AIRT","AISP",
  "AIXI","AKBA","AKCA","AKER","AKLI","AKRO","AKTS","AKTX",
  "AKUS","AKYA","ALBT","ALCE","ALCO","ALDX","ALEC","ALGS","ALGT","ALHC",
  "ALIM","ALIT","ALKS","ALLK","ALLT","ALNY","ALOT","ALPA","ALPN",
  "ALPP","ALRS","ALSA","ALSN","ALTO","ALTR","ALTU",
  "ALVO","ALXO","ALYA","ALZN","AMBO","AMCI","AMCX","AMHC","AMID",
  "AMIX","AMKR","AMMO","AMNB","AMOT","AMPE","AMPH","AMPL","AMRK",
  "AMRN","AMRS","AMSC","AMSF","AMST","AMTB","AMTX","AMWL","ANAB",
  "ANAC","ANDA","ANEB","ANIK","ANIP","ANIX","ANNX","ANPC","ANTE",
  "ANTX","ANVS","AOSL","APCA","APDN","APEI","APEN","APGE",
  "APLD","APLM","APLS","APLT","APMO","APOG","APOP","APPF",
  "APPH","APPN","APPS","APRL","APRT","APTO","APTX","APVO",
  "APYX","AQMS","AQST","ARAV","ARBE","ARCE","ARCO","ARCT",
  "AREC","ARIB","ARIZ","ARKO","ARKR","ARMP","ARMT","ARNC","AROC",
  "AROW","ARQQ","ARQT","ARTE","ARTL","ARTW","ARVN","ARWR","ARZN",
  "ASAI","ASAL","ASCA","ASEP","ASET","ASIX","ASLN","ASND",
  "ASNS","ASPC","ASPI","ASPS","ASRT","ASRV","ASTC","ASTE","ASTL","ASTR",
  "ASTS","ASUR","ASYS","ATAI","ATCX","ATEC","ATEN","ATEX","ATHA",
  "ATHE","ATHX","ATIF","ATIP","ATIS","ATLC","ATLO","ATNX","ATOM",
  "ATOS","ATPC","ATRA","ATRC","ATRI","ATRM","ATRS","ATSG","ATTO",
  "ATYR","AUDC","AUGX","AUID","AUPH","AURA","AUST","AUTL","AUVI",
  "AVAH","AVAV","AVDL","AVGR","AVID","AVIR","AVNW","AVPT","AVRO","AVTE",
  "AVTX","AVXL","AWRE","AXDX","AXGN","AXGT","AXLA","AXNX","AXSM","AXTI",
  "AYRO","AYTU","AZEK","AZPN","AZRE","AZTA","AZUL",
  // Batch 3
  "BACK","BAND","BANF","BANR","BAOS","BARK","BBCP","BBIO","BBLG","BBSI",
  "BCAB","BCAL","BCAN","BCDA","BCEL","BCLI","BCML","BCOV","BCPC","BCTX",
  "BCYC","BDSX","BDTX","BEAM","BEAT","BECN","BEEM","BFLY","BGFV","BGRY",
  "BHIL","BIAF","BIGC","BILI","BIMI","BIOX","BIRD","BITE","BIVI","BJDX",
  "BKCC","BKFG","BKKT","BKSY","BKTI","BLBD","BLBX","BLDP","BLDR","BLFS",
  "BLKB","BLMN","BLNK","BLPH","BLRX","BLTE","BLUE","BLZE","BMBL","BMRA",
  "BMRC","BMTX","BNGO","BNIX","BNRG","BNSO","BNTC","BNTX","BOCN","BOLT",
  "BONE","BONT","BOOM","BORR","BOTJ","BPMC","BPOP","BPRN","BPTS","BPTH",
  "BRAC","BRAG","BRDG","BRDS","BREA","BRFS","BRID","BRKH","BRLT","BRMK",
  "BROG","BRTX","BRWC","BRWS","BSFC","BSGM","BSRR","BSVN","BTAI","BTBT",
  "BTCS","BTCM","BTDR","BTEL","BTMD","BTTX","BTOG","BUJA","BURU","BVNK",
  "BWMN","BWSN","BXRX","BYFC","BYNO","BYRN","BYSI","BZFD",
  // Batch 4
  "CAAS","CABA","CAPR","CARV","CASM","CATO","CBAT","CBFV","CBIO","CBNK",
  "CBRL","CBRN","CBSH","CBTX","CCAP","CCCC","CCEP","CCIX","CCLP","CCNC",
  "CCOJ","CCSI","CCTS","CDAK","CDMO","CDNA","CDNS","CDRE","CDRO","CDTX",
  "CDXS","CDZI","CEAD","CECO","CELC","CELH","CELU","CELZ","CEMI","CENT",
  "CERO","CERS","CERT","CEVA","CFBK","CFFI","CFFE","CFLT","CFNB","CFRX",
  "CGEM","CGNT","CGNX","CGON","CGRN","CGRO","CGTX","CHCI","CHCT","CHDN",
  "CHEK","CHMG","CHRD","CHRS","CHRW","CHSCL","CHSCO","CHSCM","CHSCN","CHSCP",
  "CHTR","CHUY","CIFR","CIGI","CIMN","CINC","CING","CINT","CIVB","CIZN",
  "CJET","CKPT","CKVN","CLBK","CLBS","CLDT","CLFD","CLGN","CLIR","CLMB",
  "CLMT","CLNE","CLNN","CLNV","CLOA","CLOE","CLOV","CLPR","CLPS","CLPT",
  "CLRB","CLRO","CLSD","CLSK","CLST","CLVR","CLVT","CLWT","CMBT","CMCO",
  "CMCT","CMDV","CMLS","CMMB","CMND","CMPO","CMPS","CMRX","CMTG","CMTS",
  // Batch 5
  "CNDB","CNET","CNEY","CNFR","CNGL","CNGX","CNOB","CNSL","CNSP","CNTB",
  "CNTG","CNVS","CNXT","COCH","COCP","CODX","COEP","COFS","COHU","COIN",
  "COKE","COLI","COLM","COMS","CONN","COOL","COOP","COPS","COPT","CORR",
  "CORT","CORZ","COSM","COWI","CPBI","CPIX","CPLP","CPOP","CPRT","CPRX",
  "CPSH","CPSI","CPSS","CPTK","CPTN","CRAW","CRBU","CRCT","CRDF","CRDL",
  "CRDO","CRDX","CREG","CREV","CRGX","CRGY","CRIS","CRKN","CRMD","CRNC",
  "CRNT","CRNX","CRON","CROX","CRSP","CRSS","CRTO","CRUS","CRVS","CRWD",
  "CRWS","CSCW","CSGP","CSGS","CSIA","CSII","CSIQ","CSPI","CSSE","CSTA",
  "CSTE","CSTL","CSTR","CSWC","CSWI","CTGO","CTIB","CTIC","CTLT","CTMX",
  "CTON","CTOS","CTRA","CTRE","CTRL","CTSO","CTXR","CTXS","CUBS","CUEN",
  // Batch 6
  "DARE","DBGI","DBVT","DCBO","DCFC","DCGO","DCOM","DCTH","DDDD","DDIV",
  "DDOG","DELT","DEMO","DENN","DERA","DGHI","DGII","DGLY","DGNX","DGNU",
  "DGTI","DHIL","DHTX","DIBS","DIGS","DIOD","DIST","DJCO","DKNG","DLHC",
  "DLPN","DLTH","DLTX","DMAC","DMAR","DMEI","DMRC","DMTK","DNAA","DNAB",
  "DNAC","DNAD","DNAE","DNAF","DNAG","DNAH","DNAI","DNAJ","DNJR","DNLI",
  "DNMR","DNNGY","DNOW","DNUT","DOMO","DOOO","DORM","DOUG","DOVA","DPCS",
  "DPSI","DRAY","DRCT","DRNA","DRRX","DRTS","DRTS","DRVN","DSAQ","DSGN",
  "DSGX","DSKE","DSNY","DSON","DSPC","DSSI","DSWL","DTEA","DTIL","DTSS",
  "DUET","DUOL","DURO","DXPE","DXYN","DYAI","DYFN","DYNS","DYNT","DZSI",
  // Batch 7
  "EACO","EARN","EAST","EBIX","EBMT","EBSB","EBTC","ECBK","ECOR","ECPG",
  "EDBL","EDGW","EDIT","EDRY","EDSA","EDTK","EDTX","EEMA","EFOI","EFSH",
  "EGAN","EGBN","EGHT","EGIO","EGLT","EGRX","EIDA","EKSO","ELEV","ELSE",
  "ELST","ELVA","EMBC","EMKR","EMLD","EMMS","EMTX","ENCP","ENDP","ENER",
  "ENFN","ENGS","ENLT","ENLV","ENOV","ENPC","ENPH","ENSC","ENSG","ENVA",
  "ENVB","ENVX","EOLS","EOSE","EPAC","EPAZ","EPIX","EPOW","EPSN","EPZM",
  "EQBK","EQNR","EQRX","ERAS","ERES","ERIC","ERIE","ERII","ERNA","ERNZ",
  "ESEA","ESGR","ESLA","ESMT","ESNT","ESPR","ESSA","ESTC","ESXB","ETNB",
  "ETSY","ETTX","EVAX","EVBG","EVBN","EVGO","EVGR","EVIO","EVLV","EVMO",
  "EVOK","EVOP","EVTL","EVTV","EWCZ","EXFY","EXLS","EXPI","EXTO","EYEG",
  // Batch 8
  "FBIO","FBIZ","FBLG","FBMS","FBNC","FBRT","FBSS","FCAP","FCEL","FCNCA",
  "FCNCO","FCPT","FCRD","FCUV","FDBC","FDEF","FDMT","FDUS","FEAT","FEIM",
  "FELE","FELP","FEMY","FEPI","FERN","FGEN","FGMC","FGNA","FHTX","FIAC",
  "FIBK","FIII","FINV","FIXX","FKWL","FLGC","FLIC","FLLD","FLME","FLNC",
  "FLNT","FLOC","FLOT","FLPX","FLRN","FLWS","FLXS","FMBI","FMCC","FMNB",
  "FMST","FMTO","FNAM","FNCH","FNCX","FNKO","FNLC","FNMA","FNRN","FNTX",
  "FOLD","FONR","FORD","FORE","FORM","FORR","FORTY","FOSL","FPAY","FPHF",
  "FPXI","FRBA","FRBK","FRGE","FRGT","FRLN","FROG","FRPH","FRPT","FRST",
  "FRSX","FRTA","FRWT","FSFG","FSLR","FSRX","FSTR","FTCI","FTFT","FTHM",
  "FTIV","FTLF","FTPA","FTRE","FTRP","FTSI","FTUK","FUBO","FUES","FULT",
  // Batch 9
  "GALT","GATO","GBOX","GCAC","GCBC","GDEN","GDOT","GDST","GDYN","GECC",
  "GENC","GENI","GENQ","GEOS","GERN","GFAI","GFMD","GGAA","GGAL","GHIX",
  "GHRS","GHSI","GIFI","GILT","GIMI","GKOS","GLAD","GLBE","GLBS","GLDD",
  "GLMD","GLNG","GLPG","GLRE","GLSI","GLTO","GLTX","GLUE","GLXG","GMBL",
  "GMDA","GMFI","GMGI","GMRE","GNFT","GNLN","GNMK","GNPX","GNRS","GNSS",
  "GNTX","GNTY","GNUS","GOBI","GOEV","GOED","GOGL","GOGO","GOOD","GOOG",
  "GOPI","GORV","GOSS","GOVX","GPAC","GPAK","GPAT","GPCO","GPCR","GPEX",
  "GPMT","GPOR","GPRE","GPRO","GPRK","GRAM","GRDI","GREE","GREI","GRIL",
  "GRIN","GRMN","GRNV","GRPN","GRTS","GRTX","GRVY","GRWG","GSAT","GSBC",
  "GSIT","GSMG","GSUN","GTBP","GTEC","GTLB","GTLS","GTNX","GURE","GWAV",
  // Batch 10
  "HAIN","HALL","HALO","HAPP","HARP","HAYN","HBAN","HBCP","HBIO","HBMD",
  "HCAT","HCCI","HCDI","HCKT","HCNW","HCSG","HCWB","HDCO","HDSN","HEAR",
  "HEES","HEPA","HEPS","HERA","HERO","HEXO","HFBL","HFFG","HFWA","HGBL",
  "HGEN","HGTY","HHGC","HIBB","HIFS","HIHO","HIIQ","HIMAX","HIMS","HIPO",
  "HITI","HIVE","HJLI","HKIT","HLIO","HLLY","HLNE","HLTH","HLVX","HMST",
  "HNRG","HNNAZ","HNNA","HOLO","HOLX","HOMB","HONE","HONR","HOOK","HOTH",
  "HOVNP","HOWL","HPCO","HPKN","HPNN","HPRO","HPSN","HRMY","HROW","HRYU",
  "HSDT","HSII","HSKA","HSON","HSPX","HTBI","HTBK","HTGM","HTIA","HTLD",
  "HTLF","HTOO","HTPA","HUDI","HUIZ","HUMA","HURC","HUSN","HVBC","HWBK",
  "HWKN","HYAC","HYFM","HYLN","HYMC","HYPR","HYSR","HYZN","HZNP","HZON"
];

export default async function handler(req, res) {
  try {
    const now = new Date();
    const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const h = et.getHours(), m = et.getMinutes(), day = et.getDay();

    const isWeekend   = day === 0 || day === 6;
    const isPreMarket = !isWeekend && h >= 4 && (h < 9 || (h === 9 && m < 30));
    const MIN_VOLUME  = isPreMarket ? 5000 : 20000;

    const CHUNK_SIZE = 100;
    const chunks = [];
    for (let i = 0; i < WATCHLIST.length; i += CHUNK_SIZE) {
      chunks.push(WATCHLIST.slice(i, i + CHUNK_SIZE));
    }

    const allTickers = [];
    await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const url = `${BASE}/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${chunk.join(",")}&apiKey=${POLYGON_KEY}`;
          const r = await fetch(url);
          if (!r.ok) return;
          const d = await r.json();
          if (d?.tickers) allTickers.push(...d.tickers);
        } catch { }
      })
    );

    const finalResults = [];

    for (const data of allTickers) {
      const ticker = data.ticker;

      let price  = data.min?.c ?? data.lastTrade?.p ?? data.day?.c ?? 0;
      let volume = data.day?.v ?? 0;

      if (volume === 0 && data.prevDay) {
        price  = data.prevDay.c || price;
        volume = data.prevDay.v || 0;
      }

      if (price < 0.5 || price > 50) continue;
      if (volume < MIN_VOLUME) continue;

      const prevClose = data.prevDay?.c || price;
      const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

      // فلتر: استبعاد الأسهم التي ارتفعت أكثر من 20% في نفس اليوم
      if (changePct > 20) continue;

      const vwap      = data.day?.vw || price;
      const aboveVWAP = price > vwap;
      const preGap    = data.day?.o && data.prevDay?.c
        ? ((data.day.o - data.prevDay.c) / data.prevDay.c) * 100 : 0;

      const high = data.day?.h || price;
      const low  = data.day?.l || price;
      const tr   = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      const atr  = Math.max(tr, price * 0.02);

      const target1  = parseFloat((price + atr * 1.5).toFixed(2));
      const target2  = parseFloat((price + atr * 3.0).toFixed(2));
      const target3  = parseFloat((price + atr * 4.5).toFixed(2));
      const stopLoss = parseFloat(Math.max(price - atr * 0.8, price * 0.90).toFixed(2));
      const slPct    = parseFloat((((stopLoss - price) / price) * 100).toFixed(2));
      const risk     = parseFloat((price - stopLoss).toFixed(2));
      const reward   = target1 - price;
      const rr       = risk > 0 ? (reward / risk).toFixed(1) : "0";

      if (!isPreMarket && parseFloat(rr) < 1.0) continue;

      let score = 30;
      if (volume > 2_000_000)     score += 25;
      else if (volume > 500_000)  score += 18;
      else if (volume > 100_000)  score += 12;
      else if (volume > 50_000)   score += 6;

      if (changePct > 15)         score += 20;
      else if (changePct > 10)    score += 15;
      else if (changePct > 5)     score += 10;
      else if (changePct > 2)     score += 5;
      else if (changePct < 0)     score -= 5;

      if (aboveVWAP)              score += 15;

      if (preGap > 10)            score += 10;
      else if (preGap > 5)        score += 7;
      else if (preGap > 2)        score += 4;

      const rrNum = parseFloat(rr);
      if (rrNum >= 3)             score += 10;
      else if (rrNum >= 2)        score += 6;
      else if (rrNum >= 1.5)      score += 3;

      score = Math.max(30, Math.min(score, 99));

      if (score < 55) continue;

      const confidence =
        score >= 85 ? "💥 قوة قصوى" :
        score >= 70 ? "🔥 إشارة ممتازة" : "👀 مراقبة";

      finalResults.push({
        symbol:     ticker,
        price:      parseFloat(price.toFixed(2)),
        change_pct: parseFloat(changePct.toFixed(2)),
        volume,
        rr,
        signal:     confidence,
        score,
        marketCap:  data.marketCap ? data.marketCap / 1_000_000 : null,
        levels: { sl: stopLoss, t1: target1, t2: target2, t3: target3, slPct, risk }
      });
    }

    finalResults.sort((a, b) => b.score - a.score || b.volume - a.volume);

    return res.status(200).json({
      success: true,
      results: finalResults.slice(0, 25),
      total:   WATCHLIST.length
    });

  } catch (error) {
    return res.status(200).json({ success: true, results: [], error: error.message });
  }
}
