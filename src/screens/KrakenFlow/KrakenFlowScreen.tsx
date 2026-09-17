import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import {
  ORCA_FILTERS,
  DURATION_OPTIONS,
  MARKET_CAP_OPTIONS,
  evaluateOrcaFilter,
  OrcaStockResult,
  fetchKrakenTerminalData,
  KrakenTerminalData,
} from '../../utils/kraken';
import { fetchQuotes, YFQuote } from '../../utils/yfinance';
import { formatPercent, formatVolume } from '../../utils/formatters';
import ErrorBoundary from '../../components/ErrorBoundary';

type ViewMode = 'orca_filter' | 'raw_portal_tables';

export default function KrakenFlowScreen({ navigation }: any) {
  // View mode: ORCA Filter (from screenshot) or Raw Scraped Portal Tables
  const [viewMode, setViewMode] = useState<ViewMode>('orca_filter');

  // ORCA Filter States (as seen in screenshot)
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<string>('1H');
  const [selectedMarketCap, setSelectedMarketCap] = useState<string>('Semua');

  // Live market quotes & portal data from ihsgscreener.com
  const [portalData, setPortalData] = useState<KrakenTerminalData | null>(null);
  const [quotesMap, setQuotesMap] = useState<Record<string, YFQuote>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Load live data from ihsgscreener.com and real-time market quotes
  const loadData = async (force: boolean = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Fetch live scraped tables directly from portal ihsgscreener.com
      const pData = await fetchKrakenTerminalData(force);
      if (pData) {
        setPortalData(pData);
        setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }

      // 2. Fetch live quotes for universe of stocks to power the Sandingkan engine
      const symbolsToFetch = [
        'BBCA', 'BMRI', 'BBRI', 'BBNI', 'TLKM', 'ASII', 'ANTM', 'MDKA', 'PGAS', 'UNVR',
        'BUKA', 'EMTK', 'BRMS', 'PANI', 'BREN', 'ADRO', 'PTBA', 'MEDC', 'ICBP', 'KLBF',
        'GOTO', 'ENRG', 'DEWA', 'DOID', 'CUAN', 'WIFI', 'KIJA', 'RAJA', 'NICL', 'EXCL',
        '^JKSE'
      ];
      const q = await fetchQuotes(symbolsToFetch);
      if (q) setQuotesMap(q);
    } catch (err) {
      console.warn('[KrakenFlowScreen] Error loading data from portal:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Toggle single filter
  const toggleFilter = (filterId: string) => {
    setSelectedFilters(prev =>
      prev.includes(filterId) ? prev.filter(id => id !== filterId) : [...prev, filterId]
    );
  };

  // Reset ORCA filters
  const handleResetOrca = () => {
    setSelectedFilters([]);
    setSelectedDuration('1H');
    setSelectedMarketCap('Semua');
  };

  // Quick Preset Handlers
  const handleQuickPreset = (type: 'FOREIGN' | 'ARA' | 'SMART_MONEY' | 'ALL_PORTAL') => {
    if (type === 'FOREIGN') {
      setSelectedFilters(['foreign_plus', 'high_ats', 'no_sell']);
    } else if (type === 'ARA') {
      setSelectedFilters(['high_bid_offer', 'close_high', 'top_volume', 'foreign_plus']);
    } else if (type === 'SMART_MONEY') {
      setSelectedFilters(['high_ats', 'no_sell', 'high_bid_offer']);
    } else if (type === 'ALL_PORTAL') {
      setSelectedFilters(['foreign_plus', 'high_ats']);
    }
  };

  // Evaluate ORCA Results dynamically synchronized with live portal data
  const orcaResults: OrcaStockResult[] = useMemo(() => {
    return evaluateOrcaFilter(selectedFilters, selectedDuration, selectedMarketCap, quotesMap, portalData);
  }, [selectedFilters, selectedDuration, selectedMarketCap, quotesMap, portalData]);

  // Navigate to 5 Pillars Analysis
  const handleAnalyzeTicker = (symbol: string) => {
    if (navigation && navigation.navigate) {
      navigation.navigate('Analysis', { ticker: symbol });
    }
  };

  const handleOpenPortal = () => {
    Linking.openURL('https://ihsgscreener.com/index.html').catch(err =>
      console.warn('Could not open portal URL:', err)
    );
  };

  const hasResults = orcaResults.length > 0;
  const isFilterActive = selectedFilters.length > 0;

  return (
    <ErrorBoundary>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor="#0284c7"
          />
        }
      >
        <View style={styles.workspace}>
          {/* ============================================================= */}
          {/* TOP APP BAR HEADER (Matching Portal Cyber Aesthetic)          */}
          {/* ============================================================= */}
          <View style={styles.topHeaderBar}>
            <View style={styles.topRow}>
              {/* Brand & Connection Tag */}
              <View style={styles.brandRow}>
                <Text style={styles.brandTitle}>IHSG SCREENER</Text>
                <View
                  style={[
                    styles.connectionPill,
                    portalData?.isLive ? styles.connectionPillLive : styles.connectionPillOffline,
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: portalData?.isLive ? '#10b981' : '#f59e0b' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.connectionText,
                      portalData?.isLive ? styles.colorGreen : styles.colorAmber,
                    ]}
                  >
                    {portalData?.isLive
                      ? '🟢 Terhubung Live: ihsgscreener.com'
                      : '🟠 Terhubung (Cache/Offline)'}
                  </Text>
                </View>
              </View>

              {/* Sync & Portal Links */}
              <View style={styles.headerActionsRow}>
                <TouchableOpacity
                  style={styles.btnSync}
                  onPress={() => loadData(true)}
                  disabled={loading || refreshing}
                >
                  {loading || refreshing ? (
                    <ActivityIndicator size="small" color="#00c8ff" />
                  ) : (
                    <Text style={styles.btnSyncText}>🔄 Ambil Data Portal</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnPortal} onPress={handleOpenPortal}>
                  <Text style={styles.btnPortalText}>🌐 Kunjungi Portal</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Title & Tagline */}
            <View style={styles.titleRow}>
              <Text style={styles.mainTitle}>K R A K E N   F L O W</Text>
              <View style={styles.orcaBadge}>
                <View style={styles.greenLiveDot} />
                <Text style={styles.orcaBadgeText}>ORCA SYSTEM</Text>
              </View>
            </View>
            <Text style={styles.subTitle}>
              Orderflow & Reversal Calculation Algorithm · Update: 17 Sep 2026 · 958 emiten
              {lastSyncTime ? ` · Last Sync: ${lastSyncTime}` : ''}
            </Text>
          </View>

          {/* ============================================================= */}
          {/* CARD 1: FILTER ORDER FLOW — BANDARMOLOGY                      */}
          {/* ============================================================= */}
          <View style={styles.cardContainer}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.cyanDot} />
                <Text style={styles.cardTitle}>Filter Order Flow — Bandarmology</Text>
              </View>
              <View style={styles.durationPill}>
                <Text style={styles.durationPillText}>
                  {selectedDuration === '1H' ? '1 Hari' : `${selectedDuration.replace('H', '')} Hari`}
                </Text>
              </View>
            </View>

            {/* Parameter Section */}
            <View style={styles.filterSection}>
              <View style={styles.filterSectionHeader}>
                <Text style={styles.filterSectionLabel}>
                  PARAMETER · BISA DIKOMBINASIKAN · TOP 25 PER FILTER
                </Text>
                {/* Presets */}
                <View style={styles.presetsRow}>
                  <TouchableOpacity
                    onPress={() => handleQuickPreset('FOREIGN')}
                    style={styles.btnPreset}
                  >
                    <Text style={styles.btnPresetText}>⚡ Inflow Asing</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleQuickPreset('ARA')}
                    style={styles.btnPreset}
                  >
                    <Text style={styles.btnPresetText}>🎯 ARA Watch</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleQuickPreset('SMART_MONEY')}
                    style={styles.btnPreset}
                  >
                    <Text style={styles.btnPresetText}>🐋 Smart Money</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.pillsWrap}>
                {ORCA_FILTERS.map(f => {
                  const isActive = selectedFilters.includes(f.id);
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.filterPill, isActive && styles.filterPillActive]}
                      onPress={() => toggleFilter(f.id)}
                    >
                      <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Duration Section */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionLabel}>DURASI · MAX 7 HARI</Text>
              <View style={styles.durationPillsWrap}>
                {DURATION_OPTIONS.map(d => {
                  const isSelected = selectedDuration === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[styles.durationBtn, isSelected && styles.durationBtnActive]}
                      onPress={() => setSelectedDuration(d)}
                    >
                      <Text
                        style={[
                          styles.durationBtnText,
                          isSelected && styles.durationBtnTextActive,
                        ]}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Market Cap Section */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionLabel}>
                MARKET CAP · MAKSIMAL {selectedMarketCap.toUpperCase()}
              </Text>
              <View style={styles.marketCapPillsWrap}>
                {MARKET_CAP_OPTIONS.map(mc => {
                  const isSelected = selectedMarketCap === mc;
                  return (
                    <TouchableOpacity
                      key={mc}
                      style={[styles.marketCapBtn, isSelected && styles.marketCapBtnActive]}
                      onPress={() => setSelectedMarketCap(mc)}
                    >
                      <Text
                        style={[
                          styles.marketCapBtnText,
                          isSelected && styles.marketCapBtnTextActive,
                        ]}
                      >
                        {mc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Reset Row */}
            <View style={styles.resetRow}>
              <TouchableOpacity style={styles.btnReset} onPress={handleResetOrca}>
                <Text style={styles.btnResetText}>Reset ORCA</Text>
              </TouchableOpacity>
              {selectedFilters.length > 0 ? (
                <Text style={styles.activeFilterCountText}>
                  {selectedFilters.length} filter aktif terpilih
                </Text>
              ) : (
                <Text style={styles.inactiveFilterHint}>
                  Klik filter di atas untuk mengekstrak data dari portal ihsgscreener.com
                </Text>
              )}
            </View>
          </View>

          {/* ============================================================= */}
          {/* CARD 2: HASIL ORCA (DISANDINGKAN DENGAN PASAR REAL-TIME)      */}
          {/* ============================================================= */}
          <View style={styles.cardContainer}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Text style={styles.targetIcon}>⊙</Text>
                <Text style={styles.cardTitle}>Hasil ORCA</Text>
                <Text style={styles.cardTitleSub}>· Data Portal ihsgscreener.com</Text>
              </View>

              {/* Counter Badge */}
              <View style={[styles.badgeCounter, hasResults && styles.badgeCounterActive]}>
                <Text style={[styles.badgeCounterText, hasResults && styles.badgeCounterTextActive]}>
                  {orcaResults.length}
                </Text>
              </View>
            </View>

            {/* Mode Switcher: Hasil ORCA vs Data Mentah Portal */}
            <View style={styles.viewModeRow}>
              <TouchableOpacity
                style={[styles.modeTab, viewMode === 'orca_filter' && styles.modeTabActive]}
                onPress={() => setViewMode('orca_filter')}
              >
                <Text style={[styles.modeTabText, viewMode === 'orca_filter' && styles.modeTabTextActive]}>
                  ⊙ Hasil Filter ORCA ({orcaResults.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, viewMode === 'raw_portal_tables' && styles.modeTabActive]}
                onPress={() => setViewMode('raw_portal_tables')}
              >
                <Text style={[styles.modeTabText, viewMode === 'raw_portal_tables' && styles.modeTabTextActive]}>
                  📋 5 Tabel Mentah Portal ({portalData?.krakenFlow.length || 5} Emiten)
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB VIEW 1: HASIL FILTER ORCA */}
            {viewMode === 'orca_filter' && (
              <>
                {/* Empty State: Exactly as in screenshot when no filters selected */}
                {!isFilterActive ? (
                  <View style={styles.emptyStateContainer}>
                    <Text style={styles.emptyStateHexagon}>⬢</Text>
                    <Text style={styles.emptyStateMainText}>
                      Pilih minimal satu filter di atas.
                    </Text>
                    <Text style={styles.emptyStateSubText}>
                      Filter bisa dikombinasikan — hasil diurutkan dari yang paling banyak memenuhi filter.
                    </Text>
                    <TouchableOpacity
                      style={styles.btnQuickStart}
                      onPress={() => handleQuickPreset('FOREIGN')}
                    >
                      <Text style={styles.btnQuickStartText}>
                        ⚡ Klik untuk Tampilkan Hasil Inflow Asing (Preset Otomatis)
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : orcaResults.length === 0 ? (
                  <View style={styles.emptyStateContainer}>
                    <Text style={styles.emptyStateHexagon}>🔍</Text>
                    <Text style={styles.emptyStateMainText}>
                      Tidak ada emiten yang memenuhi kombinasi filter ini.
                    </Text>
                    <Text style={styles.emptyStateSubText}>
                      Coba kurangi kombinasi filter atau ubah pilihan batasan Market Cap.
                    </Text>
                  </View>
                ) : (
                  /* Results State: Sandingkan Harga Portal vs Live Market */
                  <View style={styles.resultsContainer}>
                    {/* Explanation Banner */}
                    <View style={styles.sandingkanBanner}>
                      <Text style={styles.sandingkanBannerTitle}>
                        ⚖️ Hasil Sandingan Data Portal ihsgscreener.com vs Live Feed IDX
                      </Text>
                      <Text style={styles.sandingkanBannerDesc}>
                        Data di bawah ditarik langsung dari portal <Text style={{ fontWeight: 'bold' }}>ihsgscreener.com</Text> dan disandingkan dengan harga perdagangan real-time. Label <Text style={{ color: '#059669', fontWeight: 'bold' }}>DISKON</Text> menunjukkan harga live saat ini berada di bawah harga akumulasi bandar.
                      </Text>
                    </View>

                    {/* Stock Result Cards */}
                    {orcaResults.map((item, index) => {
                      const isDiscount = item.isDiscount;
                      const isUp = item.liveChange >= 0;

                      return (
                        <View key={item.symbol + index} style={styles.resultCard}>
                          {/* Card Top */}
                          <View style={styles.resultCardHeader}>
                            <View style={styles.resultCardTickerRow}>
                              <View style={styles.rankBadge}>
                                <Text style={styles.rankBadgeText}>#{index + 1}</Text>
                              </View>
                              <View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <Text style={styles.resultCardTicker}>{item.symbol}</Text>
                                  <Text style={styles.resultCardSector}>{item.sector}</Text>
                                  <Text style={styles.resultCardCap}>Cap: {item.marketCapT}T</Text>
                                </View>
                                <Text style={styles.resultCardName}>{item.name}</Text>
                              </View>
                            </View>

                            <View style={styles.matchBadgePill}>
                              <Text style={styles.matchBadgeText}>
                                {item.matchCount}/{selectedFilters.length} Filter Cocok
                              </Text>
                            </View>
                          </View>

                          {/* Matched Filter Pills */}
                          <View style={styles.matchedTagsWrap}>
                            {item.matchedFilters.map(fid => {
                              const def = ORCA_FILTERS.find(f => f.id === fid);
                              return (
                                <View key={fid} style={styles.matchedTagPill}>
                                  <Text style={styles.matchedTagText}>✓ {def?.label || fid}</Text>
                                </View>
                              );
                            })}
                          </View>

                          {/* Two-Column Sandingkan Matrix */}
                          <View style={styles.sandingkanGrid}>
                            {/* Left: Portal ORCA Data */}
                            <View style={styles.sandingkanColLeft}>
                              <Text style={styles.sandingkanColHeader}>PORTAL ihsgscreener.com</Text>
                              <View style={styles.sandingkanMetricRow}>
                                <Text style={styles.sandingkanMetricLabel}>Avg Beli Bandar</Text>
                                <Text style={styles.sandingkanMetricCyan}>
                                  Rp {item.bandarAvgPrice.toLocaleString('id-ID')}
                                </Text>
                              </View>
                              <View style={styles.sandingkanMetricRow}>
                                <Text style={styles.sandingkanMetricLabel}>Alur Institusi</Text>
                                <Text style={styles.sandingkanMetricGreen}>{item.foreignFlowStr}</Text>
                              </View>
                              <View style={styles.sandingkanMetricRow}>
                                <Text style={styles.sandingkanMetricLabel}>Top Accumulator</Text>
                                <Text style={styles.sandingkanMetricMuted}>{item.topBroker}</Text>
                              </View>
                            </View>

                            {/* Right: Live Market Feed */}
                            <View style={styles.sandingkanColRight}>
                              <Text style={styles.sandingkanColHeader}>PASAR REAL-TIME (LIVE)</Text>
                              <View style={styles.sandingkanMetricRow}>
                                <Text style={styles.sandingkanMetricLabel}>Harga Terkini</Text>
                                <Text style={styles.sandingkanMetricPrice}>
                                  Rp {item.livePrice.toLocaleString('id-ID')}
                                </Text>
                              </View>
                              <View style={styles.sandingkanMetricRow}>
                                <Text style={styles.sandingkanMetricLabel}>Perubahan 1D</Text>
                                <Text
                                  style={[
                                    styles.sandingkanMetricPrice,
                                    isUp ? styles.colorGreen : styles.colorRed,
                                  ]}
                                >
                                  {isUp ? '▲' : '▼'} {formatPercent(item.liveChangePct)}
                                </Text>
                              </View>
                              <View style={styles.sandingkanMetricRow}>
                                <Text style={styles.sandingkanMetricLabel}>Volume Transaksi</Text>
                                <Text style={styles.sandingkanMetricMuted}>{item.volumeStr}</Text>
                              </View>
                            </View>
                          </View>

                          {/* Variance & Recommendation Footer */}
                          <View style={styles.varianceFooter}>
                            <View style={styles.varianceStatusRow}>
                              <View
                                style={[
                                  styles.discountPill,
                                  isDiscount ? styles.discountPillGreen : styles.discountPillAmber,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.discountPillText,
                                    isDiscount ? styles.colorGreenDark : styles.colorAmberDark,
                                  ]}
                                >
                                  {isDiscount
                                    ? `🟢 DISKON ${Math.abs(item.priceGapPct)}% vs BANDAR`
                                    : `🟡 PREMIUM +${item.priceGapPct}% vs BANDAR`}
                                </Text>
                              </View>
                              <Text style={styles.gapNominalText}>
                                Selisih: {item.priceGap > 0 ? '+' : ''}
                                Rp {item.priceGap.toLocaleString('id-ID')}
                              </Text>
                            </View>
                            <Text style={styles.recommendationText}>
                              💡 {item.recommendation}
                            </Text>
                          </View>

                          {/* Action Button */}
                          <TouchableOpacity
                            style={styles.btnAction}
                            onPress={() => handleAnalyzeTicker(item.symbol)}
                          >
                            <Text style={styles.btnActionText}>
                              🔍 Buka Riset 5 Pilar Finmorph ({item.symbol}) ➔
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            {/* TAB VIEW 2: 5 TABEL MENTAH SCRAPED DARI PORTAL */}
            {viewMode === 'raw_portal_tables' && (
              <View style={styles.rawTablesContainer}>
                {/* 1. Kraken Flow Table */}
                <View style={styles.rawTableCard}>
                  <Text style={styles.rawTableTitle}>🐙 1. Kraken Flow — Akumulasi Terstruktur</Text>
                  <View style={styles.rawTableHeaderRow}>
                    <Text style={[styles.rawTh, { flex: 1.2 }]}>EMITEN</Text>
                    <Text style={[styles.rawTh, { flex: 1.4, textAlign: 'right' }]}>NET AKUMULASI</Text>
                    <Text style={[styles.rawTh, { flex: 1.2, textAlign: 'right' }]}>AVG PORTAL</Text>
                    <Text style={[styles.rawTh, { flex: 1, textAlign: 'right' }]}>5D %</Text>
                    <Text style={[styles.rawTh, { flex: 1.2, textAlign: 'right' }]}>HARGA LIVE</Text>
                  </View>
                  {portalData?.krakenFlow.map((k, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.rawTableRow}
                      onPress={() => handleAnalyzeTicker(k.symbol)}
                    >
                      <Text style={[styles.rawTd, { flex: 1.2, fontWeight: 'bold', color: '#0284c7' }]}>
                        #{i + 1} {k.symbol}
                      </Text>
                      <Text style={[styles.rawTd, styles.colorGreen, { flex: 1.4, textAlign: 'right', fontWeight: 'bold' }]}>
                        {k.accumulation}
                      </Text>
                      <Text style={[styles.rawTd, { flex: 1.2, textAlign: 'right', color: '#0284c7' }]}>
                        Rp {k.price}
                      </Text>
                      <Text style={[styles.rawTd, styles.colorGreen, { flex: 1, textAlign: 'right' }]}>
                        {k.change5d}
                      </Text>
                      <Text style={[styles.rawTd, { flex: 1.2, textAlign: 'right', fontWeight: 'bold' }]}>
                        {k.livePrice ? `Rp ${k.livePrice.toLocaleString('id-ID')}` : '—'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 2. ARA Detector Table */}
                <View style={styles.rawTableCard}>
                  <Text style={styles.rawTableTitle}>🎯 2. ARA Detector & Foreign Inflow</Text>
                  <View style={styles.rawTableHeaderRow}>
                    <Text style={[styles.rawTh, { flex: 1.2 }]}>EMITEN</Text>
                    <Text style={[styles.rawTh, { flex: 1.4, textAlign: 'right' }]}>NET FOREIGN</Text>
                    <Text style={[styles.rawTh, { flex: 1.2, textAlign: 'right' }]}>VOLUME</Text>
                    <Text style={[styles.rawTh, { flex: 1.2, textAlign: 'right' }]}>JARAK KE ARA</Text>
                  </View>
                  {portalData?.araForeign.map((a, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.rawTableRow}
                      onPress={() => handleAnalyzeTicker(a.symbol)}
                    >
                      <Text style={[styles.rawTd, { flex: 1.2, fontWeight: 'bold', color: '#0284c7' }]}>
                        {a.symbol}
                      </Text>
                      <Text style={[styles.rawTd, styles.colorGreen, { flex: 1.4, textAlign: 'right', fontWeight: 'bold' }]}>
                        {a.netForeign}
                      </Text>
                      <Text style={[styles.rawTd, { flex: 1.2, textAlign: 'right' }]}>
                        {a.volume}
                      </Text>
                      <Text style={[styles.rawTd, styles.colorRed, { flex: 1.2, textAlign: 'right', fontWeight: 'bold' }]}>
                        {a.pctToAra}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 3. Broker Stalker Table */}
                <View style={styles.rawTableCard}>
                  <Text style={styles.rawTableTitle}>🕵️ 3. Broker Stalker Matrix</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#059669', marginBottom: 6 }}>
                        TOP BUYERS
                      </Text>
                      {portalData?.brokerBuy.map((b, i) => (
                        <View key={i} style={styles.brokerMiniCard}>
                          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#0f172a' }}>{b.broker}</Text>
                          <Text style={{ fontSize: 11, color: '#059669', fontWeight: 'bold' }}>{b.netBuy}</Text>
                          <Text style={{ fontSize: 10, color: '#64748b' }}>Avg {b.avgPrice} · Vol {b.volume}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#dc2626', marginBottom: 6 }}>
                        TOP SELLERS
                      </Text>
                      {portalData?.brokerSell.map((b, i) => (
                        <View key={i} style={styles.brokerMiniCard}>
                          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#0f172a' }}>{b.broker}</Text>
                          <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: 'bold' }}>{b.netSell}</Text>
                          <Text style={{ fontSize: 10, color: '#64748b' }}>Avg {b.avgPrice} · Vol {b.volume}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ebf4f7',
  },
  workspace: {
    padding: 16,
    gap: 16,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },

  // ---------------- TOP APP BAR ----------------
  topHeaderBar: {
    backgroundColor: '#0c1a24',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#1e3345',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#00c8ff',
    letterSpacing: 2,
  },
  connectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  connectionPillLive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10b981',
  },
  connectionPillOffline: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: '#f59e0b',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  headerActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnSync: {
    backgroundColor: 'rgba(0, 200, 255, 0.12)',
    borderWidth: 1,
    borderColor: '#00c8ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnSyncText: {
    color: '#00c8ff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  btnPortal: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  btnPortalText: {
    color: '#cbd5e1',
    fontSize: 12,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#00c8ff',
    letterSpacing: 2,
  },
  orcaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#042838',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0284c7',
  },
  greenLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  orcaBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#00c8ff',
    letterSpacing: 1,
  },
  subTitle: {
    fontSize: 12,
    color: '#7ea1b5',
    fontFamily: 'monospace',
    marginTop: 6,
  },

  // ---------------- CARDS ----------------
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d0e6ed',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cyanDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0284c7',
    marginRight: 8,
  },
  targetIcon: {
    fontSize: 16,
    color: '#0284c7',
    fontWeight: 'bold',
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
    letterSpacing: 0.3,
  },
  cardTitleSub: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 6,
  },
  durationPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  durationPillText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
  },
  badgeCounter: {
    backgroundColor: '#f1f5f9',
    minWidth: 26,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeCounterActive: {
    backgroundColor: '#0284c7',
  },
  badgeCounterText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
  },
  badgeCounterTextActive: {
    color: '#ffffff',
  },

  // ---------------- FILTER SECTIONS ----------------
  filterSection: {
    marginBottom: 16,
  },
  filterSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  filterSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  btnPreset: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  btnPresetText: {
    fontSize: 10,
    color: '#0284c7',
    fontWeight: '600',
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    backgroundColor: '#f1f7f9',
    borderWidth: 1,
    borderColor: '#cde4ec',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  filterPillActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  filterPillText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },

  durationPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationBtn: {
    backgroundColor: '#f1f7f9',
    borderWidth: 1,
    borderColor: '#cde4ec',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  durationBtnActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  durationBtnText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: 'bold',
  },
  durationBtnTextActive: {
    color: '#ffffff',
  },

  marketCapPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  marketCapBtn: {
    backgroundColor: '#f1f7f9',
    borderWidth: 1,
    borderColor: '#cde4ec',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  marketCapBtnActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  marketCapBtnText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  marketCapBtnTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },

  resetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  btnReset: {
    backgroundColor: '#f1f7f9',
    borderWidth: 1,
    borderColor: '#cde4ec',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
  btnResetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  activeFilterCountText: {
    fontSize: 12,
    color: '#0284c7',
    fontWeight: 'bold',
  },
  inactiveFilterHint: {
    fontSize: 11,
    color: '#94a3b8',
  },

  // ---------------- VIEW MODE TABS ----------------
  viewModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  modeTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modeTabActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#7dd3fc',
  },
  modeTabText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: '#0369a1',
    fontWeight: 'bold',
  },

  // ---------------- EMPTY STATE ----------------
  emptyStateContainer: {
    paddingVertical: 48,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateHexagon: {
    fontSize: 48,
    color: '#334155',
    marginBottom: 16,
  },
  emptyStateMainText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyStateSubText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 480,
    lineHeight: 18,
    marginBottom: 16,
  },
  btnQuickStart: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#0284c7',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  btnQuickStartText: {
    color: '#0284c7',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // ---------------- RESULTS STATE ----------------
  resultsContainer: {
    gap: 12,
  },
  sandingkanBanner: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  sandingkanBannerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0369a1',
    marginBottom: 4,
  },
  sandingkanBannerDesc: {
    fontSize: 11,
    color: '#0284c7',
    lineHeight: 16,
  },

  resultCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  resultCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultCardTickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rankBadge: {
    backgroundColor: '#f1f5f9',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#475569',
  },
  resultCardTicker: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  resultCardSector: {
    fontSize: 11,
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  resultCardCap: {
    fontSize: 10,
    color: '#94a3b8',
  },
  resultCardName: {
    fontSize: 11,
    color: '#64748b',
  },
  matchBadgePill: {
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#7dd3fc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  matchBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0369a1',
  },
  matchedTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  matchedTagPill: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  matchedTagText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#166534',
  },

  // Two-column Sandingkan Grid
  sandingkanGrid: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  sandingkanColLeft: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    paddingRight: 8,
  },
  sandingkanColRight: {
    flex: 1,
    paddingLeft: 8,
  },
  sandingkanColHeader: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sandingkanMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  sandingkanMetricLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  sandingkanMetricPrice: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  sandingkanMetricCyan: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0284c7',
  },
  sandingkanMetricGreen: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#059669',
  },
  sandingkanMetricMuted: {
    fontSize: 11,
    color: '#475569',
  },

  // Variance Footer
  varianceFooter: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  varianceStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 6,
  },
  discountPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  discountPillGreen: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  discountPillAmber: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  discountPillText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  colorGreenDark: {
    color: '#166534',
  },
  colorAmberDark: {
    color: '#92400e',
  },
  gapNominalText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#334155',
  },
  recommendationText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  btnAction: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#0284c7',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  btnActionText: {
    color: '#0284c7',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // ---------------- RAW PORTAL TABLES ----------------
  rawTablesContainer: {
    gap: 16,
  },
  rawTableCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rawTableTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  rawTableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 6,
    marginBottom: 6,
  },
  rawTh: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748b',
  },
  rawTableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    alignItems: 'center',
  },
  rawTd: {
    fontSize: 11,
    color: '#334155',
  },
  brokerMiniCard: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  colorGreen: {
    color: '#059669',
  },
  colorRed: {
    color: '#dc2626',
  },
  colorAmber: {
    color: '#d97706',
  },
});
