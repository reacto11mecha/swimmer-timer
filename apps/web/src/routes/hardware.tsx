import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

// Mengimpor fungsi secara langsung (Build process akan menggantinya dengan RPC stubs di client)
import {
  getNodes,
  addNode,
  toggleNodeStatus,
  deleteNode,
} from "../server/nodes.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/hardware")({
  component: HardwareConfigPage,
});

function HardwareConfigPage() {
  const queryClient = useQueryClient();
  const [nodeId, setNodeId] = useState("");
  const [laneNumber, setLaneNumber] = useState("");

  // Fetch Data menggunakan Static Import
  const { data: nodes, isLoading } = useQuery({
    queryKey: ["nodes"],
    queryFn: () => getNodes(),
  });

  // Mutations: Perhatikan pemanggilan fungsinya, parameter dibungkus dengan obj { data: ... }
  const addMutation = useMutation({
    mutationFn: (variables: { nodeId: string; laneNumber: number }) =>
      addNode({ data: variables }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nodes"] });
      setNodeId("");
      setLaneNumber("");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (variables: { id: number; isActive: boolean }) =>
      toggleNodeStatus({ data: variables }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nodes"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteNode({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nodes"] }),
  });

  const handleAddNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeId || !laneNumber) return;
    addMutation.mutate({ nodeId, laneNumber: parseInt(laneNumber, 10) });
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hardware Mapping</h1>
        <p className="text-muted-foreground">
          Petakan ESP32 Node ID ke nomor lintasan fisik di kolam renang.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form Tambah Node */}
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Tambah Node</CardTitle>
            <CardDescription>
              Assign perangkat baru ke lintasan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddNode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nodeId">ESP32 Node ID (MQTT)</Label>
                <Input
                  id="nodeId"
                  placeholder="Misal: NODE_LANE_1"
                  value={nodeId}
                  onChange={(e) => setNodeId(e.target.value)}
                  disabled={addMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="laneNumber">Nomor Lintasan</Label>
                <Input
                  id="laneNumber"
                  type="number"
                  min="1"
                  max="8"
                  placeholder="1-8"
                  value={laneNumber}
                  onChange={(e) => setLaneNumber(e.target.value)}
                  disabled={addMutation.isPending}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? "Menyimpan..." : "Simpan Node"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Tabel Daftar Node */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Daftar Perangkat Aktif</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                Memuat data...
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lintasan</TableHead>
                    <TableHead>Node ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nodes?.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground"
                      >
                        Belum ada node yang didaftarkan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    nodes?.map((node) => (
                      <TableRow key={node.id}>
                        <TableCell className="font-medium">
                          Lane {node.laneNumber}
                        </TableCell>
                        <TableCell className="font-mono">
                          {node.nodeId}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={node.isActive ?? false}
                              onCheckedChange={(checked) =>
                                toggleMutation.mutate({
                                  id: node.id,
                                  isActive: checked,
                                })
                              }
                            />
                            <Badge
                              variant={
                                node.isActive ? "default" : "destructive"
                              }
                            >
                              {node.isActive ? "Aktif" : "Nonaktif"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => {
                              if (window.confirm("Hapus node ini?")) {
                                deleteMutation.mutate(node.id);
                              }
                            }}
                          >
                            Hapus
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
