const POLYGON_KEY = "ZNfkvVZ46f53LayyNmA7a2dcfkJEZQqG";
const BASE = "https://api.polygon.io";

// قائمة الـ 50 سهم المضاربية الأكثر شعبية تحت الـ 20 دولار
const WATCHLIST = [
  "SOUN","BBAI","KULR","CRKN","NKLA","MULN","WISA","CBAT","BFRI","ATXS",
  "HOLO","BHAT","CLSK","MARA","RIOT","CIFR","BTBT","IREN","ARBK","MIGI",
  "ATER","CLOV","NAKD","IDEX","SENS","ZKIN","ENSC","BKKT","NRDY","SMFL",
  "ALLR","GFAI","TYGO","AGRI","NVFY","SIGA","GOVX","XELA","IMPP","AEYE",
  "PRPB","PBAX","SBET","INPX","CLRB","ATNF","AULT","TAOP","KPLT","SHOT"
];

export default async function handler(req, res) {
  try {
    // 1. جلب بيانات الأسهم بالتوازي (Single Ticker Snapshot المتوافق مع كل الباقات)
    const snapshots = await Promise.all(
      WATCHLIST.map(async (ticker) => {
        try {
          const url = `${BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${POLYGON_KEY}`;
          const r = await fetch(url);
          if (!r.ok) return null;
          const d = await r.json();
          return d?.ticker ? { ticker, data: d.ticker } : null;
        } catch { return null; }
      })
    );

    const finalResults = [];

    // 2. معالجة وتصفية البيانات بحسابات الـ ATR و الـ R:R الذكية
    for (const snap of snapshots) {
      if (!snap) continue;
      const { ticker, data } = snap;

      let price  = data.min?.c ?? data.lastTrade?.p ?? data.day?.c ?? 0;
      let volume = data.day?.v ?? 0;

      if (volume === 0 && data.prevDay) {
        price  = data.prevDay.c || price;
        volume = data.prevDay.v || 0;
      }

      // الفلاتر الأساسية حقتك لحجم السعر والسيولة
      if (price < 0.5 || price > 20) continue;
      if (volume < 50_000) continue;

      // فلتر الـ Spread لمنع الأسهم الميتة والخادعة
      if (data.lastTrade?.p && data.lastQuote) {
        const ask = data.lastQuote?.P ?? price;
        const bid = data.lastQuote?.p ?? price;
        if (price > 0) {
          const spreadPct = ((ask - bid) / price) * 100;
          if (spreadPct > 3) continue;
        }
      }

      const prevClose = data.prevDay?.c || price;
      const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
      const vwap      = data.day?.vw || price;
      const aboveVWAP = price > vwap;
      const preGap    = data.day?.o && data.prevDay?.c ? ((data.day.o - data.prevDay.c) / data.prevDay.c) * 100 : 0;

      // ── حساب الـ True Range والـ ATR التقريبي من بيانات اليوم الحية ──
      const high = data.day?.h || price;
      const low  = data.day?.l || price;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );

      // حماية: لو السهم جامد نضع حد أدنى للحركة 2% من السعر
      const atr = Math.max(tr, price * 0.02);

      // ── حساب الأهداف المرنة والمطاطية بناءً على التذبذب الحقيقي ──
      const rawTarget1  = price + atr * 1.5;
      const rawTarget2  = price + atr * 3.0;
      const rawTarget3  = price + atr * 4.5;
      const rawStopLoss = price - atr * 0.8;

      // حماية رأس المال: الوقف لا يتجاوز 10% خسارة كحد أقصى مهما كان السهم عنيفاً
      const stopLoss = parseFloat(Math.max(rawStopLoss, price * 0.90).toFixed(2));
      const target1  = parseFloat(rawTarget1.toFixed(2));
      const target2  = parseFloat(rawTarget2.toFixed(2));
      const target3  = parseFloat(rawTarget3.toFixed(2));

      // حساب النسبة المئوية الفعلية للوقف والـ Risk لعرضها بشكل أنيق ومخفي
      const slPct = parseFloat((((stopLoss - price) / price) * 100).toFixed(2));
      const risk  = parseFloat((price - stopLoss).toFixed(2));

      // ── فلتر إدارة المخاطر: استبعاد الصفقات ذات نسبة ربح/مخاطرة سيئة ──
      const reward = target1 - price;
      const rr     = risk > 0 ? (reward / risk).toFixed(1) : "0";
      if (parseFloat(rr) < 1.0) continue; 

      // ── احتساب الـ Score الذكي (مدمج فيه حركات الـ VWAP والـ Gap والتغير) ──
      let score = 40;
      if (aboveVWAP)       score += 15; // السعر فوق الـ VWAP إشارة قوية
      if (preGap > 3)      score += 10;
      if (changePct > 5)   score += 10;
      if (changePct > 15)  score += 5;
      if (volume > 500000) score += 10;
      if (volume > 2000000) score += 5;
      if (atr / price > 0.06) score += 5; // تذبذب عالي يعطي سكور أعلى للفرص الانفجارية
      score = Math.min(score, 99);

      const confidence =
        score >= 80 ? "💥 قوة قصوى" :
        score >= 60 ? "🔥 إشارة ممتازة" : "👀 مراقبة";

      finalResults.push({
        symbol:     ticker,
        price:      parseFloat(price.toFixed(2)),
        change_pct: parseFloat(changePct.toFixed(2)),
        volume:     volume,
        rr:         rr,
        signal:     confidence, // متوافق بالملّي مع الواجهة
        score:      score,
        marketCap:  data.marketCap ? data.marketCap / 1_000_000 : null,
        levels: {
          sl: stopLoss,
          t1: target1,
          t2: target2,
          t3: target3,
          slPct: slPct,
          risk: risk
        }
      });
    }

    // ترتيب تلقائي: الأعلى سكور أولاً، ثم الأعلى حجماً
    finalResults.sort((a, b) => b.score - a.score || b.volume - a.volume);

    return res.status(200).json({
      success: true,
      results: finalResults.slice(0, 25), // إرسال أفضل 25 فرصة مصفاة ومقروءة للمستخدم
      total: WATCHLIST.length
    });

  } catch (error) {
    return res.status(200).json({ success: true, results: [] });
  }
}
