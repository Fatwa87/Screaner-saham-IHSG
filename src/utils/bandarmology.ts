import { YFHistory } from './yfinance';

export interface SmartMoneyDay {
  dayIndex: number;
  dateLabel: string;
  close: number;
  changePct: number;
  volume: number;
  isAccumulation: boolean;
  flowVolume: number; // Signed flow
}

export interface TradingPlan {
  entryMin: number;
  entryMax: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  riskReward: string;
  advice: string;
}

export interface BandarmologyResult {
  avgBandar: number;
  currentPrice: number;
  distancePct: number;
  cmf: number;
  smartMoneyInflowPct: number;
  smartMoneyOutflowPct: number;
  wyckoffPhase: 'AKUMULASI' | 'MARK UP' | 'DISTRIBUSI' | 'MARKDOWN';
  phaseTitle: string;
  phaseDesc: string;
  phaseColor: string;
  entryZone: string;
  entryZoneColor: string;
  trail5Days: SmartMoneyDay[];
  tradingPlan: TradingPlan;
}

/**
 * Calculates Bandarmology, Volume-Weighted Average Price of Big Money (Avg Bandar),
 * Chaikin Money Flow (CMF 20), Wyckoff Phase, and Smart Money Inflow/Outflow.
 */
export const calculateBandarmology = (
  history: YFHistory,
  currentPrice: number
): BandarmologyResult | null => {
  if (!history || !history.closes || history.closes.length < 5) {
    return null;
  }

  const closes = history.closes;
  const highs = history.highs;
  const lows = history.lows;
  const volumes = history.volumes;

  // Clean and align bars
  const cleanBars = [];
  for (let i = 0; i < closes.length; i++) {
    const c = closes[i];
    const h = highs[i] || c;
    const l = lows[i] || c;
    const v = volumes[i] || 1;
    if (c !== null && !isNaN(c) && c > 0) {
      cleanBars.push({ c, h: Math.max(h, c), l: Math.min(l, c), v });
    }
  }

  if (cleanBars.length < 5) return null;

  const n = cleanBars.length;
  // Analyze last 20 trading days (or available)
  const period = Math.min(20, n);
  const recent = cleanBars.slice(n - period);

  let totalPV = 0;
  let totalV = 0;
  let cmfPV = 0;
  let cmfV = 0;
  let accumVolume = 0;
  let distribVolume = 0;

  for (let i = 0; i < recent.length; i++) {
    const bar = recent[i];
    const typical = (bar.h + bar.l + bar.c) / 3;
    const range = Math.max(bar.h - bar.l, 1);
    // Money Flow Multiplier: ((Close - Low) - (High - Close)) / (High - Low)
    const mfm = ((bar.c - bar.l) - (bar.h - bar.c)) / range;
    const mfv = mfm * bar.v;

    cmfPV += mfv;
    cmfV += bar.v;

    // Bandar VWAP: weight accumulation days and high-volume days
    totalPV += typical * bar.v;
    totalV += bar.v;

    if (mfm >= 0) {
      accumVolume += bar.v;
    } else {
      distribVolume += bar.v;
    }
  }

  const cur = currentPrice > 0 ? currentPrice : cleanBars[cleanBars.length - 1].c;
  const avgBandar = Math.round(totalPV / (totalV || 1));
  const distancePct = Number((((cur - avgBandar) / avgBandar) * 100).toFixed(2));
  const cmf = Number((cmfV > 0 ? cmfPV / cmfV : 0).toFixed(3));

  const totalFlow = accumVolume + distribVolume || 1;
  const smartMoneyInflowPct = Math.round((accumVolume / totalFlow) * 100);
  const smartMoneyOutflowPct = 100 - smartMoneyInflowPct;

  // 1. Determine Wyckoff / Bandarmology Phase
  let wyckoffPhase: 'AKUMULASI' | 'MARK UP' | 'DISTRIBUSI' | 'MARKDOWN' = 'AKUMULASI';
  let phaseTitle = 'Fase 1: Akumulasi (Accumulation)';
  let phaseDesc = 'Smart money sedang mengumpulkan barang secara rapi di area rata-rata modal bandar.';
  let phaseColor = '#34D399'; // Green

  if (cmf > 0.08 && distancePct >= 0 && distancePct <= 15) {
    wyckoffPhase = 'MARK UP';
    phaseTitle = 'Fase 2: Mark Up (Big Money Momentum)';
    phaseDesc = 'Harga bergerak di atas modal bandar dengan akumulasi volume tinggi. Tren naik solid!';
    phaseColor = '#38BDF8'; // Blue
  } else if (distancePct > 15 || (cmf < -0.05 && distancePct > 5)) {
    wyckoffPhase = 'DISTRIBUSI';
    phaseTitle = 'Fase 3: Distribusi (Profit Taking)';
    phaseDesc = 'Harga sudah terapresiasi tinggi di atas modal bandar. Waspadai aksi jual atau guyuran.';
    phaseColor = '#F59E0B'; // Amber
  } else if (cmf < -0.08 && distancePct < 0) {
    wyckoffPhase = 'MARKDOWN';
    phaseTitle = 'Fase 4: Markdown (Tekanan Jual Dominan)';
    phaseDesc = 'Harga berada di bawah modal bandar dengan tekanan distribusi. Tren cenderung melemah.';
    phaseColor = '#EF4444'; // Red
  }

  // 2. Entry Zone Analysis based on distance to Bandar Cost
  let entryZone = 'ZONA AMAN (DEKAT MODAL BANDAR)';
  let entryZoneColor = '#10B981';

  if (distancePct >= -2 && distancePct <= 4) {
    entryZone = 'ZONA EMAS ENTRY (Sangat Dekat Modal Bandar)';
    entryZoneColor = '#10B981';
  } else if (distancePct > 4 && distancePct <= 10) {
    entryZone = 'ZONA MODERAT (Tren Berjalan)';
    entryZoneColor = '#38BDF8';
  } else if (distancePct > 10) {
    entryZone = 'ZONA WASPADA (Jauh di Atas Modal Bandar)';
    entryZoneColor = '#F59E0B';
  } else if (distancePct < -5) {
    entryZone = 'DI BAWAH MODAL BANDAR (Tunggu Rebound)';
    entryZoneColor = '#A855F7';
  }

  // 3. Extract 5-Day Smart Money Trail
  const last5 = cleanBars.slice(-5);
  const trail5Days: SmartMoneyDay[] = last5.map((bar, idx) => {
    const prevC = idx > 0 ? last5[idx - 1].c : bar.c;
    const chgPct = Number((((bar.c - prevC) / prevC) * 100).toFixed(2));
    const range = Math.max(bar.h - bar.l, 1);
    const mfm = ((bar.c - bar.l) - (bar.h - bar.c)) / range;
    const isAccumulation = mfm >= 0 || (bar.c >= prevC && bar.v > (totalV / period));
    const dayAgo = 5 - idx;
    const dateLabel = dayAgo === 1 ? 'Hari Ini' : `${dayAgo}H Lalu`;

    return {
      dayIndex: idx + 1,
      dateLabel,
      close: bar.c,
      changePct: chgPct,
      volume: bar.v,
      isAccumulation,
      flowVolume: Math.round(bar.v * (isAccumulation ? 1 : -1)),
    };
  });

  // 4. Calculate Trading Plan
  const entryMin = Math.round(avgBandar * 0.98);
  const entryMax = Math.round(avgBandar * 1.03);
  const stopLoss = Math.round(avgBandar * 0.95); // 5% below bandar avg
  const tp1 = Math.round(avgBandar * 1.08); // +8%
  const tp2 = Math.round(avgBandar * 1.18); // +18%

  const risk = Math.max(cur - stopLoss, 1);
  const reward = Math.max(tp1 - cur, 1);
  const rrValue = (reward / risk).toFixed(1);
  const riskReward = `1 : ${rrValue}`;

  let advice = `Rekomendasi: Akumulasi bertahap di rentang Rp${entryMin.toLocaleString('id-ID')} - Rp${entryMax.toLocaleString('id-ID')} dengan Stop Loss ketat di bawah Rp${stopLoss.toLocaleString('id-ID')}.`;
  if (distancePct > 15) {
    advice = `Peringatan: Harga sudah melambung +${distancePct}% dari modal bandar. Kurangi posisi dan pasang trailing stop.`;
  }

  return {
    avgBandar,
    currentPrice: cur,
    distancePct,
    cmf,
    smartMoneyInflowPct,
    smartMoneyOutflowPct,
    wyckoffPhase,
    phaseTitle,
    phaseDesc,
    phaseColor,
    entryZone,
    entryZoneColor,
    trail5Days,
    tradingPlan: {
      entryMin,
      entryMax,
      stopLoss,
      tp1,
      tp2,
      riskReward,
      advice,
    },
  };
};
