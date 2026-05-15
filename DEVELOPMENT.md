# Dokumen Teknis Komunikasi ESP32

ESP32 -> Web

1. Data waktu start ke mqtt

Nama Topik: `timer/start` 

```ts
{
  elapsed: number,
}
```

2. Data lap perenang ke mqtt

Nama Topik: `timer/lap` 

```ts
{
  node: string,
  elapsed: number,
  lap_order: number
}
```


3. Data telemetri alat ke mqtt

Nama Topik: `timer/telemetry` 

```ts
{
  node: string,
  wifi_rssi: number,
  battery: number
}
```
