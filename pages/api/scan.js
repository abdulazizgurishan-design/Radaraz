import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
  // تعطيل تحذيرات المكتبة لزيادة سرعة معالجة الـ 200 شركة
  try { yahooFinance.suppressNotices(['yahooFinance78']); } catch(e){}

  // القائمة الكاملة المحدثة لـ 200 شركة أمريكية (ميكرو كاب) للفحص الشرعي والفني
  const TICKERS_TO_SCAN = [
    // المجموعات الأولى: تكنولوجيا وذكاء اصطناعي وطاقة
    "PALT", "AMST", "MARK", "WISA", "BCOV", "MVIS", "SINT", "CEI", "SISI", "REUN",
    "AOSL", "AKTS", "AEHR", "ADTN", "IOTS", "ALRM", "DDD", "ALT", "AGEN", "AMTX",
    "SNMP", "GFAI", "INDP", "HUBC", "TCBP", "IMTX", "VRA", "LIDR", "ZVSA", "NVOS",
    "BETS", "OCEA", "SOUN", "HOLO", "MTC", "AIXI", "GNS", "MDAI", "JUPW", "PBTS",
    "RENE", "CISO", "ISPR", "XBP", "INVO", "WAVS", "STIX", "TLSA", "ENG", "SPI",
    // المجموعات الثانية: تكنولوجيا حيوية ورعاية صحية رخيصة
    "OPTT", "GEVO", "CLSK", "ANY", "MIGI", "WULF", "IREN", "CORZ", "TERW", "VERB",
    "PEV", "SOPA", "BTTX", "KTRA", "VBLT", "STAF", "TYDE", "BBIG", "MULN", "XELA",
    "CEAD", "IMPP", "SHIP", "TOPS", "EDRY", "PSI", "GLBS", "SINO", "CTR", "RELI",
    "AUST", "BDRX", "TCJH", "WLGS", "KXIN", "HUDI", "WNW", "EZGO", "CNSP", "APDN",
    "VCNX", "OCUP", "TENX", "AIHS", "PLUR", "CDIO", "LIPO", "SVRE", "BBLG", "REVB",
    // المجموعات الثالثة: سلع استهلاكية وخدمات ومواد أساسية
    "ZVZZ", "LOGC", "MRAI", "MGIH", "BFRG", "BSFC", "BDR", "MCENT", "NEXI", "LGMK",
    "BMEA", "CPOP", "TCON", "LPTX", "ECX", "LYT", "MTC", "SXTC", "CREG", "WAFU",
    "IDAI", "INBS", "MEDS", "VACC", "STAL", "IPW", "BBOX", "EFSH", "GROM", "QH",
    "CLEU", "GLG", "RETO", "AIU", "METX", "EDTK", "CONY", "AMBO", "MOXC", "CDRE",
    "AURA", "CNEY", "STG", "TTOO", "AVTX", "EBET", "IMTE", "APM", "HOLO", "ISPC",
    // المجموعات الرابعة: شركات صغيرة منوعة تنطبق عليها شروط القيمة السوقية
    "PALI", "MNPR", "GNPX", "OCGN", "BNTC", "CRKN", "BOF", "XCUR", "ATNF", "PRST",
    "PTPI", "NUZE", "IMAC", "SINT", "VIVE", "APVO", "OMQS", "MYSZ", "SBEV", "WVVI",
    "DYAI", "CONX", "REPX", "RETO", "DTST", "MTEK", "BLBX", "IVDA", "MGIH", "LICN",
    "LRE", "BWAY", "FRGT", "CUBG", "YOTA", "SWIN", "ZAPP", "KITT", "GMM", "TIVC",
    "VHAI", "NWTN", "NHOA", "CNEY", "SZZL", "PLMI", "OBLG", "SMFL", "AAGR", "LVO"
  ];

  let results = [];

  // فحص أعلى 50 شركة نشطة كمرحلة أولى لضمان عدم حدوث بطء (Timeout) في سيرفر Vercel المجاني
  const optimizedList = TICKERS_TO_SCAN.slice(0, 60); 

  for (let tickerSymbol of optimizedList) {
    try {
      const quote = await yahooFinance.quote(tickerSymbol);
      if (!quote) continue;

      const marketCap = quote.marketCap || 0;
      const totalDebt = quote.totalDebt || 0;
      const currentPrice = quote.regularMarketPrice || 0;

      // 1. شرط الماركت كاب (أقل من 200 مليون دولار)
      if (marketCap === 0 || marketCap > 200000000) continue;

      // 2. الفحص الشرعي الكمي (الديون أقل من 30% من القيمة السوقية)
      const debtRatio = marketCap > 0 ? (totalDebt / marketCap) : 1;
      if (debtRatio >= 0.30) continue; 

      // 3. شروط الانفجار وفحص السيولة المتدفقة
      const volume = quote.regularMarketVolume || 0;
      const avgVolume = quote.averageDailyVolume3Month || 1;
      let signal = "متوافق - تداول مستقر";

      if (volume > avgVolume * 1.4) {
        signal = "🔥 انفجار سعري (سيولة ضخمة)";
      } else if (volume > avgVolume * 1.1) {
        signal = "⚡ تدفق سيولة إيجابي";
      }

      results.push({
        symbol: tickerSymbol,
        price: currentPrice,
        marketCap: marketCap.toLocaleString(),
        debtRatio: (debtRatio * 100).toFixed(2) + "%",
        signal: signal
      });

    } catch (error) {
      continue; // تجاوز الشركات التي تواجه مشاكل مؤقتة في سيرفرات ياهو
    }
  }

  // إرجاع النتيجة للواجهة الأمامية ليعرض العداد الرقمي البيانات فوراً
  res.status(200).json({ success: true, data: results });
}
