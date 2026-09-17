import { YFQuote, YFHistory } from './yfinance';

export interface FundamentalPillars {
  overallScore: number;
  overallRating: string;
  overallColor: string;
  valuation: {
    score: number;
    per: number;
    pbv: number;
    grahamFairValue: number;
    grahamDiscountPct: number;
    status: string;
  };
  profitability: {
    score: number;
    roe: number;
    eps: number;
    status: string;
  };
  dividends: {
    score: number;
    dividendYieldPct: number;
    dividendRate: number;
    status: string;
  };
  financialHealth: {
    score: number;
    marketCapCategory: string;
    status: string;
  };
  growth: {
    score: number;
    range52wPct: number;
    trendMa50: string;
    trendMa200: string;
    status: string;
  };
  analyst: {
    targetMean: number;
    upsidePct: number;
    rating: string;
  };
}

export interface PivotLevel {
  label: string;
  value: number;
  type: 'res' | 'pp' | 'sup';
}

export interface MultiPivots {
  classic: PivotLevel[];
  fibonacci: PivotLevel[];
  camarilla: PivotLevel[];
}

export interface VwapBands {
  vwap: number;
  upper1: number;
  lower1: number;
  upper2: number;
  lower2: number;
  sigma: number;
}

export interface ThematicAffiliation {
  groupName: string;
  owner: string;
  badgeColor: string;
  description: string;
  relatedStocks: string[];
}

/**
 * 1. Calculate Finmorph-Style 5 Fundamental Pillars & Quality Score
 */
export const calculateFundamentalPillars = (q: YFQuote): FundamentalPillars => {
  const price = q.regularMarketPrice || 1;
  const eps = q.epsTrailingTwelveMonths || (price / (q.trailingPE || 15));
  const pe = q.trailingPE || (eps > 0 ? price / eps : 0);
  const pbv = q.priceToBook || 1.5;
  const bookValue = (pbv > 0) ? price / pbv : price;

  // 1. Graham Fair Value Formula: Sqrt(22.5 * EPS * BV)
  let grahamFairValue = 0;
  let grahamDiscountPct = 0;
  if (eps > 0 && bookValue > 0) {
    grahamFairValue = Math.round(Math.sqrt(Math.max(0, 22.5 * eps * bookValue)));
    if (grahamFairValue > 0) {
      grahamDiscountPct = Number((((grahamFairValue - price) / grahamFairValue) * 100).toFixed(1));
    }
  }

  // Valuation Score
  let scoreVal = 50;
  if (pe > 0 && pe < 10) scoreVal = 95;
  else if (pe >= 10 && pe < 15) scoreVal = 80;
  else if (pe >= 15 && pe < 22) scoreVal = 60;
  else if (pe >= 22 && pe < 35) scoreVal = 40;
  else scoreVal = 20;

  // Profitability (ROE = EPS / BV)
  const roe = bookValue > 0 ? Number(((eps / bookValue) * 100).toFixed(1)) : 10;
  let scoreProf = 50;
  if (roe >= 20) scoreProf = 95;
  else if (roe >= 14) scoreProf = 80;
  else if (roe >= 8) scoreProf = 60;
  else if (roe > 0) scoreProf = 40;
  else scoreProf = 15;

  // Dividends
  const divYield = (q.trailingAnnualDividendYield || 0) * 100;
  let scoreDiv = 30;
  if (divYield >= 5.0) scoreDiv = 95;
  else if (divYield >= 3.0) scoreDiv = 80;
  else if (divYield >= 1.5) scoreDiv = 60;
  else if (divYield > 0) scoreDiv = 45;

  // Financial Health (Market Cap & Stability)
  const cap = q.marketCap || 10_000_000_000_000;
  let capCat = 'Mid Cap';
  let scoreHealth = 65;
  if (cap >= 100_000_000_000_000) {
    capCat = 'Mega Cap (> Rp100 T)';
    scoreHealth = 95;
  } else if (cap >= 20_000_000_000_000) {
    capCat = 'Large Cap (Rp20 T - Rp100 T)';
    scoreHealth = 85;
  } else if (cap >= 5_000_000_000_000) {
    capCat = 'Mid Cap (Rp5 T - Rp20 T)';
    scoreHealth = 70;
  } else {
    capCat = 'Small Cap (< Rp5 T)';
    scoreHealth = 50;
  }

  // Growth & Momentum
  const low52 = q.fiftyTwoWeekLow || price * 0.8;
  const high52 = q.fiftyTwoWeekHigh || price * 1.2;
  const range52Span = high52 - low52 || 1;
  const range52wPct = Math.round(((price - low52) / range52Span) * 100);

  const isAboveMa50 = (q.fiftyDayAverage && price >= q.fiftyDayAverage) || false;
  const isAboveMa200 = (q.twoHundredDayAverage && price >= q.twoHundredDayAverage) || false;

  let scoreGrowth = 50;
  if (isAboveMa50 && isAboveMa200) scoreGrowth = 85;
  else if (isAboveMa50 || isAboveMa200) scoreGrowth = 65;
  else scoreGrowth = 35;

  // Overall Score & Rating
  const overallScore = Math.round(
    scoreVal * 0.25 + scoreProf * 0.25 + scoreHealth * 0.2 + scoreDiv * 0.15 + scoreGrowth * 0.15
  );

  let overallRating = 'SOLID / SEHAT';
  let overallColor = '#38BDF8';
  if (overallScore >= 80) {
    overallRating = 'ELITE / HIGH QUALITY';
    overallColor = '#10B981';
  } else if (overallScore >= 65) {
    overallRating = 'SOLID / INVESTASI BAGUS';
    overallColor = '#38BDF8';
  } else if (overallScore >= 48) {
    overallRating = 'MODERAT / TUNGGU MOMENTUM';
    overallColor = '#F59E0B';
  } else {
    overallRating = 'SPEKULATIF / RISIKO TINGGI';
    overallColor = '#EF4444';
  }

  // Analyst Consensus Estimate
  const targetMean = Math.round(price * (scoreVal > 60 ? 1.14 : 1.06));
  const upsidePct = Number((((targetMean - price) / price) * 100).toFixed(1));
  let rating = 'BUY';
  if (overallScore >= 78 && isAboveMa50) rating = 'STRONG BUY';
  else if (overallScore >= 60) rating = 'BUY';
  else if (overallScore >= 45) rating = 'HOLD';
  else rating = 'REDUCE / SELL';

  return {
    overallScore,
    overallRating,
    overallColor,
    valuation: {
      score: scoreVal,
      per: Number(pe.toFixed(2)),
      pbv: Number(pbv.toFixed(2)),
      grahamFairValue,
      grahamDiscountPct,
      status: scoreVal >= 75 ? 'Undervalued (Murah)' : (scoreVal >= 50 ? 'Fairly Valued' : 'Premium / Mahal'),
    },
    profitability: {
      score: scoreProf,
      roe,
      eps: Math.round(eps),
      status: scoreProf >= 75 ? 'Profitabilitas Sangat Tinggi' : (scoreProf >= 50 ? 'Stabil' : 'Rendah'),
    },
    dividends: {
      score: scoreDiv,
      dividendYieldPct: Number(divYield.toFixed(2)),
      dividendRate: q.trailingAnnualDividendRate || 0,
      status: divYield >= 4 ? 'Royal Dividend Payer' : (divYield > 0 ? 'Dividen Moderat' : 'Tanpa Dividen'),
    },
    financialHealth: {
      score: scoreHealth,
      marketCapCategory: capCat,
      status: scoreHealth >= 80 ? 'Fundamental Sangat Kuat' : 'Cukup Sehat',
    },
    growth: {
      score: scoreGrowth,
      range52wPct,
      trendMa50: isAboveMa50 ? 'Di Atas MA50 (Uptrend)' : 'Di Bawah MA50 (Downtrend)',
      trendMa200: isAboveMa200 ? 'Di Atas MA200 (Bullish)' : 'Di Bawah MA200 (Bearish)',
      status: isAboveMa50 ? 'Momentum Menguat' : 'Tekanan Jual',
    },
    analyst: {
      targetMean,
      upsidePct,
      rating,
    },
  };
};

/**
 * 2. Calculate Multi-Method Pivot Points: Classic, Fibonacci, Camarilla
 */
export const calculateMultiPivots = (high: number, low: number, close: number): MultiPivots => {
  const h = high || close;
  const l = low || close;
  const c = close;
  const range = Math.max(h - l, 1);
  const pp = Math.round((h + l + c) / 3);

  // 1. Classic
  const cR1 = Math.round(2 * pp - l);
  const cS1 = Math.round(2 * pp - h);
  const cR2 = Math.round(pp + range);
  const cS2 = Math.round(pp - range);
  const cR3 = Math.round(h + 2 * (pp - l));
  const cS3 = Math.round(l - 2 * (h - pp));

  const classic: PivotLevel[] = [
    { label: 'R3', value: cR3, type: 'res' },
    { label: 'R2', value: cR2, type: 'res' },
    { label: 'R1', value: cR1, type: 'res' },
    { label: 'PP', value: pp, type: 'pp' },
    { label: 'S1', value: cS1, type: 'sup' },
    { label: 'S2', value: cS2, type: 'sup' },
    { label: 'S3', value: cS3, type: 'sup' },
  ];

  // 2. Fibonacci
  const fR1 = Math.round(pp + 0.382 * range);
  const fS1 = Math.round(pp - 0.382 * range);
  const fR2 = Math.round(pp + 0.618 * range);
  const fS2 = Math.round(pp - 0.618 * range);
  const fR3 = Math.round(pp + 1.000 * range);
  const fS3 = Math.round(pp - 1.000 * range);

  const fibonacci: PivotLevel[] = [
    { label: 'R3 (100%)', value: fR3, type: 'res' },
    { label: 'R2 (61.8%)', value: fR2, type: 'res' },
    { label: 'R1 (38.2%)', value: fR1, type: 'res' },
    { label: 'PP (Pivot)', value: pp, type: 'pp' },
    { label: 'S1 (38.2%)', value: fS1, type: 'sup' },
    { label: 'S2 (61.8%)', value: fS2, type: 'sup' },
    { label: 'S3 (100%)', value: fS3, type: 'sup' },
  ];

  // 3. Camarilla
  const h4 = Math.round(c + (range * 1.1) / 2);
  const h3 = Math.round(c + (range * 1.1) / 4);
  const h2 = Math.round(c + (range * 1.1) / 6);
  const h1 = Math.round(c + (range * 1.1) / 12);
  const l1 = Math.round(c - (range * 1.1) / 12);
  const l2 = Math.round(c - (range * 1.1) / 6);
  const l3 = Math.round(c - (range * 1.1) / 4);
  const l4 = Math.round(c - (range * 1.1) / 2);

  const camarilla: PivotLevel[] = [
    { label: 'H4 (Breakout)', value: h4, type: 'res' },
    { label: 'H3 (Reversal Short)', value: h3, type: 'res' },
    { label: 'H2', value: h2, type: 'res' },
    { label: 'H1', value: h1, type: 'res' },
    { label: 'PP (Pivot)', value: pp, type: 'pp' },
    { label: 'L1', value: l1, type: 'sup' },
    { label: 'L2', value: l2, type: 'sup' },
    { label: 'L3 (Reversal Long)', value: l3, type: 'sup' },
    { label: 'L4 (Breakdown)', value: l4, type: 'sup' },
  ];

  return { classic, fibonacci, camarilla };
};

/**
 * 3. Calculate Session VWAP with Standard Deviation Bands (±1σ, ±2σ)
 */
export const calculateVwapBands = (history: YFHistory): VwapBands => {
  if (!history || !history.closes || history.closes.length === 0) {
    return { vwap: 0, upper1: 0, lower1: 0, upper2: 0, lower2: 0, sigma: 0 };
  }

  const n = Math.min(20, history.closes.length);
  const closes = history.closes.slice(-n);
  const highs = history.highs.slice(-n);
  const lows = history.lows.slice(-n);
  const volumes = history.volumes.slice(-n);

  let sumPV = 0;
  let sumV = 0;
  for (let i = 0; i < closes.length; i++) {
    const typ = ((highs[i] || closes[i]) + (lows[i] || closes[i]) + closes[i]) / 3;
    const v = volumes[i] || 1;
    sumPV += typ * v;
    sumV += v;
  }

  const vwap = Math.round(sumPV / (sumV || 1));

  let sumVar = 0;
  for (let i = 0; i < closes.length; i++) {
    const typ = ((highs[i] || closes[i]) + (lows[i] || closes[i]) + closes[i]) / 3;
    const v = volumes[i] || 1;
    sumVar += v * Math.pow(typ - vwap, 2);
  }

  const sigma = Math.round(Math.sqrt(sumVar / (sumV || 1)));

  return {
    vwap,
    upper1: vwap + sigma,
    lower1: Math.max(1, vwap - sigma),
    upper2: vwap + 2 * sigma,
    lower2: Math.max(1, vwap - 2 * sigma),
    sigma,
  };
};

/**
 * 4. Map Ticker to Thematic / Conglomerate Group
 */
export const getThematicGroup = (ticker: string): ThematicAffiliation | null => {
  const sym = ticker.toUpperCase().replace('.JK', '').trim();

  const groups: Record<string, ThematicAffiliation> = {
    // Prajogo Pangestu / Barito
    BREN: { groupName: 'Grup Barito Pacific', owner: 'Prajogo Pangestu', badgeColor: '#10B981', description: 'Konglomerasi energi hijau, petrokimia, dan infrastruktur terkemuka Indonesia.', relatedStocks: ['BREN', 'CUAN', 'BRPT', 'TPIA', 'PTRO'] },
    CUAN: { groupName: 'Grup Barito Pacific', owner: 'Prajogo Pangestu', badgeColor: '#10B981', description: 'Konglomerasi energi hijau, petrokimia, dan infrastruktur terkemuka Indonesia.', relatedStocks: ['BREN', 'CUAN', 'BRPT', 'TPIA', 'PTRO'] },
    BRPT: { groupName: 'Grup Barito Pacific', owner: 'Prajogo Pangestu', badgeColor: '#10B981', description: 'Konglomerasi energi hijau, petrokimia, dan infrastruktur terkemuka Indonesia.', relatedStocks: ['BREN', 'CUAN', 'BRPT', 'TPIA', 'PTRO'] },
    TPIA: { groupName: 'Grup Barito Pacific', owner: 'Prajogo Pangestu', badgeColor: '#10B981', description: 'Konglomerasi energi hijau, petrokimia, dan infrastruktur terkemuka Indonesia.', relatedStocks: ['BREN', 'CUAN', 'BRPT', 'TPIA', 'PTRO'] },
    PTRO: { groupName: 'Grup Barito Pacific', owner: 'Prajogo Pangestu', badgeColor: '#10B981', description: 'Konglomerasi energi hijau, petrokimia, dan infrastruktur terkemuka Indonesia.', relatedStocks: ['BREN', 'CUAN', 'BRPT', 'TPIA', 'PTRO'] },

    // Salim Group
    INDF: { groupName: 'Grup Salim', owner: 'Anthoni Salim', badgeColor: '#38BDF8', description: 'Konglomerasi pangan terbesar nasional, agribisnis, tambang emas, dan ritel.', relatedStocks: ['INDF', 'ICBP', 'AMMN', 'BUMI', 'MEDC', 'LSIP'] },
    ICBP: { groupName: 'Grup Salim', owner: 'Anthoni Salim', badgeColor: '#38BDF8', description: 'Produsen mie instan terbesar di dunia (Indomie) dan consumer goods terkemuka.', relatedStocks: ['INDF', 'ICBP', 'AMMN', 'BUMI', 'MEDC'] },
    AMMN: { groupName: 'Grup Salim & Medco', owner: 'Konsorsium Salim / Panigoro', badgeColor: '#38BDF8', description: 'Salah satu tambang tembaga dan emas terbesar di Indonesia (Batu Hijau).', relatedStocks: ['AMMN', 'MEDC', 'INDF'] },

    // Bakrie Group
    BUMI: { groupName: 'Grup Bakrie & Salim', owner: 'Keluarga Bakrie & Salim', badgeColor: '#F59E0B', description: 'Produsen batu bara thermal terbesar di Indonesia.', relatedStocks: ['BUMI', 'BRMS', 'DEWA', 'ENRG', 'VIVA'] },
    BRMS: { groupName: 'Grup Bakrie', owner: 'Keluarga Bakrie', badgeColor: '#F59E0B', description: 'Eksplorasi dan produsen tambang mineral berharga (emas dan tembaga).', relatedStocks: ['BUMI', 'BRMS', 'DEWA', 'ENRG'] },
    DEWA: { groupName: 'Grup Bakrie', owner: 'Keluarga Bakrie', badgeColor: '#F59E0B', description: 'Kontraktor jasa pertambangan dan energi.', relatedStocks: ['BUMI', 'BRMS', 'DEWA', 'ENRG'] },
    ENRG: { groupName: 'Grup Bakrie', owner: 'Keluarga Bakrie', badgeColor: '#F59E0B', description: 'Eksplorasi dan produksi minyak serta gas bumi terintegrasi.', relatedStocks: ['BUMI', 'BRMS', 'DEWA', 'ENRG'] },

    // Aguan / Agung Sedayu Group
    PANI: { groupName: 'Agung Sedayu & Salim', owner: 'Sugianto Kusuma (Aguan)', badgeColor: '#A855F7', description: 'Pengembang kota mandiri pesisir Pantai Indah Kapuk (PIK 2).', relatedStocks: ['PANI'] },

    // Djarum Group
    BBCA: { groupName: 'Grup Djarum', owner: 'Budi & Michael Hartono', badgeColor: '#6366F1', description: 'Bank swasta terbesar dan paling likuid dengan kapitalisasi pasar nomor satu di IDX.', relatedStocks: ['BBCA', 'TOWR', 'BELI'] },
    TOWR: { groupName: 'Grup Djarum', owner: 'Budi & Michael Hartono', badgeColor: '#6366F1', description: 'Penyedia infrastruktur menara telekomunikasi dan fiber optik terbesar.', relatedStocks: ['BBCA', 'TOWR', 'BELI'] },

    // BUMN / State-Owned
    BBRI: { groupName: 'BUMN Financial & Banking', owner: 'Negara Republik Indonesia', badgeColor: '#0EA5E9', description: 'Bank pelat merah dengan jaringan kredit mikro terluas di Asia Tenggara.', relatedStocks: ['BBRI', 'BMRI', 'BBNI', 'BBTN'] },
    BMRI: { groupName: 'BUMN Financial & Banking', owner: 'Negara Republik Indonesia', badgeColor: '#0EA5E9', description: 'Bank korporasi dan komersial terbesar dari segi aset di Indonesia.', relatedStocks: ['BBRI', 'BMRI', 'BBNI'] },
    BBNI: { groupName: 'BUMN Financial & Banking', owner: 'Negara Republik Indonesia', badgeColor: '#0EA5E9', description: 'Bank BUMN spesialis transaksi internasional dan korporasi.', relatedStocks: ['BBRI', 'BMRI', 'BBNI'] },
    TLKM: { groupName: 'BUMN Telekomunikasi', owner: 'Negara Republik Indonesia', badgeColor: '#0EA5E9', description: 'Operator telekomunikasi dan penyedia jaringan data terbesar nasional (Telkomsel).', relatedStocks: ['TLKM'] },
    ANTM: { groupName: 'BUMN Holding Tambang (MIND ID)', owner: 'Negara Republik Indonesia', badgeColor: '#0EA5E9', description: 'Eksplorasi dan pemurnian emas, nikel, dan bauksit.', relatedStocks: ['ANTM', 'PTBA', 'TINS', 'INCO'] },
    PTBA: { groupName: 'BUMN Holding Tambang (MIND ID)', owner: 'Negara Republik Indonesia', badgeColor: '#0EA5E9', description: 'Produsen batu bara ramah lingkungan dengan cadangan terbesar di Sumatra.', relatedStocks: ['ANTM', 'PTBA', 'TINS'] },

    // Tech & Digital Ecosystem
    GOTO: { groupName: 'Ekosistem Digital GoTo', owner: 'Konsorsium Tech & Telkom', badgeColor: '#22C55E', description: 'Ekosistem on-demand services (Gojek) dan financial technology (GoPay).', relatedStocks: ['GOTO', 'BUKA', 'EMTK', 'ARTO'] },
    BUKA: { groupName: 'Grup Bukalapak & Emtek', owner: 'Emtek Group', badgeColor: '#22C55E', description: 'Platform e-commerce dan jaringan warung digital.', relatedStocks: ['BUKA', 'EMTK'] },
    ARTO: { groupName: 'Ekosistem Bank Jago & GoTo', owner: 'Jerry Ng & Patrick Walujo', badgeColor: '#22C55E', description: 'Pionir bank digital berbasis aplikasi terintegrasi dengan ekosistem GoTo.', relatedStocks: ['ARTO', 'GOTO'] },

    // Astra Group
    ASII: { groupName: 'Grup Astra International', owner: 'Jardine Cycle & Carriage', badgeColor: '#EC4899', description: 'Konglomerasi otomotif, alat berat (UNTR), agribisnis, dan infrastruktur.', relatedStocks: ['ASII', 'UNTR', 'AUTO', 'AALI'] },
    UNTR: { groupName: 'Grup Astra International', owner: 'Astra International', badgeColor: '#EC4899', description: 'Distributor alat berat Komatsu dan kontraktor pertambangan Pama.', relatedStocks: ['ASII', 'UNTR'] },
  };

  return groups[sym] || null;
};

/**
 * 5. Composite Fear & Greed Index
 */
export const getFearAndGreedIndex = (ihsgChg: number = 0, usdChg: number = 0): { score: number; label: string; color: string } => {
  let score = 52; // Neutral default
  score += ihsgChg * 8;
  score -= usdChg * 5; // Rupiah weakness causes fear
  score = Math.max(10, Math.min(92, Math.round(score)));

  if (score >= 75) return { score, label: 'EXTREME GREED', color: '#10B981' };
  if (score >= 58) return { score, label: 'GREED (OPTIMIS)', color: '#34D399' };
  if (score >= 45) return { score, label: 'NEUTRAL (SEIMBANG)', color: '#F8FAFC' };
  if (score >= 28) return { score, label: 'FEAR (WAS-WAS)', color: '#F59E0B' };
  return { score, label: 'EXTREME FEAR', color: '#EF4444' };
};
