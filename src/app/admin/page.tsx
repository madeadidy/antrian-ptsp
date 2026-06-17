'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface UserSession {
  id: string;
  name: string;
  username: string;
  role: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [admin, setAdmin] = useState<UserSession | null>(null);
  const [isResetLoading, setIsResetLoading] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // 1. Proteksi Halaman: Hanya ijinkan role 'admin'
  useEffect(() => {
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) {
      router.push('/login');
      return;
    }

    const session = JSON.parse(sessionStr) as UserSession;
    if (session.role !== 'admin') {
      alert('Akses ditolak! Halaman ini hanya untuk Administrator Utama.');
      router.push('/login');
      return;
    }

    setAdmin(session);
  }, [router]);

  // 2. Fungsi Eksekusi Reset Manual Seluruh Antrian
  async function handleManualReset() {
    setIsResetLoading(true);
    setSuccessMessage('');
    
    try {
      // Menghapus data antrian hari ini dari tabel queues.
      // Karena tabel 'queue_calls' dan 'audio_queue' menggunakan ON DELETE CASCADE,
      // menghapus data di 'queues' otomatis akan membersihkan tabel relasinya seketika.
      const { error } = await supabase
        .from('queues')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Trik hapus seluruh baris di Supabase client

      if (error) throw error;

      setSuccessMessage('Sistem Berhasil Direset! Semua antrian kembali ke angka 0.');
      setShowConfirm(false);
    } catch (err: unknown) {
      console.error(err);
      alert('Gagal melakukan reset database. Periksa hak akses RLS Supabase Anda.');
    } finally {
      setIsResetLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('user_session');
    router.push('/login');
  }

  if (!admin) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">Memeriksa Hak Akses Admin...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-4 md:p-8 relative select-none">
      {/* Glow Effect */}
      <div className="absolute top-0 inset-x-0 h-80 bg-gradient-to-b from-purple-950/20 to-transparent pointer-events-none" />

      <div className="max-w-4xl w-full mx-auto relative z-10 flex-1 flex flex-col justify-center">
        
        {/* HEADER PANEL */}
        <header className="flex justify-between items-center border-b border-slate-800 pb-6 mb-12">
          <div>
            <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-widest bg-purple-950/50 border border-purple-900 px-2.5 py-1 rounded-md w-fit">
              🛡️ Control Center
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-2">Administrator Panel</h1>
            <p className="text-slate-400 text-xs md:text-sm">Selamat datang kembali, <span className="text-slate-200 font-semibold">{admin.name}</span></p>
          </div>
          <button 
            onClick={handleLogout}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 transition"
          >
            Log Out
          </button>
        </header>

        {/* MAIN BODY CONTROL */}
        <main className="bg-slate-800/50 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-xl max-w-2xl w-full mx-auto text-center">
          <span className="text-4xl">⚙️</span>
          <h2 className="text-xl font-bold mt-3 text-white">Manajemen Pemeliharaan Sistem</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto mt-2 leading-relaxed">
            Gunakan tombol di bawah jika modul reset otomatis berbasis waktu mengalami kegagalan pergantian hari atau saat masa simulasi pengujian selesai.
          </p>

          {/* Alert Sukses */}
          {successMessage && (
            <div className="my-6 p-4 bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-sm font-semibold rounded-xl animate-in fade-in zoom-in-95">
              🎉 {successMessage}
            </div>
          )}

          {/* Trigger Tombol Reset Utama */}
          {!showConfirm ? (
            <button
              onClick={() => { setSuccessMessage(''); setShowConfirm(true); }}
              className="mt-8 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg shadow-red-900/20 transition active:scale-95 text-sm tracking-wider uppercase"
            >
              Reset Semua Antrian Sekarang
            </button>
          ) : (
            /* KONFIRMASI GANDA (SAFETY LOCK) */
            <div className="mt-8 p-6 bg-red-950/30 border border-red-500/20 rounded-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
              <h3 className="text-red-400 font-bold text-base mb-1">⚠️ Apakah Anda Sangat Yakin?</h3>
              <p className="text-slate-400 text-xs max-w-sm mx-auto mb-5 leading-relaxed">
                Tindakan ini akan menghapus seluruh nomor antrian aktif hari ini secara permanen. Layar monitor TV display akan langsung kembali kosong.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={handleManualReset}
                  disabled={isResetLoading}
                  className="bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg shadow disabled:opacity-50"
                >
                  {isResetLoading ? 'Mereset Data...' : 'Ya, Bersihkan Sekarang'}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={isResetLoading}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg border border-slate-700"
                >
                  Batalkan
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 text-center py-4 text-xs text-slate-600 font-mono mt-12">
        Sistem Manajemen Antrian PTSP • Mode Pengawasan Root Admin
      </footer>
    </div>
  );
}