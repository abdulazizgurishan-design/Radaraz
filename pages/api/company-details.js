// pages/api/company-details.js
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

// ─── ✅ دوال تحويل الأرقام ──────────────────────────────────────────
function formatNumber(value) {
  if (!value) return null;
  // Finnhub يعيد القيمة بالملايين، نحولها إلى رقم كامل مع فواصل
  const num = Number(value) * 1000000;
  return num.toLocaleString();
}

export default async function handler(req, res) {
  const { symbol } = req.query;
  
  // ✅ التحقق من وجود الرمز
  if (!symbol) {
    return res.status(200).json({
      success: false,
      error: "Symbol required",
    });
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
    } catch (e) {
      console.warn('Alpaca error:', e.message);
    }

    // ─── 2. من Finnhub (نبذة الشركة) ──────────────────────────
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
          
          if (profile.marketCapitalization) {
            marketCap = profile.marketCapitalization;
            marketCapFormatted = formatNumber(marketCap);
          }
          if (profile.shareOutstanding) {
            sharesOutstanding = profile.shareOutstanding;
            sharesFormatted = formatNumber(sharesOutstanding);
          }
        }
      } catch (e) {
        console.warn('Finnhub error:', e.message);
      }
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
          shortInterestFormatted = formatNumber(shortInterest);
        }
      }
    } catch (e) {
      console.warn('Polygon short interest error:', e.message);
    }

    // ─── 4. الرد (مع التأكد من عدم وجود undefined) ──────────────
    return res.status(200).json({
      success: true,
      symbol: symbol || null,
      companyName: companyName || null,
      description: description || null,
      sector: sector || null,
      industry: industry || null,
      employees: employees || null,
      ceo: ceo || null,
      website: website || null,
      marketCap: marketCap || null,
      marketCapFormatted: marketCapFormatted || null,
      sharesOutstanding: sharesOutstanding || null,
      sharesFormatted: sharesFormatted || null,
      shortable: shortable || false,
      easyToBorrow: easyToBorrow || false,
      shortInterest: shortInterest || null,
      shortInterestFormatted: shortInterestFormatted || null,
    });

  } catch (error) {
    console.error('Company details error:', error);
    return res.status(200).json({
      success: false,
      error: error.message || "Failed to fetch company details",
    });
  }
}
