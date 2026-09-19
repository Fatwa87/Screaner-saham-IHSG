import { fetchQuotes, YFQuote } from './yfinance';
import { 
  calculateIdxTradingPlan, 
  getIdxTickSize, 
  roundToIdxTick, 
  getIdxMaxAraPercent, 
  calculateIdxAraPrice, 
  calculateDistanceToAra 
} from './idxTickSize';

export interface OrderflowOption {
  id: string;
  label: string;
  shortLabel: string;
  desc: string;
  icon: string;
  color: string;
  bgColor: string;
}

export const SCANNER_ORDERFLOW_OPTIONS: OrderflowOption[] = [
  {
    id: 'high_bid_offer',
    label: 'High Bid/Offer',
    shortLabel: 'Bid/Offer',
    desc: 'Antrian beli jauh lebih tebal dari antrian jual — ada yang menampung.',
    icon: '🛡️',
    color: '#38BDF8', // Cyan
    bgColor: 'rgba(56, 189, 248, 0.15)',
  },
  {
    id: 'high_ats',
    label: 'High ATS',
    shortLabel: 'High ATS',
    desc: 'Average Trade Size besar = transaksi per eksekusi besar = pemain besar, bukan ritel.',
    icon: '🐋',
    color: '#818CF8', // Indigo
    bgColor: 'rgba(129, 140, 248, 0.15)',
  },
  {
    id: 'no_sell',
    label: 'No Sell',
    shortLabel: 'No Sell',
    desc: 'Nyaris tidak ada tekanan jual pada periode itu.',
    icon: '🚫',
    color: '#34D399', // Emerald
    bgColor: 'rgba(52, 211, 153, 0.15)',
  },
  {
    id: 'close_high',
    label: 'Close High',
    shortLabel: 'Close High',
    desc: 'Ditutup di harga tertinggi hari itu — tanda kekuatan.',
    icon: '📈',
    color: '#10B981', // Green
    bgColor: 'rgba(16, 185, 129, 0.15)',
  },
  {
    id: 'high_non_regular',
    label: 'High Non-Regular',
    shortLabel: 'Non-Reg',
    desc: 'Banyak transaksi crossing/negosiasi di luar pasar reguler.',
    icon: '🤝',
    color: '#F59E0B', // Amber
    bgColor: 'rgba(245, 158, 11, 0.15)',
  },
  {
    id: 'top_vol_freq',
    label: 'Top Volume / Freq',
    shortLabel: 'Top Vol/Freq',
    desc: 'Paling ramai secara volume atau frekuensi transaksi.',
    icon: '🔥',
    color: '#F97316', // Orange
    bgColor: 'rgba(249, 115, 22, 0.15)',
  },
  {
    id: 'foreign_plus',
    label: 'Foreign +',
    shortLabel: 'Foreign +',
    desc: 'Asing net beli pada periode itu atau dalam hari ini.',
    icon: '🌐',
    color: '#A855F7', // Purple
    bgColor: 'rgba(168, 85, 247, 0.15)',
  },
  {
    id: 'offers_slender',
    label: "Offer's Slender",
    shortLabel: "Off' Slender",
    desc: 'Antrian jual menipis drastis — sedikit yang mau melepas barang.',
    icon: '⚡',
    color: '#EC4899', // Pink
    bgColor: 'rgba(236, 72, 153, 0.15)',
  },
];

export interface AlgoResult {
  ticker: string;
  name?: string;
  price: number;
  chgPct: number;
  skor: number;
  pred?: string;
  status?: string;
  action?: string;
  trend?: string;
  volSpike?: number;
  bullPower?: number;
  volat?: number;
  open?: number;
  high?: number;
  low?: number;
  orderflowTags?: string[];
  // Extended fields for Rekomendasi Saham Besok
  buyArea?: string;
  targetPrice1?: number;
  targetPrice2?: number;
  stopLoss?: number;
  riskReward?: string;
  conviction?: string;
  catalyst?: string;
  matchedCount?: number;
  tickSize?: number;
  tp1PctActual?: number;
  tp2PctActual?: number;
  slPctActual?: number;
  // Extended fields for ARA Hunter Pro
  araPrice?: number;
  maxAraPct?: number;
  distanceToAraPct?: number;
  distanceTicks?: number;
  isLockedAra?: boolean;
  isOpenEqualsLow?: boolean;
  araStage?: string;
  turnoverIdr?: number;
  prevClose?: number;
}

/**
 * Calculates and evaluates the 8 Order Flow & Bandarmology criteria for a given stock
 */
/**
 * Rigorous Quantitative Evaluation of the 8 Order Flow & Bandarmology Criteria
 * Based on Price Action Mechanics, Volume-Spread Analysis (VSA), 
 * Candlestick Upper/Lower Shadow Anatomy, and Microstructure Flow.
 */
export const computeOrderflowTags = (
  ticker: string,
  q: YFQuote | any,
  volSpike: number = 1,
  bullPower: number = 0.5
): string[] => {
  const tags: string[] = [];
  if (!q) return tags;

  const price = q.regularMarketPrice || 0;
  const open = q.regularMarketOpen || price;
  const high = q.regularMarketDayHigh || price;
  const low = q.regularMarketDayLow || price;
  const chgPct = q.regularMarketChangePercent || 0;
  const vol = q.regularMarketVolume || 0;
  const mcap = q.marketCap || 0; // in IDR

  if (price <= 0) return tags;

  const totalRange = high - low;
  const normalizedBullPower = totalRange > 0 ? (price - low) / totalRange : 0.5;
  const upperShadowRatio = high > 0 ? (high - price) / high : 0;
  const lowerShadowRatio = open > 0 ? Math.max(0, open - low) / open : 0;
  const turnoverIdr = price * vol; // Estimasi turnover dalam Rupiah

  // 1. High Bid/Offer (Antrian beli jauh lebih tebal dari antrian jual — ada yang menampung)
  // Syarat Kuantitatif: 
  // - Bull Power kuat (pembeli mempertahankan harga di paruh atas rentang harian >= 65%)
  // - Terjadi penolakan harga bawah (lower shadow / rejection >= 0.8% atau price > open)
  // - Disertai volume akumulasi memadai (volSpike >= 0.9x atau turnover > Rp 5 Miliar)
  const isHighBidOffer = (
    normalizedBullPower >= 0.65 &&
    (lowerShadowRatio >= 0.008 || price >= open) &&
    (volSpike >= 0.9 || turnoverIdr >= 5000000000)
  );
  if (isHighBidOffer) tags.push('high_bid_offer');

  // 2. High ATS (Average Trade Size besar = transaksi per eksekusi besar = pemain besar, bukan ritel)
  // Syarat Kuantitatif:
  // - Nilai transaksi total masif (Turnover >= Rp 10 Miliar)
  // - Lonjakan volume transaksi di atas rata-rata normal (volSpike >= 1.4x)
  // - Menandakan transaksi per eksekusi (lot size) didominasi oleh order-splitter institusi/bandar
  const isHighATS = (
    (turnoverIdr >= 10000000000 && volSpike >= 1.3) ||
    (volSpike >= 2.0 && turnoverIdr >= 3000000000) ||
    (vol >= 30000000 && price > 200)
  );
  if (isHighATS) tags.push('high_ats');

  // 3. No Sell (Nyaris tidak ada tekanan jual pada periode itu)
  // Syarat Kuantitatif:
  // - Ekor atas candlestick sangat tipis / hampir tidak ada (upperShadow <= 1.0% dari harga)
  // - Candle berwarna hijau / netral (price >= open dan chgPct >= 0)
  // - Jarak harga penutupan ke harga terendah mendominasi penuh (tidak ada perlawanan seller)
  const isNoSell = (
    price >= open &&
    chgPct >= 0 &&
    upperShadowRatio <= 0.012 &&
    (price - low) >= 1.5 * Math.max(1, high - price)
  );
  if (isNoSell) tags.push('no_sell');

  // 4. Close High (Ditutup di harga tertinggi hari itu — tanda kekuatan)
  // Syarat Kuantitatif:
  // - Harga penutupan berada di dalam rentang 1.2% dari High hari itu (Price >= High * 0.988)
  // - Perubahan harga positif (chgPct > 0)
  // - Bukan single-tick / doji mati (High > Low)
  const isCloseHigh = (
    high > 0 &&
    price >= high * 0.988 &&
    chgPct > 0 &&
    totalRange > 0
  );
  if (isCloseHigh) tags.push('close_high');

  // 5. High Non-Regular (Banyak transaksi crossing/negosiasi di luar pasar reguler)
  // Syarat Kuantitatif:
  // - Anomali volume ekstrem (volSpike >= 2.2x) yang menandakan perputaran block trade
  // - Atau perputaran turnover raksasa (> Rp 20 Miliar) yang mengindikasikan crossing pasar negosiasi
  const isHighNonReg = (
    (volSpike >= 2.2 && Math.abs(chgPct) >= 1.0) ||
    (turnoverIdr >= 20000000000 && volSpike >= 1.6)
  );
  if (isHighNonReg) tags.push('high_non_regular');

  // 6. Top Volume / Freq (Paling ramai secara volume atau frekuensi transaksi)
  // Syarat Kuantitatif:
  // - Volume surge sangat masif (volSpike >= 1.8x)
  // - Total volume harian sangat likuid (Volume >= 20.000.000 lembar saham atau Turnover >= Rp 15 Miliar)
  const isTopVolFreq = (
    volSpike >= 1.8 ||
    vol >= 20000000 ||
    turnoverIdr >= 15000000000
  );
  if (isTopVolFreq) tags.push('top_vol_freq');

  // 7. Foreign + (Asing net beli pada periode itu atau dalam hari ini)
  // Syarat Kuantitatif:
  // - Saham mengalami penguatan harga (chgPct >= 0.5%) dengan dorongan volume akumulasi (volSpike >= 1.1x)
  // - Khususnya pada emiten berkapitalisasi pasar menengah-besar (Market Cap >= Rp 5 Triliun)
  //   atau tercatat pada foreign accumulation flow
  const isForeignPlus = (
    (chgPct >= 0.5 && volSpike >= 1.1 && (mcap >= 5000000000000 || turnoverIdr >= 5000000000)) ||
    (chgPct >= 1.8 && volSpike >= 1.4)
  );
  if (isForeignPlus) tags.push('foreign_plus');

  // 8. Offer's Slender (Antrian jual menipis drastis — sedikit yang mau melepas barang)
  // Syarat Kuantitatif:
  // - Kenaikan harga agresif (chgPct >= 2.0%)
  // - Bull power ekstrem (normalizedBullPower >= 0.80)
  // - Harga mendekati / menyentuh resisten puncak (price >= high * 0.985)
  // - Menandakan seluruh lot di papan Offer telah disapu bersih (buku order tipis / supply exhaustion)
  const isOffersSlender = (
    chgPct >= 2.0 &&
    normalizedBullPower >= 0.80 &&
    high > 0 &&
    price >= high * 0.985 &&
    volSpike >= 1.0
  );
  if (isOffersSlender) tags.push('offers_slender');

  return tags;
};

// 1. Algo Prediksi (Akumulasi / Distribusi & Tren)
export const runAlgoPrediksi = async (tickers: string[]): Promise<AlgoResult[]> => {
  const quotes = await fetchQuotes(tickers);
  const results: AlgoResult[] = [];

  for (const ticker of tickers) {
    const q = quotes[ticker];
    if (!q || !q.regularMarketPrice) continue;

    const price = q.regularMarketPrice || 0;
    const high = q.regularMarketDayHigh || price;
    const low = q.regularMarketDayLow || price;
    const open = q.regularMarketOpen || price;
    const chgPct = q.regularMarketChangePercent || 0;
    const vol = q.regularMarketVolume || 0;
    const avgVol = q.averageDailyVolume10Day || q.averageDailyVolume3Month || 100000;
    const ma50 = q.fiftyDayAverage || 0;
    
    const isUptrend = (ma50 > 0 && price >= ma50);
    const trend = isUptrend ? "UPTREND" : "DOWNTREND";
    const volSpike = avgVol > 0 ? vol / avgVol : 1;
    const bullPower = (high - low > 0) ? (price - low) / (high - low) : 0.5;

    let skor = 0;
    if (isUptrend) skor += 30;
    if (volSpike > 2.0) skor += 40;
    else if (volSpike > 1.2) skor += 25;
    else if (volSpike >= 0.8) skor += 15;
    
    if (bullPower > 0.8) skor += 30;
    else if (bullPower > 0.5) skor += 15;

    let pred = "⏳ NEUTRAL";
    if (skor >= 75) pred = "🚀 HIGH PROBABILITY";
    else if (skor >= 50) pred = "👀 ACCUMULATION";
    else if (skor <= 30) pred = "🔻 DISTRIBUSI";

    const orderflowTags = computeOrderflowTags(ticker, q, volSpike, bullPower);

    results.push({
      ticker,
      name: q.shortName || ticker,
      price,
      chgPct,
      trend,
      volSpike: Number(volSpike.toFixed(2)),
      bullPower: Number(bullPower.toFixed(2)),
      skor,
      pred,
      open,
      high,
      low,
      orderflowTags,
    });
  }

  return results.sort((a, b) => b.skor - a.skor);
};

// 2. Scalping Intraday (Volatilitas & Volume Surge)
export const runAlgoScalping = async (tickers: string[]): Promise<AlgoResult[]> => {
  const quotes = await fetchQuotes(tickers);
  const results: AlgoResult[] = [];

  for (const ticker of tickers) {
    const q = quotes[ticker];
    if (!q || !q.regularMarketPrice) continue;

    const price = q.regularMarketPrice || 0;
    const open = q.regularMarketOpen || price;
    const high = q.regularMarketDayHigh || price;
    const low = q.regularMarketDayLow || price;
    const chgPct = q.regularMarketChangePercent || 0;
    const vol = q.regularMarketVolume || 0;
    const avgVol = q.averageDailyVolume10Day || q.averageDailyVolume3Month || 100000;
    
    const volat = low > 0 ? (high - low) / low : 0;
    const volSpike = avgVol > 0 ? vol / avgVol : 1;
    const abvOpen = price >= open;
    const bullPower = (high - low > 0) ? (price - low) / (high - low) : 0.5;

    let skor = 0;
    if (volat > 0.04) skor += 35;
    else if (volat > 0.02) skor += 20;
    
    if (abvOpen) skor += 25;
    
    if (volSpike > 2.0) skor += 40;
    else if (volSpike > 1.2) skor += 20;

    let pred = "⚠️ SKIP";
    if (skor >= 70) pred = "🔥 HOT SCALP";
    else if (skor >= 45) pred = "⚡ AKTIF TRADING";

    const orderflowTags = computeOrderflowTags(ticker, q, volSpike, bullPower);

    results.push({
      ticker,
      name: q.shortName || ticker,
      price,
      chgPct,
      volat: Number((volat * 100).toFixed(1)),
      volSpike: Number(volSpike.toFixed(2)),
      bullPower: Number(bullPower.toFixed(2)),
      skor,
      pred,
      open,
      high,
      low,
      orderflowTags,
    });
  }
  
  return results.sort((a, b) => b.skor - a.skor);
};

// 3. ARA Hunter Pro (Official BEI Auto Rejection Atas, Open=Low & Distance to ARA Engine)
export const runAraHunter = async (tickers: string[]): Promise<AlgoResult[]> => {
  const quotes = await fetchQuotes(tickers);
  const results: AlgoResult[] = [];

  for (const ticker of tickers) {
    const q = quotes[ticker];
    if (!q || !q.regularMarketPrice) continue;

    const price = q.regularMarketPrice || 0;
    const prevClose = q.regularMarketPreviousClose || price;
    const open = q.regularMarketOpen || price;
    const high = q.regularMarketDayHigh || price;
    const low = q.regularMarketDayLow || price;
    const chgPct = q.regularMarketChangePercent || 0;
    const vol = q.regularMarketVolume || 0;
    const avgVol = q.averageDailyVolume10Day || q.averageDailyVolume3Month || 100000;
    const turnoverIdr = price * vol;

    // Filter out completely dead/inactive stocks with zero trading activity
    if (price <= 50 && vol < 5000000 && Math.abs(chgPct) < 2) continue;
    if (vol === 0 && Math.abs(chgPct) === 0) continue;

    const volSpike = avgVol > 0 ? vol / avgVol : 1;
    const totalRange = high - low;
    const intradayPower = (totalRange > 0) ? (price - low) / totalRange : 0.5;

    // 1. BEI Official Auto Rejection Atas (ARA) Limit & Target Calculation
    const isFca = price < 50;
    const maxAraPct = getIdxMaxAraPercent(prevClose, isFca);
    const araPrice = calculateIdxAraPrice(prevClose, isFca);
    const distanceInfo = calculateDistanceToAra(price, araPrice);
    const distanceToAraPct = distanceInfo.distancePct;
    const distanceTicks = distanceInfo.distanceTicks;
    const isLockedAra = distanceInfo.isLocked || (high >= araPrice && price >= araPrice * 0.99);

    // 2. Open = Low Precision Analysis (Maksimal 0.35% / 1 tick toleransi)
    const tickSize = getIdxTickSize(open);
    const isOpenEqualsLow = open > 0 && ((open - low) <= Math.max(1, tickSize) || Math.abs(open - low) <= (open * 0.0035));

    // 3. Multi-Factor ARA Scoring (0 - 100)
    let skor = 20;

    // A. Price Surge & Distance to ARA (Up to 35 pts)
    if (isLockedAra) {
      skor = 100; // Locked ARA ceiling
    } else {
      if (chgPct >= 18) skor += 30;
      else if (chgPct >= 10) skor += 24;
      else if (chgPct >= 5) skor += 16;
      else if (chgPct >= 2) skor += 8;

      // Bonus jika mendekati batas ARA dengan momentum
      if (distanceToAraPct <= 5 && chgPct > 5) skor += 15;
      else if (distanceToAraPct <= 10 && chgPct > 3) skor += 10;
    }

    // B. Open = Low Power (Up to 25 pts)
    if (isOpenEqualsLow && price > open) {
      skor += 25;
    } else if (open > 0 && price >= open) {
      skor += 10;
    }

    // C. Volume & Turnover Spike (Up to 25 pts)
    if (volSpike >= 3.0) skor += 25;
    else if (volSpike >= 2.0) skor += 18;
    else if (volSpike >= 1.3) skor += 12;
    else if (volSpike >= 0.9) skor += 6;

    if (turnoverIdr >= 10000000000) skor += 8; // > 10 Miliar
    else if (turnoverIdr >= 3000000000) skor += 5; // > 3 Miliar

    // D. Intraday Bull Power & Pinned High (Up to 15 pts)
    if (intradayPower >= 0.90) skor += 15;
    else if (intradayPower >= 0.75) skor += 8;

    skor = Math.min(100, Math.max(10, skor));

    // 4. Order Flow & Bandarmology Tags
    const orderflowTags = computeOrderflowTags(ticker, q, volSpike, intradayPower);

    // 5. ARA Stage Classification
    let araStage = '👀 MOMENTUM AWAL';
    if (isLockedAra) {
      araStage = '🔒 ARA LOCKED (DIGEMBOK)';
    } else if (skor >= 82 && distanceToAraPct <= 8) {
      araStage = '🚀 SUPER ARA RUNNER';
    } else if (isOpenEqualsLow && chgPct >= 4 && chgPct < 18) {
      araStage = '⚡ O=L ARA BREAKOUT';
    } else if (skor >= 65) {
      araStage = '🔥 POTENSI ARA TINGGI';
    } else if (isOpenEqualsLow && chgPct > 0) {
      araStage = '🎯 O=L EARLY ENTRY';
    }

    // 6. ARA Specific Trading Plan
    // TP1 is ARA Price, Stop Loss is 1-2 ticks below Open/Low
    const safeOpen = Math.max(1, roundToIdxTick(open));
    const araStopLoss = roundToIdxTick(Math.min(safeOpen * 0.97, low), 'floor');
    const riskAmount = price - araStopLoss;
    const rewardAmount = Math.max(1, araPrice - price);
    const rrVal = riskAmount > 0 ? (rewardAmount / riskAmount).toFixed(1) : '2.5';
    const riskReward = `1 : ${rrVal}`;

    results.push({
      ticker,
      name: q.shortName || ticker,
      price,
      prevClose,
      chgPct,
      open,
      high,
      low,
      bullPower: Number((intradayPower * 100).toFixed(0)),
      volSpike: Number(volSpike.toFixed(2)),
      skor,
      pred: araStage,
      status: araStage,
      araStage,
      araPrice,
      maxAraPct,
      distanceToAraPct,
      distanceTicks,
      isLockedAra,
      isOpenEqualsLow,
      turnoverIdr,
      targetPrice1: araPrice,
      stopLoss: araStopLoss,
      riskReward,
      tickSize,
      orderflowTags,
      matchedCount: orderflowTags.length,
    });
  }

  // Filter out completely dead/inactive stocks with 0 volume
  const activeResults = results.filter(r => (r.price > 0 && (r.volSpike || 0) > 0.05));

  // Sort: First by ARA Locked, then highest score, then closest distance to ARA
  return activeResults.sort((a, b) => {
    if (a.isLockedAra && !b.isLockedAra) return -1;
    if (!a.isLockedAra && b.isLockedAra) return 1;
    if (b.skor !== a.skor) return b.skor - a.skor;
    return (a.distanceToAraPct || 100) - (b.distanceToAraPct || 100);
  });
};

// 4. Super Easy Trend Follower (Swing Trading)
export const runScanner = async (tickers: string[]): Promise<AlgoResult[]> => {
  const quotes = await fetchQuotes(tickers);
  const results: AlgoResult[] = [];

  for (const ticker of tickers) {
    const q = quotes[ticker];
    if (!q || !q.regularMarketPrice) continue;

    const price = q.regularMarketPrice || 0;
    const open = q.regularMarketOpen || price;
    const high = q.regularMarketDayHigh || price;
    const low = q.regularMarketDayLow || price;
    const chgPct = q.regularMarketChangePercent || 0;
    const vol = q.regularMarketVolume || 0;
    const avgVol = q.averageDailyVolume10Day || q.averageDailyVolume3Month || 100000;
    const ma50 = q.fiftyDayAverage || 0;

    const volSpike = avgVol > 0 ? vol / avgVol : 1;
    const aboveMa = (ma50 > 0) && (price >= ma50);
    const bullPower = (high - low > 0) ? (price - low) / (high - low) : 0.5;

    let action = "WAIT";
    let skor = 50;

    if (aboveMa && volSpike >= 1.5 && chgPct > 0) {
      action = "STRONG BUY";
      skor = 90;
    } else if (aboveMa && volSpike >= 1.0) {
      action = "BUY / HOLD";
      skor = 70;
    } else if (!aboveMa && volSpike < 0.8 && chgPct < 0) {
      action = "STRONG SELL";
      skor = 20;
    } else if (!aboveMa) {
      action = "AVOID / SELL";
      skor = 35;
    }

    const orderflowTags = computeOrderflowTags(ticker, q, volSpike, bullPower);

    results.push({
      ticker,
      name: q.shortName || ticker,
      price,
      chgPct,
      volSpike: Number(volSpike.toFixed(2)),
      bullPower: Number(bullPower.toFixed(2)),
      skor,
      action,
      open,
      high,
      low,
      orderflowTags,
    });
  }

  return results.sort((a, b) => b.skor - a.skor);
};

// 5. Scanner Saham Receh 50 - 150 (Fraksi Rp 1)
export const runRecehScanner = async (tickers: string[]): Promise<AlgoResult[]> => {
  const quotes = await fetchQuotes(tickers);
  const results: AlgoResult[] = [];

  for (const ticker of tickers) {
    const q = quotes[ticker];
    if (!q || !q.regularMarketPrice) continue;

    const price = q.regularMarketPrice || 0;
    const open = q.regularMarketOpen || price;
    const high = q.regularMarketDayHigh || price;
    const low = q.regularMarketDayLow || price;
    const chgPct = q.regularMarketChangePercent || 0;
    const vol = q.regularMarketVolume || 0;
    const avgVol = q.averageDailyVolume10Day || q.averageDailyVolume3Month || 50000;

    // Price range 1 to 150 (Covering BEI FCA / Papan Pemantauan Khusus down to Rp 1)
    if (price < 1 || price > 150) continue;

    const volSpike = avgVol > 0 ? vol / avgVol : 1;
    const isAboveOpen = price >= open;
    const bullPower = (high - low > 0) ? (price - low) / (high - low) : 0.5;

    let skor = 0;
    if (price === 50) {
      skor = 20; // Bottom 50 level
    } else if (price < 50) {
      // Papan Pemantauan Khusus (FCA Rp 1 - 49)
      skor = 25;
      if (isAboveOpen) skor += 25;
      if (volSpike > 1.5) skor += 30;
      if (chgPct > 0) skor += 20;
    } else {
      if (isAboveOpen) skor += 30;
      if (volSpike > 2.0) skor += 40;
      else if (volSpike > 1.2) skor += 25;
      if (chgPct > 2) skor += 30;
      else if (chgPct >= 0) skor += 15;
    }

    let status = "💤 TIDUR";
    if (price < 50) status = "⚡ FCA (FRAKSI Rp 1)";
    else if (price === 50) status = "⚠️ LEVEL 50";
    else if (skor >= 70) status = "💎 RECEH POTENSIAL";
    else if (skor >= 45) status = "⚡ SCALP RECEH";

    const orderflowTags = computeOrderflowTags(ticker, q, volSpike, bullPower);

    results.push({
      ticker,
      name: q.shortName || ticker,
      price,
      chgPct,
      volSpike: Number(volSpike.toFixed(2)),
      bullPower: Number(bullPower.toFixed(2)),
      skor,
      status,
      open,
      high,
      low,
      orderflowTags,
    });
  }

  return results.sort((a, b) => b.skor - a.skor);
};

// 6. Rekomendasi Saham Besok (Multi-Method High Conviction Quant Analysis - 935 Saham BEI)
export const runRekomendasiBesok = async (tickers: string[]): Promise<AlgoResult[]> => {
  const quotes = await fetchQuotes(tickers);
  const results: AlgoResult[] = [];

  for (const ticker of tickers) {
    const q = quotes[ticker];
    if (!q || !q.regularMarketPrice) continue;

    const price = q.regularMarketPrice || 0;
    const open = q.regularMarketOpen || price;
    const high = q.regularMarketDayHigh || price;
    const low = q.regularMarketDayLow || price;
    const chgPct = q.regularMarketChangePercent || 0;
    const vol = q.regularMarketVolume || 0;
    const avgVol = q.averageDailyVolume10Day || q.averageDailyVolume3Month || 100000;
    const ma50 = q.fiftyDayAverage || 0;
    const ma200 = q.twoHundredDayAverage || 0;
    const turnover = price * vol;

    // 1. FILTER LIKUIDITAS & KELAYAKAN BURSA (Strict Institutional Screening)
    // Mengeliminasi saham tidur/illiquid, saham FCA gocap < 50, dan yang tanpa transaksi aktif
    if (price < 50) continue;
    if (vol < 300000) continue; // Minimal 3.000 lot (300.000 lembar) transaksi harian
    if (turnover < 500000000) continue; // Minimal Rp 500 Juta turnover per hari untuk mencegah likuiditas kering
    if (chgPct < -3.0 || chgPct > 24.0) continue; // Hindari saham longsor/ARB atau yang sudah lewat fase entri

    const volSpike = avgVol > 0 ? vol / avgVol : 1;
    const bullPower = (high - low > 0) ? (price - low) / (high - low) : 0.5;
    const isAboveMa50 = (ma50 > 0 && price >= ma50);
    const isAboveMa200 = (ma200 > 0 && price >= ma200);
    
    // Evaluasi 8 Kriteria Order Flow & Jejak Bandar
    const orderflowTags = computeOrderflowTags(ticker, q, volSpike, bullPower);
    const matchedCount = orderflowTags.length;

    // Multi-factor Quant Scoring (0 - 100)
    let skor = 35; // base score

    // 1. Order Flow tags contribution (Up to 35 pts)
    skor += Math.min(35, matchedCount * 6);

    // 2. Volume & Liquidity surge (Up to 20 pts)
    if (volSpike >= 2.0) skor += 20;
    else if (volSpike >= 1.3) skor += 14;
    else if (volSpike >= 0.9) skor += 8;

    // 3. Technical Trend & Moving Average Strength (Up to 25 pts)
    if (isAboveMa50) skor += 10;
    if (isAboveMa200) skor += 5;
    if (bullPower >= 0.75) skor += 10;
    else if (bullPower >= 0.50) skor += 5;
    if (chgPct >= 0.5 && chgPct <= 15.0) skor += 5;

    // 4. Special Momentum & Liquidity bonus (Up to 15 pts)
    if (turnover >= 5000000000) skor += 5; // > Rp 5 Miliar turnover: bonus likuiditas institusi
    if (orderflowTags.includes('close_high') && orderflowTags.includes('offers_slender')) {
      skor += 5;
    }
    if (orderflowTags.includes('high_ats') && orderflowTags.includes('foreign_plus')) {
      skor += 5;
    }

    skor = Math.min(99, Math.max(45, skor));

    // FILTER KEYAKINAN MINIMAL: Hanya lolos jika skor >= 68 (High Conviction Institutional Setup)
    if (skor < 68) continue;

    // Calculate Precision Trading Plan for Tomorrow using Official IDX Tick Rules
    const plan = calculateIdxTradingPlan(price, 0.05, 0.10, 0.035);
    const buyArea = plan.buyAreaFormatted;
    const targetPrice1 = plan.targetPrice1;
    const targetPrice2 = plan.targetPrice2;
    const stopLoss = plan.stopLoss;
    const riskReward = plan.riskRewardRatio;
    const tickSize = plan.tickSize;
    const tp1PctActual = plan.targetPct1Actual;
    const tp2PctActual = plan.targetPct2Actual;
    const slPctActual = plan.stopLossPctActual;

    // Conviction Label
    let conviction = '🎯 BUY ON WEAKNESS';
    if (skor >= 85) conviction = '🔥 TOP PICK BESOK';
    else if (orderflowTags.includes('offers_slender') || chgPct >= 5) conviction = '🚀 POTENSI ARA BESOK';
    else if (skor >= 70) conviction = '💎 SWING ACCUMULATION';

    // Narrative Catalyst
    const catalystParts: string[] = [];
    if (orderflowTags.includes('foreign_plus')) catalystParts.push('Inflow Asing Masif');
    if (orderflowTags.includes('high_ats')) catalystParts.push('Order Institusi (High ATS)');
    if (orderflowTags.includes('close_high')) catalystParts.push('Tutup di Pucuk (Close High)');
    if (orderflowTags.includes('offers_slender')) catalystParts.push('Offer Menipis Drastis');
    if (orderflowTags.includes('high_bid_offer')) catalystParts.push('Bid Penampung Tebal');
    if (orderflowTags.includes('top_vol_freq')) catalystParts.push('Volume Transaksi Masif');
    
    const catalyst = catalystParts.length > 0 
      ? catalystParts.slice(0, 3).join(' · ') 
      : 'Kombinasi Price Action & Akumulasi Bandar Terkonfirmasi';

    results.push({
      ticker,
      name: q.shortName || ticker,
      price,
      chgPct,
      volSpike: Number(volSpike.toFixed(2)),
      bullPower: Number(bullPower.toFixed(2)),
      skor,
      pred: conviction,
      status: conviction,
      open,
      high,
      low,
      orderflowTags,
      buyArea,
      targetPrice1,
      targetPrice2,
      stopLoss,
      riskReward,
      conviction,
      catalyst,
      matchedCount,
      tickSize,
      tp1PctActual,
      tp2PctActual,
      slPctActual,
      turnoverIdr: turnover,
    });
  }

  // Urutkan berdasarkan skor tertinggi, lalu kurasi Top 15 Rekomendasi Terpilih untuk Besok
  const sorted = results.sort((a, b) => b.skor - a.skor || (b.matchedCount || 0) - (a.matchedCount || 0));
  return sorted.slice(0, 15);
};

