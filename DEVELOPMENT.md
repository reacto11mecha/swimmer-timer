# Convention Pengembangan

## Dokumen Teknis Komunikasi ESP32

### ESP32 -> Web

1. Data waktu start ke mqtt. Dikirim oleh starter gun.

Nama Topik: `starter/start` 

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

Nama Topik: `device/telemetry` 

```ts
{
  node: string,
  wifi_rssi: number,
  battery: number
}
```

### Web -> ESP32

1. Untuk mereset hitungan lap dan state di semua alat.

Nama Topik: `server/reset`

Data bisa berupa string kosong, bisa di abaikan.

## Dokumen Teknis Pewaktu <=> Registrasi

Struktur untuk diminta dari server pewaktu ke server registrasi.

```json
[
  {
    "id": number, (Primary Key Penanda Acara)
    "kode_acara": number (201)
    "nomor_lomba": number (jarak)
    "heats": [
      {
        "id": number, (Primary Key penanda heat)
        "label": number, (1)
        "lanes": [
          {
            "lane": number, (2)
            "participantId": number,
            "name": string,
            "club": string
          }
        ]
      }
    ]
  }
]
```

Struktur untuk dikirim dari server pewaktu ke server registrasi.

```json
[
  {
    "id": number, (Primary Key Penanda Acara)
    "heats": [
      {
        "id": number, (Primary Key penanda heat)
        "lanes": [
          {
            "lane": number, (2)
            "participantId": number,
            "result_time": number (hasil waktu finish dikurangi waktu starter gun)
          }
        ]
      }
    ]
  }
]
```
