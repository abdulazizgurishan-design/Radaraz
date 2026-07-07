// pages/api/company-details.js
// جلب تفاصيل الشركة (Market Cap, Shares, Shortable, Short Interest)
// ═══════════════════════════════════════════════════════════════════

const POLYGON_KEY = process.env.POLYGON_API_KEY;
const ALPACA_BASE = "https://paper-api.alpaca.markets";
const ALPACA_KEY = process.env.ALPACA_KEY;
const ALPACA_SECRET = process.env.ALPACA_SECRET;

const H = {
  "APCA-API-KEY-ID": ALPACA_KEY,
  "APCA-API-SECRET-KEY": ALPACA_SECRET,
  "Content-Type": "application/json",
};

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) {
    return res.status(400).json({ error: "Symbol required" });
  }

  try {
    // 1. من Alpaca (shortable)
    let shortable = false;
    let easyToBorrow = false;
    try {
      const assetRes = await fetch(`${ALPACA_BASE}/v2/assets/${symbol}`, { headers: H });
      if (assetRes.ok) {
        const asset = await assetRes.json();
        shortable = asset?.shortable || false;
        easyToBorrow = asset?.easy_to_borrow || false;
      }
    } catch {}

    // 2. من Polygon (market cap, shares)
    let marketCap = null;
    let sharesOutstanding = null;
    try {
      const detailsRes = await fetch(
        `https://api.polygon.io/v3/reference/tickers/${symbol}?apiKey=${POLYGON_KEY}`
      );
      if (detailsRes.ok) {
        const details = await detailsRes.json();
        marketCap = details?.results?.market_cap || null;
        sharesOutstanding = details?.results?.share_class_shares_outstanding || null;
      }
    } catch {}

    // 3. من Polygon (short interest)
    let shortInterest = null;
    try {
      const siRes = await fetch(
        `https://api.polygon.io/v3/reference/short-interest/${symbol}?apiKey=${POLYGON_KEY}`
      );
      if (siRes.ok) {
        const siData = await siRes.json();
        shortInterest = siData?.results?.[0]?.short_interest || null;
      }
    } catch {}

    return res.status(200).json({
      success: true,
      symbol,
      marketCap,
      sharesOutstanding,
      shortable,
      easyToBorrow,
      shortInterest,
    });

  } catch (error) {
    return res.status(200).json({
      success: false,
      error: error.message,
    });
  }
}
