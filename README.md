# 📈 Stock Master — IHSG Market Screener & AI Predictive Analytics

Aplikasi analisa dan screener saham Bursa Efek Indonesia (IHSG) modern berbasis **React Native Web**, **Express.js**, dan kecerdasan buatan **Google Gemini AI**.

---

## 🌟 Fitur Utama

### 1. 🔍 8 Scanner Saham Berbasis Algoritma Presisi
- **High Bid/Offer**: Mendeteksi antrian beli jauh lebih tebal dari antrian jual (akumulasi/penampungan).
- **High ATS (Average Trade Size)**: Transaksi per eksekusi berukuran masif (pemain besar/bandar, bukan ritel).
- **No Sell**: Tekanan jual nyaris nol pada periode observasi.
- **Close High**: Saham ditutup di harga tertinggi harian (tanda kekuatan dorongan beli).
- **High Non-Regular**: Banyak transaksi negosiasi/crossing di luar pasar reguler.
- **Top Volume / Freq**: Paling ramai dan likuid dari frekuensi maupun volume transaksi.
- **Foreign +**: Akumulasi net buy investor asing harian dan historis.
- **Offer's Slender**: Antrian penawaran jual menipis drastis (sedikit yang mau melepas barang).

### 2. ⭐ Rekomendasi Saham Besok
Tab cerdas yang meranking saham-saham IHSG dengan probabilitas momentum tertinggi hasil analisa multi-faktor komprehensif.

### 3. 🤖 Analisa Lanjutan AI (Google Gemini 3.6 Flash)
- **Sentimen Berita Pasar**: Scraping media finansial Indonesia terkini (Kontan, Bisnis, CNBC, Bloomberg Technoz) & kalkulasi skor sentimen.
- **Skor AI & Gauge Prediksi**: Skor 0–100, probabilitas kenaikan vs penurunan %, dan rekomendasi aksi (*Strong Buy, Buy on Weakness, Hold, Sell*).
- **Fundamental Ratios**: Evaluasi PER, PBV, ROE, ROA, DER, dan EPS lengkap dengan interpretasi kesehatan emiten.
- **TradingView Chart**: Widget interaktif candlestick `IDX:{TICKER}` lengkap dengan indikator MA, RSI, support/resistance, dan panduan entri.
- **Pola Musiman 5 Tahun**: Matriks 12 bulan historis (*Win Rate* bulanan & rata-rata return %) untuk mendeteksi siklus musiman dan *window dressing*.

### 4. 🇮🇩 Seluruh Emiten IHSG
Mencakup seluruh 900+ emiten yang tercatat di Bursa Efek Indonesia, termasuk saham papan pemantauan khusus dengan harga minimum Rp 1.

---

## 🚀 Menjalankan Secara Lokal

1. **Instalasi Dependensi**:
   ```bash
   npm install
   ```

2. **Jalankan Server Fullstack (Web & API)**:
   ```bash
   npm start
   ```
   Akses website di: `http://localhost:3000`

3. **Jalankan Mode Pengembangan Mobile (Expo)**:
   ```bash
   npm run dev
   ```

---

## ☁️ Deployment ke Cloud Hosting (Render / Railway)

Aplikasi ini siap di-deploy langsung ke **Render.com** atau **Railway.app**:

1. Sambungkan repository ini di dashboard hosting.
2. Tambahkan Environment Variable:
   - `GEMINI_API_KEY`: *(API Key Google Gemini Anda)*
3. Konfigurasi build & start:
   - **Build Command**: `npm install && npx expo export -p web`
   - **Start Command**: `node proxy.js`
4. Website akan langsung aktif dengan HTTPS otomatis.
