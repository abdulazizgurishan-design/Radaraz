// السطر 173 (STRETCH)
const STRETCH = {
  ENABLED: true,
  WARN: 12,          // من 10 → 12
  PEN_K: 0.2,        // من 0.4 → 0.2
  PEN_CAP: 4,        // من 8 → 4
  BONUS_STRONG: 3,
  DROP: 25,          // من 18 → 25 (يسمح بامتداد أكبر)
};

// السطر 545 (fetchNews شرطي)
const wantNews = s.changePct > 12 || s.rvol > 8 || s.ep >= 70;  // رفع العتبة

// السطر 152 (DEADLINE)
const DEADLINE = t0 + 20000;   // من 25000 → 20000

// السطر 45 (HEAVY_LIMIT)
HEAVY_LIMIT: 60,   // من 45 → 60
