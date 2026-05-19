import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
// Fungsi server dari hasil perombakan sebelumnya
import {
  syncDailySchedule,
  activateHeat,
  getRunningHeat,
  getPendingHeats,
  updateHeatMaxLaps,
} from "@/server/heat.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Play, Save, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/preparation")({
  component: PreparationPage,
});

function PreparationPage() {
  const queryClient = useQueryClient();
  const [maxLapsInput, setMaxLapsInput] = useState<number | string>("");

  // ==========================================
  // MUTASI SERVER (POST)
  // ==========================================
  const syncMutation = useMutation({
    mutationFn: () => syncDailySchedule(),
    onSuccess: () => {
      toast.success("Berhasil sinkronisasi seluruh jadwal harian!");
      queryClient.invalidateQueries({ queryKey: ["runningHeat"] });
      queryClient.invalidateQueries({ queryKey: ["pendingHeats"] });
    },
    onError: (err: any) => {
      toast.error(`Error sinkronisasi: ${err.message}`);
    },
  });

  const activateMutation = useMutation({
    mutationFn: (heatId: number) =>
      activateHeat({ data: { heatDbId: heatId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runningHeat"] });
      queryClient.invalidateQueries({ queryKey: ["pendingHeats"] });
    },
    onError: (err: any) => {
      toast.error(`Error mengaktifkan heat: ${err.message}`);
    },
  });

  // ==========================================
  // FETCH DATA (GET)
  // ==========================================

  // Fetch Real-time menggunakan Server Function murni via TanStack Query
  const { data: runningHeat, isLoading: isRunningLoading } = useQuery({
    queryKey: ["runningHeat"],
    queryFn: () => getRunningHeat(),
  });

  const { data: pendingHeats = [], isLoading: isPendingLoading } = useQuery({
    queryKey: ["pendingHeats"],
    queryFn: () => getPendingHeats(),
  });

  // Mutasi untuk menyimpan batas lapping
  const updateLapsMutation = useMutation({
    mutationFn: (payload: { heatId: number; maxLaps: number }) =>
      updateHeatMaxLaps({ data: payload }),
    onSuccess: () => {
      toast.success("Batas putaran berhasil diperbarui!");
      queryClient.invalidateQueries({ queryKey: ["runningHeat"] });
      queryClient.invalidateQueries({ queryKey: ["pendingHeats"] });
    },
    onError: (err: any) => {
      toast.error(`Gagal menyimpan: ${err.message}`);
    },
  });

  const handleUpdateLaps = () => {
    if (!runningHeat) return;
    updateLapsMutation.mutate({
      heatId: runningHeat.id,
      maxLaps: parseInt(maxLapsInput as string),
    });
  };

  // Sinkronisasi form input max laps jika heat yang berjalan berubah
  useEffect(() => {
    if (runningHeat && !maxLapsInput) {
      setMaxLapsInput(runningHeat.maxLaps);
    }
  }, [runningHeat]);

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-8">
      {/* HEADER HALAMAN */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Persiapan Kompetisi
          </h1>
          <p className="text-muted-foreground mt-1">
            Pantau dan atur antrean pertandingan. Lakukan sinkronisasi data pagi
            sebelum lomba dimulai.
          </p>
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto"
        >
          {syncMutation.isPending ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {syncMutation.isPending
            ? "Menyinkronkan..."
            : "Tarik Data Pagi (Sync)"}
        </Button>
      </div>

      {/* KARTU UTAMA: HEAT BERJALAN (RUNNING) */}
      <Card className="shadow-sm">
        <CardHeader className="border-b border-green-100 dark:border-green-900/30">
          <div className="space-y-1">
            <CardTitle className="text-2xl flex items-center gap-3">
              Heat Berjalan
              <Badge className="bg-green-500 hover:bg-green-600 dark:bg-green-600 text-white shadow-sm border-0">
                <span className="relative flex h-2 w-2 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                RUNNING
              </Badge>
            </CardTitle>
            <CardDescription>
              Informasi detail terkait heat yang saat ini sedang berlangsung di
              kolam.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {isRunningLoading ? (
            <p className="text-center py-6 text-muted-foreground">
              Memuat data aktif...
            </p>
          ) : runningHeat ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* Info Acara */}
              <div className="grid grid-cols-2 gap-y-4 text-sm bg-background/50 p-4 rounded-xl border">
                <div className="text-muted-foreground font-medium">
                  Kode Acara
                </div>
                <div className="font-semibold text-lg">
                  {runningHeat.event.kodeAcara}
                </div>

                <div className="text-muted-foreground font-medium">
                  Nomor Lomba
                </div>
                <div className="font-semibold text-lg">
                  {runningHeat.event.nomorLomba}m
                </div>

                <div className="text-muted-foreground font-medium">
                  Heat Ke-
                </div>
                <div className="font-bold text-2xl text-primary">
                  {runningHeat.label}
                </div>
              </div>

              {/* Pengaturan Lap */}
              <div className="bg-muted/40 p-5 rounded-xl border space-y-4">
                <div>
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Batas Maksimal Lap
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Atur kapan sistem harus mencatat waktu "Finish" akhir.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    value={maxLapsInput}
                    onChange={(e) => setMaxLapsInput(e.target.value)}
                    className="max-w-[120px] text-lg font-bold text-center"
                  />
                  <Button onClick={handleUpdateLaps} className="flex-1">
                    <Save className="w-4 h-4 mr-2" />
                    Simpan Perubahan
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <p>Tidak ada heat yang berstatus RUNNING saat ini.</p>
              <p className="text-sm mt-1">
                Silakan aktifkan heat dari daftar antrean di bawah.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DAFTAR HEAT (PENDING) */}
      <Card>
        <CardHeader>
          <CardTitle>Antrean Selanjutnya (PENDING)</CardTitle>
          <CardDescription>
            Pilih dan aktifkan heat selanjutnya. Mengaktifkan heat baru otomatis
            akan menutup heat yang sebelumnya berjalan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPendingLoading ? (
            <p className="text-center py-6 text-muted-foreground">
              Memuat antrean...
            </p>
          ) : pendingHeats.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Kode Acara</TableHead>
                    <TableHead>Nomor Lomba</TableHead>
                    <TableHead>Heat</TableHead>
                    <TableHead>Max Lap Default</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingHeats.map((heat) => (
                    <TableRow key={heat.id}>
                      <TableCell className="font-medium">
                        {heat.event.kodeAcara}
                      </TableCell>
                      <TableCell>{heat.event.nomorLomba}m</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-xs font-semibold"
                        >
                          Heat {heat.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{heat.maxLaps} Lap</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => activateMutation.mutate(heat.id)}
                          disabled={activateMutation.isPending}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Set Jadi Running
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/20">
              <p>Semua heat sudah selesai dipertandingkan.</p>
              <p className="text-sm mt-1">
                Atau Anda belum melakukan tarik data pagi hari ini.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
