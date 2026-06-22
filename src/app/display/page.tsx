'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface AudioQueueRow {
  id: string;
  queue_id: string;
  counter_id: string;
  status: 'pending' | 'playing' | 'played';
  text_to_speak: string;
  created_at: string;
}

interface CounterRow {
  id: string;
  name: string;
  service_id: string;
  services: {
    code: string;
  } | null;
}

interface MappedCounterStatus {
  id: string;
  name: string;
  code: string;
  currentNumber: string;
  status: 'waiting' | 'calling' | 'served' | 'skipped' | 'empty';
}

export default function DisplayPage() {
  const [countersStatus, setCountersStatus] = useState<MappedCounterStatus[]>([]);
  const [isAudioActivated, setIsAudioActivated] = useState<boolean>(false);
  const [lastCalledInfo, setLastCalledInfo] = useState<{ number: string; counter: string } | null>(null);
  
  const isSpeakingRef = useRef<boolean>(false);

  // Ambil status matriks antrian harian
  const fetchAllCountersStatus = useCallback(async () => {
    try {
      const { data: countersData } = await supabase
        .from('counters')
        .select('id, name, service_id, services(code)');

      if (!countersData) return;
      const typedCounters = countersData as unknown as CounterRow[];

      const today = new Date().toISOString().split('T')[0];
      const { data: processedQueues } = await supabase
        .from('queues')
        .select('id, queue_number, service_id, status, created_at')
        .neq('status', 'waiting')
        .gte('created_at', `${today}T00:00:00.000Z`)
        .order('created_at', { ascending: false });

      const mapped = typedCounters.map((counter) => {
        const matchQueue = processedQueues?.find((q) => q.service_id === counter.service_id);
        
        return {
          id: counter.id,
          name: counter.name,
          code: counter.services?.code || '',
          currentNumber: matchQueue ? matchQueue.queue_number : '—',
          status: matchQueue ? (matchQueue.status as MappedCounterStatus['status']) : 'empty',
        };
      });

      mapped.sort((a, b) => a.code.localeCompare(b.code));
      setCountersStatus(mapped);
    } catch (err) {
      console.error('Gagal memuat status grid papan display:', err);
    }
  }, []);

  // ─── AMAN GANDA: PENGOLAH AUDIO DENGAN PERISAI TRY-CATCH (ANTI-CRASH) ───
  const handleIncomingAudio = useCallback(async (audioRow: AudioQueueRow) => {
    if (isSpeakingRef.current) {
      setTimeout(() => handleIncomingAudio(audioRow), 1000);
      return;
    }

    // Amankan antarmuka React menggunakan blok Try-Catch agar jika terjadi kegagalan perebutan data di database,
    // aplikasi tidak akan pernah melempar unhandled client-side exception yang merusak layar web.
    try {
      isSpeakingRef.current = true;

      // Coba perbarui status audio di database
      const { error: updateError } = await supabase
        .from('audio_queue')
        .update({ status: 'playing' })
        .eq('id', audioRow.id);

      // Jika komputer ini kalah balapan dengan komputer display lain, hentikan proses tanpa crash
      if (updateError) {
        isSpeakingRef.current = false;
        return;
      }

      const { data: queueData } = await supabase.from('queues').select('queue_number').eq('id', audioRow.queue_id).maybeSingle();
      const { data: counterData } = await supabase.from('counters').select('name').eq('id', audioRow.counter_id).maybeSingle();

      if (queueData && counterData) {
        setLastCalledInfo({
          number: queueData.queue_number,
          counter: counterData.name.toUpperCase(),
        });
      }

      await fetchAllCountersStatus();

      const utterance = new SpeechSynthesisUtterance(audioRow.text_to_speak);
      const availableVoices = window.speechSynthesis.getVoices();
      const indonesianVoice = availableVoices.find(voice => 
        voice.lang.includes('id-ID') || voice.lang.includes('id_ID') || voice.lang.includes('id')
      );
      
      if (indonesianVoice) utterance.voice = indonesianVoice;
      utterance.lang = 'id-ID';
      utterance.rate = 0.85;

      utterance.onend = async () => {
        try {
          await supabase.from('audio_queue').update({ status: 'played', played_at: new Date().toISOString() }).eq('id', audioRow.id);
        } catch (e) {
          console.error('Gagal update status played:', e);
        } finally {
          isSpeakingRef.current = false;
        }
      };

      utterance.onerror = () => {
        isSpeakingRef.current = false;
      };

      window.speechSynthesis.speak(utterance);

    } catch (criticalError) {
      // Menangkap semua kesalahan runtime di sisi klien secara sunyi (Silent Catch)
      console.error('Sistem mendeteksi tabrakan multi-display teredam:', criticalError);
      isSpeakingRef.current = false;
    }
  }, [fetchAllCountersStatus]);

  const activateAudioEngine = () => {
    setIsAudioActivated(true);
    const testUtterance = new SpeechSynthesisUtterance('Sistem papan monitoring aktif');
    testUtterance.volume = 0.1;
    window.speechSynthesis.speak(testUtterance);
  };

  useEffect(() => {
    fetchAllCountersStatus();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, [fetchAllCountersStatus]);

  useEffect(() => {
    const channel = supabase
      .channel('realtime_grid_display')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audio_queue' }, (payload) => {
        const newRow = payload.new as AudioQueueRow;
        if (newRow && newRow.status === 'pending') {
          handleIncomingAudio(newRow);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'queues' }, (payload) => {
        const newRecord = payload.new as { status: string } | null;
        if (newRecord && newRecord.status === 'calling') return;
        fetchAllCountersStatus();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleIncomingAudio, fetchAllCountersStatus]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 md:p-6 relative overflow-x-hidden select-none">
      
      {!isAudioActivated && (
        <div className="absolute inset-0 bg-slate-950/98 z-50 flex items-center justify-center p-4 text-center backdrop-blur-md">
          <div className="max-w-md bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl">
            <h3 className="text-2xl font-bold text-blue-400 mb-2">Papan Panggilan Antrian</h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Tekan tombol konfirmasi di bawah ini agar speaker pengeras suara ruang tunggu dapat menyiarkan panggilan nomor secara otomatis.
            </p>
            <button
              onClick={activateAudioEngine}
              className="w-full bg-blue-600 hover:bg-blue-700 font-bold py-3.5 px-6 rounded-xl shadow-lg transition active:scale-95 text-sm uppercase tracking-wider"
            >
              Aktifkan Papan Suara
            </button>
          </div>
        </div>
      )}

      <header className="flex flex-col sm:flex-row justify-between items-center gap-3 border-b border-slate-800 pb-4 text-center sm:text-left">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-widest text-white">PELAYANAN TERPADU SATU PINTU (PTSP)</h1>
          <p className="text-xs text-blue-400 font-medium tracking-wide uppercase mt-0.5">Pengadilan Negeri Seluruh Lini Perkara</p>
        </div>
        <div className="text-sm md:text-lg font-mono bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-slate-300 shadow-inner font-bold">
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </header>

      {lastCalledInfo && (
        <div className="my-4 bg-blue-950/40 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-center gap-6">
          <span className="text-blue-400 text-sm font-bold uppercase tracking-widest">Panggilan Terakhir:</span>
          <div className="text-3xl font-black text-yellow-400 tracking-tight">{lastCalledInfo.number}</div>
          <div className="text-lg font-bold text-emerald-400">➔ {lastCalledInfo.counter}</div>
        </div>
      )}

      <main className="flex-1 my-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 items-center justify-center max-w-7xl w-full mx-auto">
        {countersStatus.map((counter) => {
          const isCalling = lastCalledInfo && counter.currentNumber === lastCalledInfo.number && counter.status === 'calling';
          
          return (
            <div
              key={counter.id}
              className={`bg-slate-900 border rounded-3xl p-6 md:p-8 flex flex-col items-center justify-between shadow-xl min-h-[220px] md:min-h-[260px] transition-all duration-300 ${
                isCalling 
                  ? 'border-yellow-500 bg-gradient-to-b from-slate-900 to-blue-950/50 scale-[1.02] ring-2 ring-yellow-500/20' 
                  : 'border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="w-full flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm md:text-base font-black tracking-wider text-slate-200 uppercase truncate">
                  {counter.name}
                </h3>
                <span className="bg-blue-950 text-blue-400 border border-blue-900 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md">
                  KODE {counter.code}
                </span>
              </div>

              <div className={`text-6xl sm:text-7xl md:text-8xl font-black tracking-tight leading-none my-4 transition-colors ${
                counter.currentNumber === '—' 
                  ? 'text-slate-700' 
                  : isCalling 
                    ? 'text-yellow-400' 
                    : counter.status === 'served'
                      ? 'text-slate-400'
                      : 'text-emerald-400'
              }`}>
                {counter.currentNumber}
              </div>

              <div className={`text-[10px] md:text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full border ${
                counter.status === 'empty' 
                  ? 'bg-slate-950 text-slate-500 border-transparent' 
                  : counter.status === 'calling'
                    ? 'bg-amber-950/40 text-amber-400 border-amber-900/50 animate-pulse'
                    : counter.status === 'served'
                      ? 'bg-emerald-950/40 text-emerald-500 border-emerald-900/40'
                      : 'bg-red-950/40 text-red-400 border-red-900/40'
              }`}>
                {counter.status === 'empty' && 'Kosong / Istirahat'}
                {counter.status === 'calling' && 'Sedang Dilayani'}
                {counter.status === 'served' && 'Selesai Pelayanan'}
                {counter.status === 'skipped' && 'Terlewat (Skip)'}
              </div>
            </div>
          );
        })}
      </main>

      <footer className="bg-slate-900 border border-slate-800 p-3 md:p-4 rounded-2xl overflow-hidden whitespace-nowrap shadow-inner mt-2">
        <div className="inline-block animate-[marquee_30s_linear_infinite] font-medium text-xs md:text-sm text-slate-400 tracking-wide">
          Menerapkan Zona Integritas Wilayah Bebas Korupsi (WBK) • Utamakan budaya antri yang tertib • Laporkan tindakan pungutan liar melalui kanal pengaduan resmi • Jam pelayanan PTSP Senin - Jumat pukul 08:00 s.d 16:30 WIB.
        </div>
      </footer>

      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translate3d(100%, 0, 0); }
          100% { transform: translate3d(-100%, 0, 0); }
        }
      `}</style>
    </div>
  );
}