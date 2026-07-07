// pages/api/company-details.js
// جلب تفاصيل الشركة (Market Cap, Shares, Shortable, Short Interest, Description, Sector, etc.)
// ═══════════════════════════════════════════════════════════════════

const POLYGON_KEY = process.env.POLYGON_API_KEY;
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const ALPACA_BASE = "https://paper-api.alpaca.markets";
const ALPACA_KEY = process.env.ALPACA_KEY;
const ALPACA_SECRET = process.env.ALPACA_SECRET;

const H = {
  "APCA-API-KEY-ID": ALPACA_KEY,
  "APCA-API-SECRET-KEY": ALPACA_SECRET,
  "Content-Type": "application/json",
};

// ─── دوال تنسيق الأرقام (للاستخدام في الواجهة) ──────────────────
function formatMarketCap(value) {
  if (!value) return null;
  // Finnhub يعيد القيمة بالدولار العادي
  if (value >= 1e12) return { value: (value / 1e12).toFixed(2), suffix: 'T' };
  if (value >= 1e9) return { value: (value / 1e9).toFixed(2), suffix: 'B' };
  if (value >= 1e6) return { value: (value / 1e6).toFixed(2), suffix: 'M' };
  return { value: value.toFixed(2), suffix: '' };
}

function formatShares(value) {
  if (!value) return null;
  // Finnhub يعيد عدد الأسهم العادي
  if (value >= 1e9) return { value: (value / 1e9).toFixed(2), suffix: 'B' };
  if (value >= 1e6) return { value: (value / 1e6).toFixed(2), suffix: 'M' };
  return { value: value.toFixed(2), suffix: '' };
}

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

    // ─── 2. من Finnhub (نبذة الشركة الكاملة) ──────────────────
    let companyName = null;
    let description = null;
    let sector = null;
    let industry = null;
    let employees = null;
    let ceo = null;
    let website = null;
    let marketCap = null;
    let marketCapFormatted = null;
    let sharesOutstanding = null;
    let sharesFormatted = null;

    if (FINNHUB_KEY) {
      try {
        const profileRes = await fetch(
          `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`
        );
        if (profileRes.ok) {
          const profile = await profileRes.json();
          companyName = profile.name || null;
          description = profile.name ? `${profile.name} is a company in the ${profile.finnhubIndustry || ""} sector.` : null;
          sector = profile.finnhubIndustry || null;
          industry = profile.finnhubIndustry || null;
          employees = profile.employeeCount || null;
          ceo = profile.ceo || null;
          website = profile.weburl || null;
          
          // تنسيق الأرقام
          if (profile.marketCapitalization) {
            marketCap = profile.marketCapitalization;
            const formatted = formatMarketCap(marketCap);
            marketCapFormatted = formatted;
          }
          if (profile.shareOutstanding) {
            sharesOutstanding = profile.shareOutstanding;
            const formatted = formatShares(sharesOutstanding);
            sharesFormatted = formatted;
          }
        }
      } catch {}
    }

    // ─── 3. من Polygon (short interest) ──────────────────────────
    let shortInterest = null;
    let shortInterestFormatted = null;
    try {
      const siRes = await fetch(
        `https://api.polygon.io/v3/reference/short-interest/${symbol}?apiKey=${POLYGON_KEY}`
      );
      if (siRes.ok) {
        const siData = await siRes.json();
        shortInterest = siData?.results?.[0]?.short_interest || null;
        if (shortInterest) {
          const formatted = formatShares(shortInterest);
          shortInterestFormatted = formatted;
        }
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
      // البيانات المالية (الرقم الخام + المنسق)
      marketCap,
      marketCapFormatted,
      sharesOutstanding,
      sharesFormatted,
      // البيع على المكشوف
      shortable,
      easyToBorrow,
      shortInterest,
      shortInterestFormatted,
    });

  } catch (error) {
    return res.status(200).json({
      success: false,
      error: error.message,
    });
  }
}
