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
  
  // State untuk melacak apakah browser sudah diizinkan bersuara
  const [isAudioActivated, setIsAudioActivated] = useState<boolean>(false);
  
  const isSpeakingRef = useRef<boolean>(false);

  // Fungsi internal untuk update teks layar
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

  // Fungsi eksekusi suara dengan pencarian Voice Pack yang lebih aman
  const handleIncomingAudio = useCallback(async (audioRow: AudioQueueRow) => {
    if (isSpeakingRef.current) {
      setTimeout(() => handleIncomingAudio(audioRow), 1000);
      return;
    }

    isSpeakingRef.current = true;

    // 1. Update status DB ke 'playing'
    await supabase.from('audio_queue').update({ status: 'playing' }).eq('id', audioRow.id);

    // 2. Update teks di layar TV
    await updateDisplayUI(audioRow.queue_id, audioRow.counter_id);

    // 3. Konfigurasi Speech
    console.log('Memulai suara untuk teks:', audioRow.text_to_speak);
    const utterance = new SpeechSynthesisUtterance(audioRow.text_to_speak);
    
    // Cari voice Indonesia di browser secara dinamis
    const availableVoices = window.speechSynthesis.getVoices();
    const indonesianVoice = availableVoices.find(voice => 
      voice.lang.includes('id-ID') || voice.lang.includes('id_ID') || voice.lang.includes('id')
    );
    
    if (indonesianVoice) {
      utterance.voice = indonesianVoice;
    }
    
    utterance.lang = 'id-ID';
    utterance.rate = 0.85; // Sedikit lambat agar artikulatif

    utterance.onend = async () => {
      console.log('Suara selesai diputar.');
      await supabase
        .from('audio_queue')
        .update({ status: 'played', played_at: new Date().toISOString() })
        .eq('id', audioRow.id);
      isSpeakingRef.current = false;
    };

    utterance.onerror = (event) => {
      console.error('Terjadi error pada Speech Synthesis:', event.error);
      isSpeakingRef.current = false;
    };

    // Eksekusi perintah suara ke soundcard laptop/TV
    window.speechSynthesis.speak(utterance);
  }, [updateDisplayUI]);

  // Mengaktifkan fitur audio via interaksi klik pengguna
  const activateAudioEngine = () => {
    setIsAudioActivated(true);
    
    // Test beep/suara kosong pelan untuk memicu izin browser
    const testUtterance = new SpeechSynthesisUtterance('Sistem suara aktif');
    testUtterance.volume = 0.1;
    testUtterance.rate = 1.5;
    window.speechSynthesis.speak(testUtterance);
    
    console.log('Audio Engine Berhasil Diaktivasi!');
  };

  // Initial load data terakhir
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
    
    // Pemicu awal agar daftar suara siap di memori browser
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, [updateDisplayUI]);

  // Realtime listener
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
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-8 relative">
      
      {/* OVERLAY PROTEKSI AUDIO BROWSER */}
      {!isAudioActivated && (
        <div className="absolute inset-0 bg-slate-950/95 z-50 flex flex-col items-center justify-center p-4 text-center">
          <div className="max-w-md bg-slate-900 p-8 rounded-2xl border border-slate-700 shadow-2xl">
            <h3 className="text-2xl font-bold text-yellow-400 mb-2">Konfigurasi Audio TV</h3>
            <p className="text-slate-400 text-sm mb-6">
              Browser memblokir suara otomatis sebelum ada interaksi. Klik tombol di bawah agar speaker ruang tunggu dapat berbunyi.
            </p>
            <button
              onClick={activateAudioEngine}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all active:scale-95"
            >
              Aktifkan Suara Speaker
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex justify-between items-center border-b border-slate-700 pb-4">
        <h1 className="text-3xl font-bold tracking-wider text-blue-400">PTSP PENGADILAN NEGERI</h1>
        <div className="text-2xl font-mono bg-slate-800 px-4 py-2 rounded">
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Main Big Display */}
      <div className="flex-1 flex flex-col items-center justify-center my-12 bg-slate-800 rounded-3xl p-12 border border-slate-700 shadow-2xl">
        <h2 className="text-4xl text-slate-400 font-medium uppercase tracking-widest mb-4">Panggilan Antrian</h2>
        <div className="text-[12rem] font-black tracking-tight text-yellow-400 leading-none">
          {displayQueue}
        </div>
        <div className="text-5xl font-bold text-emerald-400 mt-6 tracking-wide bg-emerald-950/50 px-8 py-4 rounded-xl border border-emerald-500/30">
          {displayCounter}
        </div>
      </div>

      {/* Bottom Running Text */}
      <div className="bg-blue-950 border border-blue-800 text-blue-200 p-4 rounded-xl text-xl overflow-hidden whitespace-nowrap">
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