# PRD Tambahan — Fitur Lapor & Peringatan Dini

Addendum untuk: PRD Agent AI Warta Warga
Fitur: Lapor Penipuan/Hoaks dari Warga → Peringatan Dini ke Komunitas
Versi: 0.1 | Status: Draft untuk build
Catatan: Bangun fitur ini SETELAH alur inti (info bansos + verifikasi + broadcast) stabil & teruji.

---

## 1. Tujuan & Batas

### Tujuan
Memanfaatkan laporan warga soal **penipuan/hoaks bansos** sebagai sumber peringatan dini: warga saling melindungi dengan menyebarkan peringatan "awas modus X marak di daerahmu" — setelah diverifikasi AI dan disetujui pengurus.

### Batas tegas (jangan dilanggar)
- **HANYA** untuk laporan penipuan/hoaks. BUKAN pengaduan layanan publik (jalan rusak, listrik mati, dll → di luar studi kasus, jangan dibangun).
- Output peringatan selalu **ke sesama warga**, BUKAN tiket/aduan ke instansi pemerintah.
- Sistem tidak pernah broadcast peringatan secara otomatis tanpa persetujuan manusia.

### Kenapa fitur ini ada (untuk pitch)
Info bansos tidak update tiap hari, tapi penipuan jalan terus. Fitur ini bikin sistem berguna setiap hari — saat tidak ada info bansos baru, sistem tetap melindungi warga dari penipuan yang sedang marak.

---

## 2. Alur Lengkap

```
Warga lapor penipuan/hoaks (japri/grup)
        ↓
Agent: klasifikasi maksud = "lapor"
        ↓
Catat laporan + tag wilayah (dari konteks grup/japri)
        ↓
AI cek klaim ke SUMBER TERKURASI → tentukan status:
   ├─ Jelas penipuan (cocok pola / bertentangan sumber)
   │       → masuk ANTRIAN APPROVAL pengurus (dashboard)
   ├─ Belum bisa dipastikan (tak ada di sumber)
   │       → simpan; bila banyak laporan serupa, naik prioritas tinjau
   └─ Ternyata valid / bukan penipuan
           → tutup, tanpa aksi
        ↓
Pengurus tinjau di dashboard → APPROVE
        ↓
Broadcast peringatan ke grup sewilayah (numpang infra broadcast yang ada)
```

Catatan: status 3-tingkat di atas konsisten dengan sistem 3-label verifikasi yang sudah ada — tidak membuat logika baru dari nol.

---

## 3. Tiga Rambu Wajib

### Rambu 1 — Dua lapis pengaman sebelum sebar
- **Lapis 1 (AI):** cek klaim ke sumber terkurasi. Hanya yang lolos sebagai "jelas penipuan" yang masuk antrian.
- **Lapis 2 (Manusia):** pengurus approve via dashboard sebelum peringatan disebar.
- AI TIDAK PERNAH broadcast peringatan sendiri. Selalu ada approval manusia.

### Rambu 2 — Privasi pelapor
- Peringatan berbunyi umum: "Ada laporan modus penipuan X di daerah ini. Hati-hati."
- TIDAK menyebut nama/nomor/identitas pelapor.
- Identitas pelapor tidak disimpan (konsisten prinsip no-PII §6.2 PRD utama).

### Rambu 3 — Numpang infrastruktur yang ada
- Tag wilayah: peringatan hanya ke grup sewilayah (aturan hierarkis §6.3).
- Opt-in: hanya ke grup yang sudah `/start`.
- Delay antar grup & dedup: pakai mekanisme broadcast yang sudah teruji.
- Traceable: peringatan menyertakan dasar verifikasi bila ada.

---

## 4. Requirement Fungsional

- L1: Agent dapat mengklasifikasi pesan warga sebagai maksud "lapor" (vs tanya info / verifikasi / ambigu).
- L2: Laporan disimpan dengan `wilayah_tag`, `status`, `timestamp` — TANPA identitas pelapor.
- L3: AI mengecek klaim laporan ke sumber terkurasi, menetapkan status: `jelas_penipuan` / `belum_pasti` / `bukan_penipuan`.
- L4: Hanya status `jelas_penipuan` yang masuk antrian approval dashboard.
- L5: Laporan `belum_pasti` yang serupa & menumpuk → naik prioritas tinjau (mis. hitung jumlah laporan sejenis sewilayah).
- L6: Pengurus dapat melihat antrian, meninjau, lalu approve/tolak via dashboard.
- L7: Hanya laporan yang di-approve yang di-broadcast — sebagai peringatan umum, ke grup sewilayah, tanpa identitas pelapor.
- L8: Peringatan yang sama tidak dikirim ulang (dedup).

---

## 5. Skema Database (tambahan)

```
laporan
  id              (PK)
  isi_ringkas     (ringkasan modus, tanpa data pribadi pelapor)
  wilayah_tag
  status          (jelas_penipuan / belum_pasti / bukan_penipuan)
  jumlah_serupa   (counter laporan sejenis sewilayah)
  status_approval (menunggu / disetujui / ditolak)
  dasar_verifikasi (ringkas hasil cek AI, opsional)
  timestamp

peringatan_terkirim
  id
  laporan_id      (FK)
  wilayah_tag
  timestamp
```

> Tidak ada kolom nama/nomor/identitas pelapor di mana pun. Yang dicatat hanya isi modus + wilayah.

---

## 6. Dashboard — Antrian Approval

Pengurus melihat:
- Daftar laporan berstatus `jelas_penipuan` yang menunggu approval.
- Per laporan: ringkasan modus, wilayah, jumlah laporan serupa, dasar verifikasi AI.
- Aksi: `Approve & sebar peringatan` / `Tolak`.
- (Opsional) edit teks peringatan sebelum sebar.

---

## 7. Responsible AI (poin kuat untuk juri)

| Risiko | Mitigasi |
|---|---|
| AI salah cap penipuan → sebar peringatan keliru | AI tidak pernah sebar sendiri; pengurus approve dulu (human-in-the-loop eksplisit) |
| Laporan iseng/keliru memicu kepanikan | Dua lapis: AI saring + manusia approve; status `belum_pasti` tidak disebar |
| Privasi pelapor bocor | Identitas tidak disimpan & tidak disebut; peringatan bersifat umum |
| Peringatan salah daerah | Tag wilayah + filter hierarkis |
| Spam peringatan | Dedup + delay antar grup (infra yang ada) |

> Kalimat pitch: "AI hanya menyaring; keputusan menyebar peringatan tetap di tangan pengurus. AI mempercepat, manusia memutuskan."

---

## 8. Definition of Done

Inti fitur (wajib):
- [ ] Klasifikasi maksud "lapor" berfungsi.
- [ ] Laporan tersimpan dengan wilayah + status, tanpa identitas pelapor.
- [ ] AI cek klaim ke sumber → status 3-tingkat.
- [ ] Antrian approval di dashboard: pengurus bisa approve/tolak.
- [ ] Hanya yang di-approve yang di-broadcast (peringatan umum, sewilayah, dedup).

Bonus (kalau waktu sisa):
- [ ] Prioritas otomatis untuk laporan `belum_pasti` yang menumpuk.
- [ ] Edit teks peringatan sebelum sebar.
- [ ] Statistik tren modus penipuan per wilayah di dashboard.

---

## 9. Di Luar Cakupan (jangan dibangun)

- Pengaduan layanan publik (jalan rusak, listrik, dll).
- Penerusan laporan ke sistem/instansi pemerintah.
- Broadcast peringatan otomatis tanpa approval manusia.
- Menyimpan atau menampilkan identitas pelapor.