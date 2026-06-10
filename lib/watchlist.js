// lib/watchlist.js
// ═══════════════════════════════════════════════════════════════════
//  قائمة ديناميكية تُحدّث يومياً من Polygon → Supabase
// ═══════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

// قائمة احتياطية بسيطة (fallback)
export const FALLBACK_LEADERS = [
  "NVDA","AMD","MSFT","META","GOOGL","AMZN","AAPL","TSLA","PLTR","SMCI",
  "CRWD","DDOG","SNOW","RBLX","UBER","LYFT","ABNB","DASH","COIN","HOOD",
  "SOFI","MSTR","NET","ZS","OKTA","SHOP","SQ","PYPL","AFRM","SPOT",
  "SNAP","PINS","RDDT","MRVL","QCOM","AVGO","MU","INTC","ON","MARA",
  "RIOT","CLSK","IREN","MRNA","BNTX","VRTX","REGN","ILMN","BIIB","GILD",
];

const FALLBACK_SPECULATION = [
  "SOUN","BBAI","KULR","CRKN","AIXI","AEYE","GFAI","BTBT","WULF","HIVE",
  "NKLA","MULN","WISA","CBAT","BFRI","SIGA","GOVX","JOBY","RKLB",
  "LCID","HIMS","ENVX","PLUG","FCEL","FUBO","GRPN","WKHS","GOEV","SPCE",
  "RIDE","SOLO","KNDI","ATHE","ARMP","ALHC","GPCR","AIRS","ATER","ATHX",
];

export async function loadWatchlist() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return buildFallback();
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/watchlist_active?select=symbol,type&order=dollar_volume.desc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) return buildFallback();
    const rows = await res.json();
    if (!rows.length) return buildFallback();

    const LEADERS     = rows.filter(r => r.type === "leader").map(r => r.symbol);
    const SPECULATION = rows.filter(r => r.type === "speculation").map(r => r.symbol);
    const WATCHLIST   = [...new Set([...LEADERS, ...SPECULATION])];

    return { LEADERS, SPECULATION, WATCHLIST, source: "supabase" };
  } catch (err) {
    return buildFallback();
  }
}

function buildFallback() {
  const LEADERS     = FALLBACK_LEADERS;
  const SPECULATION = FALLBACK_SPECULATION;
  const WATCHLIST   = [...new Set([...LEADERS, ...SPECULATION])];
  return { LEADERS, SPECULATION, WATCHLIST, source: "fallback" };
}

// Static exports للتوافق
export const LEADERS = FALLBACK_LEADERS;
export const SPECULATION = FALLBACK_SPECULATION;
export const WATCHLIST = [...new Set([...LEADERS, ...SPECULATION])];
