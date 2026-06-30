// ─── 🃏 بطاقة مبسطة وجذابة للمستخدم الجديد ───
function Card({ r, idx, t, lang, isEarly, isFav, onToggleFav }) {
  const en = lang === "en";
  const [open, setOpen] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savedNote, setSavedNote] = useState('');

  // تحميل الملاحظة من localStorage
  useEffect(() => {
    const notes = JSON.parse(localStorage.getItem('favorite_notes') || '{}');
    setSavedNote(notes[r.symbol] || '');
    setNoteText(notes[r.symbol] || '');
  }, [r.symbol]);

  const isRebound = r.type === "ارتداد" || r.is_rebound;
  const isSniper = r.is_sniper || r.sniper_type || false;
  
  const formatPrice = useCallback((n) => "$" + (+n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), []);
  const formatPct   = useCallback((n) => (n >= 0 ? "+" : "") + Math.round(+n) + "%", []);

  // ✅ حساب المخاطرة
  const getRiskLevel = () => {
    const slPct = Math.abs(r.levels?.slPct || 0);
    if (slPct <= 4) return { label: en ? "🟢 Low" : "🟢 منخفضة", color: "#22c55e" };
    if (slPct <= 8) return { label: en ? "🟡 Medium" : "🟡 متوسطة", color: "#eab308" };
    return { label: en ? "🔴 High" : "🔴 مرتفعة", color: "#ef4444" };
  };

  // ✅ حساب القوة
  const getStrength = () => {
    const score = r.score || 0;
    if (score >= 80) return { label: en ? "🔥 Very Strong" : "🔥 قوي جداً", color: "#ff6b35" };
    if (score >= 60) return { label: en ? "💪 Strong" : "💪 قوي", color: "#fbbf24" };
    if (score >= 40) return { label: en ? "📊 Neutral" : "📊 محايد", color: "#60a5fa" };
    return { label: en ? "📉 Weak" : "📉 ضعيف", color: "#94a3b8" };
  };

  const risk = getRiskLevel();
  const strength = getStrength();

  // حفظ الملاحظة
  const saveNote = () => {
    const notes = JSON.parse(localStorage.getItem('favorite_notes') || '{}');
    if (noteText.trim() === '') {
      delete notes[r.symbol];
    } else {
      notes[r.symbol] = noteText.trim();
    }
    localStorage.setItem('favorite_notes', JSON.stringify(notes));
    setSavedNote(noteText.trim());
    setShowNote(false);
  };

  return (
    <div className="card-simple">
      {/* صف العلوي: رمز + سعر + تغيير + زر المفضلة */}
      <div className="card-simple-header">
        <div className="card-simple-left">
          <span className="card-simple-symbol">{r.symbol}</span>
          {isSniper && <span className="badge-sniper">🎯</span>}
          {isRebound && <span className="badge-rebound">🔄</span>}
          {isEarly && !isRebound && !isSniper && <span className="badge-early">🔍</span>}
        </div>
        <div className="card-simple-center">
          <span className="card-simple-price">${r.price}</span>
          <span className={`card-simple-change ${r.change_pct >= 0 ? 'up' : 'down'}`}>
            {r.change_pct >= 0 ? '▲' : '▼'} {Math.abs(r.change_pct)}%
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFav && onToggleFav(r); }}
          className={`card-simple-fav ${isFav ? 'active' : ''}`}
          title={isFav ? t.removeFav : t.addFav}
        >
          {isFav ? '⭐' : '☆'}
        </button>
      </div>

      {/* صف القوة والمخاطرة */}
      <div className="card-simple-metrics">
        <span className="metric-strength" style={{ color: strength.color }}>
          {strength.label}
        </span>
        <span className="metric-risk" style={{ color: risk.color }}>
          {risk.label}
        </span>
      </div>

      {/* الهدف والوقف */}
      <div className="card-simple-targets">
        {r.levels?.t1 && (
          <span className="target-item target1">
            🎯 {formatPrice(r.levels.t1)} <span className="target-pct">{formatPct(r.levels.t1Pct)}</span>
          </span>
        )}
        {r.levels?.sl && (
          <span className="target-item stop">
            🛑 {formatPrice(r.levels.sl)} <span className="target-pct">{formatPct(r.levels.slPct)}</span>
          </span>
        )}
      </div>

      {/* الأزرار الثلاثة */}
      <div className="card-simple-actions">
        <button 
          onClick={() => setOpen(!open)}
          className="action-btn primary"
        >
          {en ? "📖 Simple View" : "📖 شرح بسيط"}
        </button>
        <button 
          onClick={() => setOpen(!open)}
          className="action-btn secondary"
        >
          {en ? "📊 Advanced" : "📊 تحليل متقدم"}
        </button>
        <button 
          onClick={() => setShowNote(!showNote)}
          className="action-btn note"
        >
          {savedNote ? '📝' : '📝+'}
        </button>
      </div>

      {/* شرح بسيط (يظهر عند الضغط) */}
      {open && (
        <div className="card-simple-details">
          <div className="simple-explanation">
            <p>
              {en 
                ? `📈 ${r.symbol} is in an upward trend. The stock is ${strength.label.toLowerCase()} with ${risk.label.toLowerCase()} risk.`
                : `📈 ${r.symbol} في اتجاه صاعد. السهم ${strength.label} مع مخاطرة ${risk.label}.`
              }
            </p>
            <p>
              {en 
                ? `🎯 First target at ${formatPrice(r.levels?.t1)} (${formatPct(r.levels?.t1Pct)}).`
                : `🎯 الهدف الأول عند ${formatPrice(r.levels?.t1)} (${formatPct(r.levels?.t1Pct)}).`
              }
            </p>
            <p>
              {en 
                ? `🛑 Stop loss at ${formatPrice(r.levels?.sl)} (${formatPct(r.levels?.slPct)}).`
                : `🛑 وقف الخسارة عند ${formatPrice(r.levels?.sl)} (${formatPct(r.levels?.slPct)}).`
              }
            </p>
          </div>

          {/* خريطة السوق (التحليل المتقدم) */}
          <div className="simple-structure">
            <StructureMap r={r} lang={lang} />
          </div>
        </div>
      )}

      {/* محرر الملاحظة */}
      {showNote && (
        <div className="card-note-editor">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder={en ? "Write your notes here..." : "اكتب ملاحظتك هنا..."}
            rows={2}
          />
          <div className="note-actions">
            <button onClick={() => setShowNote(false)} className="note-cancel">
              {en ? "Cancel" : "إلغاء"}
            </button>
            <button onClick={saveNote} className="note-save">
              {en ? "💾 Save" : "💾 حفظ"}
            </button>
          </div>
          {savedNote && (
            <div className="saved-note">
              <span>📝 {savedNote}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
