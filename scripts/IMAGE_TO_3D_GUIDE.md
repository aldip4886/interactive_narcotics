# Panduan Image-to-3D Model Generator (.GLB)

Script Python [`scripts/image_to_3d.py`](image_to_3d.py) menggunakan AI open-source untuk mengubah foto/gambar 2D menjadi model 3D berformat **`.glb`** yang siap pakai pada modul Three.js / SCORM.

---

## 🚀 Fitur Utama
1. **Multi-Backend AI**:
   - **TripoSR** (`stabilityai/TripoSR`) — Sangat cepat (15-20 detik), stabil, langsung output `.glb`.
   - **Unique3D** (`Wuvin/Unique3D`) — Rekonstruksi multi-view detail tinggi dari Tsinghua University.
   - **TRELLIS** (`trellis-community/TRELLIS`) — SOTA 3D Structured Latent dari Microsoft.
   - **Auto-Fallback** — Otomatis mencoba backend berikutnya jika salah satu server antre/sibuk.
2. **Post-Processing Otomatis (Trimesh)**:
   - Menghapus background gambar secara otomatis.
   - Meratakan tapak kaki tepat di lantai (`y = 0.0`).
   - Meluruskan posisi tengah (Center X & Z).
   - Menyesuaikan tinggi model secara proporsional ke skala nyata (default `1.82 meter`).
   - Memperbaiki arah normal vertex (*normal fixing*).

---

## 📋 Cara Penggunaan

### 1. Perintah Dasar
Ubah gambar 2D menjadi `.glb`:
```powershell
python scripts/image_to_3d.py -i path/ke/foto_manusia.png -o src/assets/models/human_body_male.glb
```

### 2. Memilih Backend Spesifik
```powershell
# Menggunakan TripoSR (Cepat & Stabil)
python scripts/image_to_3d.py -i foto.jpg -o model.glb -b triposr --resolution 256

# Menggunakan Unique3D (Detail Multi-view)
python scripts/image_to_3d.py -i foto.jpg -o model.glb -b unique3d

# Menggunakan TRELLIS (Microsoft SOTA)
python scripts/image_to_3d.py -i foto.jpg -o model.glb -b trellis
```

### 3. Opsi Tambahan
- `--target-height 1.82` : Mengatur tinggi model dalam meter (sesuai skala hotspot).
- `--resolution 256` : Resolusi voxel/marching cubes (128, 256, atau 320).
- `--no-remove-bg` : Matikan auto-remove background jika gambar sudah transparan PNG.
- `--no-ground-align` : Jangan ratakan ke lantai `y = 0`.
- `--hf-token <TOKEN>` : Token Hugging Face opsional untuk prioritas antrean.

---

## 🔄 Integrasi Langsung ke Modul Pembelajaran
Setelah model `.glb` dibuat ke `src/assets/models/human_body_male.glb`:
```powershell
# 1. Build ulang SCORM package
npm run package-scorm

# 2. Buka dev server untuk preview
npm run dev
```
