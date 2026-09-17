import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';
import { fetchQuotes, YFQuote } from '../../utils/yfinance';
import { formatRupiah, formatPercent } from '../../utils/formatters';

const WATCH_LEADERS = ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'GOTO', 'AMMN'];

export default function DashboardScreen() {
  const [macroData, setMacroData] = useState<{ ihsg?: YFQuote; usdidr?: YFQuote; snp?: YFQuote; gold?: YFQuote }>({});
  const [leadersData, setLeadersData] = useState<Record<string, YFQuote>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const allQuotes = await fetchQuotes(['^JKSE', 'IDR=X', '^GSPC', 'GC=F', ...WATCH_LEADERS]);
      setMacroData({
        ihsg: allQuotes['^JKSE'],
        usdidr: allQuotes['IDR=X'],
        snp: allQuotes['^GSPC'],
        gold: allQuotes['GC=F'],
      });

      const leaders: Record<string, YFQuote> = {};
      WATCH_LEADERS.forEach(t => {
        if (allQuotes[t]) leaders[t] = allQuotes[t];
      });
      setLeadersData(leaders);
      setLastUpdated(new Date().toLocaleTimeString('id-ID'));
    } catch (e) {
      console.error('Error loading dashboard data:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const renderMacroCard = (title: string, quote?: YFQuote, isCurrency = false, invertColor = false) => {
    const price = quote?.regularMarketPrice || 0;
    const chg = quote?.regularMarketChangePercent || 0;
    const isUp = chg >= 0;
    
    // Invert for USD/IDR: Rupiah weakening is bearish (danger)
    let color = isUp ? COLORS.success : COLORS.danger;
    if (invertColor) color = isUp ? COLORS.danger : COLORS.success;

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardPrice}>
          {price > 0 ? (isCurrency ? formatRupiah(price) : price.toLocaleString('id-ID', { maximumFractionDigits: 2 })) : '—'}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={[styles.cardChg, { color }]}>
            {isUp ? '▲' : '▼'} {formatPercent(chg)}
          </Text>
          {quote?.regularMarketDayHigh ? (
            <Text style={styles.cardRange}>
              H: {Math.round(quote.regularMarketDayHigh)} L: {Math.round(quote.regularMarketDayLow)}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  const getPrediction = () => {
    const snpUp = (macroData.snp?.regularMarketChangePercent || 0) > 0;
    const usdUp = (macroData.usdidr?.regularMarketChangePercent || 0) > 0;
    const ihsgPrice = macroData.ihsg?.regularMarketPrice || 0;
    const ihsgMa50 = macroData.ihsg?.fiftyDayAverage || 0;

    if (snpUp && !usdUp) {
      return {
        badge: '🚀 STRONG BULLISH',
        color: COLORS.success,
        text: 'Kondisi Sempurna: Wall Street menguat dan Rupiah apresiasi. Momentum akumulasi & swing trade maksimal!',
      };
    }
    if (snpUp && usdUp) {
      return {
        badge: '🟡 MIXED MOMENTUM',
        color: COLORS.warning,
        text: 'Wall Street naik namun Rupiah melemah. IHSG cenderung selective dan rotasi sektor.',
      };
    }
    if (!snpUp && usdUp) {
      return {
        badge: '🔻 STRONG BEARISH',
        color: COLORS.danger,
        text: 'Kondisi Bahaya: Tekanan global meningkat, Rupiah depresiasi. Disiplin cut loss & perbanyak cash!',
      };
    }
    if (ihsgPrice < ihsgMa50 && ihsgMa50 > 0) {
      return {
        badge: '⚠️ DOWNTREND ALERT',
        color: COLORS.warning,
        text: 'IHSG berada di bawah MA50. Fokus pada scalping cepat atau tunggu rebound di area support.',
      };
    }
    return {
      badge: '🟡 KONSOLIDASI',
      color: COLORS.primary,
      text: 'Pasar bergerak sideways. Tunggu konfirmasi volume breakout pada saham leading.',
    };
  };

  const pred = getPrediction();

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={COLORS.primary} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>STOCK MASTER v3.6</Text>
          <Text style={styles.subtitle}>Makro, IHSG & Market Dashboard</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
          <Text style={styles.refreshText}>🔄 {lastUpdated || 'Refresh'}</Text>
        </TouchableOpacity>
      </View>

      {/* 3-Pillar Macro Analysis Box */}
      <View style={[styles.predictionBox, { borderColor: pred.color }]}>
        <View style={styles.badgeContainer}>
          <Text style={[styles.predictionBadge, { color: pred.color }]}>{pred.badge}</Text>
          <Text style={styles.pilarTag}>Sistem 3 Pilar</Text>
        </View>
        <Text style={styles.predictionText}>{pred.text}</Text>
      </View>

      {/* Macro Indicators Grid */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Indikator Pasar Global & Valuta</Text>
      </View>
      <View style={styles.grid}>
        {renderMacroCard('IHSG (Composite)', macroData.ihsg)}
        {renderMacroCard('USD / IDR', macroData.usdidr, true, true)}
        {renderMacroCard('S&P 500', macroData.snp)}
        {renderMacroCard('Emas (Gold)', macroData.gold)}
      </View>

      {/* Market Leaders Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Saham Market Leaders (LQ45)</Text>
      </View>
      <View style={styles.leadersList}>
        {WATCH_LEADERS.map(ticker => {
          const q = leadersData[ticker];
          const price = q?.regularMarketPrice || 0;
          const chg = q?.regularMarketChangePercent || 0;
          const isUp = chg >= 0;

          return (
            <View key={ticker} style={styles.leaderRow}>
              <View>
                <Text style={styles.leaderTicker}>{ticker}</Text>
                <Text style={styles.leaderName}>{q?.shortName || ticker}</Text>
              </View>
              <View style={styles.leaderRight}>
                <Text style={styles.leaderPrice}>{price > 0 ? formatRupiah(price) : '—'}</Text>
                <Text style={[styles.leaderChg, { color: isUp ? COLORS.success : COLORS.danger }]}>
                  {formatPercent(chg)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: SIZES.padding,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: COLORS.primary,
    fontSize: SIZES.font * 1.4,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.85,
    marginTop: 2,
  },
  refreshBtn: {
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  refreshText: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.8,
  },
  predictionBox: {
    margin: SIZES.padding,
    padding: SIZES.padding,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    borderWidth: 1.5,
  },
  badgeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  predictionBadge: {
    fontSize: SIZES.font * 1.15,
    fontWeight: 'bold',
  },
  pilarTag: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  predictionText: {
    color: COLORS.text,
    fontSize: SIZES.font * 0.95,
    lineHeight: 22,
  },
  sectionHeader: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding / 2,
    paddingBottom: 8,
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SIZES.padding / 2,
  },
  card: {
    width: '50%',
    padding: SIZES.padding / 2,
  },
  cardTitle: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.85,
    marginBottom: 4,
  },
  cardPrice: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.3,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardChg: {
    fontSize: SIZES.font * 0.9,
    fontWeight: 'bold',
  },
  cardRange: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.7,
  },
  leadersList: {
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.padding * 2,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  leaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  leaderTicker: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.05,
    fontWeight: 'bold',
  },
  leaderName: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.8,
    marginTop: 2,
  },
  leaderRight: {
    alignItems: 'flex-end',
  },
  leaderPrice: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.05,
    fontWeight: 'bold',
  },
  leaderChg: {
    fontSize: SIZES.font * 0.85,
    fontWeight: 'bold',
    marginTop: 2,
  },
});
