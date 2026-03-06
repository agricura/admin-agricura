export const formatCLP = (val) => {
  return new Intl.NumberFormat('es-CL').format(Math.round(val || 0));
};

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// Converts "yyyy-mm-dd" → "dd-Mmm-yyyy" (e.g. "01-Mar-2026")
export const formatDate = (str) => {
  if (!str) return '—';
  const parts = String(str).split('-');
  if (parts.length !== 3) return String(str);
  const [y, m, d] = parts;
  const mes = MESES[parseInt(m, 10) - 1];
  if (!mes) return String(str);
  return `${d}-${mes}-${y}`;
};
