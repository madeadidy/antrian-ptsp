'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface UserSession {
  id: string;
  name: string;
  username: string;
  role: string;
}

interface ServiceRow {
  id: string;
  name: string;
  code: string;
}

interface QueueRow {
  id: string;
  status: 'waiting' | 'calling' | 'served' | 'skipped';
  service_id: string;
}

interface ServiceVolume {
  code: string;
  name: string;
  count: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [admin, setAdmin] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  
  // State Statistik Utama (4 Card Atas)
  const [stats, setStats] = useState({
    total: 0,
    served: 0,
    skipped: 0,
    waiting: 0,
  });

  // State Tabel Volume Antrian
  const [volumes, setVolumes] = useState<ServiceVolume[]>([]);

  // State Pengunci Reset Manual
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [isResetLoading, setIsResetLoading] = useState<boolean>(false);

  // FUNGSI UTAMA: Tarik data real harian & hitung volume perkara
  const refreshDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // 1. Ambil data master layanan (Services)
      const { data: servicesData } = await supabase
        .from('services')
        .select('id, name, code');

      // 2. Ambil semua tiket antrian hari ini
      const { data: queuesData } = await supabase
        .from('queues')
        .select('id, status, service_id')
        .gte('created_at', `${today}T00:00:00.000Z`);

      const services = (servicesData || []) as ServiceRow[];
      const queues = (queuesData || []) as QueueRow[];

      // 3. Hitung 4 Metrik Ringkasan Utama
      const total = queues.length;
      const served = queues.filter((q) => q.status === 'served').length;
      const skipped = queues.filter((q) => q.status === 'skipped').length;
      const waiting = queues.filter((q) => q.status === 'waiting' || q.status === 'calling').length;

      setStats({ total, served, skipped, waiting });

      // 4. Hitung Volume Antrian Per Layanan untuk Tabel bawah
      const mappedVolumes = services.map((srv) => {
        const matchCount = queues.filter((q) => q.service_id === srv.id).length;
        return {
          code: srv.code,
          name: srv.name,
          count: matchCount,
        };
      });

      // Urutkan berdasarkan abjad kode tiket (A-F) agar rapi
      mappedVolumes.sort((a, b) => a.code.localeCompare(b.code));
      setVolumes(mappedVolumes);
    } catch (err) {
      console.error('Gagal memuat matriks laporan:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Proteksi Login Sesi Admin
  useEffect(() => {
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) {
      router.push('/login');
      return;
    }

    const session = JSON.parse(sessionStr) as UserSession;
    if (session.role !== 'admin') {
      alert('Akses ditolak. Halaman ini hanya untuk Administrator.');
      router.push('/login');
      return;
    }

    setAdmin(session);
    refreshDashboardData();
  }, [router, refreshDashboardData]);

  // Fungsi Eksekusi Reset Manual Darurat
  async function handleManualReset() {
    setIsResetLoading(true);
    try {
      const { error } = await supabase
        .from('queues')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Bersihkan semua baris hari ini

      if (error) throw error;

      setShowConfirm(false);
      await refreshDashboardData();
    } catch (err) {
      console.error(err);
      alert('Gagal membersihkan database.');
    } finally {
      setIsResetLoading(false);
    }
  }

  if (!admin) return <div className="p-8 text-center text-slate-500">Memeriksa enkripsi sesi...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 select-none">
      <div className="max-w-6xl w-full mx-auto">
        
        {/* TOP HEADER SECTION */}
        <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Laporan Pelayanan PTSP</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Log masuk sebagai: <span className="font-semibold text-slate-700">{admin.name}</span>
            </p>
          </div>

          {/* RIGHT ACTION BUTTONS GROUP */}
          <div className="flex items-center gap-2.5">
            {/* SAKLAR RESET DARURAT DENGAN SAFETY LOCK INLINE */}
            {showConfirm ? (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 p-1 rounded-xl shadow-sm animate-in fade-in zoom-in-95 duration-150">
                <span className="text-[11px] text-red-600 font-bold px-2">Yakin hapus semua?</span>
                <button
                  onClick={handleManualReset}
                  disabled={isResetLoading}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                >
                  {isResetLoading ? 'Proses...' : 'Ya'}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={isResetLoading}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg transition"
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                className="bg-white hover:bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition active:scale-95"
              >
                Reset Antrian
              </button>
            )}

            <button
              onClick={refreshDashboardData}
              disabled={loading}
              className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition active:scale-95"
            >
              {loading ? 'Memuat...' : 'Refresh Data'}
            </button>
            
            <button
              onClick={() => { localStorage.removeItem('user_session'); router.push('/login'); }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition active:scale-95"
            >
              Keluar
            </button>
          </div>
        </header>

        {/* METRICS ROW (4 CARDS SESUAI GAMBAR) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm border-l-4 border-l-slate-400">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Antrian</p>
            <p className="text-3xl font-black text-slate-800 mt-2 font-mono">{stats.total}</p>
          </div>
          <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm border-l-4 border-l-emerald-500">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Selesai Dilayani</p>
            <p className="text-3xl font-black text-emerald-600 mt-2 font-mono">{stats.served}</p>
          </div>
          <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm border-l-4 border-l-orange-500">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Terlewat (Skipped)</p>
            <p className="text-3xl font-black text-orange-600 mt-2 font-mono">{stats.skipped}</p>
          </div>
          <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm border-l-4 border-l-blue-500">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Menunggu/Proses</p>
            <p className="text-3xl font-black text-blue-600 mt-2 font-mono">{stats.waiting}</p>
          </div>
        </section>

        {/* BREAKDOWN VOLUME CARD BOX */}
        <main className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-sm">
          <div className="mb-6">
            <h2 className="text-base font-bold text-slate-800">Volume Antrian Per Layanan</h2>
            <p className="text-xs text-slate-400 mt-0.5">Statistik sebaran volume loket berdasarkan jenis perkara</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 text-xs uppercase font-bold tracking-wider">
                  <th className="pb-3 w-24">Kode</th>
                  <th className="pb-3">Nama Layanan</th>
                  <th className="pb-3 text-right">Jumlah Antrian Hari Ini</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {volumes.map((vol) => (
                  <tr key={vol.code} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 text-blue-600 font-bold font-mono text-base">{vol.code}</td>
                    <td className="py-4 text-slate-800 font-semibold">{vol.name}</td>
                    <td className="py-4 text-right font-bold text-slate-900 font-mono text-base pr-4">{vol.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>

      </div>
    </div>
  );
}