// lib/radar/services/PredictionEngine.js
// ============================================================
// RadarAZ v20.3 - Prediction Engine (ANTICIPATION model)
//
// 🎯 التحول الجوهري: من مطاردة الاختراق → إلى التنبؤ بالحركة قبلها.
//
// المشكلتان في v20.2 اللتان يعالجهما هذا الإصدار:
//   (1) كان يكافئ breakout بأعلى درجة (structure=1.0) و nearResistance بأقل
//       (0.7) — أي يعطي السهم درجة أعلى *بعد* ارتفاعه منه *قبله* = مطاردة.
//   (2) وزن earlyAccumulation (0.30، الأعلى في model_registry) كان كوداً ميتاً:
//       ruleBasedScore استخدم مفاتيح مختلفة (momentum/volume/...) فتجاهل
//       أوزان النموذج (earlyAccumulation/breakoutProbability/marketRegime).
//
// ✅ v20.3: خمسة مكوّنات تطابق أسماء model_registry بالضبط، فتصبح أوزان
//    النموذج فعّالة لأول مرة. الزخم/الحجم/التقلّب/الاتجاه صارت *مدخلات*
//    داخل هذه المكوّنات لا أوزاناً منفصلة:
//      earlyAccumulation (0.30) — التجمّع الاستباقي تحت المقاومة (قلب النظام).
//      breakoutProbability (0.25) — احتمال اختراق وشيك؛ ينخفض بعد الاختراق (مكافحة المطاردة).
//      structure (0.20) — نظافة الدعم/المقاومة وجودة R:R.
//      liquidity (0.15) — السيولة.
//      marketRegime (0.10) — سياق السوق.
//
// ملاحظة توافق: calculate() يبقى كما هو (ruleScore*ruleWeight)، حفاظاً على
// معايرة عتبات العرض الحالية. عند تفعيل aiScore لاحقاً يدخل نصيبه تلقائياً.
// ============================================================

export class PredictionEngine {

  static calculate(fv, weights = {}, ruleWeight = 0.7, aiWeight = 0.3) {
    const ruleScore = this.ruleBasedScore(fv, weights);
    // يُستبدل لاحقاً بالنموذج الذكي بعد جمع بيانات backtesting.
    const aiScore = 0;
    const aiActive = aiScore > 0;

    // 🆕 v20.6: تطبيع الدرجة. طالما aiScore غير مفعّل (=0)، ضرب ruleScore في
    //   ruleWeight (0.7) يسحق الدرجة (سقف فعلي ~70، تتكدّس حول 30-50) فتبدو
    //   التوصية ضعيفة زوراً. الحل: نعطي ruleScore الوزن الكامل حتى يُفعّل الذكاء،
    //   فتعود الدرجة لمقياسها الطبيعي (0-100). العلاقات النسبية محفوظة تماماً
    //   (كل الدرجات تُقاس بنفس المسطرة). عند تفعيل aiScore يعود المزج الطبيعي.
    if (!aiActive) {
      return Math.round(ruleScore);
    }
    return Math.round((ruleScore * ruleWeight) + (aiScore * aiWeight));
  }

  static ruleBasedScore(fv, weights = {}) {
    // أوزان تطابق model_registry (تُصبح فعّالة الآن). تجمع إلى 1.0.
    const W = {
      earlyAccumulation: 0.30,
      breakoutProbability: 0.25,
      structure: 0.20,
      liquidity: 0.15,
      marketRegime: 0.10,
      ...weights, // أوزان النموذج البطل تتجاوز الافتراضي
    };

    // ─── مدخلات خام ───
    const price = Number(fv.price ?? fv.close ?? 0);
    const rsi = Number(fv.rsi ?? 50);
    const rvol = Number(fv.rvol ?? 0);
    const atr = Number(fv.atr ?? 0);
    const ema9 = Number(fv.ema9 ?? 0);
    const ema21 = Number(fv.ema21 ?? 0);
    const vwap = Number(fv.vwap ?? 0);
    const change_pct = Number(fv.change_pct ?? 0);
    const resistance = fv.resistance;   // أقرب مقاومة فوق السعر (أو null عند الاختراق)
    const support = fv.support;         // أقرب دعم تحت السعر (أو null)
    const breakout = fv.breakout === true;
    const nearResistance = fv.nearResistance === true;
    const aboveVWAP = fv.aboveVWAP === true;

    const atrPct = price > 0 ? (atr / price) * 100 : 0;
    const distToResPct =
      (resistance != null && resistance > price && price > 0)
        ? ((resistance - price) / price) * 100
        : null;

    // ─── قابلية المضاربة (تقلّب كافٍ للحركة) — مضاعِف للمكوّنات الاستباقية ───
    let tradability;
    if (atrPct >= 2 && atrPct <= 8) tradability = 1.0;
    else if (atrPct > 8) tradability = 0.8;               // متقلّب جداً لكن قابل
    else if (atrPct >= 1) tradability = 0.6 + (atrPct - 1) * 0.4; // 0.6→1.0
    else tradability = 0.4;                                // هادئ جداً

    // ════════════════════════════════════════════════════════
    // 1) earlyAccumulation — التجمّع الاستباقي (قبل الحركة)
    //    يبلغ ذروته لسهم يقترب من المقاومة من الأسفل، بحجم يتزايد بهدوء،
    //    وزخم يبني دون تشبّع، فوق VWAP، ولم يمتدّ بعد اليوم.
    //    = 0 إذا اخترق فعلاً (ليس تجمّعاً، الحركة فاتت) أو لا مقاومة فوقه.
    // ════════════════════════════════════════════════════════
    let earlyAccumulation = 0;
    if (!breakout && distToResPct != null && distToResPct > 0) {
      // (أ) القرب من المقاومة من الأسفل: مثالي ضمن 3%، يتلاشى عند ~8%.
      let prox;
      if (distToResPct <= 3) prox = 1.0;
      else if (distToResPct <= 8) prox = 1 - (distToResPct - 3) / 5; // 1→0
      else prox = 0;

      // (ب) تزايد الحجم بهدوء: 1.2–2.2 مثالي؛ الانفجار (>3) «متأخر».
      let vol;
      if (rvol >= 1.2 && rvol <= 2.2) vol = 1.0;
      else if (rvol > 2.2 && rvol <= 3) vol = 0.7;
      else if (rvol > 3) vol = 0.4;                       // ينفجر أصلاً = متأخر
      else if (rvol >= 1) vol = ((rvol - 1) / 0.2) * 0.6; // 1→1.2 : 0→0.6
      else vol = rvol * 0.4;                              // <1 ضعيف

      // (ج) بناء الزخم دون تشبّع: 50–65 مثالي؛ >72 ممتد.
      let mom;
      if (rsi >= 50 && rsi <= 65) mom = 1.0;
      else if (rsi > 65 && rsi <= 72) mom = 0.7;
      else if (rsi > 72) mom = 0.35;                      // مُشبع = متأخر
      else if (rsi >= 42) mom = 0.4 + ((rsi - 42) / 8) * 0.6; // 42→50 : 0.4→1.0
      else mom = 0.2;

      // (د) قوة سياقية: فوق VWAP.
      const vwapScore = aboveVWAP ? 1.0 : 0.4;

      // (هـ) لم يمتدّ اليوم (طازج): تغيّر يومي صغير أفضل.
      const chg = Math.abs(change_pct);
      let fresh;
      if (chg <= 3) fresh = 1.0;
      else if (chg <= 7) fresh = 1 - ((chg - 3) / 4) * 0.6; // 1→0.4
      else fresh = 0.3;                                     // ركض أصلاً

      earlyAccumulation =
        (prox * 0.30 + vol * 0.25 + mom * 0.20 + vwapScore * 0.10 + fresh * 0.15) *
        tradability;
    }

    // ════════════════════════════════════════════════════════
    // 2) breakoutProbability — احتمال اختراق وشيك *قابل للالتقاط*
    //    يرتفع كلما اقترب من المقاومة مع دفع حجم واتجاه صاعد.
    //    ينخفض إلى 0.2 بعد الاختراق (الفرصة فاتت) = قلب مكافحة المطاردة.
    // ════════════════════════════════════════════════════════
    let breakoutProbability;
    if (breakout) {
      breakoutProbability = 0.2;                           // اخترق أصلاً = مطاردة
    } else if (distToResPct != null && distToResPct > 0) {
      let near;
      if (distToResPct <= 1) near = 1.0;
      else if (distToResPct <= 3) near = 0.8;
      else if (distToResPct <= 6) near = 0.5;
      else near = 0.2;

      const volPush = Math.min(
        rvol >= 1 ? 0.5 + (rvol - 1) * 1.0 : rvol * 0.5,
        1
      );
      const trendUp = ema21 > 0 && ema9 > ema21 ? 1.0 : 0.5;

      breakoutProbability = (near * 0.5 + volPush * 0.3 + trendUp * 0.2) * tradability;
    } else {
      breakoutProbability = 0.2;                           // لا مقاومة/قمم جديدة
    }

    // ════════════════════════════════════════════════════════
    // 3) structure — نظافة الدعم/المقاومة وجودة المخاطرة/العائد
    // ════════════════════════════════════════════════════════
    let structure = 0.3;
    const hasSup = support != null && support < price;
    const hasRes = resistance != null && resistance > price;
    if (hasSup && hasRes) {
      const up = resistance - price;
      const down = price - support;
      const rr = down > 0 ? up / down : 2;
      structure = rr >= 2 ? 1.0 : rr >= 1 ? 0.6 + (rr - 1) * 0.4 : 0.4 + rr * 0.2;
    } else if (hasSup) {
      structure = 0.6;   // دعم واضح وأفق مفتوح
    } else if (hasRes) {
      structure = 0.5;
    } else {
      structure = 0.3;
    }
    if (aboveVWAP) structure = Math.min(1, structure + 0.1);

    // ════════════════════════════════════════════════════════
    // 4) liquidity
    // ════════════════════════════════════════════════════════
    const liquidity = Math.max(0, Math.min((fv.volume || 0) / 1000000, 1));

    // ════════════════════════════════════════════════════════
    // 5) marketRegime
    // ════════════════════════════════════════════════════════
    const regime = String(fv.market_regime ?? fv.marketRegime ?? '').toLowerCase();
    let marketRegime = 0.5;
    if (regime === 'strong' || regime === 'bull') marketRegime = 1;
    else if (regime === 'neutral') marketRegime = 0.6;
    else if (regime === 'weak' || regime === 'bear') marketRegime = 0.25;

    // ─── الدرجة النهائية (الأوزان تجمع إلى 1.0) ───
    const score =
      earlyAccumulation * 100 * W.earlyAccumulation +
      breakoutProbability * 100 * W.breakoutProbability +
      structure * 100 * W.structure +
      liquidity * 100 * W.liquidity +
      marketRegime * 100 * W.marketRegime;

    return Math.max(0, Math.min(Math.round(score), 100));
  }

  // ════════════════════════════════════════════════════════
  // classifySetup — تصنيف مرحلة الإعداد لكل إشارة.
  // يقرأه scan.js ليعرض «توصية جاهزة» مقابل «مطاردة/تنبيه».
  //   actionable=true  → قابلة للدخول (pre_breakout/approaching/pullback/building)
  //   actionable=false → فاتت نقطة الدخول (breakout/extended) → تُعرض كتنبيه
  // ════════════════════════════════════════════════════════
  static classifySetup(fv) {
    const price = Number(fv.price ?? 0);
    const res = fv.resistance;
    const sup = fv.support;
    const rvol = Number(fv.rvol ?? 0);
    const rsi = Number(fv.rsi ?? 50);
    const chg = Math.abs(Number(fv.change_pct ?? 0));

    const distToResPct =
      (res != null && res > price && price > 0) ? ((res - price) / price) * 100 : null;
    const distFromSupPct =
      (sup != null && sup < price && price > 0) ? ((price - sup) / price) * 100 : null;

    if (fv.breakout === true) {
      return { stage: 'breakout', label: 'اخترق — بدأت الحركة (تنبيه لا دخول)', actionable: false };
    }
    if (chg >= 7 && rsi > 72) {
      return { stage: 'extended', label: 'ممتد — تجاوز نقطة الدخول', actionable: false };
    }
    if (distToResPct != null && distToResPct <= 3 && rvol >= 1.2) {
      return { stage: 'pre_breakout', label: 'قبل الاختراق — توصية جاهزة', actionable: true };
    }
    if (fv.nearResistance === true) {
      return { stage: 'approaching', label: 'يقترب من المقاومة — راقب الدخول', actionable: true };
    }
    if (distFromSupPct != null && distFromSupPct <= 3) {
      return { stage: 'pullback', label: 'ارتداد من الدعم — منطقة دخول', actionable: true };
    }
    return { stage: 'building', label: 'يبني تحت المقاومة — مبكّر', actionable: true };
  }
}
