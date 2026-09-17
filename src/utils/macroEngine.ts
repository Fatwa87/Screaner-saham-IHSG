import { YFQuote } from './yfinance';

export interface MacroPillar {
  name: string;
  weight: number; // percentage (e.g. 25)
  score: number; // 0 - 100
  status: 'SANGAT POSITIF' | 'POSITIF' | 'NETRAL' | 'WASPADA' | 'BEARISH';
  color: string;
  summary: string;
  detail: string;
}

export interface MacroAnalysisResult {
  compositeScore: number; // 0 - 100
  regime: {
    title: string;
    badge: string;
    color: string;
    bgGlow: string;
    borderColor: string;
    allocation: string; // e.g. "Ekuitas 80% • Kas 20%"
    strategy: string;
    summary: string;
    fullDescription: string;
  };
  pillars: {
    currencyFlow: MacroPillar;
    globalRisk: MacroPillar;
    commodityEngine: MacroPillar;
    domesticBreadth: MacroPillar;
  };
  ihsgLevels: {
    current: number;
    pivot: number;
    support1: number;
    support2: number;
    resist1: number;
    resist2: number;
    trendStatus: string;
  };
  sectorRotation: {
    topSectors: string[];
    catalyst: string;
    avoidSectors: string[];
  };
  bigBanksHealth: {
    score: number;
    bullishCount: number;
    totalCount: number;
    status: string;
    color: string;
  };
}

/**
 * Calculates Institutional 4-Pillar Macro Analysis for IHSG
 * 
 * 4 Pillars:
 * 1. Valuta & Capital Flow Dynamics (25%) - USD/IDR, DXY, US 10Y Yield
 * 2. Global Risk Appetite & Asia Regional Peers (25%) - S&P 500, Nikkei 225, Hang Seng, VIX
 * 3. Indonesian Commodity Export Engine (25%) - Crude Oil WTI, Gold
 * 4. Domestic Market Structure & Big 4 Banks (25%) - IHSG vs MA, BBCA, BBRI, BMRI, BBNI
 */
export const calculateMacroAnalysis = (
  quotes: Record<string, YFQuote>
): MacroAnalysisResult => {
  const ihsg = quotes['^JKSE'];
  const usdidr = quotes['IDR=X'];
  const dxy = quotes['DX-Y.NYB'];
  const tnx = quotes['^TNX'];
  const sp500 = quotes['^GSPC'];
  const nikkei = quotes['^N225'];
  const hangseng = quotes['^HSI'];
  const vix = quotes['^VIX'];
  const gold = quotes['GC=F'];
  const oil = quotes['CL=F'];

  // Big 4 Banks
  const bbca = quotes['BBCA'];
  const bbri = quotes['BBRI'];
  const bmri = quotes['BMRI'];
  const bbni = quotes['BBNI'];

  // ════════════════════════════════════════════════════════════════════════════
  // 1. PILAR 1: VALUTA & ARUS MODAL ASING (25%)
  // ════════════════════════════════════════════════════════════════════════════
  let currencyScore = 50;
  const usdidrChg = usdidr?.regularMarketChangePercent || 0;
  const usdidrPrice = usdidr?.regularMarketPrice || 16000;
  const tnxChg = tnx?.regularMarketChangePercent || 0;
  const dxyChg = dxy?.regularMarketChangePercent || 0;

  // Rupiah Appreciation (usdidrChg < 0) is Bullish for IHSG
  if (usdidrChg < -0.3) currencyScore += 25;
  else if (usdidrChg <= 0) currencyScore += 15;
  else if (usdidrChg > 0.5) currencyScore -= 25;
  else if (usdidrChg > 0) currencyScore -= 15;

  // US 10-Yr Yield Drop (tnxChg < 0) spurs Emerging Market Capital Inflows
  if (tnxChg < -1.0) currencyScore += 15;
  else if (tnxChg < 0) currencyScore += 8;
  else if (tnxChg > 1.5) currencyScore -= 15;
  else if (tnxChg > 0) currencyScore -= 8;

  // DXY Dollar Index
  if (dxyChg < -0.2) currencyScore += 10;
  else if (dxyChg > 0.3) currencyScore -= 10;

  currencyScore = Math.min(100, Math.max(10, currencyScore));

  let currencyStatus: MacroPillar['status'] = 'NETRAL';
  let currencyColor = '#38BDF8';
  if (currencyScore >= 75) {
    currencyStatus = 'SANGAT POSITIF';
    currencyColor = '#10B981';
  } else if (currencyScore >= 60) {
    currencyStatus = 'POSITIF';
    currencyColor = '#34D399';
  } else if (currencyScore <= 35) {
    currencyStatus = 'BEARISH';
    currencyColor = '#F43F5E';
  } else if (currencyScore <= 45) {
    currencyStatus = 'WASPADA';
    currencyColor = '#F59E0B';
  }

  const currencyPillar: MacroPillar = {
    name: 'Valuta & Capital Flow',
    weight: 25,
    score: currencyScore,
    status: currencyStatus,
    color: currencyColor,
    summary: `USD/IDR ${usdidrPrice ? `Rp ${Math.round(usdidrPrice).toLocaleString('id-ID')}` : '—'} (${usdidrChg >= 0 ? '+' : ''}${usdidrChg.toFixed(2)}%)`,
    detail: usdidrChg <= 0
      ? 'Rupiah menguat/stabil terhadap USD. Tekanan capital outflow mereda, ramah bagi likuiditas perbankan dan obligasi.'
      : 'Pelemahan Rupiah membatasi agresivitas investor asing di pasar reguler. Waspadai tekanan jual pada big banks.',
  };

  // ════════════════════════════════════════════════════════════════════════════
  // 2. PILAR 2: GLOBAL RISK APPETITE & SENTIMEN REGIONAL ASIA (25%)
  // ════════════════════════════════════════════════════════════════════════════
  let globalScore = 50;
  const spChg = sp500?.regularMarketChangePercent || 0;
  const nikkeiChg = nikkei?.regularMarketChangePercent || 0;
  const hsChg = hangseng?.regularMarketChangePercent || 0;
  const vixLevel = vix?.regularMarketPrice || 16;

  // Wall Street S&P 500
  if (spChg > 0.8) globalScore += 20;
  else if (spChg > 0) globalScore += 10;
  else if (spChg < -0.8) globalScore -= 20;
  else if (spChg < 0) globalScore -= 10;

  // Regional Asia (Nikkei & Hang Seng) - Crucial for morning session sentiment
  const asiaAvg = (nikkeiChg + hsChg) / 2;
  if (asiaAvg > 0.5) globalScore += 15;
  else if (asiaAvg > 0) globalScore += 8;
  else if (asiaAvg < -0.5) globalScore -= 15;
  else if (asiaAvg < 0) globalScore -= 8;

  // CBOE VIX (Global Fear Gauge)
  if (vixLevel < 16) globalScore += 15; // Low fear / Extreme risk on
  else if (vixLevel <= 20) globalScore += 5;
  else if (vixLevel > 28) globalScore -= 20; // High Panic
  else if (vixLevel > 22) globalScore -= 10;

  globalScore = Math.min(100, Math.max(10, globalScore));

  let globalStatus: MacroPillar['status'] = 'NETRAL';
  let globalColor = '#38BDF8';
  if (globalScore >= 75) {
    globalStatus = 'SANGAT POSITIF';
    globalColor = '#10B981';
  } else if (globalScore >= 60) {
    globalStatus = 'POSITIF';
    globalColor = '#34D399';
  } else if (globalScore <= 35) {
    globalStatus = 'BEARISH';
    globalColor = '#F43F5E';
  } else if (globalScore <= 45) {
    globalStatus = 'WASPADA';
    globalColor = '#F59E0B';
  }

  const globalPillar: MacroPillar = {
    name: 'Global & Regional Risk',
    weight: 25,
    score: globalScore,
    status: globalStatus,
    color: globalColor,
    summary: `S&P ${spChg >= 0 ? '+' : ''}${spChg.toFixed(2)}% • VIX ${vixLevel.toFixed(1)}`,
    detail: vixLevel < 18 && spChg >= 0
      ? 'Risk-on global mendominasi. Volatilitas VIX rendah menandakan minat institusi global terhadap ekuitas sangat kondusif.'
      : vixLevel > 22
      ? 'Tingkat kekhawatiran global (VIX) meningkat. Investor cenderung beralih ke instrumen defensif (safe-haven).'
      : 'Pasar global bergerak dalam rentang wajar tanpa gejolak kepanikan sistemik.',
  };

  // ════════════════════════════════════════════════════════════════════════════
  // 3. PILAR 3: SIKLUS KOMODITAS EKSPOR INDONESIA (25%)
  // ════════════════════════════════════════════════════════════════════════════
  let commodityScore = 50;
  const goldChg = gold?.regularMarketChangePercent || 0;
  const oilChg = oil?.regularMarketChangePercent || 0;

  // Gold Momentum (Catalyst for ANTM, MDKA, BRMS, PSAB)
  if (goldChg > 1.0) commodityScore += 18;
  else if (goldChg > 0) commodityScore += 8;
  else if (goldChg < -1.0) commodityScore -= 12;

  // Oil Momentum (Catalyst for MEDC, ENRG, PGAS)
  if (oilChg > 1.5) commodityScore += 18;
  else if (oilChg > 0) commodityScore += 8;
  else if (oilChg < -1.5) commodityScore -= 14;

  // Combined commodity index
  commodityScore = Math.min(100, Math.max(15, commodityScore));

  let commStatus: MacroPillar['status'] = 'NETRAL';
  let commColor = '#38BDF8';
  if (commodityScore >= 70) {
    commStatus = 'POSITIF';
    commColor = '#10B981';
  } else if (commodityScore <= 40) {
    commStatus = 'WASPADA';
    commColor = '#F59E0B';
  }

  const commodityPillar: MacroPillar = {
    name: 'Siklus Komoditas',
    weight: 25,
    score: commodityScore,
    status: commStatus,
    color: commColor,
    summary: `Emas ${goldChg >= 0 ? '+' : ''}${goldChg.toFixed(2)}% • Minyak ${oilChg >= 0 ? '+' : ''}${oilChg.toFixed(2)}%`,
    detail: (goldChg > 0 || oilChg > 0)
      ? 'Apresiasi komoditas memberikan dorongan pendapatan bagi emiten tambang & energi Indonesia.'
      : 'Harga komoditas energi & logam melandai. Sentimen sektor sumber daya alam cenderung sideways.',
  };

  // ════════════════════════════════════════════════════════════════════════════
  // 4. PILAR 4: STRUKTUR PASAR DOMESTIK & BIG 4 BANKS HEALTH (25%)
  // ════════════════════════════════════════════════════════════════════════════
  let domesticScore = 50;
  const ihsgPrice = ihsg?.regularMarketPrice || 7000;
  const ihsgHigh = ihsg?.regularMarketDayHigh || ihsgPrice;
  const ihsgLow = ihsg?.regularMarketDayLow || ihsgPrice;
  const ihsgChg = ihsg?.regularMarketChangePercent || 0;
  const ihsgMa50 = ihsg?.fiftyDayAverage || 0;
  const ihsgMa200 = ihsg?.twoHundredDayAverage || 0;

  // Technical position
  if (ihsgMa50 > 0 && ihsgPrice >= ihsgMa50) domesticScore += 12;
  else if (ihsgMa50 > 0) domesticScore -= 10;

  if (ihsgMa200 > 0 && ihsgPrice >= ihsgMa200) domesticScore += 10;
  else if (ihsgMa200 > 0) domesticScore -= 10;

  // Intraday bull power
  const ihsgRange = ihsgHigh - ihsgLow;
  if (ihsgRange > 0) {
    const bullPower = (ihsgPrice - ihsgLow) / ihsgRange;
    if (bullPower >= 0.7) domesticScore += 10;
    else if (bullPower <= 0.3) domesticScore -= 10;
  }

  // Big 4 Banks Breath (BBCA, BBRI, BMRI, BBNI)
  const banks = [bbca, bbri, bmri, bbni];
  const validBanks = banks.filter(b => b && b.regularMarketPrice);
  const greenBanks = validBanks.filter(b => (b?.regularMarketChangePercent || 0) >= 0);
  const greenBankCount = greenBanks.length;
  const totalBankCount = validBanks.length || 4;

  if (greenBankCount >= 3) domesticScore += 18;
  else if (greenBankCount === 2) domesticScore += 5;
  else if (greenBankCount <= 1 && totalBankCount >= 3) domesticScore -= 18;

  domesticScore = Math.min(100, Math.max(10, domesticScore));

  let domesticStatus: MacroPillar['status'] = 'NETRAL';
  let domesticColor = '#38BDF8';
  if (domesticScore >= 75) {
    domesticStatus = 'SANGAT POSITIF';
    domesticColor = '#10B981';
  } else if (domesticScore >= 60) {
    domesticStatus = 'POSITIF';
    domesticColor = '#34D399';
  } else if (domesticScore <= 35) {
    domesticStatus = 'BEARISH';
    domesticColor = '#F43F5E';
  } else if (domesticScore <= 45) {
    domesticStatus = 'WASPADA';
    domesticColor = '#F59E0B';
  }

  const domesticPillar: MacroPillar = {
    name: 'Internal Breadth & Banks',
    weight: 25,
    score: domesticScore,
    status: domesticStatus,
    color: domesticColor,
    summary: `Big 4 Bank: ${greenBankCount}/${totalBankCount} Hijau • IHSG ${ihsgChg >= 0 ? '+' : ''}${ihsgChg.toFixed(2)}%`,
    detail: greenBankCount >= 3
      ? 'Tulang punggung bursa (Big 4 Banks) solid menghijau. IHSG memiliki pilar penopang kokoh.'
      : greenBankCount <= 1
      ? 'Big 4 Banks serentak tertekan. Berpotensi menahan laju indeks meskipun ada saham lapis dua yang naik.'
      : 'Struktur internal perbankan bervariasi. Rotasi modal terjadi antar emiten bank besar.',
  };

  // ════════════════════════════════════════════════════════════════════════════
  // 5. COMPOSITE MACRO SCORE & MARKET REGIME
  // ════════════════════════════════════════════════════════════════════════════
  const compositeScore = Math.round(
    currencyScore * 0.25 +
    globalScore * 0.25 +
    commodityScore * 0.25 +
    domesticScore * 0.25
  );

  let regimeTitle = 'KONSOLIDASI (RANGE-BOUND)';
  let regimeBadge = '⚖️ NEUTRAL CONSOLIDATION';
  let regimeColor = '#38BDF8';
  let bgGlow = 'rgba(56, 189, 248, 0.12)';
  let borderColor = 'rgba(56, 189, 248, 0.4)';
  let allocation = 'Ekuitas 50% • Kas 50%';
  let strategy = 'Trading Rentang (Range Trading) & Buy on Support';
  let summary = 'Pasar Bergerak Konsolidasi / Sideways';
  let fullDescription = 'Kekuatan sentimen global dan domestik relatif berimbang. Fokus pada trading saham berpotensi teknikal kuat di area support dan batasi target keuntungan harian.';

  if (compositeScore >= 78) {
    regimeTitle = 'RISK-ON AGGRESSIVE BULLISH';
    regimeBadge = '🚀 AGGRESSIVE BULLISH';
    regimeColor = '#10B981';
    bgGlow = 'rgba(16, 185, 129, 0.14)';
    borderColor = 'rgba(16, 185, 129, 0.5)';
    allocation = 'Ekuitas 80% - 90% • Kas 10% - 20%';
    strategy = 'Agresif Swing Buy & Ride Trend Saham Penggerak';
    summary = 'Kondisi Makro Sangat Kondusif untuk Akumulasi';
    fullDescription = 'Kombinasi penguatan Rupiah, sentimen global risk-on, dan solidnya Big Banks membuka ruang akselerasi IHSG. Waktu ideal memaksimalkan alokasi modal pada saham-saham leading.';
  } else if (compositeScore >= 62) {
    regimeTitle = 'MODERATE BULLISH (ROTATION)';
    regimeBadge = '📈 MODERATE BULLISH';
    regimeColor = '#34D399';
    bgGlow = 'rgba(52, 211, 153, 0.12)';
    borderColor = 'rgba(52, 211, 153, 0.4)';
    allocation = 'Ekuitas 65% - 75% • Kas 25% - 35%';
    strategy = 'Selektif Rotasi Sektor Unggulan & Buy on Weakness';
    summary = 'Sentimen Cenderung Positif Secara Terukur';
    fullDescription = 'Pasar menunjukkan sinyal positif, namun tetap selektif. Manfaatkan koreksi sehat untuk entry pada saham yang diuntungkan oleh katalis sektoral.';
  } else if (compositeScore <= 35) {
    regimeTitle = 'RISK-OFF CAPITAL PRESERVATION';
    regimeBadge = '🛑 RISK-OFF / EXTREME DEFENSIVE';
    regimeColor = '#F43F5E';
    bgGlow = 'rgba(244, 63, 94, 0.14)';
    borderColor = 'rgba(244, 63, 94, 0.5)';
    allocation = 'Ekuitas 10% - 20% • Kas 80% - 90%';
    strategy = 'Cash is King • Disiplin Cutloss Ketat • Hindari Average Down';
    summary = 'Tekanan Makro Tinggi & Risiko Koreksi Lanjutan';
    fullDescription = 'Tekanan pelemahan valuta dan sentimen risk-off global membayangi pasar. Amankan modal, prioritaskan posisi kas, dan hindari spekulasi berlebihan.';
  } else if (compositeScore <= 48) {
    regimeTitle = 'CAUTIOUS DEFENSIVE';
    regimeBadge = '⚠️ CAUTIOUS DEFENSIVE';
    regimeColor = '#F59E0B';
    bgGlow = 'rgba(245, 158, 11, 0.12)';
    borderColor = 'rgba(245, 158, 11, 0.4)';
    allocation = 'Ekuitas 30% - 40% • Kas 60% - 70%';
    strategy = 'Scalping Cepat (Fast In-Out) & Kurangi Ukuran Lot';
    summary = 'Volatilitas Tinggi dengan Tekanan Jual Terdeteksi';
    fullDescription = 'Pasar rentan terhadap sentimen negatif eksternal. Lakukan pengetatan stop loss dan hindari menahan posisi swing trading terlalu lama.';
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 6. IHSG DAILY SUPPORT & RESISTANCE (PIVOT + ATR MECHANICS)
  // ════════════════════════════════════════════════════════════════════════════
  const highVal = ihsgHigh > 0 ? ihsgHigh : ihsgPrice;
  const lowVal = ihsgLow > 0 ? ihsgLow : ihsgPrice;
  const closeVal = ihsgPrice > 0 ? ihsgPrice : 7000;

  const pivot = Math.round((highVal + lowVal + closeVal) / 3);
  const resist1 = Math.round((2 * pivot) - lowVal);
  const support1 = Math.round((2 * pivot) - highVal);
  const resist2 = Math.round(pivot + (highVal - lowVal));
  const support2 = Math.round(pivot - (highVal - lowVal));

  const isUptrend = (ihsgMa50 > 0 && closeVal >= ihsgMa50);
  const trendStatus = isUptrend ? 'UPTREND (DI ATAS MA50)' : 'KONSOLIDASI (DI BAWAH MA50)';

  // ════════════════════════════════════════════════════════════════════════════
  // 7. PETA ROTASI SEKTOR TERBAIK
  // ════════════════════════════════════════════════════════════════════════════
  const topSectors: string[] = [];
  const avoidSectors: string[] = [];
  let sectorCatalyst = '';

  if (goldChg > 0.5 || oilChg > 0.5) {
    topSectors.push('Tambang Logam & Emas (MDKA, ANTM, BRMS)');
    topSectors.push('Energi & Minyak (MEDC, ENRG, PGAS)');
    sectorCatalyst = 'Rally komoditas global menjadi katalis utama bagi emiten energi dan logam.';
  }

  if (usdidrChg < 0 && greenBankCount >= 2) {
    topSectors.push('Perbankan Big Caps (BBCA, BBRI, BMRI, BBNI)');
    sectorCatalyst = 'Penguatan Rupiah mendukung arus modal asing masuk ke sektor perbankan.';
  } else if (usdidrChg > 0.3) {
    avoidSectors.push('Emiten dengan Utang USD Tinggi & Importir Bahan Baku');
  }

  if (vixLevel > 22 || compositeScore < 50) {
    topSectors.push('Konsumer Primer / Defensif (ICBP, INDF, MYOR)');
    avoidSectors.push('Saham Siklikal Berbeta Tinggi');
  }

  if (topSectors.length === 0) {
    topSectors.push('Perbankan BUKU 4 Terpilih');
    topSectors.push('Infrastruktur Telekomunikasi (TLKM, ISAT)');
    sectorCatalyst = 'Kondisi pasar netral mengarahkan modal ke emiten likuid berfundamental defensif.';
  }

  return {
    compositeScore,
    regime: {
      title: regimeTitle,
      badge: regimeBadge,
      color: regimeColor,
      bgGlow,
      borderColor,
      allocation,
      strategy,
      summary,
      fullDescription,
    },
    pillars: {
      currencyFlow: currencyPillar,
      globalRisk: globalPillar,
      commodityEngine: commodityPillar,
      domesticBreadth: domesticPillar,
    },
    ihsgLevels: {
      current: Math.round(closeVal),
      pivot,
      support1,
      support2,
      resist1,
      resist2,
      trendStatus,
    },
    sectorRotation: {
      topSectors,
      catalyst: sectorCatalyst,
      avoidSectors,
    },
    bigBanksHealth: {
      score: Math.round((greenBankCount / totalBankCount) * 100),
      bullishCount: greenBankCount,
      totalCount: totalBankCount,
      status: greenBankCount >= 3 ? 'BULLISH PENOPANG' : (greenBankCount === 2 ? 'MODERAT' : 'TERTEKAN'),
      color: greenBankCount >= 3 ? '#10B981' : (greenBankCount === 2 ? '#38BDF8' : '#F43F5E'),
    },
  };
};
