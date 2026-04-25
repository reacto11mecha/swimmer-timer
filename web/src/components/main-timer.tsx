import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Square, RotateCcw, Timer } from "lucide-react";

// Tipe data berdasarkan struktur JSON yang diberikan
interface Participant {
  id: string;
  name: string;
}

interface InfoLomba {
  nama: string;
  no_seri: string;
  jumlah_peserta: number;
  participants: Participant[];
}

interface LaneState {
  id: number;
  isActive: boolean;
  participantId: string | null;
  timeMs: number; // Waktu dalam milidetik
}

export default function TimerDashboard() {
  const [infoLomba, setInfoLomba] = useState<InfoLomba | null>(null);

  // Inisialisasi 10 Lane
  const [lanes, setLanes] = useState<LaneState[]>(
    Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      isActive: true, // Default aktif
      participantId: null,
      timeMs: 0,
    })),
  );

  const [isRaceActive, setIsRaceActive] = useState(false);

  // Simulasi Fetch Data Eksternal
  useEffect(() => {
    // Di aplikasi nyata, ganti dengan fetch() ke API/Endpoint Anda
    const fetchMockData = async () => {
      const mockData: InfoLomba = {
        nama: "Kejuaraan Renang Antar Mahasiswa",
        no_seri: "Heat 1 - Gaya Bebas 50m",
        jumlah_peserta: 6,
        participants: [
          { id: "P01", name: "Budi Santoso" },
          { id: "P02", name: "Andi Saputra" },
          { id: "P03", name: "Reza Rahadian" },
          { id: "P04", name: "Kevin Sanjaya" },
          { id: "P05", name: "Marcus Gideon" },
          { id: "P06", name: "Jonatan Christie" },
        ],
      };
      setInfoLomba(mockData);

      // Auto-assign peserta ke lane yang aktif (opsional, sebagai kemudahan UX)
      setLanes((prevLanes) => {
        const newLanes = [...prevLanes];
        let pIndex = 0;
        for (let i = 0; i < newLanes.length; i++) {
          if (newLanes[i].isActive && pIndex < mockData.participants.length) {
            newLanes[i].participantId = mockData.participants[pIndex].id;
            pIndex++;
          }
        }
        return newLanes;
      });
    };

    fetchMockData();
  }, []);

  // Handler untuk mengaktifkan/menonaktifkan lane
  const toggleLaneActive = (laneId: number) => {
    setLanes(
      lanes.map((lane) =>
        lane.id === laneId
          ? {
              ...lane,
              isActive: !lane.isActive,
              participantId: !lane.isActive ? lane.participantId : null,
            }
          : lane,
      ),
    );
  };

  // Handler untuk assign peserta ke lane
  const assignParticipant = (laneId: number, participantId: string) => {
    setLanes(
      lanes.map((lane) =>
        lane.id === laneId ? { ...lane, participantId } : lane,
      ),
    );
  };

  // Format waktu timer (MM:SS.ms)
  const formatTime = (timeMs: number) => {
    const minutes = Math.floor(timeMs / 60000);
    const seconds = Math.floor((timeMs % 60000) / 1000);
    const milliseconds = Math.floor((timeMs % 1000) / 10);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(2, "0")}`;
  };

  if (!infoLomba)
    return (
      <div className="p-8 flex justify-center text-xl dark:text-slate-200">
        Memuat data perlombaan...
      </div>
    );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 min-h-screen">
      {/* Header Info Perlombaan */}
      <Card className="border-t-4 border-t-blue-600 dark:border-t-blue-500 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-2xl font-bold">
              {infoLomba.nama}
            </CardTitle>
            <p className="mt-1 font-medium text-slate-700 dark:text-slate-300">
              {infoLomba.no_seri}
            </p>
          </div>
          <div className="flex gap-4">
            <Badge variant="secondary" className="text-sm py-1 px-3">
              Total Peserta: {infoLomba.jumlah_peserta}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex gap-3 pt-4 border-t dark:border-slate-800 mt-4">
          <Button
            size="lg"
            className="bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 dark:text-white w-32"
            onClick={() => setIsRaceActive(true)}
            disabled={isRaceActive}
          >
            <Play className="mr-2 h-5 w-5" /> Start All
          </Button>
          <Button
            size="lg"
            variant="destructive"
            className="w-32"
            onClick={() => setIsRaceActive(false)}
            disabled={!isRaceActive}
          >
            <Square className="mr-2 h-5 w-5" /> Stop All
          </Button>
          <Button size="lg" variant="outline" className="w-32">
            <RotateCcw className="mr-2 h-5 w-5" /> Reset
          </Button>
        </CardContent>
      </Card>

      {/* Grid 10 Lane */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {lanes.map((lane) => (
          <Card
            key={lane.id}
            className={`transition-all duration-200 ${
              !lane.isActive
                ? "opacity-60 bg-slate-100 dark:bg-slate-900 border-transparent dark:border-slate-800"
                : "border-blue-200 dark:border-blue-900/50 shadow-sm hover:shadow-md dark:bg-slate-950"
            }`}
          >
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center justify-center h-8 w-8 rounded-full font-bold text-white ${
                    lane.isActive
                      ? "bg-blue-600 dark:bg-blue-600"
                      : "bg-slate-400 dark:bg-slate-700"
                  }`}
                >
                  {lane.id}
                </div>
                <Label
                  htmlFor={`lane-${lane.id}`}
                  className="font-semibold text-slate-700 dark:text-slate-200"
                >
                  Lane {lane.id}
                </Label>
              </div>
              <Switch
                id={`lane-${lane.id}`}
                checked={lane.isActive}
                onCheckedChange={() => toggleLaneActive(lane.id)}
                disabled={isRaceActive}
              />
            </CardHeader>

            <CardContent className="p-4 pt-2 space-y-4">
              {/* Dropdown Peserta */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 dark:text-slate-400">
                  Atlet / Peserta
                </Label>
                <Select
                  disabled={!lane.isActive || isRaceActive}
                  value={lane.participantId || undefined}
                  onValueChange={(val) => assignParticipant(lane.id, val)}
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="Kosong (Tidak ada)" />
                  </SelectTrigger>
                  <SelectContent>
                    {infoLomba.participants.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Display Timer per Lane */}
              <div
                className={`p-3 rounded-lg border flex items-center justify-between ${
                  lane.isActive
                    ? "bg-slate-900 text-white border-slate-800 dark:bg-black dark:border-slate-800"
                    : "bg-slate-200 text-slate-400 border-slate-300 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700"
                }`}
              >
                <Timer className="h-5 w-5 opacity-70" />
                <span className="font-mono text-2xl font-bold tracking-wider">
                  {formatTime(lane.timeMs)}
                </span>
              </div>

              {/* Tombol Stop Individual */}
              {lane.isActive && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                  disabled={!isRaceActive}
                >
                  Lap / Stop
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
