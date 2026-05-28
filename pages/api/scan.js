const POLYGON_KEY = process.env.POLYGON_API_KEY;
const BASE = "https://api.polygon.io";

export default async function handler(req, res) {
  try {
    // تحقق من الـ API Key
    if (!POLYGON_KEY) {
      return res.status(200).json({ error: "NO API KEY", key: "missing" });
    }

    // جلب سهم واحد فقط للتجربة
    const url = `${BASE}/v2/snapshot/locale/us/markets/stocks/tickers?tickers=AAPL,TSLA,NVDA&apiKey=${POLYGON_KEY}`;
    const r = await fetch(url);
    const d = await r.json();

    return res.status(200).json({
      key_exists: true,
      status: r.status,
      tickers_count: d?.tickers?.length ?? 0,
      sample: d?.tickers?.[0] ?? null,
      error: d?.error ?? null
    });

  } catch (error) {
    return res.status(200).json({ error: error.message });
  }
}
