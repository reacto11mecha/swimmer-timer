import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { syncAndPrepareHeat } from "@/server/heat.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RefreshCw, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/preparation")({
  component: PreparationPage,
});

function PreparationPage() {
  const navigate = useNavigate();
  const [heatId, setHeatId] = useState("");

  const syncMutation = useMutation({
    mutationFn: (id: string) => syncAndPrepareHeat({ data: { heatId: id } }),
    onSuccess: (res) => {
      alert(`Berhasil sinkronisasi: ${res.eventTitle}`);
      navigate({ to: "/" }); // Langsung ke Dashboard setelah siap
    },
    onError: (err: any) => {
      alert(`Error: ${err.message}`);
    },
  });

  return (
    <div className="container mx-auto p-6 max-w-xl py-20">
      <Card className="shadow-lg border-2 border-blue-100">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">Persiapan Pertandingan</CardTitle>
          <CardDescription>
            Masukkan ID Seri dari Server Registrasi untuk memulai sinkronisasi
            hardware.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="heatId">ID Seri / Heat ID</Label>
            <div className="flex gap-2">
              <Input
                id="heatId"
                placeholder="Misal: HEAT_2024_001"
                value={heatId}
                onChange={(e) => setHeatId(e.target.value)}
                className="text-lg h-12"
              />
            </div>
          </div>

          <Button
            className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700"
            disabled={!heatId || syncMutation.isPending}
            onClick={() => syncMutation.mutate(heatId)}
          >
            {syncMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                Menyinkronkan Data...
              </>
            ) : (
              <>
                Tarik & Siapkan Data <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Tindakan ini akan mereset semua sensor ESP32 dan membersihkan data
            sesi sebelumnya di lokal.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
