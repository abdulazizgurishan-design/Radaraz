// pages/api/market-status.js
// ─────────────────────────────────────────────
//  جلب حالة السوق الديناميكية
// ─────────────────────────────────────────────

export default function handler(req, res) {
  // ─── نظام حالة السوق ──────────────────────────────────────────
  function getMarketStatus() {
    const etNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const etH = etNow.getHours(), etM = etNow.getMinutes();
    const day = etNow.getDay();
    const isWeekend = day === 0 || day === 6;
    
    const isPreMarket = !isWeekend && (etH >= 4 && (etH < 9 || (etH === 9 && etM < 30)));
    const isMarketOpen = !isWeekend && (etH > 9 || (etH === 9 && etM >= 30)) && etH < 16;
    const isAfterHours = !isWeekend && etH >= 16 && etH < 20;
    const isClosed = isWeekend || etH >= 20 || etH < 4;
    
    let status, label, icon, warning, mode;
    if (isPreMarket) {
      status = "premarket";
      label = "🔵 Pre-Market";
      icon = "🔵";
      warning = "⚠️ سيولة أقل · تقلب أعلى · تداول بحذر";
      mode = "premarket";
    } else if (isMarketOpen) {
      status = "open";
      label = "🟢 السوق مفتوح";
      icon = "🟢";
      warning = "";
      mode = "open";
    } else if (isAfterHours) {
      status = "afterhours";
      label = "🟡 After-Hours";
      icon = "🟡";
      warning = "⚠️ سيولة منخفضة · تداول بحذر";
      mode = "afterhours";
    } else {
      status = "closed";
      label = "🔴 السوق مغلق";
      icon = "🔴";
      warning = "⏳ سيتم تحديث الإشارات بعد فتح السوق";
      mode = "closed";
    }
    
    return {
      status,
      label,
      icon,
      warning,
      mode,
      isPreMarket,
      isMarketOpen,
      isAfterHours,
      isClosed,
      saudiTime: {
        preMarketStart: "11:00 ص",
        preMarketEnd: "4:30 م",
        marketOpen: "4:30 م",
        marketClose: "11:00 م",
      }
    };
  }

  const marketStatus = getMarketStatus();
  
  return res.status(200).json(marketStatus);
}
