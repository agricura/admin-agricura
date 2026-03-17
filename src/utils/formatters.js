export const formatCLP = (val) => {
  return new Intl.NumberFormat('es-CL').format(Math.round(val || 0));
};

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// ── Date helpers ──────────────────────────────────────────────────────────────
// Handles: Excel serial ints, JS Date objects, "dd-mm-yy", "dd-mm-yyyy", "yyyy/mm/dd", "yyyy-mm-dd"
export const parseDate = (v) => {
  if (!v && v !== 0) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400000);
    return isNaN(d) ? null : d;
  }
  const s = String(v).trim();
  const m1 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (m1) {
    let [, dd, mm, yy] = m1;
    if (yy.length === 2) yy = parseInt(yy) < 50 ? `20${yy}` : `19${yy}`;
    return new Date(`${yy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}T00:00:00`);
  }
  const m2 = s.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
  if (m2) return new Date(`${m2[1]}-${m2[2]}-${m2[3]}T00:00:00`);
  return null;
};

// Formats any date value → "dd-Mmm-yyyy" (e.g. "01-Mar-2026")
export const formatDate = (v) => {
  if (!v && v !== 0) return '—';
  // Fast path: "yyyy-mm-dd" string (most common from Supabase)
  if (typeof v === 'string') {
    const parts = v.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const mes = MESES[parseInt(parts[1], 10) - 1];
      if (mes) return `${parts[2]}-${mes}-${parts[0]}`;
    }
  }
  // General path: parse then format
  const d = parseDate(v);
  if (!d || isNaN(d)) return v ? String(v) : '—';
  const day = String(d.getDate()).padStart(2, '0');
  const mes = MESES[d.getMonth()];
  const y = d.getFullYear();
  return `${day}-${mes}-${y}`;
};

// Returns "yyyy-mm-dd" string for filter/sort comparison
export const toISODate = (v) => {
  const d = parseDate(v);
  if (!d || isNaN(d)) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
