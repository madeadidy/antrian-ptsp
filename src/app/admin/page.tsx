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
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isResetLoading, setIsResetLoading] = useState<boolean>(false);

  // 1. FUNGSI UTAMA: Tarik data harian & hitung volume perkara
  const refreshDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // FIX LOGIKA ZONA WAKTU 
      const localMidnight = new Date();
      localMidnight.setHours(0, 0, 0, 0);
      const startOfToday = localMidnight.toISOString(); 

      // Ambil data master layanan (Services)
      const { data: servicesData } = await supabase
        .from('services')
        .select('id, name, code');

      // Ambil semua tiket antrian hari ini
      const { data: queuesData } = await supabase
        .from('queues')
        .select('id, status, service_id')
        .gte('created_at', startOfToday);

      const services = (servicesData || []) as ServiceRow[];
      const queues = (queuesData || []) as QueueRow[];

      // Hitung 4 Metrik Ringkasan Utama
      const total = queues.length;
      const served = queues.filter((q) => q.status === 'served').length;
      const skipped = queues.filter((q) => q.status === 'skipped').length;
      const waiting = queues.filter((q) => q.status === 'waiting' || q.status === 'calling').length;

      setStats({ total, served, skipped, waiting });

      // Hitung Volume Antrian Per Layanan untuk Tabel bawah
      const mappedVolumes = services.map((srv) => {
        const matchCount = queues.filter((q) => q.service_id === srv.id).length;
        return {
          code: srv.code,
          name: srv.name,
          count: matchCount,
        };
      });

      mappedVolumes.sort((a, b) => a.code.localeCompare(b.code));
      setVolumes(mappedVolumes);
    } catch (err) {
      console.error('Gagal memuat matriks laporan:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Proteksi Login Sesi Admin & Load Pertama
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

  // ─── FIX UTAMA: LISTENER REALTIME SUPABASE (AUTO-REFRESH HANDS-FREE) ───
  useEffect(() => {
    const channel = supabase
      .channel('admin_realtime_tracker')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'queues' }, 
        () => {
          // Ketika ada INSERT, UPDATE, atau DELETE di tabel queues, jalankan kalkulasi ulang otomatis
          refreshDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshDashboardData]);

  // Fungsi Eksekusi Reset Manual dari Dalam Modal
  async function handleManualReset() {
    setIsResetLoading(true);
    try {
      const { error } = await supabase
        .from('queues')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

      setIsModalOpen(false);
      await refreshDashboardData();
    } catch (err) {
      console.error(err);
      alert('Gagal bersihkan database.');
    } finally {
      setIsResetLoading(false);
    }
  }

  if (!admin) return <div className="p-8 text-center text-slate-500 font-medium">Memeriksa enkripsi sesi...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 select-none relative">
      
      {/* MODAL DI CENTER */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 text-center mx-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-4 border border-red-100">
              ⚠️
            </div>
            <h3 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">
              Konfirmasi Kedaruratan
            </h3>
            <p className="text-slate-500 text-xs md:text-sm mt-2.5 leading-relaxed max-w-xs mx-auto">
              Apakah Anda benar-benar yakin ingin melakukan reset? Tindakan ini akan **menghapus permanen seluruh data nomor antrian harian**.
            </p>
            
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleManualReset}
                disabled={isResetLoading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs md:text-sm font-bold py-3 rounded-xl shadow-md transition disabled:opacity-50"
              >
                {isResetLoading ? 'Membersihkan...' : 'Ya, Reset Data'}
              </button>
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={isResetLoading}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs md:text-sm font-bold py-3 rounded-xl border border-slate-200 transition"
              >
                Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl w-full mx-auto relative z-10">
        <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Laporan Pelayanan PTSP</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Log masuk sebagai: <span className="font-semibold text-slate-700">{admin.name}</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-white hover:bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition active:scale-95"
            >
              Reset Antrian
            </button>

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