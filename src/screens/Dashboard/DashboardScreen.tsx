import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Platform } from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';
import { fetchQuotes, YFQuote } from '../../utils/yfinance';
import { formatRupiah, formatPercent } from '../../utils/formatters';

const WATCH_LEADERS = ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'GOTO', 'AMMN'];

const LEADER_INFO: Record<string, { name: string; sector: string }> = {
  BBCA: { name: 'Bank Central Asia', sector: 'Financials' },
  BBRI: { name: 'Bank Rakyat Indonesia', sector: 'Financials' },
  BMRI: { name: 'Bank Mandiri', sector: 'Financials' },
  BBNI: { name: 'Bank Negara Indonesia', sector: 'Financials' },
  TLKM: { name: 'Telkom Indonesia', sector: 'Infrastructure' },
  ASII: { name: 'Astra International', sector: 'Conglomerate' },
  GOTO: { name: 'GoTo Gojek Tokopedia', sector: 'Technology' },
  AMMN: { name: 'Amman Mineral', sector: 'Basic Materials' },
};

export default function DashboardScreen({ navigation }: any) {
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
      setLastUpdated(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e) {
      console.error('[DashboardScreen] Error loading data:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const renderMacroCard = (
    title: string, 
    icon: string, 
    quote?: YFQuote, 
    isCurrency = false, 
    invertColor = false
  ) => {
    const price = quote?.regularMarketPrice || 0;
    const chg = quote?.regularMarketChangePercent || 0;
    const isUp = chg >= 0;
    
    // Invert for USD/IDR: Rupiah weakening is bearish for IHSG
    let isPositive = isUp;
    if (invertColor) isPositive = !isUp;

    const accentColor = isPositive ? COLORS.success : COLORS.danger;
    const badgeBg = isPositive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)';
    const badgeBorder = isPositive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)';

    // High/Low range visual ratio
    const high = quote?.regularMarketDayHigh || price;
    const low = quote?.regularMarketDayLow || price;
    const rangeSpan = high - low;
    const currentProgress = rangeSpan > 0 ? Math.min(Math.max((price - low) / rangeSpan, 0.05), 0.95) : 0.5;

    return (
      <View style={[styles.macroCardWrapper]}>
        <View style={styles.macroCard}>
          <View style={styles.macroHeader}>
            <View style={styles.macroTitleGroup}>
              <Text style={styles.macroIcon}>{icon}</Text>
              <Text style={styles.macroTitle}>{title}</Text>
            </View>
            <View style={[styles.chgBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
              <Text style={[styles.chgBadgeText, { color: accentColor }]}>
                {isUp ? '▲' : '▼'} {formatPercent(chg)}
              </Text>
            </View>
          </View>

          <Text style={styles.macroPrice}>
            {price > 0 ? (isCurrency ? formatRupiah(price) : price.toLocaleString('id-ID', { maximumFractionDigits: 2 })) : '—'}
          </Text>

          {/* Range High-Low visual indicator */}
          {high > low && (
            <View style={styles.rangeContainer}>
              <View style={styles.rangeTrack}>
                <View style={[styles.rangeFill, { left: `${currentProgress * 100}%`, backgroundColor: accentColor }]} />
              </View>
              <View style={styles.rangeLabels}>
                <Text style={styles.rangeText}>L: {Math.round(low).toLocaleString('id-ID')}</Text>
                <Text style={styles.rangeText}>H: {Math.round(high).toLocaleString('id-ID')}</Text>
              </View>
            </View>
          )}
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
        bgGlow: 'rgba(16, 185, 129, 0.12)',
        borderColor: 'rgba(16, 185, 129, 0.4)',
        summary: 'Wall Street Menguat & Rupiah Menguat',
        text: 'Sentimen global sangat kondusif. Aliran dana asing berpotensi masuk ke IHSG. Momentum optimal untuk swing trade & akumulasi saham leading.',
      };
    }
    if (snpUp && usdUp) {
      return {
        badge: '🟡 MIXED MOMENTUM',
        color: COLORS.warning,
        bgGlow: 'rgba(245, 158, 11, 0.12)',
        borderColor: 'rgba(245, 158, 11, 0.4)',
        summary: 'Wall Street Hijau tapi Rupiah Melemah',
        text: 'Pasar cenderung selektif. Fokus pada rotasi saham berbasis komoditas ekspor atau saham perbankan berfundamental kuat.',
      };
    }
    if (!snpUp && usdUp) {
      return {
        badge: '🔻 STRONG BEARISH',
        color: COLORS.danger,
        bgGlow: 'rgba(244, 63, 94, 0.12)',
        borderColor: 'rgba(244, 63, 94, 0.4)',
        summary: 'Global Tertekan & Rupiah Melemah',
        text: 'Tekanan makro eksternal tinggi. Batasi posisi trading, amankan profit, disiplin stop loss ketat, dan perbanyak cash reserve.',
      };
    }
    if (ihsgPrice < ihsgMa50 && ihsgMa50 > 0) {
      return {
        badge: '⚠️ DOWNTREND ALERT',
        color: COLORS.warning,
        bgGlow: 'rgba(245, 158, 11, 0.12)',
        borderColor: 'rgba(245, 158, 11, 0.4)',
        summary: 'IHSG di Bawah Rata-Rata MA50',
        text: 'IHSG berada dalam fase konsolidasi/koreksi teknikal. Disarankan scalping kilat atau buy on weakness di area support kuat.',
      };
    }
    return {
      badge: '⚖️ KONSOLIDASI',
      color: '#38BDF8',
      bgGlow: 'rgba(56, 189, 248, 0.12)',
      borderColor: 'rgba(56, 189, 248, 0.4)',
      summary: 'Pasar Bergerak Sideways',
      text: 'Volatilitas pasar cenderung netral. Tunggu konfirmasi lonjakan volume transaksi pada breakout saham penggerak.',
    };
  };

  const pred = getPrediction();

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={COLORS.cyan} />}
    >
      {/* Top Header Command Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.pageTitle}>Dashboard Pasar</Text>
          <Text style={styles.pageSubtitle}>Pantauan Makro Global, IHSG & Big Caps</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadData} activeOpacity={0.8}>
          <Text style={styles.refreshIcon}>🔄</Text>
          <Text style={styles.refreshText}>{lastUpdated || 'Segarkan'}</Text>
        </TouchableOpacity>
      </View>

      {/* Hero 3-Pillar Macro Analysis Command Center */}
      <View style={[styles.heroCard, { backgroundColor: pred.bgGlow, borderColor: pred.borderColor }]}>
        <View style={styles.heroTop}>
          <View style={styles.heroTagRow}>
            <View style={[styles.statusBadge, { borderColor: pred.borderColor }]}>
              <Text style={[styles.statusBadgeText, { color: pred.color }]}>{pred.badge}</Text>
            </View>
            <View style={styles.algoPill}>
              <Text style={styles.algoPillText}>Sistem 3 Pilar Quant</Text>
            </View>
          </View>
          <Text style={styles.heroSummary}>{pred.summary}</Text>
        </View>
        <Text style={styles.heroDescription}>{pred.text}</Text>
      </View>

      {/* Macro Indicators 2x2 Grid */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionIcon}>📊</Text>
        <Text style={styles.sectionTitle}>Indikator Pasar Global & Valuta</Text>
      </View>
      <View style={styles.macroGrid}>
        {renderMacroCard('IHSG', '🇮🇩', macroData.ihsg)}
        {renderMacroCard('USD / IDR', '💵', macroData.usdidr, true, true)}
        {renderMacroCard('S&P 500', '🇺🇸', macroData.snp)}
        {renderMacroCard('Emas', '🪙', macroData.gold)}
      </View>

      {/* Market Leaders LQ45 Section */}
      <View style={[styles.sectionHeader, { marginTop: 12 }]}>
        <Text style={styles.sectionIcon}>🏛️</Text>
        <Text style={styles.sectionTitle}>Saham Market Leaders (LQ45 Penggerak)</Text>
      </View>
      
      <View style={styles.leadersCard}>
        {WATCH_LEADERS.map((ticker, idx) => {
          const q = leadersData[ticker];
          const info = LEADER_INFO[ticker] || { name: q?.shortName || ticker, sector: 'IDX' };
          const price = q?.regularMarketPrice || 0;
          const chg = q?.regularMarketChangePercent || 0;
          const isUp = chg >= 0;

          return (
            <TouchableOpacity 
              key={ticker} 
              style={[styles.leaderRow, idx === WATCH_LEADERS.length - 1 && styles.leaderRowLast]}
              activeOpacity={0.7}
              onPress={() => {
                if (navigation) {
                  navigation.navigate('Analysis', { ticker });
                }
              }}
            >
              <View style={styles.leaderLeft}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{idx + 1}</Text>
                </View>
                <View>
                  <View style={styles.tickerRow}>
                    <Text style={styles.leaderTicker}>{ticker}</Text>
                    <View style={styles.sectorBadge}>
                      <Text style={styles.sectorText}>{info.sector}</Text>
                    </View>
                  </View>
                  <Text style={styles.leaderName} numberOfLines={1}>{info.name}</Text>
                </View>
              </View>

              <View style={styles.leaderRight}>
                <Text style={styles.leaderPrice}>
                  {price > 0 ? formatRupiah(price) : '—'}
                </Text>
                <View style={[
                  styles.leaderChgPill, 
                  { backgroundColor: isUp ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)' }
                ]}>
                  <Text style={[styles.leaderChgText, { color: isUp ? COLORS.success : COLORS.danger }]}>
                    {isUp ? '▲' : '▼'} {formatPercent(chg)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
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
  contentContainer: {
    padding: SIZES.padding,
    paddingBottom: 36,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pageTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pageSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    gap: 6,
  },
  refreshIcon: {
    fontSize: 12,
  },
  refreshText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  heroCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 20,
    ...SHADOWS.card,
  },
  heroTop: {
    marginBottom: 8,
  },
  heroTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  algoPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  algoPillText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '600',
  },
  heroSummary: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  heroDescription: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionIcon: {
    fontSize: 15,
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 16,
  },
  macroCardWrapper: {
    width: '50%',
    padding: 6,
  },
  macroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    minHeight: 112,
    justifyContent: 'space-between',
    ...SHADOWS.card,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  macroTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  macroIcon: {
    fontSize: 14,
  },
  macroTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  chgBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  chgBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  macroPrice: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginVertical: 4,
  },
  rangeContainer: {
    marginTop: 4,
  },
  rangeTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    position: 'relative',
    overflow: 'visible',
  },
  rangeFill: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    top: -1,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  rangeText: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '600',
  },
  leadersCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  leaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  leaderRowLast: {
    borderBottomWidth: 0,
  },
  leaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  tickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leaderTicker: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sectorBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  sectorText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '600',
  },
  leaderName: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
    maxWidth: 180,
  },
  leaderRight: {
    alignItems: 'flex-end',
  },
  leaderPrice: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  leaderChgPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
    marginTop: 3,
  },
  leaderChgText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
