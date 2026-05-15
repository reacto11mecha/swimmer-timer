import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getLiveDashboard } from "@/server/timer.functions"; // Pastikan path ini benar
import { publishResetToHardware as resetHardware } from "@/server/mqtt.functions";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Timer, Activity, Waves, RotateCcw, Square } from "lucide-react";

export default function TimerDashboard() {
  const requestRef = useRef<number>(null);
  const [displayTime, setDisplayTime] = useState(0);

  // 1. Polling data dari database setiap 1 detik untuk update Lap/Status
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["liveTimer"],
    queryFn: () => getLiveDashboard(),
    refetchInterval: 1000,
  });

  const resetMutation = useMutation({
    mutationFn: () => resetHardware(),
    onSuccess: () => alert("Sinyal reset telah dikirim ke perangkat!"),
  });

  const heat = dashboard?.heat;
  const isRunning = heat?.status === "RUNNING";

  // 2. Logika Animasi Stopwatch (Berjalan Mulus di UI)
  useEffect(() => {
    if (isRunning && heat?.startedAt) {
      // Hitung selisih waktu sekarang dengan waktu mulai di server
      const startTimestamp = new Date(heat.startedAt).getTime();

      const update = () => {
        setDisplayTime(Date.now() - startTimestamp);
        requestRef.current = requestAnimationFrame(update);
      };
      requestRef.current = requestAnimationFrame(update);
    } else {
      setDisplayTime(0);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isRunning, heat?.startedAt]);

  // Format MM:SS.ms
  const formatTime = (ms: number) => {
    if (ms < 0) ms = 0;
    const m = Math.floor(ms / 60000)
      .toString()
      .padStart(2, "0");
    const s = Math.floor((ms % 60000) / 1000)
      .toString()
      .padStart(2, "0");
    const mil = Math.floor((ms % 1000) / 10)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}.${mil}`;
  };

  // 3. State Loading
  if (isLoading) {
    return (
      <div className="p-20 text-center animate-pulse text-slate-500">
        Menghubungkan ke database...
      </div>
    );
  }

  // 4. State Jika Tidak Ada Pertandingan Aktif (Pending/Running)
  if (!dashboard || !heat) {
    return (
      <div className="p-20 text-center space-y-4">
        <div className="text-slate-300 flex justify-center">
          <Waves size={64} />
        </div>
        <h2 className="text-xl font-semibold text-slate-500">
          Tidak Ada Pertandingan Aktif
        </h2>
        <p className="text-slate-400">
          Silakan tarik data dari menu Persiapan Lomba untuk memulai.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 min-h-screen">
      {/* Race Info & Global Timer */}
      <Card
        className={`border-t-4 shadow-sm transition-all ${isRunning ? "border-t-green-500" : "border-t-blue-600"}`}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={isRunning ? "default" : "secondary"}>
                {heat.status}
              </Badge>
              {isRunning && (
                <Activity className="h-4 w-4 text-green-500 animate-pulse" />
              )}
            </div>
            <CardTitle className="text-3xl font-bold">
              {heat.eventTitle}
            </CardTitle>
          </div>

          <div className="text-right">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
              Waktu Berjalan
            </p>
            <div
              className={`text-5xl font-mono font-bold tabular-nums ${isRunning ? "text-green-600" : ""}`}
            >
              {formatTime(displayTime)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex gap-3 pt-4 border-t dark:border-slate-800 mt-4">
          <Button
            size="lg"
            variant="outline"
            className="w-48"
            onClick={() => resetMutation.mutate()}
            disabled={isRunning || resetMutation.isPending}
          >
            <RotateCcw className="mr-2 h-5 w-5" /> Persiapan & Reset
          </Button>
          <Button
            size="lg"
            variant="destructive"
            className="w-32"
            disabled={!isRunning}
          >
            <Square className="mr-2 h-5 w-5" /> Stop All
          </Button>
        </CardContent>
      </Card>

      {/* Grid Lane (Dinamis berdasarkan database) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {dashboard.lanes.map((lane) => (
          <Card
            key={lane.id}
            className="overflow-hidden border-blue-100 dark:border-slate-800 shadow-sm"
          >
            <div
              className={`p-2 text-center text-white font-bold text-sm ${isRunning ? "bg-blue-600" : "bg-slate-700"}`}
            >
              LINTASAN {lane.laneNumber}
            </div>
            <CardContent className="p-4 space-y-4">
              <div className="min-h-[40px]">
                <p className="text-sm font-bold leading-tight uppercase">
                  {lane.athleteName || "KOSONG"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {lane.clubName || "-"}
                </p>
              </div>

              {/* Display Waktu per Lane */}
              <div className="bg-slate-900 text-white p-3 rounded-lg flex items-center justify-between dark:bg-black border border-slate-800">
                <Timer
                  className={`h-5 w-5 ${isRunning && !lane.lastLap ? "text-blue-400 animate-pulse" : "opacity-50"}`}
                />
                <span className="font-mono text-2xl font-bold tracking-wider">
                  {/* Tampilkan Lap terakhir jika sudah masuk, jika belum tampilkan running time */}
                  {lane.lastLap
                    ? lane.lastLap.cumulativeTime
                    : formatTime(displayTime)}
                </span>
              </div>

              {/* Status Lap & Info Split */}
              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-muted-foreground font-medium">
                  {lane.lastLap
                    ? `Lap ${lane.lastLap.lapNumber} selesai`
                    : isRunning
                      ? "Sprinting..."
                      : "Ready"}
                </span>
                {lane.lastLap && (
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0 px-1.5 h-5"
                  >
                    Split: {lane.lastLap.splitTime}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
