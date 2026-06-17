'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface UserRow {
  id: string;
  name: string;
  username: string;
  role: 'admin' | 'operator' | 'display';
  counter_id: string | null;
}

export default function LoginPage() {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // 1. Ambil data user beserta password_hash untuk divalidasi
    const { data, error } = await supabase
      .from('users')
      .select('id, name, username, role, counter_id, password_hash')
      .eq('username', username.trim())
      .maybeSingle();

    if (error) {
      setErrorMsg('Terjadi kesalahan sistem koneksi.');
      setLoading(false);
      return;
    }

    if (!data) {
      setErrorMsg('Username tidak ditemukan.');
      setLoading(false);
      return;
    }

    // 2. Validasi kecocokan password_hash
    if (data.password_hash !== password) {
      setErrorMsg('Password yang Anda masukkan salah.');
      setLoading(false);
      return;
    }

    const user: UserRow = {
      id: data.id,
      name: data.name,
      username: data.username,
      role: data.role,
      counter_id: data.counter_id,
    };

    // 3. Amankan validasi role & counter_id sebelum disimpan ke session
    if (user.role === 'operator' && !user.counter_id) {
      setErrorMsg('Akun operator belum dikaitkan ke loket fisik mana pun.');
      setLoading(false);
      return;
    }

    // Simpan data sesi ke localStorage
    localStorage.setItem('user_session', JSON.stringify(user));

    // 4. Redirect bersih berdasarkan role masing-masing
    if (user.role === 'admin') {
      router.push('/admin');
    } else if (user.role === 'operator') {
      router.push('/operator');
    } else {
      router.push('/display');
    }
    
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 relative overflow-hidden">
      {/* Background Glow Effect */}
      <div className="absolute top-0 inset-x-0 h-80 bg-gradient-to-b from-blue-950/30 to-transparent pointer-events-none" />
      
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 relative z-10">
        <div className="text-center mb-6">
          <span className="text-3xl">🏛️</span>
          <h2 className="text-2xl font-black text-white mt-2">PTSP Log In</h2>
          <p className="text-sm text-slate-400 mt-1">Silahkan masuk menggunakan akun Anda</p>
        </div>
        
        {errorMsg && (
          <div className="bg-red-950/50 text-red-400 p-3.5 rounded-xl text-sm font-medium mb-5 border border-red-500/20 text-center animate-in fade-in zoom-in-95 duration-150">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 text-white text-sm transition-colors"
              placeholder="Masukkan username loket/admin"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 text-white text-sm transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-blue-700 active:scale-[0.98] transition disabled:opacity-50 mt-6 text-sm tracking-wide"
          >
            {loading ? 'Memverifikasi Sesi...' : 'Masuk Sistem'}
          </button>
        </form>
      </div>
    </div>
  );
}