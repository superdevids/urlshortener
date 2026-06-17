# Prompt AI: Build URL Shortener Professional-Grade dengan Next.js

# (Storage Adapter: JSON File [default] atau MySQL [optional, via .env])

```
Saya ingin kamu membangun aplikasi web URL Shortener menggunakan Next.js (App Router)
dengan standar PROFESSIONAL / PRODUCTION-READY — bukan sekadar prototype.

Aplikasi ini harus mendukung DUA pilihan storage backend yang bisa dipilih lewat
environment variable, TANPA mengubah kode bisnis logic (gunakan pola Repository/
Adapter Pattern):

1. **JSON File** (PRIMARY/DEFAULT) — data disimpan di file .json lokal
2. **MySQL** (OPTIONAL) — data disimpan di database MySQL

Switch ditentukan oleh env var `STORAGE_DRIVER=json` atau `STORAGE_DRIVER=mysql`.
Default-nya adalah `json` jika env var tidak diset.

## TECH STACK
- Next.js 14+ (App Router)
- TypeScript (strict mode)
- Tailwind CSS untuk styling
- Storage layer abstraksi (Repository Pattern) supaya JSON dan MySQL implementasinya
  interchangeable
- Untuk MySQL: gunakan `mysql2` (atau Prisma jika menurutmu lebih maintainable —
  jelaskan trade-off-nya dan pilih salah satu, lalu konsisten)
- Validasi schema menggunakan `zod`
- dotenv untuk konfigurasi (.env.local)

## ARSITEKTUR STORAGE (WAJIB DIIKUTI)

Buat interface `LinkRepository` di `/lib/storage/types.ts` dengan method:
- `findAll(): Promise<Link[]>`
- `findByShortCode(code: string): Promise<Link | null>`
- `findById(id: string): Promise<Link | null>`
- `create(data: CreateLinkInput): Promise<Link>`
- `delete(id: string): Promise<boolean>`
- `incrementClick(shortCode: string): Promise<void>`
- `existsByShortCode(code: string): Promise<boolean>`

Implementasikan dua class:
- `JsonFileRepository implements LinkRepository` → di `/lib/storage/json-repository.ts`
- `MySqlRepository implements LinkRepository` → di `/lib/storage/mysql-repository.ts`

Buat factory function `getRepository()` di `/lib/storage/index.ts` yang membaca
`process.env.STORAGE_DRIVER` dan return instance repository yang sesuai (singleton,
jangan instansiasi ulang setiap request). Semua API routes HARUS memanggil
`getRepository()`, tidak boleh ada kode yang langsung akses fs atau mysql2 di luar
folder `/lib/storage`.

## KONFIGURASI ENV (.env.local.example)
Buatkan file contoh env lengkap dengan komentar penjelasan untuk tiap variabel:
```

# Storage driver: "json" atau "mysql"

STORAGE_DRIVER=json

# Hanya dipakai jika STORAGE_DRIVER=json

JSON_DB_PATH=./data/links.json

# Hanya dipakai jika STORAGE_DRIVER=mysql

MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=url_shortener

# Base URL untuk generate short link (contoh: https://short.example.com)

NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Rate limiting

RATE_LIMIT_MAX=10
RATE_LIMIT_WINDOW_MS=60000

```

## SCHEMA DATA (berlaku sama untuk JSON dan MySQL)
```

Link {
id: string (uuid)
shortCode: string (6 karakter alfanumerik, unique)
originalUrl: string
createdAt: ISO timestamp
expiresAt: ISO timestamp | null
clickCount: number (default 0)
lastClickedAt: ISO timestamp | null
}

```

Untuk MySQL, sertakan juga file SQL migration `/migrations/001_create_links_table.sql`
dengan index pada kolom `shortCode` (unique index) dan `createdAt`.

## FITUR YANG DIBUTUHKAN

### 1. Shorten URL (POST /api/shorten)
- Input divalidasi dengan zod schema: originalUrl (wajib, harus URL valid http/https),
  customAlias (opsional, 3-20 karakter alfanumerik + dash/underscore),
  expiresInDays (opsional, integer positif)
- Cek apakah customAlias sudah dipakai (return 409 jika sudah ada) lewat
  `repository.existsByShortCode()`
- Generate shortCode acak (6 karakter alfanumerik, case-sensitive) jika customAlias
  kosong, dengan retry logic jika collision
- Return: shortCode, fullShortUrl (gabungan NEXT_PUBLIC_BASE_URL + shortCode), originalUrl

### 2. Redirect (GET /[shortCode])
- Cari shortCode lewat repository
- Ketemu & belum expired → increment clickCount, update lastClickedAt, redirect
  302 ke originalUrl
- Tidak ketemu → halaman 404 custom
- Expired → halaman "link sudah tidak berlaku"

### 3. Dashboard ("/")
- Form shorten URL baru (originalUrl, custom alias opsional, expiry opsional)
- Tabel semua short URL (terbaru dulu): short URL, original URL (truncate),
  jumlah klik, tanggal dibuat, status aktif/expired
- Copy-to-clipboard button
- Delete button per item (DELETE /api/links/[id])
- Search/filter client-side berdasarkan originalUrl/shortCode
- Tampilkan indikator kecil di UI storage driver mana yang sedang aktif (misal
  badge kecil "Storage: JSON" / "Storage: MySQL") — berguna untuk debugging

### 4. Analytics (GET /api/links/[id]/stats)
- Return clickCount dan lastClickedAt

## PERSYARATAN TEKNIS WAJIB

1. **Concurrency safety (khusus JSON driver)**: implementasikan file-locking
   (gunakan library `proper-lockfile` atau mutex in-memory dengan queue) agar
   tidak ada race condition saat read-modify-write file JSON secara bersamaan.

2. **Connection pooling (khusus MySQL driver)**: gunakan connection pool
   (`mysql2/promise` createPool), jangan buka koneksi baru tiap request.

3. **Error handling konsisten**: semua API routes return format error JSON yang
   konsisten, misal `{ error: { code: string, message: string } }`, dengan HTTP
   status yang sesuai (400/404/409/500). Jangan biarkan exception bocor ke
   response tanpa di-handle.

4. **Auto-inisialisasi**:
   - JSON driver: buat file + folder otomatis jika belum ada
   - MySQL driver: sediakan script `npm run db:migrate` yang menjalankan file
     migration SQL

5. **Security**:
   - Sanitasi originalUrl: tolak scheme selain http/https (cegah javascript:,
     data:, file: URI untuk XSS/open-redirect)
   - Rate limiting di endpoint /api/shorten berdasarkan IP (pakai env
     RATE_LIMIT_MAX & RATE_LIMIT_WINDOW_MS), implementasi in-memory cukup untuk
     skala kecil tapi beri komentar bahwa untuk multi-instance deployment perlu
     Redis
   - Untuk MySQL: gunakan parameterized query (prepared statements), JANGAN
     string concatenation untuk mencegah SQL injection

6. **TypeScript**: strict mode aktif, semua function punya return type eksplisit,
   shared types di `/types/index.ts`

7. **Testing dasar**: sertakan minimal 1 file unit test (pakai Vitest atau Jest)
   untuk validasi shortCode generator dan untuk salah satu repository (boleh JSON
   repository saja) yang menguji create → findByShortCode → delete.

8. **README.md**: tulis README lengkap berisi: deskripsi project, cara setup
   (.env), cara run dengan JSON driver, cara run dengan MySQL driver (termasuk
   cara migrate), dan struktur folder.

## STRUKTUR FOLDER YANG DIHARAPKAN
```

/app
/page.tsx
/[shortCode]/route.ts
/api/shorten/route.ts
/api/links/route.ts
/api/links/[id]/route.ts
/api/links/[id]/stats/route.ts
/lib
/storage/
types.ts → interface LinkRepository, types CreateLinkInput
json-repository.ts
mysql-repository.ts
index.ts → factory getRepository()
/validators.ts → zod schemas
/rate-limit.ts
/short-code.ts → generator + collision retry logic
/migrations
/001_create_links_table.sql
/types
/index.ts
/data
/links.json
/tests
/short-code.test.ts
/json-repository.test.ts
.env.local.example
README.md

```

## OUTPUT YANG DIINGINKAN (urutan wajib)
1. Ringkasan arsitektur (jelaskan kenapa Repository Pattern dipilih, bagaimana
   switching driver bekerja)
2. Kode lengkap setiap file di struktur folder di atas (production-ready, bukan
   pseudo-code, termasuk semua import yang dibutuhkan)
3. Isi `.env.local.example` lengkap dengan komentar
4. Instruksi setup & run (untuk kedua mode driver)
5. Penjelasan eksplisit di akhir: trade-off JSON vs MySQL (concurrency,
   scalability, kemudahan deploy ke Vercel/serverless — termasuk peringatan bahwa
   JSON driver TIDAK reliable di Vercel karena filesystem ephemeral, jadi MySQL
   driver direkomendasikan untuk deployment serverless), dan rekomendasi kapan
   pakai yang mana.

---

## ❓ HAL YANG MASIH PERLU DIKLARIFIKASI SEBELUM AI MULAI MENGERJAKAN

Beberapa keputusan di bawah ini saya buatkan asumsi default (supaya AI tetap bisa
mulai kerja tanpa terhenti), tapi sebaiknya kamu konfirmasi/ubah dulu sebelum
benar-benar generate code, karena akan mengubah cukup banyak bagian:

1. **Apakah butuh autentikasi/multi-user?**
   Saat ini prompt mengasumsikan single-user/tanpa login (semua link bisa dilihat
   semua orang yang akses dashboard). Kalau ini dipakai banyak orang/publik,
   sebaiknya tambahkan auth (misal NextAuth + login email/password atau OAuth)
   supaya tiap user hanya lihat link miliknya sendiri.

2. **Deployment target final-nya apa?**
   Ini penting banget karena menentukan driver storage default kamu di production.
   - Kalau target-nya Vercel/serverless → MySQL wajib dipakai di production
     (JSON akan reset/hilang tiap deploy)
   - Kalau target-nya VPS (DigitalOcean, dst) dengan Node.js process yang persist
     → JSON file masih aman dipakai
   Saya asumsikan kamu mau dukung dua-duanya dan biarkan kamu pilih saat deploy.

3. **MySQL versi/provider mana?**
   Lokal pakai MySQL biasa, atau mau langsung diarahkan ke provider managed
   (PlanetScale, Railway, AWS RDS)? Ini mempengaruhi apakah perlu SSL config
   khusus di connection string.

4. **Custom domain untuk short link?**
   Apakah short URL akan pakai domain sendiri (misal `link.kamu.com/abc123`) atau
   cukup domain default tempat deploy? Saya sudah masukkan `NEXT_PUBLIC_BASE_URL`
   sebagai env supaya fleksibel, tapi perlu dipastikan domain-nya sudah siap kalau
   mau custom.

5. **Apakah perlu QR code generator untuk tiap short link?**
   Fitur umum di url shortener profesional (Bitly, dll). Belum saya masukkan ke
   prompt, tambahkan kalau perlu.

6. **Retention/cleanup link expired?**
   Saat ini link yang expired hanya "ditandai tidak aktif" saat diakses, tapi
   tidak dihapus otomatis. Apakah perlu cron job untuk hapus permanen link yang
   sudah expired lebih dari X hari?

7. **Apakah perlu password-protect untuk link tertentu?**
   Misal sebelum redirect, user harus masukkan password dulu. Ini fitur tambahan
   yang umum di tool profesional tapi menambah kompleksitas cukup signifikan.

Kalau kamu tidak mengubah apa-apa, AI akan jalan dengan asumsi: tanpa auth,
mendukung dua mode deployment, MySQL lokal standar tanpa SSL, base URL fleksibel
lewat env, tanpa QR code, tanpa auto-cleanup, tanpa password-protect link.
```
