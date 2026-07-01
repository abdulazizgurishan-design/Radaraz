// ─── تحميل البيانات ──────────────────────────────────────────────
const loadCached = useCallback(async () => {
  try {
    // ❌ قديماً: كان يجلب من /api/latest
    // const res = await fetch("/api/latest");
    
    // ✅ جديداً: نجلب من /api/scan مباشرة
    const res = await fetch("/api/scan?light=1");
    if (!res.ok) return;
    const data = await res.json();
    
    // استخراج الإشارات من الرد
    let cards = [];
    if (data.results) {
      cards = data.results.filter(s => (s.score || 0) >= DISPLAY_MIN_SCORE);
    }
    
    if (cards.length === 0 && data.opportunities) {
      // إذا ما في نتائج، نأخذ من الأقسام
      for (const key of ['ready', 'watch', 'late', 'hidden']) {
        if (data.opportunities[key]) {
          cards.push(...data.opportunities[key]);
        }
      }
    }
    
    // 🆕 حفظ حالة الرادار (عدد الإشارات الحية)
    setResults(cards);
    setTotal(cards.length);
    
    // تحديث الأقسام
    // ... باقي الكود
    
  } catch (err) {
    console.error('خطأ في تحميل البيانات:', err);
  }
}, []);
