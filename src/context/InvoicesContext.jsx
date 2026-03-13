import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const InvoicesContext = createContext(null);

export function InvoicesProvider({ supabase, children }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    let all = [], from = 0;
    try {
      while (true) {
        const { data, error } = await supabase
          .from('invoices')
          .select('*')
          .order('fecha_emision', { ascending: false })
          .range(from, from + 999);
        if (error) throw error;
        all = [...all, ...data];
        if (data.length < 1000) break;
        from += 1000;
      }
      setInvoices(all);
    } catch (e) {
      setError(e.message || 'Error al cargar facturas');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Optimistic update — reverts on error
  const updateInvoice = useCallback(async (id, updates) => {
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv));
    const { error } = await supabase.from('invoices').update(updates).eq('id', id);
    if (error) { fetchInvoices(); return { error }; }
    return { error: null };
  }, [supabase, fetchInvoices]);

  // Optimistic delete — reverts on error
  const deleteInvoice = useCallback(async (id) => {
    setInvoices(prev => prev.filter(inv => inv.id !== id));
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) { fetchInvoices(); return { error }; }
    return { error: null };
  }, [supabase, fetchInvoices]);

  useEffect(() => {
    if (supabase) fetchInvoices();
  }, [supabase]);

  return (
    <InvoicesContext.Provider value={{ invoices, loading, error, updateInvoice, deleteInvoice, refetch: fetchInvoices }}>
      {children}
    </InvoicesContext.Provider>
  );
}

export function useInvoices() {
  const ctx = useContext(InvoicesContext);
  if (!ctx) throw new Error('useInvoices debe usarse dentro de InvoicesProvider');
  return ctx;
}
