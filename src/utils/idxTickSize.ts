/**
 * IDX (Bursa Efek Indonesia) Price Fraction & Tick Size Engine
 * Berdasarkan Surat Keputusan Direksi PT Bursa Efek Indonesia No. Kep-00023/BEI/04-2016
 * 
 * Kelompok Harga:
 * 1. < Rp 200          => Fraksi Rp 1
 * 2. Rp 200 - < Rp 500  => Fraksi Rp 2
 * 3. Rp 500 - < Rp 2.000 => Fraksi Rp 5
 * 4. Rp 2.000 - < Rp 5.000 => Fraksi Rp 10
 * 5. >= Rp 5.000       => Fraksi Rp 25
 */

/**
 * Mendapatkan ukuran fraksi harga (tick size) resmi BEI untuk harga tertentu
 */
export const getIdxTickSize = (price: number): number => {
  if (price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2000) return 5;
  if (price < 5000) return 10;
  return 25;
};

/**
 * Membulatkan harga sembarang ke Fraksi Resmi BEI terdekat
 * @param price Harga acuan
 * @param mode 'round' (terdekat), 'floor' (ke bawah), 'ceil' (ke atas)
 */
export const roundToIdxTick = (
  price: number,
  mode: 'round' | 'floor' | 'ceil' = 'round'
): number => {
  if (price <= 1) return 1;

  // Dapatkan tick size awal
  const tick = getIdxTickSize(price);

  let result: number;
  if (mode === 'floor') {
    result = Math.floor(price / tick) * tick;
  } else if (mode === 'ceil') {
    result = Math.ceil(price / tick) * tick;
  } else {
    result = Math.round(price / tick) * tick;
  }

  // Jika hasil pembulatan menyeberang batas kelompok harga, sesuaikan ulang dengan fraksi barunya
  const newTick = getIdxTickSize(result);
  if (newTick !== tick) {
    if (mode === 'floor') {
      result = Math.floor(result / newTick) * newTick;
    } else if (mode === 'ceil') {
      result = Math.ceil(result / newTick) * newTick;
    } else {
      result = Math.round(result / newTick) * newTick;
    }
  }

  return Math.max(1, result);
};

/**
 * Menggeser harga sebanyak N tick (bisa positif untuk naik atau negatif untuk turun)
 * Aman melintasi batas kelompok fraksi harga BEI.
 */
export const stepIdxTicks = (price: number, ticks: number): number => {
  let currentPrice = roundToIdxTick(price);
  const direction = ticks >= 0 ? 1 : -1;
  const count = Math.abs(ticks);

  for (let i = 0; i < count; i++) {
    if (direction > 0) {
      const tick = getIdxTickSize(currentPrice);
      currentPrice += tick;
    } else {
      // Saat turun, jika pas di perbatasan bawah kelompok (misal 200, 500, 2000, 5000),
      // fraksi di bawahnya menggunakan fraksi kelompok yang lebih rendah
      const tickBelow = getIdxTickSize(currentPrice - 0.5);
      currentPrice -= tickBelow;
      if (currentPrice <= 1) {
        currentPrice = 1;
        break;
      }
    }
  }

  return Math.max(1, currentPrice);
};

export interface IdxTradingPlan {
  entryPrice: number;
  buyAreaLow: number;
  buyAreaHigh: number;
  buyAreaFormatted: string;
  targetPrice1: number;
  targetPct1Actual: number;
  targetPrice2: number;
  targetPct2Actual: number;
  stopLoss: number;
  stopLossPctActual: number;
  riskAmount: number;
  rewardAmount: number;
  riskRewardRatio: string;
  tickSize: number;
}

/**
 * Menghitung Trading Plan (Area Beli, TP1, TP2, Stop Loss) 
 * yang 100% patuh pada Fraksi Resmi BEI sehingga tidak akan ditolak oleh sistem broker.
 */
export const calculateIdxTradingPlan = (
  price: number,
  targetPct1 = 0.05,  // Default +5%
  targetPct2 = 0.10,  // Default +10%
  stopLossPct = 0.035 // Default -3.5%
): IdxTradingPlan => {
  const safePrice = Math.max(1, roundToIdxTick(price));
  const tickSize = getIdxTickSize(safePrice);

  // 1. Area Beli (Entry Area): Sekitar 2-3 tick di bawah harga sampai 1 tick di atas harga
  const buyAreaLow = stepIdxTicks(safePrice, -2);
  const buyAreaHigh = stepIdxTicks(safePrice, 1);
  const buyAreaFormatted = `Rp ${buyAreaLow.toLocaleString('id-ID')} - ${buyAreaHigh.toLocaleString('id-ID')}`;

  // 2. Target Price 1 (+5% dibulatkan ke fraksi yang sah)
  // Untuk target jual, floor lebih aman agar antrian limit pasti tersentuh
  const rawTp1 = safePrice * (1 + targetPct1);
  const targetPrice1 = roundToIdxTick(rawTp1, 'floor');
  const targetPct1Actual = Number((((targetPrice1 - safePrice) / safePrice) * 100).toFixed(2));

  // 3. Target Price 2 (+10% / Potensi ARA dibulatkan ke fraksi sah)
  const rawTp2 = safePrice * (1 + targetPct2);
  const targetPrice2 = roundToIdxTick(rawTp2, 'floor');
  const targetPct2Actual = Number((((targetPrice2 - safePrice) / safePrice) * 100).toFixed(2));

  // 4. Stop Loss (-3.5% dibulatkan ke fraksi yang sah)
  // Untuk stop loss, floor agar membatasi kerugian sebelum amblas lebih dalam
  const rawSl = safePrice * (1 - stopLossPct);
  const stopLoss = roundToIdxTick(rawSl, 'floor');
  const stopLossPctActual = Number((((safePrice - stopLoss) / safePrice) * 100).toFixed(2));

  // 5. Risk-Reward Ratio Riil
  const riskAmount = safePrice - stopLoss;
  const rewardAmount = targetPrice1 - safePrice;
  const rrVal = riskAmount > 0 ? (rewardAmount / riskAmount).toFixed(1) : '2.0';
  const riskRewardRatio = `1 : ${rrVal}`;

  return {
    entryPrice: safePrice,
    buyAreaLow,
    buyAreaHigh,
    buyAreaFormatted,
    targetPrice1,
    targetPct1Actual,
    targetPrice2,
    targetPct2Actual,
    stopLoss,
    stopLossPctActual,
    riskAmount,
    rewardAmount,
    riskRewardRatio,
    tickSize,
  };
};
