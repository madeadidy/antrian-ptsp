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

    // Mencari user berdasarkan username dan password_hash (custom login)
    const { data, error } = await supabase
      .from('users')
      .select('id, name, username, role, counter_id')
      .eq('username', username)
      .eq('password_hash', password) // Pada produksi, gunakan hashing seperti bcrypt
      .maybeSingle();

    if (error) {
      setErrorMsg('Terjadi kesalahan sistem.');
      setLoading(false);
      return;
    }

    if (!data) {
      setErrorMsg('Username atau password salah.');
      setLoading(false);
      return;
    }

    const user = data as UserRow;

    // Simpan data sesi ke localStorage
    localStorage.setItem('user_session', JSON.stringify(user));

    // Redirect berdasarkan role
    if (user.role === 'operator') {
      router.push('/operator');
    } else if (user.role === 'admin') {
      router.push('/admin'); // Modul admin masa depan
    } else {
      router.push('/display');
    }
    
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md border border-slate-200">
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">PTSP Log In</h2>
        <p className="text-sm text-center text-slate-500 mb-6">Silahkan masuk menggunakan akun Anda</p>
        
        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium mb-4 border border-red-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800"
              placeholder="Masukkan username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg shadow hover:bg-blue-700 transition disabled:opacity-50 mt-6"
          >
            {loading ? 'Memverifikasi...' : 'Masuk Sistem'}
          </button>
        </form>
      </div>
    </div>
  );
}