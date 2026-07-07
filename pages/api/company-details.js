// pages/api/company-details.js
// جلب تفاصيل الشركة (Market Cap, Shares, Shortable, Short Interest, Description, Sector, etc.)
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
    // ─── 1. من Alpaca (shortable) ──────────────────────────────
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

    // ─── 2. من Polygon (تفاصيل الشركة الكاملة) ──────────────────
    let companyName = null;
    let description = null;
    let sector = null;
    let industry = null;
    let employees = null;
    let ceo = null;
    let website = null;
    let marketCap = null;
    let sharesOutstanding = null;

    try {
      const detailsRes = await fetch(
        `https://api.polygon.io/v3/reference/tickers/${symbol}?apiKey=${POLYGON_KEY}`
      );
      if (detailsRes.ok) {
        const details = await detailsRes.json();
        const r = details?.results || {};
        companyName = r.name || null;
        description = r.description || null;
        sector = r.sector || null;
        industry = r.industry || null;
        employees = r.employees || null;
        ceo = r.ceo || null;
        website = r.website || null;
        marketCap = r.market_cap || null;
        sharesOutstanding = r.share_class_shares_outstanding || r.weighted_shares_outstanding || null;
      }
    } catch {}

    // ─── 3. من Polygon (short interest) ──────────────────────────
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

    // ─── 4. الرد ──────────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      symbol,
      // تفاصيل الشركة
      companyName,
      description,
      sector,
      industry,
      employees,
      ceo,
      website,
      // البيانات المالية
      marketCap,
      sharesOutstanding,
      // البيع على المكشوف
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
