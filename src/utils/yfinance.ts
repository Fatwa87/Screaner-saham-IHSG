import axios from 'axios';
import { Platform } from 'react-native';
import { getApiBaseUrl, setLiveMarketConnected } from './apiConfig';

const BASE_YAHOO_URL = 'https://query1.finance.yahoo.com';

const getProxyUrl = (url: string) => {
  const proxyBase = getApiBaseUrl();
  return url.replace(BASE_YAHOO_URL, proxyBase);
};

export interface YFQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  regularMarketChange: number;
  regularMarketVolume: number;
  regularMarketOpen: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketPreviousClose: number;
  averageDailyVolume10Day?: number;
  averageDailyVolume3Month?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
  trailingPE?: number;
  priceToBook?: number;
  trailingAnnualDividendYield?: number;
  trailingAnnualDividendRate?: number;
  bookValue?: number;
  epsTrailingTwelveMonths?: number;
  marketCap?: number;
  beta3Year?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  shortName?: string;
  longName?: string;
  isLive?: boolean;
  fetchedAt?: number;
}

// In-memory cache of verified live quotes received from the exchange
const verifiedQuotesCache = new Map<string, { quote: YFQuote; timestamp: number }>();

export const fetchQuotes = async (tickers: string[]): Promise<Record<string, YFQuote>> => {
  const result: Record<string, YFQuote> = {};
  if (!tickers || tickers.length === 0) return result;

  const BATCH_SIZE = 40;
  const FIELDS = [
    'regularMarketPrice', 'regularMarketChangePercent', 'regularMarketChange',
    'regularMarketVolume', 'regularMarketOpen', 'regularMarketDayHigh',
    'regularMarketDayLow', 'regularMarketPreviousClose', 'averageDailyVolume10Day',
    'averageDailyVolume3Month', 'fiftyDayAverage', 'twoHundredDayAverage',
    'trailingPE', 'priceToBook', 'trailingAnnualDividendYield', 'epsTrailingTwelveMonths',
    'marketCap', 'beta3Year', 'fiftyTwoWeekHigh', 'fiftyTwoWeekLow', 'shortName', 'longName'
  ].join(',');

  const batches: string[][] = [];
  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    batches.push(tickers.slice(i, i + BATCH_SIZE));
  }

  let totalQuotesReceived = 0;
  let lastError: any = null;

  // Execute in concurrent pools of 4
  const CONCURRENCY = 4;
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const pool = batches.slice(i, i + CONCURRENCY);
    await Promise.all(
      pool.map(async (batch) => {
        const symbols = batch.map(t => {
          if (t.includes('=X') || t.includes('^') || t.includes('=F') || t.endsWith('.JK')) {
            return t;
          }
          return `${t}.JK`;
        }).join(',');

        const url = `${BASE_YAHOO_URL}/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=${encodeURIComponent(FIELDS)}`;
        const startTime = Date.now();

        try {
          const response = await axios.get(getProxyUrl(url), { timeout: 6000 });
          const latency = Date.now() - startTime;
          const quotes = response.data?.quoteResponse?.result || [];

          if (Array.isArray(quotes) && quotes.length > 0) {
            totalQuotesReceived += quotes.length;
            setLiveMarketConnected(true, latency, null);

            const now = Date.now();
            quotes.forEach((q: any) => {
              if (!q || !q.symbol) return;
              const cleanTicker = q.symbol.replace('.JK', '').toUpperCase();
              const quoteData: YFQuote = {
                ...q,
                isLive: true,
                fetchedAt: now,
              };
              result[cleanTicker] = quoteData;
              result[q.symbol] = quoteData;

              // Store in verified live cache
              verifiedQuotesCache.set(cleanTicker, { quote: quoteData, timestamp: now });
              verifiedQuotesCache.set(q.symbol, { quote: quoteData, timestamp: now });
            });
          }
        } catch (innerErr: any) {
          lastError = innerErr;
          // When live backend is unreachable, ONLY fallback to verified previously fetched live quotes
          // NEVER fabricate fake/synthetic stock prices to prevent trading bias!
          batch.forEach(t => {
            const clean = t.replace('.JK', '').toUpperCase();
            const cached = verifiedQuotesCache.get(clean) || verifiedQuotesCache.get(`${clean}.JK`);
            if (cached) {
              const staleQuote = { ...cached.quote, isLive: false };
              result[clean] = staleQuote;
              result[`${clean}.JK`] = staleQuote;
            }
          });
        }
      })
    );
  }

  if (totalQuotesReceived === 0 && lastError) {
    setLiveMarketConnected(false, undefined, lastError.message || 'Gagal mengambil data pasar live.');
  }

  return result;
};

export interface YFHistory {
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
}

export const fetchHistory = async (ticker: string, range: string = '3mo'): Promise<YFHistory> => {
  const empty = { closes: [], highs: [], lows: [], volumes: [] };
  const clean = ticker.trim().toUpperCase();
  const symbol = (clean.includes('=X') || clean.includes('^') || clean.includes('=F') || clean.endsWith('.JK')) 
    ? clean 
    : `${clean}.JK`;
  
  const url = `${BASE_YAHOO_URL}/v8/finance/chart/${symbol}?interval=1d&range=${range}`;

  try {
    const response = await axios.get(getProxyUrl(url), { timeout: 8000 });
    const chart = response.data?.chart?.result?.[0];
    if (!chart?.indicators?.quote?.[0]) return empty;

    const q = chart.indicators.quote[0];
    return {
      closes: (q.close || []).filter((v: any) => v !== null && !isNaN(v)),
      highs: (q.high || []).filter((v: any) => v !== null && !isNaN(v)),
      lows: (q.low || []).filter((v: any) => v !== null && !isNaN(v)),
      volumes: (q.volume || []).filter((v: any) => v !== null && !isNaN(v) && v > 0),
    };
  } catch (error) {
    // If real history fails, return empty to avoid creating misleading sine-wave charts
    return empty;
  }
};

export const getAverage = (arr: number[]): number => {
  if (!arr || arr.length === 0) return 0;
  let sum = 0, cnt = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== null && arr[i] !== undefined && !isNaN(arr[i])) {
      sum += arr[i];
      cnt++;
    }
  }
  return cnt > 0 ? sum / cnt : 0;
};

