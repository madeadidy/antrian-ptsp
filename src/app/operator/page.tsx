"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface ActiveQueue {
  id: string;
  queue_number: string;
  service_id: string;
  status: "waiting" | "calling" | "served" | "skipped";
  created_at: string;
}

interface UserSession {
  id: string;
  name: string;
  username: string;
  role: string;
  counter_id: string | null;
}

interface QueueCallResponse {
  queues: {
    id: string;
    queue_number: string;
    service_id: string;
    status: "waiting" | "calling" | "served" | "skipped";
    created_at: string;
  } | null;
}

export default function OperatorDashboard() {
  const router = useRouter();
  const [operator, setOperator] = useState<UserSession | null>(null);
  const [counterName, setCounterName] = useState<string>("Memuat Loket...");
  const [serviceId, setServiceId] = useState<string>(""); // State baru untuk mengunci ID Layanan loket
  const [currentQueue, setCurrentQueue] = useState<ActiveQueue | null>(null);
  const [stats, setStats] = useState<{ waiting: number }>({ waiting: 0 });

  // 1. FUNGSI SISA ANTRIAN: Diperbarui agar menyaring berdasarkan service_id spesifik loket
  const fetchWaitingCount = useCallback(async (targetServiceId: string) => {
    if (!targetServiceId) return;
    
    const { count } = await supabase
      .from("queues")
      .select("*", { count: "exact", head: true })
      .eq("status", "waiting")
      .eq("service_id", targetServiceId); // Filter spesifik perkara loket ini

    setStats({ waiting: count || 0 });
  }, []);

  // 2. FUNGSI INITIAL LOAD SINKRONISASI REFRESH
  const checkActiveQueueOnLoad = useCallback(async (counterId: string) => {
    const { data: activeCallData } = await supabase
      .from("queue_calls")
      .select("queues!inner(id, queue_number, service_id, status, created_at)")
      .eq("counter_id", counterId)
      .eq("queues.status", "calling")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeCallData && activeCallData.queues) {
      const typedData = activeCallData as unknown as QueueCallResponse;
      setCurrentQueue(typedData.queues as ActiveQueue);
    } else {
      setCurrentQueue(null);
    }
  }, []);

  // Sesi Proteksi & Inisialisasi Pertama
  useEffect(() => {
    const sessionStr = localStorage.getItem("user_session");
    if (!sessionStr) {
      router.push("/login");
      return;
    }

    const session = JSON.parse(sessionStr) as UserSession;
    if (session.role !== "operator" || !session.counter_id) {
      alert("Anda tidak memiliki akses ke loket petugas.");
      router.push("/login");
      return;
    }

    setOperator(session);

    async function initDashboard() {
      // Ambil nama loket sekaligus dapatkan service_id relasinya
      const { data } = await supabase
        .from("counters")
        .select("name, service_id")
        .eq("id", session.counter_id!)
        .single();
        
      if (data) {
        setCounterName(data.name);
        setServiceId(data.service_id); // Kunci service_id ke state lokal

        // Jalankan sinkronisasi data awal menggunakan service_id yang valid
        await fetchWaitingCount(data.service_id);
        await checkActiveQueueOnLoad(session.counter_id!);
      }
    }

    initDashboard();
  }, [router, fetchWaitingCount, checkActiveQueueOnLoad]);

  // 3. FUNGSI PANGGIL: Diperbarui agar hanya menarik nomor antrian serumpun layanannya
  async function callNextQueue() {
    if (!operator || !operator.counter_id || !serviceId) return;

    // Ambil 1 antrian tertua berstatus waiting KHUSUS untuk service_id loket ini
    const { data: nextQueue } = await supabase
      .from("queues")
      .select("*")
      .eq("status", "waiting")
      .eq("service_id", serviceId) // Filter jaminan anti-salah panggil kode tiket
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!nextQueue) {
      alert("Tidak ada antrian dalam antrian tunggu untuk layanan ini.");
      return;
    }

    const localActiveQueue: ActiveQueue = {
      id: nextQueue.id,
      queue_number: nextQueue.queue_number,
      service_id: nextQueue.service_id,
      status: "calling",
      created_at: nextQueue.created_at,
    };
    setCurrentQueue(localActiveQueue);

    await supabase.from("queues").update({ status: "calling", called_at: new Date().toISOString() }).eq("id", nextQueue.id);

    await supabase.from("queue_calls").insert([
      {
        queue_id: nextQueue.id,
        counter_id: operator.counter_id,
        operator_id: operator.id,
      },
    ]);

    const spokenCounterName = counterName.replace("PHI", "P. H. I.");
    const textToSpeak = `Nomor antrian, ${nextQueue.queue_number.split("").join(" ")}, menuju, ${spokenCounterName}`;
    
    await supabase.from("audio_queue").insert([
      {
        queue_id: nextQueue.id,
        counter_id: operator.counter_id,
        status: "pending",
        text_to_speak: textToSpeak,
      },
    ]);

    await fetchWaitingCount(serviceId);
  }

  // 4. FUNGSI UPDATE STATUS
  async function handleStatus(status: "served" | "skipped") {
    if (!currentQueue || !operator || !operator.counter_id || !serviceId) return;

    setCurrentQueue(null);

    const { error } = await supabase.from("queues").update({ status: status, finished_at: new Date().toISOString() }).eq("id", currentQueue.id);

    if (error) {
      alert("Gagal memperbarui status ke database: " + error.message);
    }

    await fetchWaitingCount(serviceId);
  }

  // 5. FUNGSI RECALL PANGGIL ULANG
  async function recall() {
    if (!currentQueue || !operator || !operator.counter_id) return;

    const spokenCounterName = counterName.replace("PHI", "P. H. I.");
    const textToSpeak = `Mengulang, nomor antrian, ${currentQueue.queue_number.split("").join(" ")}, menuju, ${spokenCounterName}`;
    
    await supabase.from("audio_queue").insert([
      {
        queue_id: currentQueue.id,
        counter_id: operator.counter_id,
        status: "pending",
        text_to_speak: textToSpeak,
      },
    ]);
  }

  function handleLogout() {
    localStorage.removeItem("user_session");
    router.push("/login");
  }

  if (!operator) return <div className="p-8 text-center text-slate-500">Memeriksa enkripsi sesi...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto select-none">
      <header className="mb-8 border-b pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{counterName}</h1>
          <p className="text-sm text-gray-500">Petugas: {operator.name}</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Badge Sisa Antrian Spesifik Loket */}
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-bold text-sm tracking-wide border border-blue-100">
            Sisa Antrian: {stats.waiting} Orang
          </div>
          <button onClick={handleLogout} className="text-sm text-red-600 hover:underline font-bold">
            Log Out
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kartu Display Antrian */}
        <div className="bg-white p-6 border rounded-xl shadow-sm text-center">
          <h2 className="text-gray-500 font-medium mb-2">Antrian Saat Ini</h2>
          <div className="text-6xl font-black text-slate-800 my-4 font-mono">{currentQueue ? currentQueue.queue_number : "—"}</div>

          <div className="flex justify-center gap-2 mt-6">
            <button onClick={callNextQueue} disabled={!!currentQueue} className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-blue-700 active:scale-95 transition-all">
              Panggil Berikutnya
            </button>

            <button
              onClick={recall}
              disabled={!currentQueue}
              className="border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-slate-100 hover:border-slate-400 hover:text-slate-900 active:scale-95 active:bg-slate-200 transition-all"
            >
              Recall
            </button>
          </div>
        </div>

        {/* Panel Kontrol Eksekusi Pelayanan */}
        <div className="bg-slate-50 p-6 border rounded-xl flex flex-col justify-center gap-4">
          <button onClick={() => handleStatus("served")} disabled={!currentQueue} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg shadow disabled:opacity-40 hover:bg-green-700 transition">
            Selesai Pelayanan (Served)
          </button>
          <button onClick={() => handleStatus("skipped")} disabled={!currentQueue} className="w-full bg-orange-500 text-white font-bold py-3 rounded-lg shadow disabled:opacity-40 hover:bg-orange-600 transition">
            Lewati (Skip Antrian)
          </button>
        </div>
      </div>
    </div>
  );
}