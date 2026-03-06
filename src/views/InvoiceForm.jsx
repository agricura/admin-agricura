import React, { useState, useEffect } from 'react';
import { ChevronLeft, Package, PlusCircle, MinusCircle } from 'lucide-react';
import DateInput from '../components/DateInput';
import SelectInput from '../components/SelectInput';
import { formatCLP } from '../utils/formatters';

function InvoiceForm({ supabase, onSuccess, invoiceToEdit, onShowConfirm }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tipo_doc: invoiceToEdit?.tipo_doc || 'Factura',
    folio: invoiceToEdit?.folio || '',
    rut: invoiceToEdit?.rut || '',
    proveedor: invoiceToEdit?.proveedor || '',
    fecha_emision: invoiceToEdit?.fecha_emision || '',
    fecha_venc: invoiceToEdit?.fecha_venc || '',
    total_bruto: invoiceToEdit?.total_bruto || 0,
    iva: invoiceToEdit?.iva || 0,
    total_a_pagar: invoiceToEdit?.total_a_pagar || 0,
    centro_costo: invoiceToEdit?.centro_costo || '',
    item: invoiceToEdit?.item || '',
    items:
      invoiceToEdit?.items && Array.isArray(invoiceToEdit.items) && invoiceToEdit.items.length > 0
        ? invoiceToEdit.items
        : [{ detalle: '', cantidad: 1, total_item: 0 }],
  });

  const [focusField, setFocusField] = useState(null);
  const [tipoOptions, setTipoOptions] = useState(['Factura', 'Boleta', 'Nota de Crédito', 'Nota de Débito', 'Otro']);

  useEffect(() => {
    supabase
      .from('invoices')
      .select('tipo_doc')
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map((r) => r.tipo_doc).filter(Boolean))].sort();
          if (unique.length > 0) setTipoOptions([...unique.filter((o) => o !== 'Otro'), 'Otro']);
        }
      });
  }, []);

  const calculateTotals = (items, netoManual = null) => {
    const neto =
      items.length > 0 && items[0].detalle !== ''
        ? items.reduce((sum, it) => sum + (Number(it.total_item) || 0), 0)
        : netoManual !== null
        ? Number(netoManual)
        : Number(formData.total_bruto) || 0;
    const iva = Math.round(neto * 0.19);
    return { neto, iva, total: neto + iva };
  };

  const handleItemChange = (idx, field, value) => {
    const newItems = [...formData.items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    const { neto, iva, total } = calculateTotals(newItems);
    setFormData({ ...formData, items: newItems, total_bruto: neto, iva, total_a_pagar: total });
  };

  const handleGeneralChange = (e) => {
    const { name, value } = e.target;
    if (name === 'total_bruto') {
      const { neto, iva, total } = calculateTotals([], value);
      setFormData({ ...formData, total_bruto: neto, iva, total_a_pagar: total });
    } else if (name === 'iva') {
      const ivaVal = Number(value) || 0;
      setFormData({ ...formData, iva: ivaVal, total_a_pagar: Number(formData.total_bruto) + ivaVal });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { ...formData, items: formData.items.filter((it) => it.detalle.trim() !== ''), created_by: user.id };
      let res = invoiceToEdit
        ? await supabase.from('invoices').update(payload).eq('id', invoiceToEdit.id)
        : await supabase.from('invoices').insert([payload]);
      if (res.error) throw res.error;
      onSuccess();
    } catch (err) {
      onShowConfirm({ title: 'Error de Guardado', message: err.message, type: 'danger', onConfirm: () => {} });
    } finally {
      setLoading(false);
    }
  };

  const hasItems = formData.items.some((i) => i.detalle.trim() !== '');

  return (
    <div className="p-0 lg:p-4 max-w-5xl mx-auto space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-center gap-4">
        <button onClick={onSuccess} className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-all active:scale-[0.98] text-slate-500"><ChevronLeft size={18} /></button>
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">{invoiceToEdit ? 'Editar Registro' : 'Nuevo Documento'}</h2>
          <p className="text-slate-500 text-sm font-medium mt-0.5">Gestión y desglose contable</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="bg-white p-6 lg:p-8 rounded-xl border border-slate-200/60 space-y-7">
        {/* SECCIÓN 1: PROVEEDOR */}
        <div className="space-y-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block px-1">Proveedor y Datos Básicos</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Nombre del Proveedor</label>
              <input name="proveedor" value={formData.proveedor} onChange={handleGeneralChange} className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 px-4 py-2.5 rounded-lg font-semibold text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all outline-none text-slate-900 placeholder:text-slate-400 placeholder:font-normal" placeholder="Nombre de la Empresa o Proveedor" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Tipo de Documento</label>
              <SelectInput
                name="tipo_doc"
                options={tipoOptions}
                value={formData.tipo_doc}
                onChange={handleGeneralChange}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 lg:gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Folio / Número</label>
              <input name="folio" value={formData.folio} onChange={handleGeneralChange} className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 px-4 py-2.5 rounded-lg font-medium text-sm text-slate-800 outline-none transition-all focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" placeholder="Ej: 45001" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">RUT Proveedor</label>
              <input name="rut" value={formData.rut} onChange={handleGeneralChange} className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 px-4 py-2.5 rounded-lg font-medium text-sm text-slate-800 outline-none transition-all focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" placeholder="Ej: 76.123.456-7" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Fecha Emisión</label>
              <DateInput value={formData.fecha_emision} onChange={handleGeneralChange} name="fecha_emision" required className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 px-4 py-2.5 rounded-lg font-medium text-sm text-slate-800 outline-none transition-all focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Vencimiento</label>
              <DateInput value={formData.fecha_venc} onChange={handleGeneralChange} name="fecha_venc" required className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 px-4 py-2.5 rounded-lg font-medium text-sm text-slate-800 outline-none transition-all focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" />
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: PRODUCTOS */}
        <div className="space-y-4 pt-6 border-t border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2"><Package size={18} className="text-blue-500" /> Detalle de Ítems</h3>
          <div className="space-y-4">
            {formData.items.map((it, idx) => (
              <div key={idx} className="bg-slate-50 p-4 lg:p-5 rounded-xl border border-slate-200/60 space-y-3 relative group hover:bg-white hover:shadow-sm hover:border-slate-300 transition-all">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Descripción del Ítem</label>
                  <input value={it.detalle} onChange={(e) => handleItemChange(idx, 'detalle', e.target.value)} className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-slate-400" placeholder="Ej: Fertilizante Triple 15..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Cantidad</label>
                    <input type="number" step="0.01" value={it.cantidad} onChange={(e) => handleItemChange(idx, 'cantidad', e.target.value)} className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-lg text-sm text-center font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all" placeholder="1.00" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-emerald-600 uppercase tracking-wide px-1">Total (Sin IVA)</label>
                    <div className="bg-emerald-50/50 border border-emerald-200 px-4 py-2.5 rounded-lg flex items-center transition-all focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:bg-white focus-within:border-emerald-400">
                      <span className="text-emerald-600 font-semibold mr-2 text-sm">$</span>
                      <input
                        type={focusField === `i-${idx}` ? 'number' : 'text'}
                        value={focusField === `i-${idx}` ? it.total_item : formatCLP(it.total_item)}
                        onChange={(e) => handleItemChange(idx, 'total_item', e.target.value)}
                        onFocus={() => setFocusField(`i-${idx}`)}
                        onBlur={() => setFocusField(null)}
                        className="w-full bg-transparent text-right font-semibold text-emerald-900 text-sm font-mono outline-none"
                      />
                    </div>
                  </div>
                </div>
                {formData.items.length > 1 && (
                  <button type="button" onClick={() => setFormData({ ...formData, items: formData.items.filter((_, i) => i !== idx) })} className="absolute -top-3 -right-3 bg-white shadow-md text-rose-500 rounded-full p-1.5 border border-slate-100 transition-transform hover:scale-110 hover:text-rose-600 active:scale-[0.98]"><MinusCircle size={20} /></button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setFormData({ ...formData, items: [...formData.items, { detalle: '', cantidad: 1, total_item: 0 }] })} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-lg text-xs font-semibold uppercase tracking-wide text-slate-400 hover:bg-blue-50/50 hover:text-blue-600 hover:border-blue-300 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2">
              <PlusCircle size={18} /> Agregar Línea de Producto
            </button>
          </div>
        </div>

        {/* SECCIÓN 3: TOTALES */}
        <div className="bg-slate-900 p-6 lg:p-8 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full opacity-10 blur-[80px]"></div>
          <div className="space-y-2 z-10">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block px-1">Total Neto</label>
            <input name="total_bruto" type={focusField === 'neto' ? 'number' : 'text'} value={focusField === 'neto' ? formData.total_bruto : formatCLP(formData.total_bruto)} onChange={handleGeneralChange} onFocus={() => setFocusField('neto')} onBlur={() => setFocusField(null)} className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 font-semibold text-lg text-white font-mono outline-none transition-all focus:bg-white/10 focus:ring-2 focus:ring-blue-500/30 ${hasItems ? 'opacity-50 pointer-events-none' : ''}`} required readOnly={hasItems} />
          </div>
          <div className="space-y-2 z-10">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block px-1">IVA (19%)</label>
            <input name="iva" type={focusField === 'iva' ? 'number' : 'text'} value={focusField === 'iva' ? formData.iva : formatCLP(formData.iva)} onChange={handleGeneralChange} onFocus={() => setFocusField('iva')} onBlur={() => setFocusField(null)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 font-semibold text-lg text-blue-300 font-mono outline-none transition-all focus:bg-white/10 focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div className="space-y-2 z-10">
            <label className="text-xs font-semibold text-blue-300 uppercase tracking-wide block px-1">Total a Pagar</label>
            <div className="bg-blue-600 px-4 py-3.5 rounded-xl font-mono text-lg font-bold text-white border border-blue-500/40 flex items-center justify-end">
              ${formatCLP(formData.total_a_pagar)}
            </div>
          </div>
        </div>

        {/* SECCIÓN 4: CLASIFICACIÓN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Centro de Costo</label>
            <input name="centro_costo" value={formData.centro_costo} onChange={handleGeneralChange} className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 px-4 py-2.5 rounded-lg outline-none font-medium text-slate-800 uppercase text-sm transition-all focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400 placeholder:normal-case" placeholder="Ej: Agrícola Central" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Categoría Contable</label>
            <input name="item" value={formData.item} onChange={handleGeneralChange} className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 px-4 py-2.5 rounded-lg outline-none font-medium text-slate-800 uppercase text-sm transition-all focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400 placeholder:normal-case" placeholder="Ej: Insumos Químicos" />
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-end gap-3 pt-6 border-t border-slate-100">
          <button type="button" onClick={onSuccess} className="w-full md:w-auto px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all rounded-lg order-2 md:order-1 active:scale-[0.98] outline-none">Cancelar</button>
          <button type="submit" disabled={loading} className="w-full md:w-auto px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg text-sm shadow-sm shadow-blue-600/20 hover:shadow-md active:scale-[0.98] transition-all hover:bg-blue-700 outline-none order-1 md:order-2 flex justify-center items-center gap-2">
            {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Guardando...</> : 'Guardar Documento'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default InvoiceForm;
