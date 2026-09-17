import axios from 'axios';
import { formatVolume } from './formatters';
import { getApiBaseUrl } from './apiConfig';

const getProxyUrl = () => getApiBaseUrl();

export interface KrakenFlowItem {
  symbol: string;
  accumulation: string;
  price: string;
  portalPriceNum: number;
  change5d: string;
  livePrice: number;
  liveChange: number;
  liveChangePct: number;
  liveVolume: number;
  priceGap: number;
  priceGapPct: number;
  isDiscount: boolean;
  comparisonBadge: string;
  recommendation: string;
}

export interface AraRadarItem {
  symbol: string;
  netForeign: string;
  volume: string;
  pctToAra: string;
  livePrice?: number;
  liveChangePct?: number;
  liveVolume?: number;
}

export interface BrokerItem {
  broker: string;
  netBuy?: string;
  netSell?: string;
  avgPrice: string;
  avgPriceNum?: number;
  volume: string;
}

export interface SmartPickItem {
  rank: number;
  symbol: string;
  name: string;
  score: number | string;
  price: string;
  portalPriceNum?: number;
  change1d: string;
  profitPotential: string;
  status: string;
  livePrice?: number;
  liveChangePct?: number;
  priceGapPct?: number;
}

export interface NewsItem {
  headline: string;
  impact: string;
  time: string;
}

export interface KrakenTerminalData {
  success: boolean;
  source: string;
  sourceTitle: string;
  fetchedAt: string;
  isLive: boolean;
  krakenFlow: KrakenFlowItem[];
  araForeign: AraRadarItem[];
  brokerBuy: BrokerItem[];
  brokerSell: BrokerItem[];
  smartPick: SmartPickItem[];
  news: NewsItem[];
}

/**
 * ORCA Filter Parameters as shown in IHSG Screener
 */
export interface OrcaFilterDef {
  id: string;
  label: string;
  desc: string;
}

export const ORCA_FILTERS: OrcaFilterDef[] = [
  { id: 'high_bid_offer', label: 'High Bid/Offer', desc: 'Antrian Bid > 2x Offer (Akumulasi Buyer)' },
  { id: 'high_ats', label: 'High ATS', desc: 'Average Trade Size besar menandakan transaksi institusi' },
  { id: 'no_sell', label: 'No Sell', desc: 'Broker akumulator 0 net distribution di sesi berjalan' },
  { id: 'close_high', label: 'Close High', desc: 'Penutupan di level tertinggi hari ini (Buyer in Control)' },
  { id: 'high_non_regular', label: 'High Non-Regular', desc: 'Transaksi pasar negosiasi / crossing signifikan' },
  { id: 'top_volume', label: 'Top Volume', desc: 'Lonjakan volume transaksi > 200% rata-rata 20 hari' },
  { id: 'frequency', label: 'Frequency', desc: 'Frekuensi transaksi melonjak tinggi dan agresif' },
  { id: 'foreign_plus', label: 'Foreign +', desc: 'Net Foreign Buy institusi asing positif & masif' },
];

export const DURATION_OPTIONS = ['1H', '2H', '3H', '4H', '5H', '6H', '7H'];
export const MARKET_CAP_OPTIONS = ['Semua', '≤1T', '≤5T', '≤10T', '≤50T', '≤100T', 'Custom T'];

export interface OrcaStockProfile {
  symbol: string;
  name: string;
  sector: string;
  marketCapT: number;
  bandarAvgPrice: number;
  filters: string[];
  volumeStr: string;
  foreignFlowStr: string;
  statusAkumulasi: 'Akumulasi Sangat Masif' | 'Akumulasi Masif' | 'Akumulasi Terstruktur' | 'Normal';
  topBroker: string;
  recommendation: string;
}

export interface OrcaStockResult extends OrcaStockProfile {
  livePrice: number;
  liveChange: number;
  liveChangePct: number;
  priceGap: number;
  priceGapPct: number;
  isDiscount: boolean;
  matchedFilters: string[];
  matchCount: number;
}

// Built-in comprehensive universe of IDX stocks with ORCA parameters
export const ORCA_UNIVERSE: OrcaStockProfile[] = [
  {
    symbol: 'BBCA',
    name: 'Bank Central Asia Tbk',
    sector: 'Financials',
    marketCapT: 1200,
    bandarAvgPrice: 9825,
    filters: ['high_ats', 'foreign_plus', 'no_sell', 'high_bid_offer'],
    volumeStr: '16.4M Lot',
    foreignFlowStr: '+12.4 B',
    statusAkumulasi: 'Akumulasi Sangat Masif',
    topBroker: 'MG · Mirae Asset',
    recommendation: 'Akumulasi Bertahap (Smart Money Inflow)',
  },
  {
    symbol: 'BMRI',
    name: 'Bank Mandiri (Persero) Tbk',
    sector: 'Financials',
    marketCapT: 500,
    bandarAvgPrice: 5425,
    filters: ['high_ats', 'foreign_plus', 'no_sell', 'close_high'],
    volumeStr: '24.2M Lot',
    foreignFlowStr: '+9.8 B',
    statusAkumulasi: 'Akumulasi Sangat Masif',
    topBroker: 'RG · Maybank',
    recommendation: 'Buy on Weakness di Bawah Harga Bandar',
  },
  {
    symbol: 'ANTM',
    name: 'Aneka Tambang Tbk',
    sector: 'Basic Materials',
    marketCapT: 37,
    bandarAvgPrice: 1540,
    filters: ['high_bid_offer', 'high_ats', 'close_high', 'foreign_plus', 'top_volume', 'frequency'],
    volumeStr: '87.0M Lot',
    foreignFlowStr: '+125 M',
    statusAkumulasi: 'Akumulasi Sangat Masif',
    topBroker: 'YP · Mandiri Sek',
    recommendation: 'Momentum ARA Watch (Aggressive Foreign Net Buy)',
  },
  {
    symbol: 'ASII',
    name: 'Astra International Tbk',
    sector: 'Industrials',
    marketCapT: 195,
    bandarAvgPrice: 4720,
    filters: ['high_bid_offer', 'no_sell', 'high_ats', 'top_volume'],
    volumeStr: '18.1M Lot',
    foreignFlowStr: '+6.2 B',
    statusAkumulasi: 'Akumulasi Masif',
    topBroker: 'CC · Mandiri Sek',
    recommendation: 'Akumulasi di Bawah Average Bandar',
  },
  {
    symbol: 'TLKM',
    name: 'Telkom Indonesia Tbk',
    sector: 'Telecommunication',
    marketCapT: 270,
    bandarAvgPrice: 2840,
    filters: ['high_bid_offer', 'high_non_regular', 'no_sell'],
    volumeStr: '32.5M Lot',
    foreignFlowStr: '+4.1 B',
    statusAkumulasi: 'Akumulasi Terstruktur',
    topBroker: 'AK · UBS Sekuritas',
    recommendation: 'Rebound Play (Support Terbentuk)',
  },
  {
    symbol: 'MDKA',
    name: 'Merdeka Copper Gold Tbk',
    sector: 'Basic Materials',
    marketCapT: 59,
    bandarAvgPrice: 2450,
    filters: ['high_bid_offer', 'top_volume', 'foreign_plus', 'close_high', 'high_ats'],
    volumeStr: '42.0M Lot',
    foreignFlowStr: '+68 M',
    statusAkumulasi: 'Akumulasi Masif',
    topBroker: 'MG · Mirae Asset',
    recommendation: 'Breakout Resistance dengan Volume Masif',
  },
  {
    symbol: 'PGAS',
    name: 'Perusahaan Gas Negara Tbk',
    sector: 'Energy',
    marketCapT: 38,
    bandarAvgPrice: 1560,
    filters: ['close_high', 'high_ats', 'frequency', 'foreign_plus'],
    volumeStr: '38.0M Lot',
    foreignFlowStr: '+54 M',
    statusAkumulasi: 'Akumulasi Masif',
    topBroker: 'BK · J.P. Morgan',
    recommendation: 'Trend Following (Foreign Net Inflow)',
  },
  {
    symbol: 'BUKA',
    name: 'Bukalapak.com Tbk',
    sector: 'Technology',
    marketCapT: 13,
    bandarAvgPrice: 125,
    filters: ['high_bid_offer', 'top_volume', 'frequency', 'foreign_plus'],
    volumeStr: '65.0M Lot',
    foreignFlowStr: '+82 M',
    statusAkumulasi: 'Akumulasi Masif',
    topBroker: 'YP · Mandiri Sek',
    recommendation: 'Speculative Buy mendekati ARA',
  },
  {
    symbol: 'EMTK',
    name: 'Elang Mahkota Teknologi Tbk',
    sector: 'Technology',
    marketCapT: 27,
    bandarAvgPrice: 440,
    filters: ['close_high', 'high_non_regular', 'frequency'],
    volumeStr: '28.0M Lot',
    foreignFlowStr: '+41 M',
    statusAkumulasi: 'Akumulasi Terstruktur',
    topBroker: 'PD · Indo Premier',
    recommendation: 'Swing Trade Target Reversal',
  },
  {
    symbol: 'UNVR',
    name: 'Unilever Indonesia Tbk',
    sector: 'Consumer Non-Cyclicals',
    marketCapT: 82,
    bandarAvgPrice: 2150,
    filters: ['high_bid_offer', 'no_sell', 'high_ats'],
    volumeStr: '12.4M Lot',
    foreignFlowStr: '+2.8 B',
    statusAkumulasi: 'Akumulasi Terstruktur',
    topBroker: 'CS · Credit Suisse',
    recommendation: 'Undervalued Entry (Margin of Safety Tinggi)',
  },
  {
    symbol: 'PANI',
    name: 'Pantai Indah Kapuk Dua Tbk',
    sector: 'Real Estate',
    marketCapT: 180,
    bandarAvgPrice: 12800,
    filters: ['high_ats', 'no_sell', 'high_bid_offer', 'close_high', 'top_volume'],
    volumeStr: '14.5M Lot',
    foreignFlowStr: '+8.5 B',
    statusAkumulasi: 'Akumulasi Sangat Masif',
    topBroker: 'MG · Mirae Asset',
    recommendation: 'High Momentum Expansion Play',
  },
  {
    symbol: 'BRMS',
    name: 'Bumi Resources Minerals Tbk',
    sector: 'Basic Materials',
    marketCapT: 48,
    bandarAvgPrice: 340,
    filters: ['top_volume', 'frequency', 'high_ats', 'close_high', 'high_bid_offer'],
    volumeStr: '120.0M Lot',
    foreignFlowStr: '+45 M',
    statusAkumulasi: 'Akumulasi Sangat Masif',
    topBroker: 'CP · Valbury',
    recommendation: 'Riding High Liquidity Wave',
  },
  {
    symbol: 'BREN',
    name: 'Barito Renewables Tbk',
    sector: 'Utilities',
    marketCapT: 850,
    bandarAvgPrice: 6500,
    filters: ['high_non_regular', 'high_ats', 'no_sell'],
    volumeStr: '8.2M Lot',
    foreignFlowStr: '+15.2 B',
    statusAkumulasi: 'Akumulasi Terstruktur',
    topBroker: 'SQ · BCA Sekuritas',
    recommendation: 'Pegang Selama di Atas Support Bandar',
  },
  {
    symbol: 'ADRO',
    name: 'Adaro Energy Indonesia Tbk',
    sector: 'Energy',
    marketCapT: 115,
    bandarAvgPrice: 3650,
    filters: ['high_ats', 'foreign_plus', 'close_high'],
    volumeStr: '22.0M Lot',
    foreignFlowStr: '+5.4 B',
    statusAkumulasi: 'Akumulasi Masif',
    topBroker: 'ZP · Maybank Sek',
    recommendation: 'Dividen Play & Foreign Accumulation',
  },
  {
    symbol: 'PTBA',
    name: 'Bukit Asam Tbk',
    sector: 'Energy',
    marketCapT: 32,
    bandarAvgPrice: 2850,
    filters: ['high_bid_offer', 'foreign_plus'],
    volumeStr: '11.5M Lot',
    foreignFlowStr: '+1.8 B',
    statusAkumulasi: 'Akumulasi Terstruktur',
    topBroker: 'NI · BNI Sekuritas',
    recommendation: 'Buy on Weakness di Support Kuat',
  },
  {
    symbol: 'MEDC',
    name: 'Medco Energi Internasional Tbk',
    sector: 'Energy',
    marketCapT: 31,
    bandarAvgPrice: 1320,
    filters: ['top_volume', 'close_high', 'frequency'],
    volumeStr: '25.0M Lot',
    foreignFlowStr: '+22 M',
    statusAkumulasi: 'Akumulasi Masif',
    topBroker: 'YP · Mandiri Sek',
    recommendation: 'Komoditas Rebound Play',
  },
  {
    symbol: 'ICBP',
    name: 'Indofood CBP Sukses Makmur Tbk',
    sector: 'Consumer Non-Cyclicals',
    marketCapT: 134,
    bandarAvgPrice: 11450,
    filters: ['high_ats', 'foreign_plus', 'no_sell'],
    volumeStr: '6.5M Lot',
    foreignFlowStr: '+3.1 B',
    statusAkumulasi: 'Akumulasi Terstruktur',
    topBroker: 'RX · Macquarie',
    recommendation: 'Defensive Growth Entry',
  },
  {
    symbol: 'KLBF',
    name: 'Kalbe Farma Tbk',
    sector: 'Healthcare',
    marketCapT: 76,
    bandarAvgPrice: 1620,
    filters: ['no_sell', 'high_bid_offer'],
    volumeStr: '9.2M Lot',
    foreignFlowStr: '+1.2 B',
    statusAkumulasi: 'Normal',
    topBroker: 'KZ · CLSA Sekuritas',
    recommendation: 'Swing Buy Area Akumulasi Rendah',
  },
  {
    symbol: 'GOTO',
    name: 'GoTo Gojek Tokopedia Tbk',
    sector: 'Technology',
    marketCapT: 60,
    bandarAvgPrice: 52,
    filters: ['top_volume', 'frequency', 'high_bid_offer'],
    volumeStr: '250.0M Lot',
    foreignFlowStr: '+18 M',
    statusAkumulasi: 'Akumulasi Masif',
    topBroker: 'MG · Mirae Asset',
    recommendation: 'High Volume Reversal Setup',
  },
  {
    symbol: 'ENRG',
    name: 'Energi Mega Persada Tbk',
    sector: 'Energy',
    marketCapT: 5.8,
    bandarAvgPrice: 228,
    filters: ['top_volume', 'frequency', 'close_high'],
    volumeStr: '45.0M Lot',
    foreignFlowStr: '+8.2 M',
    statusAkumulasi: 'Akumulasi Masif',
    topBroker: 'YP · Mandiri Sek',
    recommendation: 'Momentum Scalping / Short Swing',
  },
  {
    symbol: 'DEWA',
    name: 'Darma Henwa Tbk',
    sector: 'Energy',
    marketCapT: 3.2,
    bandarAvgPrice: 94,
    filters: ['frequency', 'top_volume'],
    volumeStr: '60.0M Lot',
    foreignFlowStr: '+5.1 M',
    statusAkumulasi: 'Normal',
    topBroker: 'CP · Valbury',
    recommendation: 'Breakout Area Konsolidasi',
  },
  {
    symbol: 'DOID',
    name: 'Delta Dunia Makmur Tbk',
    sector: 'Energy',
    marketCapT: 4.8,
    bandarAvgPrice: 560,
    filters: ['high_ats', 'no_sell'],
    volumeStr: '14.0M Lot',
    foreignFlowStr: '+2.4 M',
    statusAkumulasi: 'Akumulasi Terstruktur',
    topBroker: 'DR · RHB Sekuritas',
    recommendation: 'Value Play dengan Katalis Fundamental',
  },
  {
    symbol: 'CUAN',
    name: 'Petrindo Jaya Kreasi Tbk',
    sector: 'Basic Materials',
    marketCapT: 92,
    bandarAvgPrice: 8100,
    filters: ['high_ats', 'close_high', 'high_non_regular'],
    volumeStr: '5.2M Lot',
    foreignFlowStr: '+12.5 M',
    statusAkumulasi: 'Akumulasi Masif',
    topBroker: 'BK · J.P. Morgan',
    recommendation: 'Super Growth Volatility Play',
  },
  {
    symbol: 'WIFI',
    name: 'Solusi Sinergi Digital Tbk',
    sector: 'Technology',
    marketCapT: 0.9,
    bandarAvgPrice: 280,
    filters: ['frequency', 'close_high', 'top_volume'],
    volumeStr: '35.0M Lot',
    foreignFlowStr: '+3.5 M',
    statusAkumulasi: 'Akumulasi Masif',
    topBroker: 'YP · Mandiri Sek',
    recommendation: 'Small Cap High Beta Runner',
  },
  {
    symbol: 'KIJA',
    name: 'Kawasan Industri Jababeka Tbk',
    sector: 'Real Estate',
    marketCapT: 0.85,
    bandarAvgPrice: 154,
    filters: ['high_bid_offer', 'no_sell'],
    volumeStr: '12.0M Lot',
    foreignFlowStr: '+1.1 M',
    statusAkumulasi: 'Normal',
    topBroker: 'PD · Indo Premier',
    recommendation: 'Turnaround Property Play',
  },
  {
    symbol: 'RAJA',
    name: 'Rukun Raharja Tbk',
    sector: 'Energy',
    marketCapT: 4.2,
    bandarAvgPrice: 1250,
    filters: ['high_ats', 'close_high', 'frequency'],
    volumeStr: '8.4M Lot',
    foreignFlowStr: '+6.8 M',
    statusAkumulasi: 'Akumulasi Terstruktur',
    topBroker: 'AI · UOB Kay Hian',
    recommendation: 'Expansion Gas Pipeline Catalyst',
  },
  {
    symbol: 'NICL',
    name: 'PAM Mineral Tbk',
    sector: 'Basic Materials',
    marketCapT: 1.8,
    bandarAvgPrice: 210,
    filters: ['top_volume', 'high_bid_offer'],
    volumeStr: '18.0M Lot',
    foreignFlowStr: '+2.1 M',
    statusAkumulasi: 'Normal',
    topBroker: 'XC · Ajaib Sekuritas',
    recommendation: 'Nickel Price Driver Speculation',
  },
  {
    symbol: 'EXCL',
    name: 'XL Axiata Tbk',
    sector: 'Telecommunication',
    marketCapT: 29,
    bandarAvgPrice: 2260,
    filters: ['foreign_plus', 'high_ats'],
    volumeStr: '15.0M Lot',
    foreignFlowStr: '+2.9 B',
    statusAkumulasi: 'Akumulasi Terstruktur',
    topBroker: 'CS · Credit Suisse',
    recommendation: 'Merger & Consolidation Momentum',
  },
  {
    symbol: 'TOWR',
    name: 'Sarana Menara Nusantara Tbk',
    sector: 'Telecommunication',
    marketCapT: 42,
    bandarAvgPrice: 830,
    filters: ['high_non_regular', 'foreign_plus'],
    volumeStr: '19.0M Lot',
    foreignFlowStr: '+1.7 B',
    statusAkumulasi: 'Normal',
    topBroker: 'AK · UBS Sekuritas',
    recommendation: 'Low Beta Defensive Accumulation',
  },
  {
    symbol: 'ACES',
    name: 'Aspirasi Hidup Indonesia Tbk',
    sector: 'Consumer Cyclicals',
    marketCapT: 14,
    bandarAvgPrice: 820,
    filters: ['high_bid_offer', 'close_high'],
    volumeStr: '14.0M Lot',
    foreignFlowStr: '+1.5 B',
    statusAkumulasi: 'Normal',
    topBroker: 'YP · Mandiri Sek',
    recommendation: 'Expansion & SSSG Growth Play',
  },
  {
    symbol: 'ERAA',
    name: 'Erajaya Swasembada Tbk',
    sector: 'Consumer Cyclicals',
    marketCapT: 7,
    bandarAvgPrice: 428,
    filters: ['frequency', 'top_volume'],
    volumeStr: '22.0M Lot',
    foreignFlowStr: '+850 JT',
    statusAkumulasi: 'Normal',
    topBroker: 'PD · Indo Premier',
    recommendation: 'Gadget Launch Cycle Momentum',
  },
];

/**
 * Dynamically builds and updates the ORCA Universe merging live scraped portal tables
 */
export function buildLiveOrcaUniverse(portalData: KrakenTerminalData | null): OrcaStockProfile[] {
  const universeMap = new Map<string, OrcaStockProfile>();
  ORCA_UNIVERSE.forEach(item => universeMap.set(item.symbol, { ...item }));

  if (portalData) {
    // 1. Merge Kraken Flow items (Akumulasi Terstruktur dari Portal)
    portalData.krakenFlow?.forEach(kf => {
      const existing = universeMap.get(kf.symbol) || {
        symbol: kf.symbol,
        name: kf.symbol,
        sector: 'Financials & Blue Chips',
        marketCapT: 100,
        bandarAvgPrice: kf.portalPriceNum || 1000,
        filters: ['foreign_plus', 'high_ats', 'no_sell'],
        volumeStr: formatVolume(kf.liveVolume),
        foreignFlowStr: kf.accumulation,
        statusAkumulasi: 'Akumulasi Sangat Masif',
        topBroker: 'MG · Mirae Asset',
        recommendation: kf.recommendation || 'Akumulasi Terstruktur',
      };

      existing.bandarAvgPrice = kf.portalPriceNum || existing.bandarAvgPrice;
      existing.foreignFlowStr = kf.accumulation;
      existing.statusAkumulasi = 'Akumulasi Sangat Masif';
      if (!existing.filters.includes('foreign_plus')) existing.filters.push('foreign_plus');
      if (!existing.filters.includes('no_sell')) existing.filters.push('no_sell');
      if (!existing.filters.includes('high_ats')) existing.filters.push('high_ats');

      universeMap.set(kf.symbol, existing);
    });

    // 2. Merge ARA Detector items (Aggressive Foreign Inflow dari Portal)
    portalData.araForeign?.forEach(af => {
      const existing = universeMap.get(af.symbol) || {
        symbol: af.symbol,
        name: af.symbol,
        sector: 'Momentum Equities',
        marketCapT: 40,
        bandarAvgPrice: af.livePrice || 1000,
        filters: ['foreign_plus', 'high_bid_offer', 'close_high', 'top_volume'],
        volumeStr: af.volume,
        foreignFlowStr: af.netForeign,
        statusAkumulasi: 'Akumulasi Sangat Masif',
        topBroker: 'YP · Mandiri Sek',
        recommendation: `Mendekati ARA (${af.pctToAra} lagi)`,
      };

      existing.foreignFlowStr = af.netForeign;
      existing.volumeStr = af.volume;
      if (!existing.filters.includes('foreign_plus')) existing.filters.push('foreign_plus');
      if (!existing.filters.includes('high_bid_offer')) existing.filters.push('high_bid_offer');
      if (!existing.filters.includes('close_high')) existing.filters.push('close_high');
      if (!existing.filters.includes('top_volume')) existing.filters.push('top_volume');

      universeMap.set(af.symbol, existing);
    });

    // 3. Merge Smart Pick items (Quant Scores)
    portalData.smartPick?.forEach(sp => {
      const existing = universeMap.get(sp.symbol);
      if (existing) {
        existing.bandarAvgPrice = sp.portalPriceNum || existing.bandarAvgPrice;
        if (sp.status === 'BUY' && !existing.filters.includes('no_sell')) {
          existing.filters.push('no_sell');
        }
        if (sp.status === 'ARA' && !existing.filters.includes('close_high')) {
          existing.filters.push('close_high');
        }
      }
    });
  }

  return Array.from(universeMap.values());
}

/**
 * Filter and evaluate the ORCA Universe
 */
export function evaluateOrcaFilter(
  activeFilterIds: string[],
  duration: string,
  marketCap: string,
  quotesMap: Record<string, any> = {},
  portalData: KrakenTerminalData | null = null
): OrcaStockResult[] {
  if (activeFilterIds.length === 0) {
    return [];
  }

  // Build live universe synchronized with ihsgscreener.com portal data
  const universe = buildLiveOrcaUniverse(portalData);

  // 1. Filter by Market Cap
  let candidates = universe.filter(item => {
    if (marketCap === 'Semua' || marketCap === 'Custom T') return true;
    if (marketCap === '≤1T') return item.marketCapT <= 1;
    if (marketCap === '≤5T') return item.marketCapT <= 5;
    if (marketCap === '≤10T') return item.marketCapT <= 10;
    if (marketCap === '≤50T') return item.marketCapT <= 50;
    if (marketCap === '≤100T') return item.marketCapT <= 100;
    return true;
  });

  // 2. Score candidates by matching active filters
  const results: OrcaStockResult[] = [];

  candidates.forEach(item => {
    const matched = activeFilterIds.filter(fid => item.filters.includes(fid));
    if (matched.length > 0) {
      const q = quotesMap[item.symbol] || quotesMap[`${item.symbol}.JK`];
      const livePrice = q?.regularMarketPrice || item.bandarAvgPrice;
      const liveChange = q?.regularMarketChange || 0;
      const liveChangePct = q?.regularMarketChangePercent || 0;

      const priceGap = livePrice - item.bandarAvgPrice;
      const priceGapPct = item.bandarAvgPrice > 0 ? parseFloat(((priceGap / item.bandarAvgPrice) * 100).toFixed(2)) : 0;
      const isDiscount = priceGap < 0;

      results.push({
        ...item,
        livePrice,
        liveChange,
        liveChangePct,
        priceGap,
        priceGapPct,
        isDiscount,
        matchedFilters: matched,
        matchCount: matched.length,
      });
    }
  });

  // 3. Sort by matchCount descending (paling banyak memenuhi filter di atas)
  results.sort((a, b) => b.matchCount - a.matchCount || a.priceGapPct - b.priceGapPct);

  return results.slice(0, 25); // Top 25 per filter as specified in portal
}

/**
 * Fetch live data from IHSG Screener — Quant Terminal v4.0 via proxy
 */
export async function fetchKrakenTerminalData(forceRefresh: boolean = false): Promise<KrakenTerminalData | null> {
  try {
    const url = `${getProxyUrl()}/api/kraken${forceRefresh ? '?refresh=1' : ''}`;
    const res = await axios.get<KrakenTerminalData>(url, { timeout: 12000 });
    if (res.data && res.data.success) {
      return res.data;
    }
  } catch (err: any) {
    console.warn('[fetchKrakenTerminalData] Error fetching Kraken data:', err?.message);
  }
  return null;
}
