# Snub Keymap

Editor keymap ZMK untuk **Chocofi** (split 3×5+3 / 3×6+3), mirip
[keymap-editor](https://nickcoutsos.github.io/keymap-editor/). Dibuat dengan SvelteKit + Bun.
Build firmware berjalan di Docker, jadi **tidak butuh internet** setelah image dibuat.

```
docker compose up -d        # buka http://localhost:3737
```

## Arsitektur

| Service | Isi | Port |
|---|---|---|
| `web` | SvelteKit (adapter-node) dijalankan dengan Bun, plus git untuk commit | `3737` (`WEB_PORT`) |
| `zmk` | `zmkfirmware/zmk-build-arm:3.5` (Zephyr SDK 0.16.3) + workspace west **ZMK v0.3.0 + zmk-nice-oled** yang di-bake saat `docker build`, plus builder HTTP (Bun) | `127.0.0.1:18080` (`BUILDER_PORT`, hanya untuk dev) |

| Path | Fungsi |
|---|---|
| `config/`, `build.yaml` | Config ZMK, layout standar user-config (dulu repo `chocofi-snub`, digabung beserta riwayatnya). Sumber yang diedit dan di-build |
| `docs/` | Dokumentasi keyboard (`docs/keyboard.md`) dan gambar layout |
| `firmware/` | Hasil `.uf2` dan `builds.json` (riwayat build) |
| volume `build-cache` | Cache build inkremental (build kedua dan seterusnya lebih cepat) |

Kedua container berjalan sebagai uid 1000, jadi file yang ditulis tetap milik user Anda.

## Fitur

**Tampilan keyboard**
- Layout fisik resmi ZMK `foostan_corne` 6 kolom (**42**) dan 5 kolom (**36**), termasuk stagger dan rotasi thumb. Bisa beralih tampilan, atau **konversi file** 42↔36. Konversi memetakan ulang posisi combo dan `hold-trigger-key-positions`, serta menambah atau menghapus `chosen zmk,physical-layout`.
- Label tap/hold terpisah, warna per jenis behavior, garis warna layer tujuan, label efektif untuk `&trans` (diambil dari layer di bawahnya), arsiran untuk `&none`.
- Tooltip: binding mentah, deskripsi, sisi/baris/jari, binding posisi itu di semua layer, combo yang memakainya.
- Overlay combo (garis dan label), pencarian keycode di semua layer, nomor posisi, ringkasan mini semua layer, tema gelap dan terang.

**Editing**
- Binding picker: semua behavior bawaan v0.3 (`&kp &mt &lt &mo &to &tog &sl &sk &kt &caps_word &key_repeat &gresc &bt &out &ext_power &rgb_ug &bl &mkp &mmv &msc &bootloader &sys_reset &soft_off &studio_unlock`), behavior dan macro custom, pencarian keycode, toggle modifier `LS()/LC()/…`, dan tangkap tombol dari keyboard fisik.
- Layer: tambah, duplikat, hapus, urutkan dengan drag (semua referensi index ikut diperbarui), display-name untuk OLED, conditional layer (tri-layer).
- Combo: pilih posisi dengan klik di keyboard, timeout, require-prior-idle, layer, slow-release.
- Macro: langkah bisa di-drag, kontrol tap/press/release/wait/param, macro 0/1/2 parameter, "ketik teks → langkah".
- Behavior: template home row mod (positional hold-tap), layer-tap custom, tap dance, mod-morph, sticky key, serta override `&mt`, `&lt`, `&sk`, `&mmv`, `&msc`, `&soft_off`, dll.
- `.conf`: form berisi opsi ZMK dan **zmk-nice-oled** lengkap dengan deskripsi, plus mode raw.
- Drag tombol untuk menukar (Alt = salin), undo/redo, salin/tempel binding.

**Keamanan perubahan**
- Parser/printer devicetree mempertahankan komentar, `#include`, dan properti yang tidak dikenal. Round-trip `corne.keymap` byte-identik.
- Validasi langsung di browser: behavior tidak terdefinisi, jumlah parameter, layer di luar jangkauan atau tidak terjangkau, `BT_SEL` melebihi `BT_MAX_PAIRED`, `&mkp/&mmv/&msc` tanpa `CONFIG_ZMK_POINTING`, konflik widget nice_oled, batas combo, display-name lebih dari 4 huruf, dan lainnya.
- Diff source terhadap file di disk. Saat menyimpan, editor menolak jika file berubah di disk sejak dimuat.

**Build**
- Target dibaca dari `build.yaml`. Bisa build semua atau per target, ada opsi pristine, log real-time (SSE), dan tombol unduh `.uf2`, plus panduan flashing.
- Commit git dari UI (hanya `config/` dan `build.yaml`). Push dilakukan dari host: `git push`.
- GitHub Actions (`.github/workflows/build.yml`) tetap membangun firmware di GitHub, hanya saat `config/` atau `build.yaml` berubah. Hasilnya ada di tab Actions → artifact `firmware`.

## Shortcut

| Tombol | Aksi |
|---|---|
| `Ctrl+S` | Simpan |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |
| `Del` | Set tombol terpilih ke `&trans` |
| `Ctrl+C` / `Ctrl+V` | Salin / tempel binding |
| Panah | Pindah tombol terpilih |
| `Alt+0..9` | Pindah layer |
| `Ctrl+klik` tombol layer | Buka layer tujuan |
| `Esc` | Batal pilih |

## Catatan

- Satu repo berisi aplikasi dan config. Clone, lalu `docker compose up -d`. Pertama kali butuh internet untuk build image.

- **Menambah modul west** (mengubah `config/west.yml`) butuh internet sekali: `docker compose build zmk`. UI akan memperingatkan jika `west.yml` berbeda dari yang di-bake.
- Identitas commit dari UI bisa diatur di `.env`: `GIT_AUTHOR_NAME=...`, `GIT_AUTHOR_EMAIL=...`.
- Pengembangan tanpa Docker untuk web:
  ```
  docker compose up -d zmk
  cd web && ZMK_CONFIG_DIR=.. FIRMWARE_DIR=../firmware BUILDER_URL=http://localhost:18080 bun run dev
  ```
- Link "docs ↗" di binding editor mengarah ke zmk.dev dan butuh internet. Fitur lainnya berjalan offline.
