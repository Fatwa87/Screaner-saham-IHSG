import axios from 'axios';
import { Platform } from 'react-native';
import { getApiBaseUrl } from './apiConfig';

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
}

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

  // Execute in concurrent pools of 4 to fetch 900+ stocks in a few seconds
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
        
        try {
          const response = await axios.get(getProxyUrl(url), { timeout: 9000 });
          const quotes = response.data?.quoteResponse?.result || [];
          
          quotes.forEach((q: any) => {
            if (!q || !q.symbol) return;
            const cleanTicker = q.symbol.replace('.JK', '');
            result[cleanTicker] = q as YFQuote;
            result[q.symbol] = q as YFQuote;
          });
        } catch (innerErr) {
          console.warn(`[fetchQuotes] Batch error for ${symbols}:`, innerErr);
        }
      })
    );
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
    console.error(`[fetchHistory] Error for ${ticker}:`, error);
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
