'use client';

import Link from 'next/link';

interface PortalMenu {
  title: string;
  description: string;
  url: string;
  badge: string;
  badgeColor: string;
  iconBg: string;
  iconText: string;
}

export default function Home() {
  // Data menu navigasi tanpa 'any'
  const menus: PortalMenu[] = [
    {
      title: 'Mesin Kiosk Antrian',
      description: 'Halaman khusus pengunjung untuk mengambil dan mencetak nomor antrian PTSP secara mandiri.',
      url: '/kiosk',
      badge: 'Public Kiosk',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      iconBg: 'bg-blue-600',
      iconText: '🖨️',
    },
    {
      title: 'Monitor Display TV',
      description: 'Menampilkan nomor antrian realtime di ruang tunggu dilengkapi dengan pengeras suara otomatis.',
      url: '/display',
      badge: 'Ruang Tunggu',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconBg: 'bg-emerald-600',
      iconText: '📺',
    },
    {
      title: 'Panel Operator Loket',
      description: 'Dashboard petugas untuk memanggil, mengulang, melewati, dan menyelesaikan pelayanan antrian.',
      url: '/login',
      badge: 'Petugas Loket',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      iconBg: 'bg-amber-500',
      iconText: '👤',
    },
    {
      title: 'Laporan & Administrasi',
      description: 'Analisis rekapitulasi performa pelayanan harian dan manajemen master data untuk Administrator.',
      url: '/login',
      badge: 'Admin Utama',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      iconBg: 'bg-purple-600',
      iconText: '📊',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between">
      {/* ─── Background Dekoratif Atas ─── */}
      <div className="absolute top-0 inset-x-0 h-80 bg-gradient-to-b from-blue-950/40 to-transparent pointer-events-none" />

      {/* ─── Main Content ─── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-16 flex flex-col justify-center relative z-10">
        
        {/* Header Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-blue-950 border border-blue-800 text-blue-400 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 shadow-sm">
            🏛️ Pengadilan Negeri
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-3">
            PTSP <span className="text-blue-500">Queue Management System</span>
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto text-base md:text-lg font-medium leading-relaxed">
            Sistem tata kelola antrian layanan informasi publik yang terintegrasi, transparan, dan realtime.
          </p>
        </div>

        {/* Grid Menus */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {menus.map((menu, index) => (
            <Link 
              key={index} 
              href={menu.url}
              className="group bg-slate-800/60 border border-slate-700/70 p-6 rounded-2xl shadow-sm hover:bg-slate-800 hover:border-slate-500 active:scale-[0.99] transition-all duration-200 flex gap-4 text-left"
            >
              {/* Icon Container */}
              <div className={`w-12 h-12 rounded-xl ${menu.iconBg} flex items-center justify-center text-2xl flex-shrink-0 shadow-md group-hover:scale-105 transition-transform`}>
                {menu.iconText}
              </div>
              
              {/* Text Description */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h3 className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">
                      {menu.title}
                    </h3>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border rounded-md ${menu.badgeColor}`}>
                      {menu.badge}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed font-normal">
                    {menu.description}
                  </p>
                </div>
                
                {/* Arrow Indicator */}
                <div className="text-xs font-semibold text-blue-400 mt-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                  Masuk Modul <span>➔</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* ─── Footer Instansi ─── */}
      <footer className="border-t border-slate-800 bg-slate-950/40 py-4 text-center text-xs text-slate-500 relative z-10">
        <div>© 2026 PTSP Pengadilan Negeri. All Rights Reserved.</div>
        <div className="text-[10px] text-slate-600 mt-0.5 font-mono">v1.0.0-MVP (Next.js 15 + Supabase)</div>
      </footer>
    </div>
  );
}