'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Service {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

interface ReceiptData {
  queueNumber: string;
  serviceName: string;
  dateStr: string;
}

export default function KioskPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const fetchServices = useCallback(async () => {
    const { data } = await supabase.from('services').select('*').eq('is_active', true);
    if (data) setServices(data as Service[]);
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // 1. Simpan ke database terlebih dahulu di latar belakang
  async function handleCreateQueue() {
    if (!selectedService || loading) return;
    setLoading(true);
    
    try {
      const today = new Date().toISOString().split('T')[0];

      const { count } = await supabase
        .from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('service_id', selectedService.id)
        .gte('created_at', `${today}T00:00:00.000Z`);

      const nextNumber = String((count || 0) + 1).padStart(3, '0');
      const queueNumber = `${selectedService.code}${nextNumber}`;

      const { error } = await supabase
        .from('queues')
        .insert([{ queue_number: queueNumber, service_id: selectedService.id, status: 'waiting' }]);

      if (error) throw error;

      const now = new Date();
      const dateOptions: Intl.DateTimeFormatOptions = { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit' 
      };
      
      // Data struk disimpan, DOM layar sukses akan dirender menggantikan modal konfirmasi
      setReceipt({
        queueNumber,
        serviceName: selectedService.name,
        dateStr: now.toLocaleDateString('id-ID', dateOptions) + ' WIB'
      });

    } catch (error) {
      alert('Gagal memproses nomor antrian.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  // 2. EKSEKUSI CETAK UTAMA: Dipicu murni oleh sentuhan fisik terakhir pengunjung (100% Kebal Ekstensi Locker)
  function handleExecutePrint() {
    window.print();
    
    // Bersihkan sesi setelah tombol dialog print ditutup oleh sistem peramban
    setSelectedService(null);
    setReceipt(null);
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 flex flex-col items-center justify-center print:bg-white print:p-0 select-none">
      
      {/* LAYAR UTAMA PEMILIHAN LOKET */}
      <div className="w-full max-w-4xl print:hidden flex flex-col items-center">
        <h1 className="text-4xl font-black mb-2 text-slate-800 tracking-tight">SISTEM ANTRIAN PTSP</h1>
        <p className="text-slate-500 mb-10 text-lg">Silahkan sentuh layar pada jenis layanan yang Anda tuju:</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => setSelectedService(service)}
              className="flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-200 rounded-2xl shadow-sm hover:border-blue-500 hover:shadow-md active:scale-95 transition-all text-left"
            >
              <span className="text-5xl font-black text-blue-600 mb-3">{service.code}</span>
              <span className="text-xl font-bold text-slate-700 text-center uppercase tracking-wide">{service.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* STEP A: MODAL KONFIRMASI AWAL */}
      {selectedService && !receipt && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 print:hidden backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Konfirmasi Pilihan</div>
            <h2 className="text-2xl font-black text-slate-800 uppercase mb-4">{selectedService.name}</h2>
            <p className="text-slate-500 text-sm mb-8">Apakah Anda yakin ingin memproses nomor antrian untuk layanan ini?</p>
            <div className="flex gap-4">
              <button disabled={loading} onClick={() => setSelectedService(null)} className="flex-1 bg-slate-100 text-slate-700 font-bold py-3.5 rounded-xl transition">Kembali</button>
              <button disabled={loading} onClick={handleCreateQueue} className="flex-1 bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-md transition">
                {loading ? 'Memproses...' : 'Ya, Ambil Nomor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP B: LAYAR AMBIL STRUK (MUNCUL SETELAH INPUT DB SUKSES) */}
      {receipt && (
        <div className="fixed inset-0 bg-slate-950 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-lg text-center text-white animate-in zoom-in-95 duration-200">
            <span className="text-5xl animate-pulse">🎉</span>
            <h2 className="text-2xl font-black text-white mt-4">ANTRIAN BERHASIL DIBUAT</h2>
            <p className="text-slate-400 text-xs mt-1">Silahkan tekan tombol di bawah untuk mencetak kertas nomor Anda</p>
            
            {/* Box Nomor Highlight */}
            <div className="my-6 bg-slate-950 border border-slate-800 p-6 rounded-2xl">
              <div className="text-6xl font-black text-yellow-400 font-mono tracking-tight">{receipt.queueNumber}</div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">{receipt.serviceName}</div>
            </div>

            <button
              onClick={handleExecutePrint}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-900/30 text-base uppercase tracking-wider transition active:scale-95"
            >
              🖨️ Sentuh Untuk Cetak Struk
            </button>
          </div>
        </div>
      )}

      {/* TEMPLATE NOTA THERMAL KERTAS (HANYA DILIHAT OLEH DRIVER PRINTER) */}
      {receipt && (
        <div className="hidden print:block print:w-[76mm] text-black font-mono text-xs mx-auto text-center leading-tight">
          <div className="border-b-2 border-dashed border-black pb-3 mb-3">
            <h4 className="text-sm font-bold tracking-tight">PENGADILAN NEGERI</h4>
            <p className="text-[10px] mt-0.5">Sistem Manajemen Antrian PTSP</p>
          </div>
          <p className="text-[10px] uppercase font-bold tracking-wide text-slate-600">Nomor Antrian Anda</p>
          <div className="text-5xl font-black my-4 tracking-tight">{receipt.queueNumber}</div>
          <div className="border-t border-b border-black py-1.5 my-2 font-bold uppercase text-[11px]">{receipt.serviceName}</div>
          <p className="text-[9px] text-slate-500 mt-3">{receipt.dateStr}</p>
          <div className="border-t-2 border-dashed border-black pt-3 mt-4 text-[10px]">
            <p className="font-bold">Silahkan Tunggu Nomor Anda Dipanggil</p>
            <p className="text-[9px] mt-1">Terima Kasih Atas Kunjungan Anda</p>
          </div>
        </div>
      )}

    </div>
  );
}