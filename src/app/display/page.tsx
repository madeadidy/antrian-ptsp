'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface AudioQueueRow {
  id: string;
  queue_id: string;
  counter_id: string;
  status: 'pending' | 'playing' | 'played';
  text_to_speak: string;
  created_at?: string;
  played_at?: string | null;
}

export default function DisplayPage() {
  const [displayQueue, setDisplayQueue] = useState<string>('—');
  const [displayCounter, setDisplayCounter] = useState<string>('SILAHKAN MENUNGGU');
  const [isAudioActivated, setIsAudioActivated] = useState<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);

  const updateDisplayUI = useCallback(async (queueId: string, counterId: string) => {
    try {
      const { data: queueData } = await supabase
        .from('queues')
        .select('queue_number')
        .eq('id', queueId)
        .maybeSingle();

      const { data: counterData } = await supabase
        .from('counters')
        .select('name')
        .eq('id', counterId)
        .maybeSingle();

      if (queueData) setDisplayQueue(queueData.queue_number);
      if (counterData) setDisplayCounter((counterData.name as string).toUpperCase());
    } catch (error) {
      console.error('Gagal update UI teks:', error);
    }
  }, []);

  const handleIncomingAudio = useCallback(async (audioRow: AudioQueueRow) => {
    if (isSpeakingRef.current) {
      setTimeout(() => handleIncomingAudio(audioRow), 1000);
      return;
    }

    isSpeakingRef.current = true;

    await supabase.from('audio_queue').update({ status: 'playing' }).eq('id', audioRow.id);
    await updateDisplayUI(audioRow.queue_id, audioRow.counter_id);

    const utterance = new SpeechSynthesisUtterance(audioRow.text_to_speak);
    
    const availableVoices = window.speechSynthesis.getVoices();
    const indonesianVoice = availableVoices.find(voice => 
      voice.lang.includes('id-ID') || voice.lang.includes('id_ID') || voice.lang.includes('id')
    );
    
    if (indonesianVoice) utterance.voice = indonesianVoice;
    utterance.lang = 'id-ID';
    utterance.rate = 0.85;

    utterance.onend = async () => {
      await supabase
        .from('audio_queue')
        .update({ status: 'played', played_at: new Date().toISOString() })
        .eq('id', audioRow.id);
      isSpeakingRef.current = false;
    };

    utterance.onerror = () => {
      isSpeakingRef.current = false;
    };

    window.speechSynthesis.speak(utterance);
  }, [updateDisplayUI]);

  const activateAudioEngine = () => {
    setIsAudioActivated(true);
    const testUtterance = new SpeechSynthesisUtterance('Sistem suara aktif');
    testUtterance.volume = 0.1;
    testUtterance.rate = 1.5;
    window.speechSynthesis.speak(testUtterance);
  };

  useEffect(() => {
    async function fetchLatestActiveCall() {
      const { data } = await supabase
        .from('audio_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const latestRow = data as AudioQueueRow;
        await updateDisplayUI(latestRow.queue_id, latestRow.counter_id);
      }
    }
    fetchLatestActiveCall();
    
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, [updateDisplayUI]);

  useEffect(() => {
    const channel = supabase
      .channel('realtime_audio_broadcast')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audio_queue' },
        (payload) => {
          const newRow = payload.new as AudioQueueRow;
          if (newRow && newRow.status === 'pending') {
            handleIncomingAudio(newRow);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleIncomingAudio]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-4 md:p-8 relative overflow-hidden">
      
      {/* Overlay Audio */}
      {!isAudioActivated && (
        <div className="absolute inset-0 bg-slate-950/95 z-50 flex items-center justify-center p-4 text-center">
          <div className="max-w-md bg-slate-900 p-6 md:p-8 rounded-2xl border border-slate-700 shadow-2xl">
            <h3 className="text-xl md:text-2xl font-bold text-yellow-400 mb-2">Konfigurasi Audio TV</h3>
            <p className="text-slate-400 text-xs md:text-sm mb-6">
              Browser memblokir suara otomatis sebelum ada interaksi. Klik tombol di bawah agar speaker ruang tunggu dapat berbunyi.
            </p>
            <button
              onClick={activateAudioEngine}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all active:scale-95 text-sm md:text-base"
            >
              Aktifkan Suara Speaker
            </button>
          </div>
        </div>
      )}

      {/* Top Header - Diperbaiki menggunakan flex-col pada mobile */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 border-b border-slate-700 pb-4 text-center sm:text-left">
        <h1 className="text-xl md:text-3xl font-bold tracking-wider text-blue-400">
          PTSP PENGADILAN NEGERI
        </h1>
        <div className="text-sm md:text-2xl font-mono bg-slate-800 px-4 py-1.5 rounded-lg shadow-sm">
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Main Big Display - Diperbaiki ukuran font & padding menggunakan breakpoint */}
      <div className="flex-1 flex flex-col items-center justify-center my-6 md:my-12 bg-slate-800 rounded-3xl p-6 md:p-12 border border-slate-700 shadow-2xl text-center w-full max-w-5xl mx-auto">
        <h2 className="text-lg md:text-4xl text-slate-400 font-medium uppercase tracking-widest mb-2 md:mb-4">
          Panggilan Antrian
        </h2>
        <div className="text-7xl sm:text-9xl md:text-[11rem] lg:text-[13rem] font-black tracking-tight text-yellow-400 leading-none my-4">
          {displayQueue}
        </div>
        <div className="text-xl sm:text-3xl md:text-5xl font-bold text-emerald-400 mt-2 md:mt-6 tracking-wide bg-emerald-950/50 px-5 py-2.5 md:px-8 md:py-4 rounded-xl border border-emerald-500/30 uppercase max-w-full break-words">
          {displayCounter}
        </div>
      </div>

      {/* Bottom Running Text */}
      <div className="bg-blue-950 border border-blue-800 text-blue-200 p-3 md:p-4 rounded-xl text-sm md:text-xl overflow-hidden whitespace-nowrap shadow-inner">
        <div className="inline-block animate-[marquee_25s_linear_infinite] font-medium">
          Menerapkan Zona Integritas Wilayah Bebas Korupsi (WBK) • Utamakan budaya antri yang tertib • Laporkan jika ada pungutan liar melalui kanal resmi pengaduan.
        </div>
      </div>

      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translate3d(100%, 0, 0); }
          100% { transform: translate3d(-100%, 0, 0); }
        }
      `}</style>
    </div>
  );
}