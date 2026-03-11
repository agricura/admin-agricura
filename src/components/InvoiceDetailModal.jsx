import React, { useState, useRef, useEffect } from 'react';
import { Package, X, Pencil, FileText, Upload, Loader2, ExternalLink, Trash2 } from 'lucide-react';
import { formatCLP, formatDate } from '../utils/formatters';

const BUCKET = 'invoice-documents';

const InvoiceDetailModal = ({ invoice, onClose, onEdit, supabase }) => {
  if (!invoice) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(invoice.document_url || null);
  const [showPdf, setShowPdf] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Refresh pdfUrl if invoice changes
  useEffect(() => { setPdfUrl(invoice.document_url || null); }, [invoice.document_url]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;
    if (file.type !== 'application/pdf') { setUploadError('Solo se permiten archivos PDF.'); return; }
    if (file.size > 10 * 1024 * 1024) { setUploadError('El archivo no puede superar 10 MB.'); return; }

    setUploading(true);
    setUploadError(null);
    try {
      const path = `${invoice.id}/${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const { error: dbErr } = await supabase.from('invoices').update({ document_url: publicUrl }).eq('id', invoice.id);
      if (dbErr) throw dbErr;

      setPdfUrl(publicUrl);
      invoice.document_url = publicUrl;
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!supabase || !pdfUrl) return;
    setUploading(true);
    try {
      // Extract storage path from public URL
      const parts = pdfUrl.split(`/storage/v1/object/public/${BUCKET}/`);
      if (parts[1]) {
        await supabase.storage.from(BUCKET).remove([decodeURIComponent(parts[1])]);
      }
      await supabase.from('invoices').update({ document_url: null }).eq('id', invoice.id);
      setPdfUrl(null);
      invoice.document_url = null;
      setShowPdf(false);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200/60">
        <div className="bg-white border-b border-slate-100 p-5 lg:p-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600"><Package size={20} /></div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                #{invoice.folio}
                <span className="text-xs uppercase font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md tracking-wide">{invoice.tipo_doc}</span>
              </h3>
              <p className="text-slate-500 text-sm font-medium truncate max-w-[200px] lg:max-w-none mt-0.5">{invoice.proveedor}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(invoice)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-sm font-medium transition-all active:scale-[0.98]"
              >
                <Pencil size={14} /> Editar
              </button>
            )}
            <button onClick={onClose} className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg transition-all active:scale-[0.98]"><X size={18} /></button>
          </div>
        </div>

        <div className="p-5 lg:p-6 overflow-y-auto space-y-6 bg-slate-50/30">
          <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-white border border-slate-100 shadow-sm">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-1 tracking-wide">Fecha Emisión</p>
              <p className="font-mono text-sm font-semibold text-slate-800">{formatDate(invoice.fecha_emision)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-1 tracking-wide">Vencimiento</p>
              <p className={`font-mono text-sm font-semibold ${todayStr > invoice.fecha_venc && invoice.status_pago === 'PENDIENTE' ? 'text-rose-600' : 'text-slate-800'}`}>{formatDate(invoice.fecha_venc)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-1 tracking-wide">RUT Proveedor</p>
              <p className="font-mono text-sm font-semibold text-slate-800">{invoice.rut || '—'}</p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-2">Desglose de Productos</h4>
            <div className="space-y-3">
              {invoice.items && invoice.items.length > 0 ? (
                invoice.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-slate-200 transition-colors">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm font-semibold text-slate-800 truncate mb-0.5">{it.detalle}</p>
                      <p className="text-xs text-slate-500 font-medium">Cant: {it.cantidad}</p>
                    </div>
                    <p className="font-bold text-slate-900 text-base font-mono">${formatCLP(it.total_item)}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-200">
                  <p className="text-slate-400 text-sm font-medium">Sin detalle de productos registrado.</p>
                </div>
              )}
            </div>
          </div>

          {/* Documento PDF */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-2">Documento Original</h4>
            {pdfUrl ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowPdf(!showPdf)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                  >
                    <FileText size={15} />
                    {showPdf ? 'Ocultar documento' : 'Ver documento'}
                  </button>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-medium transition-all active:scale-[0.97]"
                  >
                    <ExternalLink size={14} /> Abrir en nueva pestaña
                  </a>
                  {supabase && (
                    <button
                      onClick={handleDelete}
                      disabled={uploading}
                      className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-50"
                    >
                      {uploading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Eliminar
                    </button>
                  )}
                </div>
                {showPdf && (
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
                    <iframe src={pdfUrl} className="w-full h-[500px]" title="Documento PDF" />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 bg-white rounded-xl border border-dashed border-slate-200">
                <FileText size={28} className="text-slate-300" />
                <p className="text-slate-400 text-sm font-medium">Sin documento adjunto</p>
                {supabase && (
                  <>
                    <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleUpload} className="hidden" />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-50"
                    >
                      {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                      Subir PDF
                    </button>
                  </>
                )}
              </div>
            )}
            {uploadError && (
              <p className="text-sm text-rose-600 font-medium">{uploadError}</p>
            )}
          </div>

          <div className="bg-slate-900 p-5 rounded-xl text-white space-y-3 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500 rounded-full opacity-15 blur-3xl"></div>
            <div className="flex justify-between items-center text-sm font-medium opacity-80 border-b border-white/10 pb-3">
              <span>Subtotal Neto</span><span>${formatCLP(invoice.total_bruto)}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-medium opacity-80 border-b border-white/10 pb-3">
              <span>IVA (19%)</span><span>${formatCLP(invoice.iva)}</span>
            </div>
            <div className="pt-2 flex justify-between items-end relative z-10">
              <span className="text-xs font-semibold uppercase text-blue-300 tracking-wide">Total a Pagar</span>
              <span className="text-xl font-bold font-mono tracking-tight">${formatCLP(invoice.total_a_pagar)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetailModal;
