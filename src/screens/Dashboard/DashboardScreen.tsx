import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Platform } from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';
import { fetchQuotes, YFQuote } from '../../utils/yfinance';
import { formatRupiah, formatPercent } from '../../utils/formatters';
import { calculateMacroAnalysis, MacroAnalysisResult, MacroPillar } from '../../utils/macroEngine';

const ALL_MACRO_TICKERS = [
  '^JKSE',    // IHSG
  'IDR=X',    // USD / IDR
  'DX-Y.NYB', // US Dollar Index (DXY)
  '^TNX',     // US 10-Year Treasury Yield
  '^GSPC',    // S&P 500
  '^N225',    // Nikkei 225
  '^HSI',     // Hang Seng Index
  '^VIX',     // CBOE Volatility Index
  'GC=F',     // Emas (Gold)
  'CL=F',     // Minyak Mentah (Crude Oil WTI)
  'BBCA', 'BBRI', 'BMRI', 'BBNI', // Big 4 Banks
  'TLKM', 'ASII', 'GOTO', 'AMMN'  // Other Market Leaders
];

const WATCH_LEADERS = ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'GOTO', 'AMMN'];

const LEADER_INFO: Record<string, { name: string; sector: string }> = {
  BBCA: { name: 'Bank Central Asia', sector: 'Financials (Big 4)' },
  BBRI: { name: 'Bank Rakyat Indonesia', sector: 'Financials (Big 4)' },
  BMRI: { name: 'Bank Mandiri', sector: 'Financials (Big 4)' },
  BBNI: { name: 'Bank Negara Indonesia', sector: 'Financials (Big 4)' },
  TLKM: { name: 'Telkom Indonesia', sector: 'Infrastructure' },
  ASII: { name: 'Astra International', sector: 'Conglomerate' },
  GOTO: { name: 'GoTo Gojek Tokopedia', sector: 'Technology' },
  AMMN: { name: 'Amman Mineral', sector: 'Basic Materials' },
};

type MacroCategory = 'semua' | 'valuta' | 'global' | 'komoditas';

export default function DashboardScreen({ navigation }: any) {
  const [quotesMap, setQuotesMap] = useState<Record<string, YFQuote>>({});
  const [macroAnalysis, setMacroAnalysis] = useState<MacroAnalysisResult | null>(null);
  const [activeCategory, setActiveCategory] = useState<MacroCategory>('semua');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const allQuotes = await fetchQuotes(ALL_MACRO_TICKERS);
      setQuotesMap(allQuotes);
      
      const analysis = calculateMacroAnalysis(allQuotes);
      setMacroAnalysis(analysis);

      setLastUpdated(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e) {
      console.error('[DashboardScreen] Error loading macro data:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const renderMacroCard = (
    title: string, 
    icon: string, 
    tickerKey: string,
    isCurrency = false, 
    invertColor = false,
    unitSuffix = ''
  ) => {
    const quote = quotesMap[tickerKey];
    const price = quote?.regularMarketPrice || 0;
    const chg = quote?.regularMarketChangePercent || 0;
    const isUp = chg >= 0;
    
    // Invert for USD/IDR or VIX: increases are bearish for IHSG
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
      <View key={tickerKey} style={styles.macroCardWrapper}>
        <View style={styles.macroCard}>
          <View style={styles.macroHeader}>
            <View style={styles.macroTitleGroup}>
              <Text style={styles.macroIcon}>{icon}</Text>
              <Text style={styles.macroTitle} numberOfLines={1}>{title}</Text>
            </View>
            <View style={[styles.chgBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
              <Text style={[styles.chgBadgeText, { color: accentColor }]}>
                {isUp ? '▲' : '▼'} {formatPercent(chg)}
              </Text>
            </View>
          </View>

          <Text style={styles.macroPrice}>
            {price > 0 
              ? (isCurrency ? formatRupiah(price) : `${price.toLocaleString('id-ID', { maximumFractionDigits: 2 })}${unitSuffix}`)
              : '—'}
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

  const renderPillarCard = (pillar: MacroPillar) => {
    return (
      <View key={pillar.name} style={styles.pillarCardWrapper}>
        <View style={styles.pillarCard}>
          <View style={styles.pillarHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pillarName}>{pillar.name}</Text>
              <Text style={styles.pillarWeight}>Bobot {pillar.weight}%</Text>
            </View>
            <View style={[styles.pillarScoreBadge, { borderColor: pillar.color, backgroundColor: `${pillar.color}15` }]}>
              <Text style={[styles.pillarScoreText, { color: pillar.color }]}>
                {pillar.score}/100
              </Text>
            </View>
          </View>
          <View style={[styles.pillarStatusTag, { backgroundColor: `${pillar.color}20` }]}>
            <Text style={[styles.pillarStatusText, { color: pillar.color }]}>{pillar.status}</Text>
          </View>
          <Text style={styles.pillarSummary}>{pillar.summary}</Text>
          <Text style={styles.pillarDetail} numberOfLines={3}>{pillar.detail}</Text>
        </View>
      </View>
    );
  };

  const regime = macroAnalysis?.regime;
  const levels = macroAnalysis?.ihsgLevels;
  const rotation = macroAnalysis?.sectorRotation;
  const banksHealth = macroAnalysis?.bigBanksHealth;

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={COLORS.cyan} />}
    >
      {/* Top Header Command Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.pageTitle}>Dashboard Makro IHSG</Text>
          <Text style={styles.pageSubtitle}>Model Kuantitatif 4 Pilar Institusional</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadData} activeOpacity={0.8}>
          <Text style={styles.refreshIcon}>🔄</Text>
          <Text style={styles.refreshText}>{lastUpdated || 'Segarkan'}</Text>
        </TouchableOpacity>
      </View>

      {/* 1. HERO INSTITUTIONAL MACRO COMPOSITE SCORE CARD */}
      {regime && (
        <View style={[styles.heroCard, { backgroundColor: regime.bgGlow, borderColor: regime.borderColor }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroScoreGroup}>
              <View style={[styles.compositeScoreCircle, { borderColor: regime.color }]}>
                <Text style={[styles.compositeScoreValue, { color: regime.color }]}>
                  {macroAnalysis?.compositeScore}
                </Text>
                <Text style={styles.compositeScoreMax}>/100</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.heroTagRow}>
                  <View style={[styles.statusBadge, { borderColor: regime.borderColor }]}>
                    <Text style={[styles.statusBadgeText, { color: regime.color }]}>{regime.badge}</Text>
                  </View>
                </View>
                <Text style={styles.heroRegimeTitle}>{regime.title}</Text>
                <Text style={styles.heroSummary}>{regime.summary}</Text>
              </View>
            </View>
          </View>

          {/* Actionable Allocation & Strategy Box */}
          <View style={styles.actionPlanBox}>
            <View style={styles.actionPlanRow}>
              <View style={styles.allocationPill}>
                <Text style={styles.allocationPillText}>💼 {regime.allocation}</Text>
              </View>
              <View style={styles.strategyPill}>
                <Text style={styles.strategyPillText}>⚡ {regime.strategy}</Text>
              </View>
            </View>
            <Text style={styles.heroDescription}>{regime.fullDescription}</Text>
          </View>
        </View>
      )}

      {/* 2. IHSG INTRADAY PROJECTION & SUPPORT-RESISTANCE BOX */}
      {levels && (
        <View style={styles.levelsCard}>
          <View style={styles.levelsHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 14 }}>🇮🇩</Text>
              <Text style={styles.levelsTitle}>Proyeksi Level Kunci IHSG Hari Ini</Text>
            </View>
            <View style={styles.trendBadge}>
              <Text style={styles.trendBadgeText}>{levels.trendStatus}</Text>
            </View>
          </View>

          <View style={styles.levelsGrid}>
            <View style={styles.levelItem}>
              <Text style={styles.levelLabel}>Support 2 (S2)</Text>
              <Text style={[styles.levelValue, { color: COLORS.danger }]}>{levels.support2.toLocaleString('id-ID')}</Text>
            </View>
            <View style={styles.levelItem}>
              <Text style={styles.levelLabel}>Support 1 (S1)</Text>
              <Text style={[styles.levelValue, { color: '#FB7185' }]}>{levels.support1.toLocaleString('id-ID')}</Text>
            </View>
            <View style={[styles.levelItem, styles.levelItemPivot]}>
              <Text style={styles.levelLabel}>Titik Pivot (P)</Text>
              <Text style={[styles.levelValue, { color: '#38BDF8', fontWeight: '900' }]}>{levels.pivot.toLocaleString('id-ID')}</Text>
            </View>
            <View style={styles.levelItem}>
              <Text style={styles.levelLabel}>Resisten 1 (R1)</Text>
              <Text style={[styles.levelValue, { color: '#34D399' }]}>{levels.resist1.toLocaleString('id-ID')}</Text>
            </View>
            <View style={styles.levelItem}>
              <Text style={styles.levelLabel}>Resisten 2 (R2)</Text>
              <Text style={[styles.levelValue, { color: COLORS.success }]}>{levels.resist2.toLocaleString('id-ID')}</Text>
            </View>
          </View>
        </View>
      )}

      {/* 3. THE 4 QUANTITATIVE MACRO PILLARS */}
      <View style={[styles.sectionHeader, { marginTop: 14 }]}>
        <Text style={styles.sectionIcon}>🏛️</Text>
        <Text style={styles.sectionTitle}>Evaluasi 4 Pilar Penggerak Pasar</Text>
      </View>
      {macroAnalysis?.pillars && (
        <View style={styles.pillarsGrid}>
          {renderPillarCard(macroAnalysis.pillars.currencyFlow)}
          {renderPillarCard(macroAnalysis.pillars.globalRisk)}
          {renderPillarCard(macroAnalysis.pillars.commodityEngine)}
          {renderPillarCard(macroAnalysis.pillars.domesticBreadth)}
        </View>
      )}

      {/* 4. SECTOR ROTATION BIAS & ACTIONABLE GUIDANCE */}
      {rotation && (
        <View style={styles.rotationCard}>
          <View style={styles.rotationHeader}>
            <Text style={styles.rotationTitle}>🎯 Peta Rotasi Sektor Terbaik Hari Ini</Text>
          </View>
          <Text style={styles.rotationCatalyst}>"{rotation.catalyst}"</Text>
          
          <View style={styles.rotationGroup}>
            <Text style={styles.rotationSubLabel}>✅ Sektor Unggulan yang Diuntungkan:</Text>
            <View style={styles.sectorPillsWrap}>
              {rotation.topSectors.map((sec, idx) => (
                <View key={idx} style={styles.sectorPillGreen}>
                  <Text style={styles.sectorPillGreenText}>{sec}</Text>
                </View>
              ))}
            </View>
          </View>

          {rotation.avoidSectors.length > 0 && (
            <View style={[styles.rotationGroup, { marginTop: 10 }]}>
              <Text style={styles.rotationSubLabel}>⚠️ Sektor yang Perlu Dibatasi:</Text>
              <View style={styles.sectorPillsWrap}>
                {rotation.avoidSectors.map((sec, idx) => (
                  <View key={idx} style={styles.sectorPillAmber}>
                    <Text style={styles.sectorPillAmberText}>{sec}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* 5. MULTI-ASSET MACRO TICKER CARDS */}
      <View style={[styles.sectionHeader, { marginTop: 18 }]}>
        <Text style={styles.sectionIcon}>📊</Text>
        <Text style={styles.sectionTitle}>Indikator Multi-Aset Live</Text>
      </View>

      {/* Filter Category Chips */}
      <View style={styles.categoryChipsContainer}>
        {(['semua', 'valuta', 'global', 'komoditas'] as MacroCategory[]).map((cat) => {
          const labels: Record<MacroCategory, string> = {
            semua: 'Semua Instrumen',
            valuta: '💵 Valuta & Yield',
            global: '🌐 Global & Asia',
            komoditas: '🪙 Komoditas',
          };
          const isSelected = activeCategory === cat;
          return (
            <TouchableOpacity 
              key={cat} 
              style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                {labels[cat]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.macroGrid}>
        {(activeCategory === 'semua' || activeCategory === 'valuta') && (
          <>
            {renderMacroCard('IHSG', '🇮🇩', '^JKSE')}
            {renderMacroCard('USD / IDR', '💵', 'IDR=X', true, true)}
            {renderMacroCard('US Dollar DXY', '💲', 'DX-Y.NYB', false, true)}
            {renderMacroCard('US 10Y Yield', '📈', '^TNX', false, true, '%')}
          </>
        )}
        {(activeCategory === 'semua' || activeCategory === 'global') && (
          <>
            {renderMacroCard('S&P 500', '🇺🇸', '^GSPC')}
            {renderMacroCard('Nikkei 225', '🇯🇵', '^N225')}
            {renderMacroCard('Hang Seng', '🇭🇰', '^HSI')}
            {renderMacroCard('CBOE VIX', '⚡', '^VIX', false, true)}
          </>
        )}
        {(activeCategory === 'semua' || activeCategory === 'komoditas') && (
          <>
            {renderMacroCard('Emas (Gold)', '🪙', 'GC=F', false, false, ' USD')}
            {renderMacroCard('Minyak WTI', '🛢️', 'CL=F', false, false, ' USD')}
          </>
        )}
      </View>

      {/* 6. MARKET LEADERS LQ45 & BIG 4 BANKS STATUS */}
      <View style={[styles.sectionHeader, { marginTop: 14 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.sectionIcon}>🏛️</Text>
            <Text style={styles.sectionTitle}>Market Leaders (LQ45)</Text>
          </View>
          {banksHealth && (
            <View style={[styles.banksHealthBadge, { borderColor: banksHealth.color, backgroundColor: `${banksHealth.color}15` }]}>
              <Text style={[styles.banksHealthText, { color: banksHealth.color }]}>
                Big 4 Banks: {banksHealth.bullishCount}/{banksHealth.totalCount} ({banksHealth.status})
              </Text>
            </View>
          )}
        </View>
      </View>
      
      <View style={styles.leadersCard}>
        {WATCH_LEADERS.map((ticker, idx) => {
          const q = quotesMap[ticker];
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
    paddingBottom: 40,
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

  // 1. HERO MACRO COMPOSITE SCORE CARD
  heroCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 16,
    ...SHADOWS.card,
  },
  heroTop: {
    marginBottom: 12,
  },
  heroScoreGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  compositeScoreCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compositeScoreValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  compositeScoreMax: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    marginTop: -2,
  },
  heroTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroRegimeTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  heroSummary: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  actionPlanBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  actionPlanRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  allocationPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  allocationPillText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  strategyPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 1,
  },
  strategyPillText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
  },
  heroDescription: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },

  // 2. IHSG LEVELS PROJECTION CARD
  levelsCard: {
    backgroundColor: '#0c1622',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e3345',
    marginBottom: 16,
  },
  levelsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  levelsTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  trendBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  trendBadgeText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '800',
  },
  levelsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#080d14',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  levelItem: {
    alignItems: 'center',
    flex: 1,
  },
  levelItemPivot: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  levelLabel: {
    fontSize: 9,
    color: '#64748B',
    marginBottom: 2,
    fontWeight: '600',
  },
  levelValue: {
    fontSize: 11,
    fontWeight: '800',
  },

  // 3. PILLARS GRID
  pillarsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
    marginBottom: 16,
  },
  pillarCardWrapper: {
    width: '50%',
    padding: 5,
  },
  pillarCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    minHeight: 140,
  },
  pillarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  pillarName: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
  },
  pillarWeight: {
    color: '#64748B',
    fontSize: 9,
    marginTop: 1,
  },
  pillarScoreBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  pillarScoreText: {
    fontSize: 10,
    fontWeight: '900',
  },
  pillarStatusTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginVertical: 6,
  },
  pillarStatusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pillarSummary: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  pillarDetail: {
    color: '#64748B',
    fontSize: 10,
    lineHeight: 14,
  },

  // 4. ROTATION CARD
  rotationCard: {
    backgroundColor: '#0c1622',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e3345',
    marginBottom: 16,
  },
  rotationHeader: {
    marginBottom: 6,
  },
  rotationTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  rotationCatalyst: {
    color: '#94A3B8',
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  rotationGroup: {
    gap: 6,
  },
  rotationSubLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  sectorPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sectorPillGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sectorPillGreenText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  sectorPillAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sectorPillAmberText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
  },

  // 5. MULTI-ASSET TICKER GRID
  categoryChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  categoryChipActive: {
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    borderColor: '#38BDF8',
  },
  categoryChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
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
  banksHealthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  banksHealthText: {
    fontSize: 10,
    fontWeight: '800',
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
    marginBottom: 16,
  },
  macroCardWrapper: {
    width: '50%',
    padding: 5,
  },
  macroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    minHeight: 104,
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
    gap: 5,
    flex: 1,
  },
  macroIcon: {
    fontSize: 13,
  },
  macroTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  chgBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  chgBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  macroPrice: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginVertical: 4,
  },
  rangeContainer: {
    marginTop: 2,
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
    marginTop: 3,
  },
  rangeText: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '600',
  },

  // 6. LEADERS CARD
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
