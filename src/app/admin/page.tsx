'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// 1. Definisi kontrak tipe data yang ketat
interface QueueReportItem {
  id: string;
  queue_number: string;
  status: 'waiting' | 'calling' | 'served' | 'skipped';
  created_at: string;
  services: {
    name: string;
    code: string;
  } | null;
}

interface UserSession {
  id: string;
  name: string;
  username: string;
  role: string;
}

interface StatSummary {
  total: number;
  served: number;
  skipped: number;
  waiting: number;
}

interface ServiceBreakdown {
  name: string;
  code: string;
  total: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [admin, setAdmin] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // States untuk data laporan
  const [stats, setStats] = useState<StatSummary>({ total: 0, served: 0, skipped: 0, waiting: 0 });
  const [serviceSummary, setServiceSummary] = useState<ServiceBreakdown[]>([]);

  const fetchDailyReport = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    // Ambil semua antrian yang dibuat hari ini beserta nama layanannya
    const { data, error } = await supabase
      .from('queues')
      .select('id, queue_number, status, created_at, services(name, code)')
      .gte('created_at', `${today}T00:00:00.000Z`);

    if (error) {
      alert('Gagal mengambil data laporan: ' + error.message);
      setLoading(false);
      return;
    }

    const rawQueues = data as unknown as QueueReportItem[];

    // 2. Kalkulasi Metrik Utama
    const summary: StatSummary = { total: rawQueues.length, served: 0, skipped: 0, waiting: 0 };
    const serviceMap: Record<string, { name: string; code: string; total: number }> = {};

    rawQueues.forEach((item) => {
      // Hitung berdasarkan status
      if (item.status === 'served') summary.served++;
      else if (item.status === 'skipped') summary.skipped++;
      else summary.waiting++;

      // Hitung breakdown per Layanan
      if (item.services) {
        const sName = item.services.name;
        if (!serviceMap[sName]) {
          serviceMap[sName] = { name: sName, code: item.services.code, total: 0 };
        }
        serviceMap[sName].total++;
      }
    });

    setStats(summary);
    setServiceSummary(Object.values(serviceMap));
    setLoading(false);
  }, []);

  // Proteksi Route Halaman Admin
  useEffect(() => {
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) {
      router.push('/login');
      return;
    }

    const session = JSON.parse(sessionStr) as UserSession;
    if (session.role !== 'admin') {
      alert('Akses ditolak! Halaman ini hanya untuk Administrator.');
      router.push('/login');
      return;
    }

    setAdmin(session);
    fetchDailyReport();
  }, [router, fetchDailyReport]);

  function handleLogout() {
    localStorage.removeItem('user_session');
    router.push('/login');
  }

  if (!admin || loading) {
    return <div className="p-8 text-center text-slate-500 font-medium">Memuat laporan harian...</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto bg-slate-50 min-h-screen">
      {/* Header */}
      <header className="mb-8 border-b pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-800">Laporan Pelayanan PTSP</h1>
          <p className="text-sm text-slate-500">Log masuk sebagai: <span className="font-semibold text-slate-700">{admin.name}</span></p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchDailyReport}
            className="bg-white border border-slate-300 text-slate-700 font-medium px-4 py-2 rounded-lg hover:bg-slate-100 transition text-sm"
          >
            Refresh Data
          </button>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-red-700 transition text-sm shadow-sm"
          >
            Keluar
          </button>
        </div>
      </header>

      {/* Grid Ringkasan Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">Total Antrian</div>
          <div className="text-4xl font-black text-slate-800 mt-2">{stats.total}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-green-500">
          <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">Selesai Dilayani</div>
          <div className="text-4xl font-black text-green-600 mt-2">{stats.served}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-orange-500">
          <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">Terlewat (Skipped)</div>
          <div className="text-4xl font-black text-orange-600 mt-2">{stats.skipped}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-blue-500">
          <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">Menunggu/Proses</div>
          <div className="text-4xl font-black text-blue-600 mt-2">{stats.waiting}</div>
        </div>
      </div>

      {/* Tabel Breakdown Per Layanan */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Volume Antrian Per Layanan</h2>
          <p className="text-xs text-slate-400 mt-0.5">Statistik sebaran volume loket berdasarkan jenis perkara</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                <th className="px-6 py-3">Kode</th>
                <th className="px-6 py-3">Nama Layanan</th>
                <th className="px-6 py-3 text-right">Jumlah Antrian Hari Ini</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {serviceSummary.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-slate-400">
                    Belum ada data antrian yang masuk hari ini.
                  </td>
                </tr>
              ) : (
                serviceSummary.map((srv, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 font-mono font-bold text-blue-600">{srv.code}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{srv.name}</td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900">{srv.total}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}