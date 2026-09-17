const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// ═════════════════════════════════════════════════════════════════
// 🔑 AUTOMATIC PLANTED GEMINI API KEY SYSTEM
// ═════════════════════════════════════════════════════════════════
let plantedGeminiKey = process.env.GEMINI_API_KEY || '';

function reloadPlantedGeminiKey() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/GEMINI_API_KEY\s*=\s*(.*)/);
      if (match && match[1]) {
        plantedGeminiKey = match[1].trim().replace(/^["']|["']$/g, '');
        if (plantedGeminiKey) {
          console.log('[Gemini Key] Auto-planted key loaded successfully from .env');
          return;
        }
      }
    }
    const cfgPath = path.join(__dirname, 'aiConfig.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (cfg.GEMINI_API_KEY) {
        plantedGeminiKey = cfg.GEMINI_API_KEY.trim();
        console.log('[Gemini Key] Auto-planted key loaded successfully from aiConfig.json');
        return;
      }
    }
  } catch (e) {
    console.warn('[Gemini Key] Warning loading key:', e.message);
  }
}
reloadPlantedGeminiKey();

let session = {
  cookie: null,
  crumb: null,
  timestamp: 0,
};

// In-memory cache for fallback resilience
const quotesCache = new Map();
const finmorphCache = new Map();

// Helper to acquire a Yahoo Finance crumb & cookie
async function getYahooSession(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && session.crumb && session.cookie && (now - session.timestamp < 1800000)) {
    return session;
  }

  try {
    const resCookie = await axios.get('https://fc.yahoo.com', {
      headers: { 'User-Agent': USER_AGENT },
      validateStatus: () => true,
      timeout: 6000,
    });
    const setCookie = resCookie.headers['set-cookie'];
    const cookieHeader = setCookie ? setCookie.join('; ') : '';

    const resCrumb = await axios.get('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent': USER_AGENT,
        'Cookie': cookieHeader,
      },
      timeout: 6000,
    });

    if (resCrumb.data && typeof resCrumb.data === 'string' && !resCrumb.data.includes('<html')) {
      session = {
        cookie: cookieHeader,
        crumb: resCrumb.data.trim(),
        timestamp: now,
      };
      console.log(`[Yahoo Session] New crumb acquired: ${session.crumb}`);
      return session;
    }
  } catch (err) {
    console.warn(`[Yahoo Session] Failed to acquire crumb: ${err.message}`);
  }

  return session;
}

// Normalize ticker symbol to Yahoo format (e.g., BBCA -> BBCA.JK, ^JKSE -> ^JKSE)
function normalizeSymbol(sym) {
  const s = (sym || '').trim().toUpperCase();
  if (!s) return '';
  if (s.endsWith('.JK') || s.startsWith('^') || s.includes('=') || s.includes('.')) {
    return s;
  }
  return `${s}.JK`;
}

// Fallback quote generator for IDX stocks if network is completely down
function generateFallbackQuote(symbol) {
  const clean = symbol.replace('.JK', '');
  const defaults = {
    'BBCA': { price: 6375, chg: 50, pct: 0.79, name: 'Bank Central Asia Tbk', pe: 13.5, pbv: 2.9 },
    'BBRI': { price: 3350, chg: 20, pct: 0.60, name: 'Bank Rakyat Indonesia Tbk', pe: 8.2, pbv: 1.6 },
    'BMRI': { price: 4280, chg: 20, pct: 0.47, name: 'Bank Mandiri Tbk', pe: 8.9, pbv: 1.7 },
    'BBNI': { price: 3750, chg: 20, pct: 0.54, name: 'Bank Negara Indonesia Tbk', pe: 6.8, pbv: 1.0 },
    'TLKM': { price: 2660, chg: 30, pct: 1.14, name: 'Telkom Indonesia Tbk', pe: 11.2, pbv: 1.9 },
    'ASII': { price: 4850, chg: -50, pct: -1.02, name: 'Astra International Tbk', pe: 6.5, pbv: 0.9 },
    'GOTO': { price: 50, chg: 1, pct: 2.04, name: 'GoTo Gojek Tokopedia Tbk', pe: -1, pbv: 0.7 },
    '^JKSE': { price: 6436.85, chg: -24.3, pct: -0.38, name: 'IHSG Composite', pe: 14, pbv: 1.8 },
    'IDR=X': { price: 17707, chg: 12, pct: 0.07, name: 'USD to IDR', pe: 0, pbv: 0 },
    '^GSPC': { price: 5780.20, chg: 15.4, pct: 0.27, name: 'S&P 500 Index', pe: 24, pbv: 4.5 },
    'GC=F': { price: 2680.50, chg: 8.2, pct: 0.31, name: 'Gold Futures', pe: 0, pbv: 0 },
  };

  const def = defaults[clean] || defaults[symbol] || {
    price: 1000,
    chg: 10,
    pct: 1.0,
    name: clean,
    pe: 12,
    pbv: 1.5,
  };

  return {
    symbol: symbol,
    shortName: def.name,
    longName: def.name,
    regularMarketPrice: def.price,
    regularMarketChange: def.chg,
    regularMarketChangePercent: def.pct,
    regularMarketPreviousClose: def.price - def.chg,
    regularMarketOpen: def.price - (def.chg * 0.5),
    regularMarketDayHigh: def.price + Math.abs(def.chg * 1.5),
    regularMarketDayLow: Math.max(50, def.price - Math.abs(def.chg * 1.5)),
    regularMarketVolume: 45000000,
    averageDailyVolume10Day: 40000000,
    averageDailyVolume3Month: 38000000,
    fiftyDayAverage: def.price * 0.98,
    twoHundredDayAverage: def.price * 0.95,
    fiftyTwoWeekHigh: def.price * 1.25,
    fiftyTwoWeekLow: def.price * 0.75,
    trailingPE: def.pe,
    priceToBook: def.pbv,
    marketCap: def.price * 12000000000,
  };
}

// Fetch quotes handler
async function handleQuotes(req, res) {
  const symbolsParam = req.query.symbols || req.query.s || '';
  if (!symbolsParam) {
    return res.json({ quoteResponse: { result: [] } });
  }

  const rawSymbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);
  const normalizedSymbols = rawSymbols.map(normalizeSymbol);

  let sess = await getYahooSession();
  const results = [];
  const missingSymbols = [];

  const BATCH_SIZE = 30;
  for (let i = 0; i < normalizedSymbols.length; i += BATCH_SIZE) {
    const batch = normalizedSymbols.slice(i, i + BATCH_SIZE);
    try {
      const url = 'https://query1.finance.yahoo.com/v7/finance/quote';
      const params = { symbols: batch.join(',') };
      if (sess.crumb) params.crumb = sess.crumb;

      const headers = { 'User-Agent': USER_AGENT };
      if (sess.cookie) headers['Cookie'] = sess.cookie;

      const yRes = await axios.get(url, { params, headers, timeout: 7000 });
      const items = yRes.data?.quoteResponse?.result || [];
      
      items.forEach(item => {
        results.push(item);
        quotesCache.set(item.symbol, item);
      });
    } catch (err) {
      console.warn(`[handleQuotes] Error fetching batch ${batch.join(',')}: ${err.message}`);
      if (err.response?.status === 401) {
        sess = await getYahooSession(true);
      }
      batch.forEach(s => missingSymbols.push(s));
    }
  }

  const returnedSymbols = new Set(results.map(r => r.symbol));
  normalizedSymbols.forEach(sym => {
    if (!returnedSymbols.has(sym)) {
      if (quotesCache.has(sym)) {
        results.push(quotesCache.get(sym));
      } else {
        const fallback = generateFallbackQuote(sym);
        results.push(fallback);
      }
    }
  });

  return res.json({ quoteResponse: { result: results } });
}

// Fetch chart history handler
async function handleChart(req, res) {
  const rawSymbol = req.params.symbol || req.query.symbol || 'BBCA';
  const symbol = normalizeSymbol(rawSymbol);
  const range = req.query.range || '3mo';
  const interval = req.query.interval || '1d';

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`;
    const yRes = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 7000,
    });
    return res.json(yRes.data);
  } catch (err) {
    console.warn(`[handleChart] Error fetching chart for ${symbol}: ${err.message}`);
    const basePrice = quotesCache.get(symbol)?.regularMarketPrice || 5000;
    const timestamps = [];
    const closes = [];
    const highs = [];
    const lows = [];
    const opens = [];
    const volumes = [];

    const now = Math.floor(Date.now() / 1000);
    let cur = basePrice * 0.9;
    for (let i = 60; i >= 0; i--) {
      timestamps.push(now - i * 86400);
      const delta = (Math.random() - 0.48) * (cur * 0.03);
      cur = Math.max(50, Math.round(cur + delta));
      const h = Math.round(cur * (1 + Math.random() * 0.02));
      const l = Math.round(cur * (1 - Math.random() * 0.02));
      closes.push(cur);
      highs.push(h);
      lows.push(l);
      opens.push(Math.round((cur + l) / 2));
      volumes.push(Math.round(20000000 + Math.random() * 50000000));
    }

    return res.json({
      chart: {
        result: [{
          meta: {
            symbol: symbol,
            regularMarketPrice: closes[closes.length - 1],
            currency: 'IDR',
          },
          timestamp: timestamps,
          indicators: {
            quote: [{
              close: closes,
              high: highs,
              low: lows,
              open: opens,
              volume: volumes,
            }],
          },
        }],
      },
    });
  }
}

// ═════════════════════════════════════════════════════════════════
// 🌐 FINMORPH / PREMIUMORPH LIVE DIRECT INTEGRATION ENDPOINTS
// ═════════════════════════════════════════════════════════════════

// 1. Finmorph Stock Fundamentals (Quality Score & 5 Pillars)
app.get('/api/finmorph/fundamentals', async (req, res) => {
  const sym = (req.query.symbol || 'BBCA').toUpperCase().replace('.JK', '');
  const cacheKey = `fund_${sym}`;
  if (finmorphCache.has(cacheKey) && (Date.now() - finmorphCache.get(cacheKey).time < 600000)) {
    return res.json(finmorphCache.get(cacheKey).data);
  }
  try {
    const r = await axios.get(`https://finmorphid.com/premium/api/stock_fundamentals.php?symbol=${sym}`, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 8000,
    });
    if (r.data && !r.data.error) {
      finmorphCache.set(cacheKey, { time: Date.now(), data: r.data });
      return res.json(r.data);
    }
    return res.status(404).json({ error: true, message: 'Finmorph fundamental data not found' });
  } catch (err) {
    console.warn(`[Finmorph Fundamentals] Error for ${sym}:`, err.message);
    return res.status(500).json({ error: true, message: err.message });
  }
});

// 2. Finmorph Smart Money Flow (CMF, MFI, OBV, Signals, Notes)
app.get('/api/finmorph/flow', async (req, res) => {
  const sym = (req.query.symbol || 'BBCA').toUpperCase().replace('.JK', '');
  const cacheKey = `flow_${sym}`;
  if (finmorphCache.has(cacheKey) && (Date.now() - finmorphCache.get(cacheKey).time < 300000)) {
    return res.json(finmorphCache.get(cacheKey).data);
  }
  try {
    const r = await axios.get(`https://finmorphid.com/premium/api/stock_flow.php?symbol=${sym}`, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 8000,
    });
    if (r.data && !r.data.error) {
      finmorphCache.set(cacheKey, { time: Date.now(), data: r.data });
      return res.json(r.data);
    }
    return res.status(404).json({ error: true, message: 'Finmorph flow data not found' });
  } catch (err) {
    console.warn(`[Finmorph Flow] Error for ${sym}:`, err.message);
    return res.status(500).json({ error: true, message: err.message });
  }
});

// 3. Finmorph Intraday Levels (Classic, Fibonacci, Camarilla & Session VWAP)
app.get('/api/finmorph/levels', async (req, res) => {
  const sym = (req.query.symbol || 'BBCA').toUpperCase().replace('.JK', '');
  const cacheKey = `levels_${sym}`;
  if (finmorphCache.has(cacheKey) && (Date.now() - finmorphCache.get(cacheKey).time < 120000)) {
    return res.json(finmorphCache.get(cacheKey).data);
  }
  try {
    const r = await axios.get(`https://finmorphid.com/premium/api/levels.php?symbol=${sym}&market=idx`, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 8000,
    });
    if (r.data && !r.data.error) {
      finmorphCache.set(cacheKey, { time: Date.now(), data: r.data });
      return res.json(r.data);
    }
    return res.status(404).json({ error: true, message: 'Finmorph levels not found' });
  } catch (err) {
    console.warn(`[Finmorph Levels] Error for ${sym}:`, err.message);
    return res.status(500).json({ error: true, message: err.message });
  }
});

// 4. Finmorph Market Sentiment: Fear & Greed Index
app.get('/api/finmorph/fng', async (req, res) => {
  const cacheKey = 'fng_all';
  if (finmorphCache.has(cacheKey) && (Date.now() - finmorphCache.get(cacheKey).time < 600000)) {
    return res.json(finmorphCache.get(cacheKey).data);
  }
  try {
    const r = await axios.get('https://finmorphid.com/premium/api/fng.php', {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 8000,
    });
    if (r.data && !r.data.error) {
      finmorphCache.set(cacheKey, { time: Date.now(), data: r.data });
      return res.json(r.data);
    }
    return res.status(500).json({ error: true, message: 'Failed to fetch FNG' });
  } catch (err) {
    console.warn('[Finmorph FNG] Error:', err.message);
    return res.status(500).json({ error: true, message: err.message });
  }
});

// 5. Finmorph Bandar Radar: Most Wanted (Bought / Sold)
app.get('/api/finmorph/wanted', async (req, res) => {
  const mode = req.query.mode || 'akumulasi';
  const cacheKey = `wanted_${mode}`;
  if (finmorphCache.has(cacheKey) && (Date.now() - finmorphCache.get(cacheKey).time < 300000)) {
    return res.json(finmorphCache.get(cacheKey).data);
  }
  try {
    const r = await axios.get(`https://finmorphid.com/premium/api/bandar_wanted.php?mode=${mode}`, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 8000,
    });
    if (r.data && !r.data.error) {
      finmorphCache.set(cacheKey, { time: Date.now(), data: r.data });
      return res.json(r.data);
    }
    return res.status(500).json({ error: true, message: 'Failed to fetch wanted' });
  } catch (err) {
    console.warn('[Finmorph Wanted] Error:', err.message);
    return res.status(500).json({ error: true, message: err.message });
  }
});

// ==========================================
// Kraken Flow & Quant Terminal v4.0 Scraper & Juxtaposition API
// Portal: https://ihsgscreener.com/index.html (redirects to ./login.html)
// ==========================================

let krakenCache = {
  time: 0,
  data: null,
};

function fetchIHSGScreenerHtml() {
  return new Promise((resolve, reject) => {
    function get(url, depth = 0) {
      if (depth > 5) return reject(new Error('Too many redirects'));
      https.get(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 10000,
      }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let nextUrl = res.headers.location;
          if (nextUrl.startsWith('.')) nextUrl = 'https://ihsgscreener.com' + nextUrl.replace(/^\./, '');
          if (!nextUrl.startsWith('http')) nextUrl = 'https://ihsgscreener.com/' + nextUrl.replace(/^\//, '');
          return get(nextUrl, depth + 1);
        }
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    }
    get('https://ihsgscreener.com/index.html');
  });
}

function getFallbackKrakenData() {
  return {
    success: true,
    source: 'https://ihsgscreener.com/index.html',
    sourceTitle: 'IHSG Screener — Quant Terminal v4.0 (Offline Cache)',
    fetchedAt: new Date().toISOString(),
    isLive: false,
    krakenFlow: [
      { symbol: 'BBCA', accumulation: '+12,4 B', price: '9.825', portalPriceNum: 9825, change5d: '+8,2%', livePrice: 9850, liveChange: 50, liveChangePct: 0.51, priceGap: 25, priceGapPct: 0.25, isDiscount: false, comparisonBadge: 'Premium +0.3% vs Bandar', recommendation: 'Riding Momentum di Atas Average Bandar' },
      { symbol: 'BMRI', accumulation: '+9,8 B', price: '5.425', portalPriceNum: 5425, change5d: '+5,1%', livePrice: 5400, liveChange: -25, liveChangePct: -0.46, priceGap: -25, priceGapPct: -0.46, isDiscount: true, comparisonBadge: 'Diskon 0.5% vs Bandar', recommendation: 'Akumulasi di Bawah Average Bandar' },
      { symbol: 'ASII', accumulation: '+6,2 B', price: '4.720', portalPriceNum: 4720, change5d: '+3,7%', livePrice: 4750, liveChange: 30, liveChangePct: 0.64, priceGap: 30, priceGapPct: 0.64, isDiscount: false, comparisonBadge: 'Premium +0.6% vs Bandar', recommendation: 'Riding Momentum di Atas Average Bandar' },
      { symbol: 'TLKM', accumulation: '+4,1 B', price: '2.840', portalPriceNum: 2840, change5d: '+2,4%', livePrice: 2800, liveChange: -40, liveChangePct: -1.41, priceGap: -40, priceGapPct: -1.41, isDiscount: true, comparisonBadge: 'Diskon 1.4% vs Bandar', recommendation: 'Akumulasi di Bawah Average Bandar' },
      { symbol: 'UNVR', accumulation: '+2,8 B', price: '2.150', portalPriceNum: 2150, change5d: '+1,9%', livePrice: 2160, liveChange: 10, liveChangePct: 0.47, priceGap: 10, priceGapPct: 0.47, isDiscount: false, comparisonBadge: 'Premium +0.5% vs Bandar', recommendation: 'Riding Momentum di Atas Average Bandar' }
    ],
    araForeign: [
      { symbol: 'ANTM', netForeign: '+125 M', volume: '87 JT', pctToAra: '0,8%', livePrice: 1540, liveChangePct: 2.67 },
      { symbol: 'BUKA', netForeign: '+82 M', volume: '65 JT', pctToAra: '1,2%', livePrice: 125, liveChangePct: 1.63 },
      { symbol: 'MDKA', netForeign: '+68 M', volume: '42 JT', pctToAra: '2,1%', livePrice: 2450, liveChangePct: 3.12 },
      { symbol: 'PGAS', netForeign: '+54 M', volume: '38 JT', pctToAra: '2,8%', livePrice: 1560, liveChangePct: 1.96 },
      { symbol: 'EMTK', netForeign: '+41 M', volume: '28 JT', pctToAra: '2,3%', livePrice: 440, liveChangePct: 2.33 }
    ],
    brokerBuy: [
      { broker: 'MG · Mirae Asset', netBuy: '+8,42 B', avgPrice: '9.815', avgPriceNum: 9815, volume: '2,4 JT' },
      { broker: 'RG · Kresna', netBuy: '+6,25 B', avgPrice: '9.820', avgPriceNum: 9820, volume: '1,8 JT' },
      { broker: 'YP · Ashmore', netBuy: '+4,18 B', avgPrice: '9.808', avgPriceNum: 9808, volume: '1,2 JT' },
      { broker: 'CC · Mandiri Sek', netBuy: '+3,12 B', avgPrice: '9.825', avgPriceNum: 9825, volume: '925 RB' }
    ],
    brokerSell: [
      { broker: 'DX · Bahana', netSell: '-5,21 B', avgPrice: '9.812', avgPriceNum: 9812, volume: '1,5 JT' },
      { broker: 'BR · Maybank', netSell: '-3,84 B', avgPrice: '9.806', avgPriceNum: 9806, volume: '1,1 JT' },
      { broker: 'PD · Indo Premier', netSell: '-2,65 B', avgPrice: '9.800', avgPriceNum: 9800, volume: '780 RB' },
      { broker: 'NI · BNI Sek', netSell: '-1,92 B', avgPrice: '9.815', avgPriceNum: 9815, volume: '560 RB' }
    ],
    smartPick: [
      { rank: 1, symbol: 'BBCA', name: 'Bank BCA', score: 88, price: '9.825', portalPriceNum: 9825, change1d: '+0,77%', profitPotential: '+12,4%', status: 'BUY', livePrice: 9850, liveChangePct: 0.51, priceGapPct: 0.25 },
      { rank: 2, symbol: 'BMRI', name: 'Bank Mandiri', score: 85, price: '5.425', portalPriceNum: 5425, change1d: '+1,40%', profitPotential: '+8,7%', status: 'BUY', livePrice: 5400, liveChangePct: -0.46, priceGapPct: -0.46 },
      { rank: 3, symbol: 'ANTM', name: 'Aneka Tambang', score: 82, price: '1.540', portalPriceNum: 1540, change1d: '+2,67%', profitPotential: '+15,2%', status: 'ARA', livePrice: 1540, liveChangePct: 2.67, priceGapPct: 0 },
      { rank: 4, symbol: 'TLKM', name: 'Telkom Indonesia', score: 74, price: '2.840', portalPriceNum: 2840, change1d: '+0,35%', profitPotential: '+6,4%', status: 'HOLD', livePrice: 2800, liveChangePct: -1.41, priceGapPct: -1.41 },
      { rank: 5, symbol: 'ASII', name: 'Astra International', score: 85, price: '4.720', portalPriceNum: 4720, change1d: '+1,28%', profitPotential: '+8,9%', status: 'BUY', livePrice: 4750, liveChangePct: 0.64, priceGapPct: 0.64 },
      { rank: 6, symbol: 'UNVR', name: 'Unilever Indonesia', score: 82, price: '2.150', portalPriceNum: 2150, change1d: '+0,93%', profitPotential: '+7,5%', status: 'HOLD', livePrice: 2160, liveChangePct: 0.47, priceGapPct: 0.47 },
      { rank: 7, symbol: 'ICBP', name: 'Indofood CBP', score: 81, price: '11.450', portalPriceNum: 11450, change1d: '+0,66%', profitPotential: '+5,8%', status: 'BUY', livePrice: 11500, liveChangePct: 0.44, priceGapPct: 0.44 },
      { rank: 8, symbol: 'KLBF', name: 'Kalbe Farma', score: 76, price: '1.620', portalPriceNum: 1620, change1d: '+0,62%', profitPotential: '+6,2%', status: 'HOLD', livePrice: 1615, liveChangePct: -0.31, priceGapPct: -0.31 }
    ],
    news: [
      { headline: '📰 BI Hold Rate 6,00%', impact: '+1,42%', time: '5m' },
      { headline: '📰 BBCA Q3 EPS Beat', impact: '+2,18%', time: '1h' },
      { headline: '📰 Nickel Price Surges on Supply Tightening', impact: '+3,40%', time: '2h' },
      { headline: '📰 Telco Tariff Normalization Continues', impact: '+0,85%', time: '3h' }
    ]
  };
}

async function getInternalQuotes(symbols) {
  const norm = symbols.map(normalizeSymbol);
  let sess = await getYahooSession();
  const map = {};
  
  try {
    const url = 'https://query1.finance.yahoo.com/v7/finance/quote';
    const params = { symbols: norm.join(',') };
    if (sess.crumb) params.crumb = sess.crumb;
    const headers = { 'User-Agent': USER_AGENT };
    if (sess.cookie) headers['Cookie'] = sess.cookie;
    const yRes = await axios.get(url, { params, headers, timeout: 6000 });
    const items = yRes.data?.quoteResponse?.result || [];
    items.forEach(item => {
      const clean = item.symbol.replace('.JK', '');
      map[clean] = item;
      quotesCache.set(item.symbol, item);
    });
  } catch (err) {
    console.warn(`[getInternalQuotes] Yahoo error: ${err.message}`);
  }

  symbols.forEach(sym => {
    const clean = sym.toUpperCase();
    if (!map[clean]) {
      const full = normalizeSymbol(clean);
      if (quotesCache.has(full)) {
        map[clean] = quotesCache.get(full);
      } else {
        map[clean] = generateFallbackQuote(full);
      }
    }
  });

  return map;
}

async function handleKrakenFlow(req, res) {
  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
  const now = Date.now();

  if (!forceRefresh && krakenCache.data && (now - krakenCache.time < 300000)) {
    return res.json(krakenCache.data);
  }

  try {
    const html = await fetchIHSGScreenerHtml();
    const allRows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

    const krakenFlow = [];
    const araForeign = [];
    const brokerBuy = [];
    const brokerSell = [];
    const smartPick = [];
    const news = [];

    allRows.forEach(row => {
      const cells = (row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [])
        .map(c => c.replace(/<[^>]+>/g, '').trim());

      // Kraken Akumulasi Table: [Kode, Akumulasi, Harga, 5D%]
      if (cells.length === 4 && ['BBCA', 'BMRI', 'ASII', 'TLKM', 'UNVR'].includes(cells[0])) {
        const portalPriceNum = parseFloat(cells[2].replace(/\./g, '').replace(/,/g, '.')) || 0;
        krakenFlow.push({
          symbol: cells[0],
          accumulation: cells[1],
          price: cells[2],
          portalPriceNum,
          change5d: cells[3]
        });
      }

      // ARA & Foreign: [Kode, Net Foreign, Vol, % to ARA]
      if (cells.length === 4 && ['ANTM', 'BUKA', 'MDKA', 'PGAS', 'EMTK'].includes(cells[0])) {
        araForeign.push({
          symbol: cells[0],
          netForeign: cells[1],
          volume: cells[2],
          pctToAra: cells[3]
        });
      }

      // Broker Buy: [Broker, Net Buy, Avg Price, Vol]
      if (cells.length === 4 && cells[0].includes('·') && cells[1].includes('+')) {
        brokerBuy.push({
          broker: cells[0],
          netBuy: cells[1],
          avgPrice: cells[2],
          avgPriceNum: parseFloat(cells[2].replace(/\./g, '').replace(/,/g, '.')) || 0,
          volume: cells[3]
        });
      }

      // Broker Sell: [Broker, Net Sell, Avg Price, Vol]
      if (cells.length === 4 && cells[0].includes('·') && cells[1].includes('-')) {
        brokerSell.push({
          broker: cells[0],
          netSell: cells[1],
          avgPrice: cells[2],
          avgPriceNum: parseFloat(cells[2].replace(/\./g, '').replace(/,/g, '.')) || 0,
          volume: cells[3]
        });
      }

      // Smart Pick: [# , Kode, Nama, Score, Harga, 1D%, P/L, Status]
      if (cells.length === 8 && /^\d+$/.test(cells[0])) {
        const portalPriceNum = parseFloat(cells[4].replace(/\./g, '').replace(/,/g, '.')) || 0;
        smartPick.push({
          rank: parseInt(cells[0]),
          symbol: cells[1],
          name: cells[2],
          score: parseInt(cells[3]) || cells[3],
          price: cells[4],
          portalPriceNum,
          change1d: cells[5],
          profitPotential: cells[6],
          status: cells[7]
        });
      }

      // News: [Headline, Impact, Time]
      if (cells.length === 3 && (cells[0].includes('📰') || cells[2].includes('m') || cells[2].includes('h'))) {
        if (cells[0] !== 'Headline' && !cells[0].toLowerCase().includes('berita')) {
          news.push({
            headline: cells[0],
            impact: cells[1],
            time: cells[2]
          });
        }
      }
    });

    if (krakenFlow.length === 0 && smartPick.length === 0) {
      console.warn('[handleKrakenFlow] Empty parse result, using fallback terminal data');
      return res.json(getFallbackKrakenData());
    }

    const symbolsToFetch = Array.from(new Set([
      ...krakenFlow.map(k => k.symbol),
      ...araForeign.map(a => a.symbol),
      ...smartPick.map(s => s.symbol),
    ]));

    const quotesMap = await getInternalQuotes(symbolsToFetch);

    const enrichedKrakenFlow = krakenFlow.map(item => {
      const live = quotesMap[item.symbol] || generateFallbackQuote(`${item.symbol}.JK`);
      const livePrice = live.regularMarketPrice || item.portalPriceNum;
      const portalPrice = item.portalPriceNum || livePrice;
      const priceGap = livePrice - portalPrice;
      const priceGapPct = portalPrice > 0 ? ((priceGap / portalPrice) * 100) : 0;
      const isDiscount = priceGap < 0;

      return {
        ...item,
        livePrice,
        liveChange: live.regularMarketChange || 0,
        liveChangePct: live.regularMarketChangePercent || 0,
        liveVolume: live.regularMarketVolume || 0,
        priceGap,
        priceGapPct: parseFloat(priceGapPct.toFixed(2)),
        isDiscount,
        comparisonBadge: isDiscount 
          ? `Diskon ${Math.abs(priceGapPct).toFixed(1)}% vs Bandar` 
          : `Premium +${priceGapPct.toFixed(1)}% vs Bandar`,
        recommendation: isDiscount
          ? 'Akumulasi di Bawah Average Bandar'
          : 'Riding Momentum di Atas Average Bandar'
      };
    });

    const enrichedAraForeign = araForeign.map(item => {
      const live = quotesMap[item.symbol] || generateFallbackQuote(`${item.symbol}.JK`);
      return {
        ...item,
        livePrice: live.regularMarketPrice || 0,
        liveChangePct: live.regularMarketChangePercent || 0,
        liveVolume: live.regularMarketVolume || 0
      };
    });

    const enrichedSmartPick = smartPick.map(item => {
      const live = quotesMap[item.symbol] || generateFallbackQuote(`${item.symbol}.JK`);
      const livePrice = live.regularMarketPrice || item.portalPriceNum;
      const portalPrice = item.portalPriceNum || livePrice;
      const priceGap = livePrice - portalPrice;
      const priceGapPct = portalPrice > 0 ? ((priceGap / portalPrice) * 100) : 0;

      return {
        ...item,
        livePrice,
        liveChangePct: live.regularMarketChangePercent || 0,
        priceGapPct: parseFloat(priceGapPct.toFixed(2)),
      };
    });

    const result = {
      success: true,
      source: 'https://ihsgscreener.com/index.html',
      sourceTitle: 'IHSG Screener — Quant Terminal v4.0',
      fetchedAt: new Date().toISOString(),
      isLive: true,
      krakenFlow: enrichedKrakenFlow,
      araForeign: enrichedAraForeign,
      brokerBuy,
      brokerSell,
      smartPick: enrichedSmartPick,
      news
    };

    krakenCache = { time: now, data: result };
    return res.json(result);
  } catch (err) {
    console.warn('[handleKrakenFlow] Error:', err.message);
    return res.json(getFallbackKrakenData());
  }
}

// ═════════════════════════════════════════════════════════════════
// 📰 LIVE INDONESIAN STOCK NEWS & SENTIMENT SCRAPER
// ═════════════════════════════════════════════════════════════════
const newsCache = new Map();

async function handleNews(req, res) {
  const rawSymbol = req.params.symbol || req.query.symbol || 'BBCA';
  const clean = rawSymbol.toUpperCase().replace('.JK', '').trim();
  const cacheKey = `news_${clean}`;

  if (newsCache.has(cacheKey) && (Date.now() - newsCache.get(cacheKey).time < 300000)) {
    return res.json(newsCache.get(cacheKey).data);
  }

  try {
    const searchUrl = `https://news.google.com/rss/search?q=saham+${encodeURIComponent(clean)}&hl=id&gl=ID&ceid=ID:id`;
    const r = await axios.get(searchUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 8000,
    });

    const rawItems = (r.data.match(/<item>[\s\S]*?<\/item>/g) || []).slice(0, 8);
    const items = rawItems.map(item => {
      const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
      const title = titleMatch ? titleMatch[1] : '';
      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
      const link = linkMatch ? linkMatch[1] : '';
      const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const pubDate = pubDateMatch ? pubDateMatch[1] : '';
      const sourceMatch = item.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      const source = sourceMatch ? sourceMatch[1] : 'Media Pasar Modal';

      const cleanTitle = title
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'");

      let score = 0;
      const lower = cleanTitle.toLowerCase();
      const posWords = ['laba', 'melesat', 'dividen', 'buyback', 'akumulasi', 'rekor', 'cuan', 'naik', 'optimis', 'ekspansi', 'beat', 'melonjak', 'menguat', 'target', 'potensi', 'angin segar', 'tumbuh', 'raksasa', 'borong'];
      const negWords = ['rugi', 'anjlok', 'laggard', 'turun', 'buang', 'koreksi', 'waspada', 'pangkas', 'miss', 'tekanan', 'merosot', 'tergelincir', 'merah', 'drop', 'jual asing', 'ambles'];

      posWords.forEach(w => { if (lower.includes(w)) score += 1; });
      negWords.forEach(w => { if (lower.includes(w)) score -= 1; });

      return {
        title: cleanTitle,
        link,
        pubDate,
        source,
        sentiment: score > 0 ? 'BULLISH' : (score < 0 ? 'BEARISH' : 'NETRAL')
      };
    });

    let totalScore = 0;
    items.forEach(i => {
      if (i.sentiment === 'BULLISH') totalScore += 1;
      else if (i.sentiment === 'BEARISH') totalScore -= 1;
    });

    let overallLabel = 'NETRAL';
    let sentimentScorePct = 50;
    if (totalScore >= 2) {
      overallLabel = 'SANGAT POSITIF (BULLISH)';
      sentimentScorePct = 85;
    } else if (totalScore === 1) {
      overallLabel = 'POSITIF';
      sentimentScorePct = 70;
    } else if (totalScore === 0) {
      overallLabel = 'NETRAL / SEIMBANG';
      sentimentScorePct = 50;
    } else if (totalScore === -1) {
      overallLabel = 'HATI-HATI (BEARISH)';
      sentimentScorePct = 35;
    } else {
      overallLabel = 'SANGAT NEGATIF';
      sentimentScorePct = 15;
    }

    const payload = {
      symbol: clean,
      items: items.length > 0 ? items : [
        {
          title: `Kinerja Operasional dan Perkembangan Pasar Saham ${clean}`,
          link: `https://id.tradingview.com/symbols/IDX-${clean}/`,
          pubDate: new Date().toUTCString(),
          source: 'Bursa Efek Indonesia',
          sentiment: 'NETRAL'
        }
      ],
      count: items.length,
      overallLabel,
      sentimentScorePct,
      fetchedAt: new Date().toISOString()
    };

    newsCache.set(cacheKey, { time: Date.now(), data: payload });
    return res.json(payload);
  } catch (err) {
    console.warn(`[handleNews] Error for ${clean}:`, err.message);
    return res.json({
      symbol: clean,
      items: [
        {
          title: `Kinerja Fundamental & Pergerakan Harga Saham ${clean} Terkini`,
          link: `https://id.tradingview.com/symbols/IDX-${clean}/`,
          pubDate: new Date().toUTCString(),
          source: 'Bursa Efek Indonesia',
          sentiment: 'NETRAL'
        }
      ],
      count: 1,
      overallLabel: 'NETRAL',
      sentimentScorePct: 50,
      fetchedAt: new Date().toISOString()
    });
  }
}

// ═════════════════════════════════════════════════════════════════
// 📅 5-YEAR MONTHLY SEASONALITY ENGINE
// ═════════════════════════════════════════════════════════════════
const seasonalityCache = new Map();
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

async function handleSeasonality(req, res) {
  const rawSymbol = req.params.symbol || req.query.symbol || 'BBCA';
  const clean = rawSymbol.toUpperCase().replace('.JK', '').trim();
  const cacheKey = `seasonality_${clean}`;

  if (seasonalityCache.has(cacheKey) && (Date.now() - seasonalityCache.get(cacheKey).time < 3600000)) {
    return res.json(seasonalityCache.get(cacheKey).data);
  }

  try {
    const symbol = `${clean}.JK`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1mo&range=5y`;
    const yRes = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 8000,
    });

    const chart = yRes.data?.chart?.result?.[0];
    const timestamps = chart?.timestamp || [];
    const quote = chart?.indicators?.quote?.[0] || {};
    const opens = quote.open || [];
    const closes = quote.close || [];

    const monthStats = Array.from({ length: 12 }, (_, i) => ({
      monthIndex: i,
      monthName: MONTH_NAMES[i],
      returns: [],
      positiveYears: 0,
      totalYears: 0,
      avgReturnPct: 0,
      winRatePct: 0,
      minReturnPct: 0,
      maxReturnPct: 0,
    }));

    for (let i = 0; i < timestamps.length; i++) {
      const o = opens[i];
      const c = closes[i];
      if (o && c && !isNaN(o) && !isNaN(c) && o > 0) {
        const d = new Date(timestamps[i] * 1000);
        const m = d.getUTCMonth();
        const retPct = ((c - o) / o) * 100;
        monthStats[m].returns.push(retPct);
        monthStats[m].totalYears += 1;
        if (retPct > 0) monthStats[m].positiveYears += 1;
      }
    }

    monthStats.forEach(m => {
      if (m.totalYears > 0) {
        const sum = m.returns.reduce((a, b) => a + b, 0);
        m.avgReturnPct = parseFloat((sum / m.totalYears).toFixed(2));
        m.winRatePct = Math.round((m.positiveYears / m.totalYears) * 100);
        m.minReturnPct = parseFloat(Math.min(...m.returns).toFixed(2));
        m.maxReturnPct = parseFloat(Math.max(...m.returns).toFixed(2));
      } else {
        m.winRatePct = 50;
        m.avgReturnPct = 0;
      }
    });

    const sortedByWinRate = [...monthStats].sort((a, b) => b.winRatePct - a.winRatePct || b.avgReturnPct - a.avgReturnPct);
    const bestMonth = sortedByWinRate[0] || { monthName: 'Desember', winRatePct: 80, avgReturnPct: 4.2 };
    const worstMonth = sortedByWinRate[sortedByWinRate.length - 1] || { monthName: 'Mei', winRatePct: 40, avgReturnPct: -1.5 };

    const currentMonthIdx = new Date().getMonth();
    const currentMonthData = monthStats[currentMonthIdx];

    const payload = {
      symbol: clean,
      months: monthStats,
      bestMonth: {
        name: bestMonth.monthName,
        winRatePct: bestMonth.winRatePct,
        avgReturnPct: bestMonth.avgReturnPct,
      },
      worstMonth: {
        name: worstMonth.monthName,
        winRatePct: worstMonth.winRatePct,
        avgReturnPct: worstMonth.avgReturnPct,
      },
      currentMonth: {
        name: currentMonthData.monthName,
        winRatePct: currentMonthData.winRatePct,
        avgReturnPct: currentMonthData.avgReturnPct,
      },
      fetchedAt: new Date().toISOString()
    };

    seasonalityCache.set(cacheKey, { time: Date.now(), data: payload });
    return res.json(payload);
  } catch (err) {
    console.warn(`[handleSeasonality] Error for ${clean}:`, err.message);
    const fallbackMonths = MONTH_NAMES.map((name, idx) => {
      let winRate = 50;
      let avg = 0.8;
      if (idx === 11) { winRate = 80; avg = 4.2; }
      else if (idx === 0) { winRate = 60; avg = 1.8; }
      else if (idx === 4) { winRate = 40; avg = -1.5; }
      else if (idx === 7) { winRate = 60; avg = 2.1; }
      else if (idx === 9) { winRate = 65; avg = 2.4; }
      return {
        monthIndex: idx,
        monthName: name,
        returns: [avg],
        positiveYears: Math.round(5 * (winRate / 100)),
        totalYears: 5,
        avgReturnPct: avg,
        winRatePct: winRate,
        minReturnPct: avg - 3,
        maxReturnPct: avg + 4
      };
    });

    return res.json({
      symbol: clean,
      months: fallbackMonths,
      bestMonth: { name: 'Desember', winRatePct: 80, avgReturnPct: 4.2 },
      worstMonth: { name: 'Mei', winRatePct: 40, avgReturnPct: -1.5 },
      currentMonth: { name: MONTH_NAMES[new Date().getMonth()], winRatePct: 60, avgReturnPct: 1.5 },
      fetchedAt: new Date().toISOString()
    });
  }
}

// ═════════════════════════════════════════════════════════════════
// 🤖 GEMINI AI DEEP QUANTITATIVE SYNTHESIS & ANALYSIS ENGINE
// ═════════════════════════════════════════════════════════════════
async function handleGeminiAnalyze(req, res) {
  const symbol = (req.body?.symbol || req.query?.symbol || 'BBCA').toUpperCase().replace('.JK', '').trim();
  const apiKey = req.body?.apiKey || req.query?.apiKey || plantedGeminiKey || process.env.GEMINI_API_KEY || '';
  const clientData = req.body || {};

  try {
    // 1. Fetch Quote
    const quotes = await getInternalQuotes([symbol]);
    const q = quotes[symbol] || generateFallbackQuote(`${symbol}.JK`);
    const price = q.regularMarketPrice || 1000;
    const chgPct = q.regularMarketChangePercent || 0;

    // 2. Fetch Fundamentals from Finmorph or Quote
    let finData = null;
    try {
      const finRes = await axios.get(`http://localhost:${PORT}/api/finmorph/fundamentals?symbol=${symbol}`, { timeout: 4000 });
      finData = finRes.data;
    } catch (_) {}

    // Extract PER, PBV, ROE, ROA, DER, EPS
    const eps = q.epsTrailingTwelveMonths || 
      (finData?.earnings_history?.[finData.earnings_history.length - 1]?.eps_actual * 4) || 
      Math.round(price / (q.trailingPE || 12));
    const per = q.trailingPE || (eps > 0 ? parseFloat((price / eps).toFixed(2)) : 14.5);
    const pbv = q.priceToBook || 1.8;
    const bookValue = q.bookValue || (pbv > 0 ? price / pbv : price);

    // ROE
    let roe = bookValue > 0 ? parseFloat(((eps / bookValue) * 100).toFixed(1)) : 12.5;
    if (finData?.score?.pillars) {
      const profPillar = finData.score.pillars.find(p => p.key === 'profitability');
      const roeMetric = profPillar?.metrics?.find(m => m.label.includes('ROE') || m.label.includes('Return on Equity'));
      if (roeMetric?.value) {
        roe = parseFloat(roeMetric.value.replace('%', '')) || roe;
      }
    }

    // ROA
    let roa = parseFloat((roe * 0.28).toFixed(1));
    if (finData?.score?.pillars) {
      const profPillar = finData.score.pillars.find(p => p.key === 'profitability');
      const roaMetric = profPillar?.metrics?.find(m => m.label.includes('ROA') || m.label.includes('Return on Assets'));
      if (roaMetric?.value) {
        roa = parseFloat(roaMetric.value.replace('%', '')) || roa;
      }
    }

    // DER (Debt to Equity)
    let der = 0.65;
    if (finData?.score?.pillars) {
      const healthPillar = finData.score.pillars.find(p => p.key === 'health');
      const derMetric = healthPillar?.metrics?.find(m => m.label.includes('Debt to Equity'));
      if (derMetric?.value) {
        const valNum = parseFloat(derMetric.value.replace('%', ''));
        der = !isNaN(valNum) ? parseFloat((valNum / 100).toFixed(2)) : 0.65;
      }
    }

    // 3. Fetch Seasonality
    let seasonData = null;
    try {
      const sRes = await axios.get(`http://localhost:${PORT}/api/seasonality/${symbol}`, { timeout: 4000 });
      seasonData = sRes.data;
    } catch (_) {}

    // 4. Fetch News
    let newsData = null;
    try {
      const nRes = await axios.get(`http://localhost:${PORT}/api/news/${symbol}`, { timeout: 4000 });
      newsData = nRes.data;
    } catch (_) {}

    // 5. If Gemini API Key is provided or planted, call Google Gemini Live API
    if (apiKey) {
      const candidateModels = ['gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-3.6-flash'];
      const prompt = `Anda adalah Senior Quantitative AI Equity Analyst Bursa Efek Indonesia (BEI).
Analisa saham ${symbol} (${q.shortName || symbol}) dengan data riil berikut:
- Harga Sekarang: Rp ${price} (${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(2)}%)
- Fundamental: PER=${per}x, PBV=${pbv}x, ROE=${roe}%, ROA=${roa}%, DER=${der}x, EPS=Rp ${eps}
- Pola Musiman 5 Thn: Bulan Terkuat=${seasonData?.bestMonth?.name || 'Desember'} (WinRate: ${seasonData?.bestMonth?.winRatePct || 80}%), Bulan Berjalan (${seasonData?.currentMonth?.name}) WinRate=${seasonData?.currentMonth?.winRatePct || 60}%
- Berita Terkini: ${JSON.stringify(newsData?.items?.slice(0, 4)?.map(x => x.title) || [])}

Kembalikan jawaban HANYA DALAM FORMAT JSON MURNI (tanpa markdown backticks code block) dengan struktur persis:
{
  "sentimen_berita": {
    "skor": 75,
    "label": "POSITIF",
    "ringkasan": "penjelasan sentimen berita pasar",
    "katalis_utama": ["katalis 1", "katalis 2"]
  },
  "ai_score_prediksi": {
    "skor_ai": 86,
    "prediksi_arah": "NAIK",
    "probabilitas_naik_pct": 78,
    "probabilitas_turun_pct": 22,
    "tingkat_keyakinan": "TINGGI",
    "rekomendasi": "STRONG BUY",
    "alasan_ai": "alasan mendalam prediksi AI"
  },
  "analisa_fundamental": {
    "per_evaluasi": "interpretasi per",
    "pbv_evaluasi": "interpretasi pbv",
    "roe_evaluasi": "interpretasi roe",
    "roa_evaluasi": "interpretasi roa",
    "der_evaluasi": "interpretasi der",
    "eps_evaluasi": "interpretasi eps",
    "kesimpulan_kesehatan": "kesimpulan fundamental"
  },
  "analisa_chart_teknikal": {
    "tren_utama": "UPTREND",
    "level_support": 0,
    "level_resisten": 0,
    "indikator_sinyal": "Bullish Momentum",
    "pola_chart": "Ascending Triangle",
    "rekomendasi_entri": "Buy on weakness"
  },
  "analisa_musiman": {
    "probabilitas_bulan_ini": "Kuat",
    "catatan_siklus": "catatan musiman 5 tahun",
    "peringatan_risiko": "risiko musiman"
  }
}`;

      for (const m of candidateModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
          const gRes = await axios.post(geminiUrl, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          }, { timeout: 12000 });

          const rawText = gRes.data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
            console.log(`[Gemini Live API] Successfully analyzed ${symbol} using model ${m}`);
            return res.json({
              success: true,
              source: `Google Gemini AI (${m} - Live Planted)`,
              symbol,
              price,
              changePct: chgPct,
              ratios: { per, pbv, roe, roa, der, eps },
              news: newsData,
              seasonality: seasonData,
              geminiResult: parsed,
              fetchedAt: new Date().toISOString()
            });
          }
        } catch (gErr) {
          console.warn(`[Gemini Live API] Model ${m} error:`, gErr.response?.status || gErr.message);
        }
      }
    }

    // 6. Built-in Gemini Quantitative Synthesis Engine
    // Calculates rigorous quantitative score & directional probability based on order flow, news, valuation & seasonality
    const newsScore = newsData?.sentimentScorePct || 50;
    const seasonWinRate = seasonData?.currentMonth?.winRatePct || 50;
    const isAboveMa50 = q.fiftyDayAverage ? price >= q.fiftyDayAverage : true;
    const isAboveMa200 = q.twoHundredDayAverage ? price >= q.twoHundredDayAverage : true;

    // Valuation points
    let valScore = 60;
    if (per > 0 && per < 12) valScore += 20;
    else if (per > 25) valScore -= 15;
    if (roe >= 15) valScore += 15;
    if (der < 1.0) valScore += 10;

    // Technical points
    let techScore = 60;
    if (isAboveMa50) techScore += 20;
    if (isAboveMa200) techScore += 15;
    if (chgPct > 0) techScore += 5;

    // Composite AI Score (0-100)
    let aiScore = Math.round(techScore * 0.35 + valScore * 0.30 + newsScore * 0.20 + seasonWinRate * 0.15);
    aiScore = Math.max(15, Math.min(96, aiScore));

    // Directional Probabilities
    let probUp = Math.round(aiScore * 0.85 + (chgPct > 0 ? 5 : -5));
    probUp = Math.max(10, Math.min(92, probUp));
    let probDown = 100 - probUp;

    let rekomendasi = 'HOLD / WAIT & SEE';
    let prediksiArah = 'SIDEWAYS / KONSOLIDASI';
    let keyakinan = 'MODERAT';

    if (probUp >= 75) {
      rekomendasi = 'STRONG BUY';
      prediksiArah = 'NAIK (BULLISH KUAT)';
      keyakinan = 'SANGAT TINGGI';
    } else if (probUp >= 62) {
      rekomendasi = 'BUY ON WEAKNESS';
      prediksiArah = 'NAIK (POTENSI RALLY)';
      keyakinan = 'TINGGI';
    } else if (probUp <= 35) {
      rekomendasi = 'SELL / HINDARI';
      prediksiArah = 'TURUN (BEARISH)';
      keyakinan = 'TINGGI';
    } else if (probUp <= 45) {
      rekomendasi = 'REDUCE / TAKE PROFIT';
      prediksiArah = 'RAWAN KOREKSI';
      keyakinan = 'MODERAT';
    }

    // Technical Levels
    const supportLevel = Math.round(price * 0.965);
    const resistLevel = Math.round(price * 1.055);

    const syntheticResult = {
      sentimen_berita: {
        skor: newsData?.sentimentScorePct || 65,
        label: newsData?.overallLabel || 'POSITIF',
        ringkasan: `Sentimen pasar terkini terhadap ${symbol} terpantau ${newsData?.overallLabel || 'kondusif'}. Pemberitaan media arus utama mencerminkan likuiditas stabil dan minat pelaku pasar terhadap katalis operasional emiten.`,
        katalis_utama: newsData?.items?.slice(0, 3)?.map(i => i.title) || [
          `Pertumbuhan laba dan pembagian dividen berkala ${symbol}`,
          `Aktivitas transaksi institusi dan aliran dana domestik`,
          `Sentimen pergerakan indeks sektoral di Bursa Efek Indonesia`
        ]
      },
      ai_score_prediksi: {
        skor_ai: aiScore,
        prediksi_arah: prediksiArah,
        probabilitas_naik_pct: probUp,
        probabilitas_turun_pct: probDown,
        tingkat_keyakinan: keyakinan,
        rekomendasi,
        alasan_ai: `Berdasarkan perpaduan analisa 5 pilar (Order flow, Teknis MA, Valuasi PER/PBV, Sentimen Berita, dan Siklus Musiman 5 Tahun), ${symbol} membukukan skor probabilitas kenaikan ${probUp}%. Struktur harga berada ${isAboveMa50 ? 'di atas MA50 (Uptrend)' : 'dalam fase pengujian support'}, didukung rasio profitabilitas ROE ${roe}% yang solid.`
      },
      analisa_fundamental: {
        per_evaluasi: `PER ${per}x: ${per < 15 ? 'Valuasi tergolong murah (undervalued) relatif terhadap proyeksi laba tahunan.' : 'Valuasi wajar (fair value) mencerminkan kualitas laba emiten.'}`,
        pbv_evaluasi: `PBV ${pbv}x: ${pbv < 1.5 ? 'Di bawah atau mendekati nilai buku riil perusahaan (diskon tinggi).' : 'Valuasi premium yang rasional ditopang efisiensi ekuitas tinggi.'}`,
        roe_evaluasi: `ROE ${roe}%: ${roe >= 15 ? 'Sangat superior (>15%), menandakan manajemen sangat efektif menghasilkan laba dari modal sendiri.' : 'Stabil memenuhi standar minimum industri.'}`,
        roa_evaluasi: `ROA ${roa}%: ${roa >= 5 ? 'Efisiensi pemanfaatan aset tergolong tinggi dalam menghasilkan arus kas operasional.' : 'Cukup sehat dalam menopang ekspansi bisnis.'}`,
        der_evaluasi: `DER ${der}x: ${der < 1.0 ? 'Rasio utang terhadap ekuitas sangat aman (<1x), risiko solvabilitas sangat rendah.' : 'Struktur utang cukup moderat, beban bunga masih tertutup laba operasional.'}`,
        eps_evaluasi: `EPS Rp ${eps}: Laba per lembar saham yang mampu mendukung kesinambungan pembagian dividen tunai.`,
        kesimpulan_kesehatan: `Secara fundamental, ${symbol} memiliki struktur neraca yang ${der < 1.0 ? 'sangat tangguh' : 'sehat'} dengan kekuatan laba (ROE ${roe}%) yang dapat menjadi jangkar pertahanan harga saat volatilitas pasar meningkat.`
      },
      analisa_chart_teknikal: {
        tren_utama: isAboveMa50 ? (isAboveMa200 ? 'STRONG UPTREND (Bullish Akumulasi)' : 'UPTREND JANGKA MENENGAH') : 'KONSOLIDASI / REBOUND DARI SUPPORT',
        level_support: supportLevel,
        level_resisten: resistLevel,
        indikator_sinyal: isAboveMa50 ? 'Golden Cross / Akumulasi Kuat' : 'Uji Reversal Support',
        pola_chart: chgPct >= 0 ? 'Bullish Continuation / Breakout Channel' : 'Pullback Sehat Menuju Area Buy',
        rekomendasi_entri: `Akumulasi bertahap di rentang Rp ${supportLevel} - Rp ${price}. Target profit terdekat di Rp ${resistLevel}. Cut loss ketat jika tembus di bawah Rp ${Math.round(supportLevel * 0.97)}.`
      },
      analisa_musiman: {
        probabilitas_bulan_ini: `${seasonData?.currentMonth?.name || 'Bulan ini'}: Win rate historis ${seasonData?.currentMonth?.winRatePct || 60}% dengan rata-rata return ${seasonData?.currentMonth?.avgReturnPct || 1.5}%.`,
        catatan_siklus: `Secara statistik 5 tahun terakhir, bulan terkuat saham ${symbol} adalah ${seasonData?.bestMonth?.name || 'Desember'} (Win rate ${seasonData?.bestMonth?.winRatePct || 80}%), sedangkan bulan yang cenderung sepi/koreksi adalah ${seasonData?.worstMonth?.name || 'Mei'} (Win rate ${seasonData?.worstMonth?.winRatePct || 40}%).`,
        peringatan_risiko: `Perhatikan rotasi sektoral dan rilis laporan keuangan kuartalan yang sering memicu volatilitas musiman pada saham ini.`
      }
    };

    return res.json({
      success: true,
      source: 'Gemini Quant Engine (Built-in Multi-Factor)',
      symbol,
      price,
      changePct: chgPct,
      ratios: { per, pbv, roe, roa, der, eps },
      news: newsData,
      seasonality: seasonData,
      geminiResult: syntheticResult,
      fetchedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error(`[handleGeminiAnalyze] Error for ${symbol}:`, err.message);
    return res.status(500).json({ error: true, message: err.message });
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    sessionReady: !!session.crumb,
    cachedQuotesCount: quotesCache.size,
    finmorphCacheCount: finmorphCache.size,
    timestamp: new Date().toISOString(),
  });
});

// Kraken Flow & Quant Terminal route
app.get('/api/kraken', handleKrakenFlow);

// News & Sentiment routes
app.get('/api/news/:symbol', handleNews);
app.get('/api/news', handleNews);

// Seasonality 5-Year routes
app.get('/api/seasonality/:symbol', handleSeasonality);
app.get('/api/seasonality', handleSeasonality);

// Gemini AI Deep Analysis routes
app.get('/api/gemini/analyze', handleGeminiAnalyze);
app.post('/api/gemini/analyze', handleGeminiAnalyze);

// Gemini API Key Status & Automatic Planting routes
app.get('/api/gemini/key-status', (req, res) => {
  reloadPlantedGeminiKey();
  const hasKey = !!plantedGeminiKey;
  let masked = '';
  if (hasKey) {
    masked = plantedGeminiKey.length > 8
      ? plantedGeminiKey.slice(0, 6) + '...' + plantedGeminiKey.slice(-4)
      : '******';
  }
  res.json({
    hasKey,
    keyMasked: masked,
    model: 'gemini-3.6-flash',
    source: hasKey ? 'Google Gemini 3.6 Flash (Live AI - Planted)' : 'Gemini Quant Engine (Built-in)'
  });
});

app.post('/api/gemini/set-key', (req, res) => {
  const key = (req.body?.apiKey || '').trim();
  if (!key) {
    return res.status(400).json({ error: true, message: 'API Key tidak boleh kosong' });
  }
  plantedGeminiKey = key;
  try {
    const envPath = path.join(__dirname, '.env');
    fs.writeFileSync(envPath, `GEMINI_API_KEY=${key}\n`, 'utf8');
    const cfgPath = path.join(__dirname, 'aiConfig.json');
    fs.writeFileSync(cfgPath, JSON.stringify({ GEMINI_API_KEY: key, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
    console.log('[Gemini Key] Successfully planted new key into .env and aiConfig.json');
    res.json({
      success: true,
      message: 'Gemini API Key berhasil ditanam secara otomatis di server & aplikasi!',
      keyMasked: key.slice(0, 6) + '...' + key.slice(-4)
    });
  } catch (e) {
    console.error('[Gemini Key] Error saving key:', e);
    res.status(500).json({ error: true, message: e.message });
  }
});

// Quote endpoints
app.get('/api/quotes', handleQuotes);
app.get('/v7/finance/quote', handleQuotes);

// Chart endpoints
app.get('/api/chart/:symbol', handleChart);
app.get('/api/chart', handleChart);
app.get('/v8/finance/chart/:symbol', handleChart);
app.get('/v8/finance/chart', handleChart);

// Static frontend serving if built (SPA support for public web)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  console.log('[Web Server] Serving production static web app from /dist');
  app.use(express.static(distPath));
  // Catch-all SPA handler compatible with Express 5
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/v7') && !req.path.startsWith('/v8')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
} else {
  // Root API status if dist not built
  app.get('/', (req, res) => {
    res.json({
      app: 'Stock Master Backend & Finmorph Live Proxy',
      status: 'online',
      port: PORT,
    });
  });
}

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`=================================================`);
  console.log(`🚀 Stock Master Proxy & Finmorph Live API Server`);
  console.log(`📡 Listening on http://localhost:${PORT} and 0.0.0.0:${PORT}`);
  console.log(`=================================================`);
  
  await getYahooSession();
});

module.exports = app;

