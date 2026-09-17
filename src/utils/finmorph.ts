import axios from 'axios';
import { getApiBaseUrl } from './apiConfig';
const getProxyUrl = () => getApiBaseUrl();

export interface FinmorphPillarMetric {
  label: string;
  value: string;
  score: number;
  weight: number;
  how: string;
  effective_weight?: number;
}

export interface FinmorphPillar {
  key: string;
  label: string;
  summary: string;
  weight: number;
  score: number;
  metrics: FinmorphPillarMetric[];
  effective_weight?: number;
}

export interface FinmorphRedFlag {
  label: string;
  severity?: 'critical' | 'high' | 'medium' | string;
  penalty?: number;
  detail?: string;
}

export interface FinmorphScore {
  total: number;
  base_score: number;
  penalty_total: number;
  grade: string;
  label: string;
  pillars: FinmorphPillar[];
  pillars_available: number;
  pillars_total: number;
  red_flags: (string | FinmorphRedFlag)[];
  is_financial?: boolean;
  methodology?: string;
}

export interface FinmorphAnalyst {
  recommendation: string;
  recommendation_mean: number;
  count: number;
  target_mean: number;
  target_high: number;
  target_low: number;
  upside_pct: number;
  trend?: {
    strong_buy: number;
    buy: number;
    hold: number;
    sell: number;
    strong_sell: number;
  };
}

export interface FinmorphValuation {
  trailing_pe?: number | null;
  forward_pe?: number | null;
  peg?: number | null;
  price_to_book?: number | null;
  price_to_sales?: number | null;
  ev?: number | null;
  ev_ebitda?: number | null;
  ev_revenue?: number | null;
  eps?: number | null;
  book_value?: number | null;
  earnings_yield?: number | null;
}

export interface FinmorphProfitability {
  roe?: number | null;
  roa?: number | null;
  gross_margin?: number | null;
  operating_margin?: number | null;
  net_margin?: number | null;
}

export interface FinmorphFundamentalsResponse {
  error: boolean;
  cached?: boolean;
  identity: {
    symbol: string;
    name: string;
    sector?: string;
    industry?: string;
    employees?: number;
    website?: string;
  };
  score: FinmorphScore;
  data: {
    analyst?: FinmorphAnalyst;
    valuation?: FinmorphValuation;
    profitability?: FinmorphProfitability;
    growth?: any;
    health?: any;
    dividend?: any;
    ownership?: any;
  };
  updated_at?: string;
}

export interface FinmorphFlowSignals {
  cmf: number;
  mfi: number;
  obv: {
    value: number;
    direction: string;
    bias: number;
  };
  ad: {
    value: number;
    direction: string;
    bias: number;
  };
  up_down: {
    up_vol: number;
    down_vol: number;
    ratio: number;
    bias: number;
  };
  volume: {
    latest: number;
    avg: number;
    ratio: number;
    spike: boolean;
  };
}

export interface FinmorphFlowResponse {
  error: boolean;
  symbol: string;
  flow: {
    verdict: 'akumulasi' | 'netral' | 'distribusi' | string;
    label: string;
    grade: string;
    score: number;
    signals: FinmorphFlowSignals;
    notes: string[];
    period: {
      cmf: number;
      mfi: number;
      window: number;
      candles: number;
    };
    insufficient: boolean;
  };
  updated_at?: string;
}

export interface FinmorphLevelsResponse {
  error: boolean;
  symbol: string;
  market: string;
  price: number;
  prev_day?: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
  pivots: {
    classic: {
      pp: number;
      r1: number;
      r2: number;
      r3: number;
      s1: number;
      s2: number;
      s3: number;
    };
    fibonacci: {
      pp: number;
      r1: number;
      r2: number;
      r3: number;
      s1: number;
      s2: number;
      s3: number;
    };
    camarilla: {
      pp: number;
      r1: number;
      r2: number;
      r3: number;
      r4: number;
      s1: number;
      s2: number;
      s3: number;
      s4: number;
    };
  };
  vwap: {
    value: number;
    bands: {
      u1: number;
      l1: number;
      u2: number;
      l2: number;
    };
    timeframe: string;
    session_bars: number;
  };
  updated_at?: string;
}

export interface FinmorphFngResponse {
  error: boolean;
  crypto: {
    value: number;
    level: string;
    label: string;
    previous: number;
    updated: string;
  };
  stock: {
    value: number;
    level: string;
    label: string;
    components: {
      momentum: number;
      volatility: number;
      safe_haven: number;
    };
    updated: string;
  };
  updated_at?: string;
}

export interface FinmorphWantedItem {
  rank: number;
  symbol: string;
  date: string;
  score: number;
  verdict: string;
  smart_net: number;
  heat: string;
}

export interface FinmorphWantedResponse {
  error: boolean;
  available: boolean;
  mode: 'akumulasi' | 'distribusi';
  items: FinmorphWantedItem[];
}

/**
 * Fetch live 5-pillar fundamental analysis & score from Finmorph
 */
export async function fetchFinmorphFundamentals(ticker: string): Promise<FinmorphFundamentalsResponse | null> {
  const clean = ticker.trim().toUpperCase().replace('.JK', '');
  try {
    const res = await axios.get<FinmorphFundamentalsResponse>(
      `${getProxyUrl()}/api/finmorph/fundamentals?symbol=${clean}`,
      { timeout: 9000 }
    );
    if (res.data && !res.data.error) {
      return res.data;
    }
  } catch (err: any) {
    console.warn(`[fetchFinmorphFundamentals] Failed for ${clean}:`, err?.message);
  }
  return null;
}

/**
 * Fetch live Smart Money Flow (verdict, CMF, MFI, OBV, A/D, Notes) from Finmorph
 */
export async function fetchFinmorphFlow(ticker: string): Promise<FinmorphFlowResponse | null> {
  const clean = ticker.trim().toUpperCase().replace('.JK', '');
  try {
    const res = await axios.get<FinmorphFlowResponse>(
      `${getProxyUrl()}/api/finmorph/flow?symbol=${clean}`,
      { timeout: 9000 }
    );
    if (res.data && !res.data.error) {
      return res.data;
    }
  } catch (err: any) {
    console.warn(`[fetchFinmorphFlow] Failed for ${clean}:`, err?.message);
  }
  return null;
}

/**
 * Fetch live Intraday Pivots (Classic, Fibonacci, Camarilla) & Session VWAP from Finmorph
 */
export async function fetchFinmorphLevels(ticker: string): Promise<FinmorphLevelsResponse | null> {
  const clean = ticker.trim().toUpperCase().replace('.JK', '');
  try {
    const res = await axios.get<FinmorphLevelsResponse>(
      `${getProxyUrl()}/api/finmorph/levels?symbol=${clean}`,
      { timeout: 9000 }
    );
    if (res.data && !res.data.error) {
      return res.data;
    }
  } catch (err: any) {
    console.warn(`[fetchFinmorphLevels] Failed for ${clean}:`, err?.message);
  }
  return null;
}

/**
 * Fetch live Market Fear & Greed Index from Finmorph
 */
export async function fetchFinmorphFng(): Promise<FinmorphFngResponse | null> {
  try {
    const res = await axios.get<FinmorphFngResponse>(
      `${getProxyUrl()}/api/finmorph/fng`,
      { timeout: 9000 }
    );
    if (res.data && !res.data.error) {
      return res.data;
    }
  } catch (err: any) {
    console.warn('[fetchFinmorphFng] Failed:', err?.message);
  }
  return null;
}

/**
 * Fetch live Bandar Radar Wanted (Top Akumulasi or Top Distribusi) from Finmorph
 */
export async function fetchFinmorphWanted(mode: 'akumulasi' | 'distribusi' = 'akumulasi'): Promise<FinmorphWantedResponse | null> {
  try {
    const res = await axios.get<FinmorphWantedResponse>(
      `${getProxyUrl()}/api/finmorph/wanted?mode=${mode}`,
      { timeout: 9000 }
    );
    if (res.data && !res.data.error) {
      return res.data;
    }
  } catch (err: any) {
    console.warn(`[fetchFinmorphWanted] Failed for mode ${mode}:`, err?.message);
  }
  return null;
}
