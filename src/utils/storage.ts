import AsyncStorage from '@react-native-async-storage/async-storage';

const WATCHLIST_KEY = '@stock_master_watchlist';
const PORTFOLIO_KEY = '@stock_master_portfolio';
const LOGS_KEY = '@stock_master_logs';

export const getWatchlist = async (): Promise<string[]> => {
  try {
    const data = await AsyncStorage.getItem(WATCHLIST_KEY);
    return data ? JSON.parse(data) : ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'GOTO'];
  } catch (e) {
    return [];
  }
};

export const saveWatchlist = async (tickers: string[]) => {
  try {
    await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(tickers));
  } catch (e) {
    console.error('Error saving watchlist', e);
  }
};

export const getPortfolio = async (): Promise<string[]> => {
  try {
    const data = await AsyncStorage.getItem(PORTFOLIO_KEY);
    return data ? JSON.parse(data) : ['BBRI', 'BMRI', 'BBCA', 'BBNI', 'ASII', 'TLKM', 'GOTO', 'UNVR', 'BRIS', 'ANTM', 'ADRO', 'PTBA', 'DEWA', 'BUMI', 'BRMS'];
  } catch (e) {
    return [];
  }
};

export const savePortfolio = async (tickers: string[]) => {
  try {
    await AsyncStorage.setItem(PORTFOLIO_KEY, JSON.stringify(tickers));
  } catch (e) {
    console.error('Error saving portfolio', e);
  }
};

export interface TransactionLog {
  id: string;
  date: string;
  ticker: string;
  action: 'BUY' | 'SELL';
  lot: number;
  price: number;
}

export const getLogs = async (): Promise<TransactionLog[]> => {
  try {
    const data = await AsyncStorage.getItem(LOGS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveLogs = async (logs: TransactionLog[]) => {
  try {
    await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('Error saving logs', e);
  }
};
