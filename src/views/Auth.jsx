import React, { useState } from 'react';
import { LayoutDashboard, Eye, EyeOff } from 'lucide-react';

function Auth({ supabase, onShowAlert }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) onShowAlert(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/30 px-4 py-12">
      <div className="max-w-sm w-full bg-white p-8 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200/60 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500"></div>
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4 text-blue-600 shadow-sm">
            <LayoutDashboard size={28} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Agricura</h2>
          <p className="text-slate-400 font-medium mt-1 text-sm">Control Contable</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5 px-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none font-medium text-slate-800 text-sm focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all" placeholder="usuario" required />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5 px-1">Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-lg outline-none font-medium text-slate-800 text-sm focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all" placeholder="••••••••" required />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-semibold py-2.5 px-6 rounded-lg shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-md text-sm active:scale-[0.98] transition-all mt-1 flex justify-center items-center gap-2">
            {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Validando...</> : 'Ingresar al Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Auth;
