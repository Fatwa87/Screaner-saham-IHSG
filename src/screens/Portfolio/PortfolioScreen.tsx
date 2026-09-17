import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Alert } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';
import { getPortfolio, savePortfolio, getWatchlist, saveWatchlist } from '../../utils/storage';
import { fetchQuotes, YFQuote } from '../../utils/yfinance';
import { formatPercent, formatRupiah } from '../../utils/formatters';

export default function PortfolioScreen() {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'watchlist'>('portfolio');
  const [loading, setLoading] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, YFQuote>>({});
  const [list, setList] = useState<string[]>([]);
  const [newTicker, setNewTicker] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const tickers = activeTab === 'portfolio' ? await getPortfolio() : await getWatchlist();
      setList(tickers);
      
      if (tickers.length > 0) {
        const q = await fetchQuotes(tickers);
        setQuotes(q);
      }
    } catch (e) {
      console.error('[PortfolioScreen] Error loading:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleAddStock = async () => {
    const sym = newTicker.toUpperCase().trim();
    if (!sym) return;
    if (list.includes(sym)) {
      setNewTicker('');
      return;
    }

    const updated = [sym, ...list];
    setList(updated);
    setNewTicker('');

    if (activeTab === 'portfolio') {
      await savePortfolio(updated);
    } else {
      await saveWatchlist(updated);
    }

    // Fetch quote for newly added stock
    const newQ = await fetchQuotes([sym]);
    setQuotes(prev => ({ ...prev, ...newQ }));
  };

  const handleRemoveStock = async (tickerToRemove: string) => {
    const updated = list.filter(t => t !== tickerToRemove);
    setList(updated);

    if (activeTab === 'portfolio') {
      await savePortfolio(updated);
    } else {
      await saveWatchlist(updated);
    }
  };

  const renderTab = (type: 'portfolio' | 'watchlist', label: string) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === type && styles.tabActive]}
      onPress={() => setActiveTab(type)}
    >
      <Text style={[styles.tabText, activeTab === type && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderItem = (ticker: string) => {
    const q = quotes[ticker] || quotes[`${ticker}.JK`];
    const price = q?.regularMarketPrice || 0;
    const chg = q?.regularMarketChangePercent || 0;
    const isUp = chg >= 0;

    return (
      <View key={ticker} style={styles.card}>
        <View style={styles.leftInfo}>
          <Text style={styles.ticker}>{ticker}</Text>
          <Text style={styles.name} numberOfLines={1}>{q?.shortName || q?.longName || ticker}</Text>
          {q?.regularMarketDayHigh ? (
            <Text style={styles.dayRange}>
              H: {Math.round(q.regularMarketDayHigh)} | L: {Math.round(q.regularMarketDayLow)}
            </Text>
          ) : null}
        </View>

        <View style={styles.rightInfo}>
          <Text style={styles.price}>{price > 0 ? formatRupiah(price) : '—'}</Text>
          <View style={[styles.badge, { backgroundColor: isUp ? '#064E3B' : '#7F1D1D' }]}>
            <Text style={[styles.badgeText, { color: isUp ? '#34D399' : '#F87171' }]}>
              {isUp ? '▲' : '▼'} {formatPercent(chg)}
            </Text>
          </View>
          <TouchableOpacity onPress={() => handleRemoveStock(ticker)} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>Hapus</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {renderTab('portfolio', 'Portfolio Saya')}
        {renderTab('watchlist', 'Watchlist Pantauan')}
      </View>

      {/* Add Stock Bar */}
      <View style={styles.addBar}>
        <TextInput
          style={styles.addInput}
          placeholder="Tambah Saham (cth: INCO, PTBA)..."
          placeholderTextColor={COLORS.textMuted}
          value={newTicker}
          onChangeText={setNewTicker}
          autoCapitalize="characters"
          onSubmitEditing={handleAddStock}
        />
        <TouchableOpacity style={styles.addBtn} onPress={handleAddStock}>
          <Text style={styles.addBtnText}>+ Tambah</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Banner */}
      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryLabel}>Total Saham Dipantau</Text>
          <Text style={styles.summaryCount}>{list.length} Emiten</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
          <Text style={styles.refreshText}>🔄 Refresh Harga</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Mengambil data harga pasar terkini...</Text>
        </View>
      ) : (
        <ScrollView style={styles.listContainer}>
          {list.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Daftar Masih Kosong</Text>
              <Text style={styles.emptySub}>Tambahkan kode saham di atas untuk mulai memantau portofolio Anda.</Text>
            </View>
          ) : (
            list.map(t => renderItem(t))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabsContainer: {
    flexDirection: 'row',
    padding: SIZES.padding / 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 6,
    backgroundColor: COLORS.surfaceLight,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.textMuted,
    fontWeight: 'bold',
    fontSize: SIZES.font * 0.9,
  },
  tabTextActive: {
    color: COLORS.background,
  },
  addBar: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.padding,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  addInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    color: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: SIZES.font * 0.9,
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
    marginLeft: 8,
  },
  addBtnText: {
    color: COLORS.background,
    fontWeight: 'bold',
    fontSize: SIZES.font * 0.85,
  },
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: 12,
    backgroundColor: COLORS.surfaceLight,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  summaryLabel: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
  },
  summaryCount: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.1,
    fontWeight: 'bold',
  },
  refreshBtn: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  refreshText: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    color: COLORS.textMuted,
    marginTop: 12,
  },
  listContainer: {
    padding: SIZES.padding,
  },
  emptyState: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.1,
    fontWeight: 'bold',
  },
  emptySub: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.85,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  leftInfo: {
    flex: 1,
    marginRight: 10,
  },
  ticker: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.25,
    fontWeight: '900',
  },
  name: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.85,
    marginTop: 3,
  },
  dayRange: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
    marginTop: 4,
  },
  rightInfo: {
    alignItems: 'flex-end',
  },
  price: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  badgeText: {
    fontWeight: 'bold',
    fontSize: SIZES.font * 0.8,
  },
  deleteBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  deleteText: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
  },
});
