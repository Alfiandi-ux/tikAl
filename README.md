# tikAl

Downloader video TikTok **tanpa watermark** dengan kualitas **HD**. Tersedia sebagai **APK Android** (Python + Flask dibundel, tanpa Termux) dan sebagai aplikasi web lokal di Termux. Tanpa login, tanpa iklan, dan tidak menyimpan data di server.

![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB)
![Flask](https://img.shields.io/badge/Flask-3.x-000000)
![Android](https://img.shields.io/badge/Android-8.0%2B-3DDC84)
![License](https://img.shields.io/badge/use-pribadi-lightgrey)

## Unduh APK

APK resmi tersedia di halaman **[Releases](../../releases)** repositori ini. Pasang langsung di HP Android 8.0+ (arm64), tanpa perlu Termux, Python, atau komputer.

> Di dalam APK, server Flask berjalan otomatis di latar belakang aplikasi. Berkas unduhan tersimpan di folder **Download**.


## Fitur

- Video TikTok **tanpa watermark**, pilih HD atau SD.
- **Audio MP3** dari video.
- **Slideshow/foto**: unduh semua foto sekaligus dalam ZIP.
- Pratinjau video langsung di browser.
- Riwayat unduhan tersimpan di perangkat (localStorage).
- Bisa di-install ke home screen seperti aplikasi (PWA), termasuk tampilan offline untuk shell aplikasi.
- UI mobile-first, responsif, dan berbahasa Indonesia.
- Proxy download di backend: aman dari CORS, mendukung Range/seek, dan hanya mengizinkan domain CDN TikTok.

## Cara menjalankan versi web (Termux)

```bash
cd ~/tikAl
pip install -r requirements.txt   # biasanya sudah terpasang di Termux
python3 app.py
```

Buka **http://127.0.0.1:8080** di Chrome.

Atau pakai skrip (otomatis membuka Chrome di Termux):

```bash
./run.sh
```

Matikan buka-otomatis dengan `OPEN_BROWSER=0 ./run.sh`.

> Server harus tetap berjalan selama aplikasi dipakai. Unduhan tidak akan bekerja jika server dimatikan.

### Ganti port

```bash
PORT=9000 python3 app.py
```

### Akses dari HP/PC lain di Wi-Fi yang sama

```bash
HOST=0.0.0.0 PORT=8080 python3 app.py
```

Lalu buka `http://IP-HP:8080` dari perangkat lain. Catatan: hanya lakukan ini di jaringan yang kamu percaya.

## Install sebagai aplikasi (PWA)

1. Jalankan server, lalu buka `http://127.0.0.1:8080` di Chrome.
2. Menu ⋮ → **Add to Home screen** / **Install app**.
3. Ikon tikAl muncul di launcher dan terbuka tanpa address bar.

Shell aplikasi bisa dibuka saat offline, tetapi pengambilan video tetap memerlukan server lokal yang berjalan dan koneksi internet.

### Tips di Android

- Gunakan **Chrome**, bukan browser dalam aplikasi WhatsApp/Instagram.
- File tersimpan di folder **Download** HP.
- Jika tombol unduh tidak merespons, coba lagi atau tutup lalu buka ulang aplikasi.
- Jangan tutup Termux saat memakai aplikasi versi web. Bila sering terhenti, jalankan `termux-wake-lock` sebelum server.
- Di versi APK, biarkan aplikasi tetap terbuka selama unduhan berjalan agar server lokal tidak berhenti.
- Server ini untuk pemakaian pribadi di perangkat sendiri, bukan untuk di-hosting publik.

## Build APK sendiri

APK dibangun otomatis lewat GitHub Actions (`.github/workflows/android.yml`) memakai [Chaquopy](https://chaquo.com/chaquopy/) untuk membundel Python + Flask.

- **Otomatis:** buat tag `v*` atau jalankan workflow *Build APK* secara manual, lalu isi tag rilis.
- **Lokal:** butuh JDK 17, Python 3.12, dan Android SDK:

```bash
cd android
./gradlew assembleRelease
```

Hasilnya di `android/app/build/outputs/apk/release/app-release.apk`. Tanpa keystore, APK ditandatangani dengan debug key (tetap bisa dipasang).

Untuk rilis resmi, siapkan secrets repositori: `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, dan `KEY_PASSWORD`.

## Struktur proyek

```
tikAl/
├── app.py                  # server Flask + API
├── requirements.txt
├── run.sh                  # skrip start versi web
├── templates/
│   └── index.html
├── static/
│   ├── css/style.css
│   ├── js/app.js
│   ├── sw.js               # service worker PWA
│   ├── manifest.webmanifest
│   ├── icon.svg
│   └── icon-*.png
├── android/                # pembungkus APK (WebView + Chaquopy)
│   ├── app/src/main/java/id/alfiandi/tikal/MainActivity.java
│   ├── app/src/main/python/server.py
│   └── app/src/main/res/
├── .github/workflows/
│   └── android.yml         # build + rilis APK
└── tools/
    └── make_icons.py       # generator ikon
```

## API

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| `POST` | `/api/info` | Body `{"url": "..."}` → metadata + tautan unduhan |
| `GET` | `/api/info?url=...` | Versi GET untuk pengujian |
| `GET` | `/api/download?url=...&name=...` | Streaming file (attachment; tambah `inline=1` untuk pratinjau) |
| `POST` | `/api/zip` | Body `{"url": "..."}` → ZIP semua foto slideshow |
| `GET` | `/api/zip?url=...` | Versi GET (dipakai APK Android) |
| `GET` | `/api/health` | Cek status server |

Contoh:

```bash
curl -s -X POST http://127.0.0.1:8080/api/info \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.tiktok.com/@tiktok/video/7106594312292453675"}'
```

## Cara kerja

1. Link dinormalisasi (termasuk link pendek `vm.tiktok.com` / `vt.tiktok.com`).
2. Data video diambil lewat API publik `tikwm.com` (fallback GET → POST).
3. Hasil dipetakan ke format seragam: video HD/SD tanpa watermark, versi watermark, audio, dan foto.
4. Unduhan diproksikan lewat server lokal agar tidak kena CORS dan nama file rapi. Domain media dibatasi ke CDN TikTok/TikWM, IP privat diblokir (anti-SSRF).

## Troubleshooting

**"Video tidak ditemukan"**  
Pastikan video publik, link benar, dan belum dihapus. Video privat/region-lock tidak bisa diambil.

**"Server sedang sibuk"**  
API pihak ketiga sedang membatasi permintaan. Tunggu 5–10 detik lalu coba lagi.

**Unduhan tidak mulai di Chrome**  
Coba lagi, atau buka `http://127.0.0.1:8080` langsung di Chrome (bukan in-app browser WhatsApp/Instagram). Pastikan izin penyimpanan/download aktif.

**Port sudah dipakai**  
Jalankan dengan port lain: `PORT=9000 python3 app.py`.

**Ingin kualitas lebih tinggi dari yang tersedia**  
TikTok membatasi resolusi sumber. Aplikasi mengambil versi terbaik yang disediakan (biasanya 720p–1080p).

## Catatan hukum

Aplikasi ini untuk **penggunaan pribadi** (menyimpan konten yang boleh diunduh, arsip pribadi, dsb). Hormati hak cipta kreator dan Ketentuan Layanan TikTok. Jangan mengunduh ulang, menyebarkan, atau memonetisasi konten milik orang lain tanpa izin.

---

Dibuat untuk Termux. Tidak ada data yang dikirim ke server selain permintaan ke TikTok/TikWM untuk mengambil video.
