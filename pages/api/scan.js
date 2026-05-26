const POLYGON_KEY = "Kv7F3MSRRgrH_8dOoFu4L0TpFO23Trix";
const BASE = "https://api.polygon.io";

const WATCHLIST = [
  // Mining & Energy
  "SOUN","BBAI","KULR","CRKN","NKLA","MULN","WISA","CBAT","BFRI","ATXS",
  "HOLO","BHAT","CLSK","MARA","RIOT","CIFR","BTBT","IREN","ARBK","MIGI",
  "ATER","CLOV","NAKD","IDEX","SENS","ZKIN","ENSC","BKKT","NRDY","SMFL",
  "ALLR","GFAI","TYGO","AGRI","NVFY","SIGA","GOVX","XELA","IMPP","AEYE",
  "PRPB","PBAX","SBET","INPX","CLRB","ATNF","AULT","TAOP","KPLT","SHOT",
  // Batch 2
  "ABOS","ACBA","ACER","ACHL","ACMR","ACNB","ACRX","ACST","ACTG","ACTU",
  "ADAP","ADCT","ADIL","ADMA","ADMP","ADMT","ADOC","ADSE","ADTX","ADUS",
  "ADVM","ADXN","AEAC","AEHR","AEIS","AENT","AERI","AESE","AEYE","AFAR",
  "AFBI","AFCG","AFIB","AFMD","AFRI","AFYA","AGBA","AGEN","AGFY","AGIL",
  "AGIO","AGMH","AGNS","AGPX","AGRI","AGRO","AGTI","AGYS","AHCO","AHPI",
  "AIFU","AIMD","AINC","AIRC","AIRI","AIRJ","AIRS","AIRT","AISA","AISP",
  "AIVA","AIXI","AJRD","AKBA","AKCA","AKER","AKLI","AKRO","AKTS","AKTX",
  "AKUS","AKYA","ALBT","ALCE","ALCO","ALDX","ALEC","ALGS","ALGT","ALHC",
  "ALIM","ALIT","ALJJ","ALKS","ALLK","ALLT","ALNY","ALOT","ALPA","ALPN",
  "ALPP","ALRS","ALRV","ALSA","ALSN","ALTO","ALTR","ALTS","ALTU","ALUR",
  "ALVO","ALXO","ALYA","ALZN","AMAOX","AMBO","AMCI","AMCX","AMDX","AMGN",
  "AMHC","AMID","AMIX","AMKR","AMMO","AMNB","AMOT","AMPE","AMPH","AMPI",
  "AMPL","AMRK","AMRN","AMRS","AMSC","AMSF","AMST","AMSWA","AMTB","AMTX",
  "AMWL","AMXT","ANAB","ANAC","ANDA","ANDX","ANEB","ANIK","ANIP","ANIX",
  "ANNX","ANPC","ANSS","ANTE","ANTX","ANVS","AOGO","AONC","AOSL","APCA",
  "APDN","APEI","APEN","APGE","APHA","APLD","APLM","APLS","APLT","APLY",
  "APMI","APMO","APOG","APOP","APPF","APPH","APPN","APPS","APRE","APRL",
  "APRT","APTO","APTX","APVO","APWC","APXI","APYX","AQMS","AQNB","AQST",
  "ARAV","ARBB","ARBE","ARCE","ARCO","ARCT","AREC","ARGX","ARHS","ARIB",
  "ARIZ","ARKO","ARKR","ARLP","ARMP","ARMT","ARNC","AROC","AROW","ARQQ",
  "ARQT","ARRW","ARTE","ARTL","ARTNA","ARTW","ARVN","ARWR","ARYA","ARZN",
  "ASAI","ASAL","ASAX","ASCA","ASEP","ASET","ASIX","ASKE","ASLEW","ASLN",
  "ASND","ASNS","ASPC","ASPI","ASPS","ASRT","ASRV","ASTC","ASTE","ASTL",
  "ASTR","ASTS","ASUR","ASYS","ATAI","ATAQ","ATCX","ATEC","ATEN","ATEX",
  "ATHA","ATHE","ATHX","ATIF","ATIP","ATIS","ATIX","ATLC","ATLO","ATNX",
  "ATOM","ATOS","ATPC","ATRA","ATRC","ATRI","ATRM","ATRS","ATSG","ATTO",
  "ATXI","ATXS","ATYR","AUBN","AUDC","AUGX","AUID","AUPH","AURA","AURC",
  "AUST","AUTL","AUUD","AUVI","AVAH","AVAV","AVBP","AVDL","AVGO","AVGR",
  "AVHI","AVID","AVIR","AVNW","AVPT","AVRO","AVTE","AVTX","AVXL","AVYA",
  "AWRE","AXDX","AXGN","AXGT","AXLA","AXNX","AXON","AXSM","AXTA","AXTI",
  "AXTX","AYALA","AYRO","AYTU","AZEK","AZPN","AZRE","AZTA","AZUL","AZYO",
  "BACK","BAND","BANF","BANR","BAOS","BARK","BBCP","BBIO","BBLG","BBSI",
  "BCAB","BCAL","BCAN","BCDA","BCEL","BCLI","BCML","BCNP","BCOV","BCOW",
  "BCPC","BCSA","BCTX","BCYC","BDSX","BDTX","BEAM","BEAT","BECN","BEEM",
  "BELFA","BELFB","BENF","BEOX","BFIN","BFLY","BFRI","BGFV","BGRY","BHAT",
  "BHIL","BHTG","BIAF","BIDU","BIGC","BIIB","BILI","BIMI","BINT","BIOX",
  "BIRD","BIRK","BITE","BIVI","BJDX","BKCC","BKFG","BKKT","BKNG","BKSY",
  "BKTI","BKUR","BLBD","BLBX","BLCT","BLDP","BLDR","BLEU","BLFS","BLFY",
  "BLKB","BLMN","BLNK","BLPH","BLRX","BLSA","BLTE","BLUE","BLZE","BMBL",
  "BMMJ","BMRA","BMRC","BMTX","BNGO","BNIX","BNKL","BNMV","BNOX","BNRG",
  "BNSO","BNTC","BNTX","BNZI","BOCN","BOEL","BOLT","BOMN","BONE","BONT"
];

export default async function handler(req, res) {
  try {
    const now = new Date();
    const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const h = et.getHours(), m = et.getMinutes(), day = et.getDay();

    const isWeekend   = day === 0 || day === 6;
    const isPreMarket = !isWeekend && h >= 4 && (h < 9 || (h === 9 && m < 30));

    const MIN_VOLUME = isPreMarket ? 5000 : 20000;

    // تقسيم القائمة إلى chunks بحد أقصى 100 سهم لكل طلب
    const CHUNK_SIZE = 100;
    const chunks = [];
    for (let i = 0; i < WATCHLIST.length; i += CHUNK_SIZE) {
      chunks.push(WATCHLIST.slice(i, i + CHUNK_SIZE));
    }

    // جلب كل chunk بطلب Bulk واحد
    const allTickers = [];
    await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const symbols = chunk.join(",");
          const url = `${BASE}/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${symbols}&apiKey=${POLYGON_KEY}`;
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
      const vwap      = data.day?.vw || price;
      const aboveVWAP = price > vwap;
      const preGap    = data.day?.o && data.prevDay?.c
        ? ((data.day.o - data.prevDay.c) / data.prevDay.c) * 100 : 0;

      const high = data.day?.h || price;
      const low  = data.day?.l || price;

      const tr  = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      const atr = Math.max(tr, price * 0.02);

      const target1  = parseFloat((price + atr * 1.5).toFixed(2));
      const target2  = parseFloat((price + atr * 3.0).toFixed(2));
      const target3  = parseFloat((price + atr * 4.5).toFixed(2));
      const stopLoss = parseFloat(Math.max(price - atr * 0.8, price * 0.90).toFixed(2));
      const slPct    = parseFloat((((stopLoss - price) / price) * 100).toFixed(2));
      const risk     = parseFloat((price - stopLoss).toFixed(2));
      const reward   = target1 - price;
      const rr       = risk > 0 ? (reward / risk).toFixed(1) : "0";

      if (!isPreMarket && parseFloat(rr) < 1.0) continue;

      let score = 40;
      if (aboveVWAP)      score += 15;
      if (preGap > 2)     score += 10;
      if (changePct > 3)  score += 10;
      if (volume > 50000) score += 15;
      score = Math.min(score, 99);

      const confidence =
        score >= 80 ? "💥 قوة قصوى" :
        score >= 60 ? "🔥 إشارة ممتازة" : "👀 مراقبة";

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
