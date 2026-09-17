import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';
import { fetchQuotes, fetchHistory, YFQuote } from '../../utils/yfinance';
import { formatPercent, formatRupiah, formatX, formatVolume } from '../../utils/formatters';
import { calculateBandarmology, BandarmologyResult } from '../../utils/bandarmology';
import { 
  calculateFundamentalPillars, 
  calculateMultiPivots, 
  calculateVwapBands, 
  getThematicGroup, 
  getFearAndGreedIndex,
  FundamentalPillars,
  MultiPivots,
  VwapBands,
  ThematicAffiliation
} from '../../utils/research';
import {
  fetchFinmorphFundamentals,
  fetchFinmorphFlow,
  fetchFinmorphLevels,
  fetchFinmorphFng,
  fetchFinmorphWanted,
  FinmorphFundamentalsResponse,
  FinmorphFlowResponse,
  FinmorphLevelsResponse,
  FinmorphFngResponse,
  FinmorphWantedResponse,
} from '../../utils/finmorph';
import StockChart from '../../components/StockChart';
import PositionCalculator from '../../components/PositionCalculator';
import ErrorBoundary from '../../components/ErrorBoundary';

const QUICK_PICKS = ['BBCA', 'BBRI', 'BMRI', 'TLKM', 'ASII', 'GOTO', 'PANI', 'BREN'];

type TabType = 'smart_money' | 'fundamental' | 'levels' | 'calculator' | 'thematic';

export default function AnalysisScreen({ route }: any) {
  const [ticker, setTicker] = useState(route?.params?.ticker || 'BBCA');
  const [activeTab, setActiveTab] = useState<TabType>('smart_money');
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<YFQuote | null>(null);
  const [chartData, setChartData] = useState<number[]>([]);
  
  // Advanced research metrics (local algorithm fallbacks)
  const [bandarmology, setBandarmology] = useState<BandarmologyResult | null>(null);
  const [fundamentals, setFundamentals] = useState<FundamentalPillars | null>(null);
  const [pivots, setPivots] = useState<MultiPivots | null>(null);
  const [vwapBands, setVwapBands] = useState<VwapBands | null>(null);
  const [pivotMethod, setPivotMethod] = useState<'classic' | 'fibonacci' | 'camarilla'>('classic');
  const [thematic, setThematic] = useState<ThematicAffiliation | null>(null);

  // Live Finmorph platform data
  const [finmorphFund, setFinmorphFund] = useState<FinmorphFundamentalsResponse | null>(null);
  const [finmorphFlow, setFinmorphFlow] = useState<FinmorphFlowResponse | null>(null);
  const [finmorphLevels, setFinmorphLevels] = useState<FinmorphLevelsResponse | null>(null);
  const [finmorphFng, setFinmorphFng] = useState<FinmorphFngResponse | null>(null);
  const [finmorphWanted, setFinmorphWanted] = useState<FinmorphWantedResponse | null>(null);
  const [wantedMode, setWantedMode] = useState<'akumulasi' | 'distribusi'>('akumulasi');
  const [isFinmorphLive, setIsFinmorphLive] = useState(false);

  const handleSearch = async (targetTicker?: string) => {
    const symbolToSearch = (targetTicker || ticker).toUpperCase().trim();
    if (!symbolToSearch) return;

    setLoading(true);
    try {
      // Parallel fetch: Yahoo Finance quotes/history & live Finmorph endpoints
      const [qData, fFund, fFlow, fLevels, fFng, fWanted] = await Promise.all([
        fetchQuotes([symbolToSearch]),
        fetchFinmorphFundamentals(symbolToSearch),
        fetchFinmorphFlow(symbolToSearch),
        fetchFinmorphLevels(symbolToSearch),
        fetchFinmorphFng(),
        fetchFinmorphWanted(wantedMode)
      ]);

      const foundQuote = qData[symbolToSearch] || qData[`${symbolToSearch}.JK`];
      
      if (foundQuote) {
        setQuote(foundQuote);
        const hData = await fetchHistory(symbolToSearch, '3mo');
        
        if (hData.closes && hData.closes.length > 0) {
          setChartData(hData.closes.slice(-30));
          
          // 1. Bandarmology & Smart Money
          const bRes = calculateBandarmology(hData, foundQuote.regularMarketPrice);
          setBandarmology(bRes);

          // 2. Fundamental 5-Pillars fallback
          const fRes = calculateFundamentalPillars(foundQuote);
          setFundamentals(fRes);

          // 3. Multi-Method Pivot Points fallback
          const pRes = calculateMultiPivots(
            foundQuote.regularMarketDayHigh || foundQuote.regularMarketPrice,
            foundQuote.regularMarketDayLow || foundQuote.regularMarketPrice,
            foundQuote.regularMarketPrice
          );
          setPivots(pRes);

          // 4. Session VWAP & Sigma Bands fallback
          const vRes = calculateVwapBands(hData);
          setVwapBands(vRes);

          // 5. Thematic / Conglomerate Affiliation
          const tRes = getThematicGroup(symbolToSearch);
          setThematic(tRes);
        }
      }

      if (fFund || fFlow || fLevels) {
        setIsFinmorphLive(true);
      }
      setFinmorphFund(fFund);
      setFinmorphFlow(fFlow);
      setFinmorphLevels(fLevels);
      setFinmorphFng(fFng);
      setFinmorphWanted(fWanted);
    } catch (e) {
      console.error('[AnalysisScreen] Search error:', e);
    }
    setLoading(false);
  };

  const handleWantedModeChange = async (mode: 'akumulasi' | 'distribusi') => {
    setWantedMode(mode);
    const res = await fetchFinmorphWanted(mode);
    if (res) setFinmorphWanted(res);
  };

  useEffect(() => {
    const target = route?.params?.ticker || ticker || 'BBCA';
    setTicker(target);
    handleSearch(target);
  }, [route?.params?.ticker]);

  const renderStat = (label: string, value: string | number) => (
    <View style={styles.statRow} key={label}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );

  const formatRatioPct = (val?: number | null) => {
    if (val === null || val === undefined || isNaN(Number(val))) return '—';
    return `${(Number(val) * 100).toFixed(2)}%`;
  };

  const isUp = (quote?.regularMarketChangePercent || 0) >= 0;
  const isAboveMa50 = quote?.fiftyDayAverage ? quote.regularMarketPrice >= quote.fiftyDayAverage : false;
  const localFng = getFearAndGreedIndex(quote?.regularMarketChangePercent || 0);

  // Helper colors for Finmorph score & flow
  const getVerdictColor = (verdict?: string) => {
    if (!verdict) return COLORS.primary;
    const v = verdict.toLowerCase();
    if (v.includes('akumulasi')) return COLORS.success;
    if (v.includes('distribusi')) return COLORS.danger;
    return '#F59E0B'; // netral
  };

  const getScoreColor = (score?: number) => {
    if (score === undefined || score === null) return COLORS.primary;
    if (score >= 70) return COLORS.success;
    if (score >= 50) return '#38BDF8';
    if (score >= 35) return '#F59E0B';
    return COLORS.danger;
  };

  return (
    <ScrollView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBox}>
        <TextInput
          style={styles.input}
          placeholder="Cari Kode Saham (cth: BBCA, BBRI, BREN, PANI)..."
          placeholderTextColor={COLORS.textMuted}
          value={ticker}
          onChangeText={setTicker}
          autoCapitalize="characters"
          onSubmitEditing={() => handleSearch()}
        />
        <TouchableOpacity style={styles.btn} onPress={() => handleSearch()}>
          <Text style={styles.btnText}>Riset</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Picks */}
      <View style={styles.quickPicksContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {QUICK_PICKS.map(item => (
            <TouchableOpacity
              key={item}
              style={[styles.chip, ticker.toUpperCase().trim() === item && styles.chipActive]}
              onPress={() => {
                setTicker(item);
                handleSearch(item);
              }}
            >
              <Text style={[styles.chipText, ticker.toUpperCase().trim() === item && styles.chipTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Live Finmorph Connection Banner */}
      <View style={styles.liveBannerContainer}>
        <View style={[styles.liveDot, { backgroundColor: isFinmorphLive ? '#10B981' : '#F59E0B' }]} />
        <Text style={styles.liveBannerText}>
          {isFinmorphLive
            ? 'TERHUBUNG LANGSUNG: Finmorph Platform (finmorphid.com/tools)'
            : 'Menghubungkan ke Platform Finmorph...'}
        </Text>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Mengunduh data riset live Finmorph untuk {ticker}...</Text>
        </View>
      )}

      {quote && !loading && (
        <View style={styles.resultContainer}>
          {/* Main Company Header Card */}
          <View style={styles.headerCard}>
            <View style={styles.companyRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.companyTicker}>{quote.symbol.replace('.JK', '')}</Text>
                {thematic && (
                  <View style={[styles.thematicMiniBadge, { backgroundColor: thematic.badgeColor + '25', borderColor: thematic.badgeColor }]}>
                    <Text style={[styles.thematicMiniText, { color: thematic.badgeColor }]}>{thematic.groupName}</Text>
                  </View>
                )}
              </View>
              <View style={[styles.trendBadge, { backgroundColor: isAboveMa50 ? '#064E3B' : '#7F1D1D' }]}>
                <Text style={[styles.trendBadgeText, { color: isAboveMa50 ? '#34D399' : '#F87171' }]}>
                  {isAboveMa50 ? 'BULLISH > MA50' : 'BEARISH < MA50'}
                </Text>
              </View>
            </View>
            <Text style={styles.companyName}>{quote.longName || quote.shortName || quote.symbol}</Text>
            
            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatRupiah(quote.regularMarketPrice)}</Text>
              <Text style={[styles.chg, { color: isUp ? COLORS.success : COLORS.danger }]}>
                {isUp ? '▲' : '▼'} {formatPercent(quote.regularMarketChangePercent)} ({formatRupiah(quote.regularMarketChange)})
              </Text>
            </View>

            {/* Finmorph Live Identity & Sector (if available) */}
            {finmorphFund?.identity && (
              <View style={styles.identityRow}>
                <Text style={styles.identityText}>
                  Sektor: <Text style={{ color: COLORS.text }}>{finmorphFund.identity.sector || '-'}</Text>
                </Text>
                <Text style={styles.identityText}>
                  Industri: <Text style={{ color: COLORS.text }}>{finmorphFund.identity.industry || '-'}</Text>
                </Text>
              </View>
            )}
          </View>

          {/* Sub-Navigation Tabs */}
          <View style={styles.tabsNavContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.subTab, activeTab === 'smart_money' && styles.subTabActive]}
                onPress={() => setActiveTab('smart_money')}
              >
                <Text style={[styles.subTabText, activeTab === 'smart_money' && styles.subTabTextActive]}>
                  🎯 Smart Money & Radar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.subTab, activeTab === 'fundamental' && styles.subTabActive]}
                onPress={() => setActiveTab('fundamental')}
              >
                <Text style={[styles.subTabText, activeTab === 'fundamental' && styles.subTabTextActive]}>
                  🏛️ Riset 5 Pilar Finmorph
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.subTab, activeTab === 'levels' && styles.subTabActive]}
                onPress={() => setActiveTab('levels')}
              >
                <Text style={[styles.subTabText, activeTab === 'levels' && styles.subTabTextActive]}>
                  📐 Level Pivot & VWAP
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.subTab, activeTab === 'calculator' && styles.subTabActive]}
                onPress={() => setActiveTab('calculator')}
              >
                <Text style={[styles.subTabText, activeTab === 'calculator' && styles.subTabTextActive]}>
                  🧮 Kalkulator Posisi
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.subTab, activeTab === 'thematic' && styles.subTabActive]}
                onPress={() => setActiveTab('thematic')}
              >
                <Text style={[styles.subTabText, activeTab === 'thematic' && styles.subTabTextActive]}>
                  🌐 Grup Konglomerat
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <ErrorBoundary fallbackTitle="Gagal Memuat Riset Saham Finmorph">
            {/* ═════════════════════════════════════════════════════════════════ */}
            {/* TAB 1: 🎯 SMART MONEY FLOW & BANDAR RADAR                         */}
            {/* ═════════════════════════════════════════════════════════════════ */}
            {activeTab === 'smart_money' && (
            <View>
              {/* LIVE FINMORPH SMART MONEY FLOW CARD */}
              {finmorphFlow?.flow && (
                <View style={styles.finmorphFlowCard}>
                  <View style={styles.finmorphFlowHeader}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.finmorphPlatformBadge}>FINMORPH LIVE</Text>
                        <Text style={styles.finmorphFlowTitle}>Smart Money Flow</Text>
                      </View>
                      <Text style={styles.finmorphFlowSub}>
                        Analisa CMF (20D), MFI (14D), OBV & Distribusi Volume
                      </Text>
                    </View>
                    <View style={[styles.verdictBadge, { backgroundColor: getVerdictColor(finmorphFlow.flow.verdict) + '25', borderColor: getVerdictColor(finmorphFlow.flow.verdict) }]}>
                      <Text style={[styles.verdictText, { color: getVerdictColor(finmorphFlow.flow.verdict) }]}>
                        {finmorphFlow.flow.label.toUpperCase()}
                      </Text>
                      <Text style={[styles.verdictGrade, { color: getVerdictColor(finmorphFlow.flow.verdict) }]}>
                        Grade {finmorphFlow.flow.grade.toUpperCase()} (Skor: {finmorphFlow.flow.score > 0 ? '+' : ''}{finmorphFlow.flow.score})
                      </Text>
                    </View>
                  </View>

                  {/* Flow Signals Grid */}
                  <View style={styles.flowSignalsGrid}>
                    <View style={styles.flowSignalBox}>
                      <Text style={styles.flowSignalLabel}>CMF (20D)</Text>
                      <Text style={[styles.flowSignalVal, { color: finmorphFlow.flow.signals.cmf >= 0 ? COLORS.success : COLORS.danger }]}>
                        {finmorphFlow.flow.signals.cmf > 0 ? '+' : ''}{finmorphFlow.flow.signals.cmf}
                      </Text>
                      <Text style={styles.flowSignalDesc}>
                        {finmorphFlow.flow.signals.cmf > 0.05 ? 'Inflow Kuat' : (finmorphFlow.flow.signals.cmf < -0.05 ? 'Outflow Kuat' : 'Seimbang')}
                      </Text>
                    </View>

                    <View style={styles.flowSignalBox}>
                      <Text style={styles.flowSignalLabel}>MFI (14D)</Text>
                      <Text style={[styles.flowSignalVal, { color: finmorphFlow.flow.signals.mfi > 60 ? COLORS.success : (finmorphFlow.flow.signals.mfi < 40 ? COLORS.danger : '#F59E0B') }]}>
                        {finmorphFlow.flow.signals.mfi}
                      </Text>
                      <Text style={styles.flowSignalDesc}>
                        {finmorphFlow.flow.signals.mfi > 80 ? 'Overbought' : (finmorphFlow.flow.signals.mfi < 20 ? 'Oversold' : 'Normal')}
                      </Text>
                    </View>

                    <View style={styles.flowSignalBox}>
                      <Text style={styles.flowSignalLabel}>Arah OBV</Text>
                      <Text style={[styles.flowSignalVal, { color: finmorphFlow.flow.signals.obv.direction === 'naik' ? COLORS.success : (finmorphFlow.flow.signals.obv.direction === 'turun' ? COLORS.danger : COLORS.text) }]}>
                        {finmorphFlow.flow.signals.obv.direction.toUpperCase()}
                      </Text>
                      <Text style={styles.flowSignalDesc}>
                        Bias: {finmorphFlow.flow.signals.obv.bias > 0 ? '+' : ''}{finmorphFlow.flow.signals.obv.bias}
                      </Text>
                    </View>

                    <View style={styles.flowSignalBox}>
                      <Text style={styles.flowSignalLabel}>Up/Down Vol</Text>
                      <Text style={[styles.flowSignalVal, { color: finmorphFlow.flow.signals.up_down.ratio >= 1 ? COLORS.success : COLORS.danger }]}>
                        {finmorphFlow.flow.signals.up_down.ratio}x
                      </Text>
                      <Text style={styles.flowSignalDesc}>
                        {finmorphFlow.flow.signals.up_down.ratio >= 1.2 ? 'Buyer Dominan' : (finmorphFlow.flow.signals.up_down.ratio <= 0.8 ? 'Seller Dominan' : 'Berimbang')}
                      </Text>
                    </View>
                  </View>

                  {/* Volume Spike Alert */}
                  {finmorphFlow.flow.signals.volume.spike && (
                    <View style={styles.volumeSpikeAlert}>
                      <Text style={styles.volumeSpikeText}>
                        🔥 TERDETEKSI LONJAKAN VOLUME (SPIKE) {finmorphFlow.flow.signals.volume.ratio}x DARI RATA-RATA!
                      </Text>
                    </View>
                  )}

                  {/* Official Finmorph Flow Notes */}
                  {finmorphFlow.flow.notes && finmorphFlow.flow.notes.length > 0 && (
                    <View style={styles.finmorphNotesBox}>
                      <Text style={styles.finmorphNotesTitle}>Catatan Analisis Alur Dana Finmorph:</Text>
                      {finmorphFlow.flow.notes.map((note, idx) => (
                        <View key={idx} style={styles.finmorphNoteItem}>
                          <Text style={styles.finmorphNoteBullet}>•</Text>
                          <Text style={styles.finmorphNoteText}>{note}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* LIVE FINMORPH BANDAR RADAR (MOST WANTED AKUMULASI / DISTRIBUSI) */}
              <View style={styles.wantedCard}>
                <View style={styles.wantedHeader}>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.finmorphPlatformBadge}>RADAR PASAR</Text>
                      <Text style={styles.wantedTitle}>Bandar Wanted</Text>
                    </View>
                    <Text style={styles.wantedSub}>Top Emiten Sedang Diakumulasi/Didistribusi Smart Money</Text>
                  </View>
                  <View style={styles.wantedToggleGroup}>
                    <TouchableOpacity
                      style={[styles.wantedToggleBtn, wantedMode === 'akumulasi' && styles.wantedToggleBtnActiveGreen]}
                      onPress={() => handleWantedModeChange('akumulasi')}
                    >
                      <Text style={[styles.wantedToggleText, wantedMode === 'akumulasi' && styles.wantedToggleTextActive]}>
                        Akumulasi
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.wantedToggleBtn, wantedMode === 'distribusi' && styles.wantedToggleBtnActiveRed]}
                      onPress={() => handleWantedModeChange('distribusi')}
                    >
                      <Text style={[styles.wantedToggleText, wantedMode === 'distribusi' && styles.wantedToggleTextActive]}>
                        Distribusi
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {finmorphWanted && finmorphWanted.items && finmorphWanted.items.length > 0 ? (
                  <View style={styles.wantedList}>
                    {finmorphWanted.items.slice(0, 5).map(item => (
                      <TouchableOpacity
                        key={item.symbol}
                        style={[styles.wantedItemRow, item.symbol === ticker.toUpperCase().trim() && styles.wantedItemRowActive]}
                        onPress={() => {
                          setTicker(item.symbol);
                          handleSearch(item.symbol);
                        }}
                      >
                        <View style={styles.wantedRankAndTicker}>
                          <View style={styles.wantedRankCircle}>
                            <Text style={styles.wantedRankNumber}>{item.rank}</Text>
                          </View>
                          <View>
                            <Text style={styles.wantedSymbolText}>{item.symbol}</Text>
                            <Text style={styles.wantedDateText}>{item.date}</Text>
                          </View>
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                          <View style={[styles.wantedHeatBadge, { backgroundColor: item.heat === 'membara' ? '#7F1D1D' : '#064E3B' }]}>
                            <Text style={[styles.wantedHeatText, { color: item.heat === 'membara' ? '#F87171' : '#34D399' }]}>
                              {item.heat.toUpperCase()}
                            </Text>
                          </View>
                          <Text style={[styles.wantedScoreText, { color: item.score >= 0 ? COLORS.success : COLORS.danger }]}>
                            Skor: {item.score >= 0 ? '+' : ''}{item.score}
                          </Text>
                          <Text style={styles.wantedNetText}>
                            Net: {formatRupiah(item.smart_net)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyWantedText}>Memuat data radar bandar...</Text>
                )}
              </View>

              {/* Native Price Chart with Avg Bandar Reference Line */}
              {chartData.length > 0 && (
                <View style={styles.chartContainer}>
                  <View style={styles.chartHeader}>
                    <Text style={styles.sectionTitle}>Trend Harga 30 Hari & Level Avg Bandar</Text>
                    <Text style={styles.chartSub}>Rentang 3 Bulan</Text>
                  </View>
                  <StockChart data={chartData} avgBandar={bandarmology?.avgBandar} />
                </View>
              )}

              {/* Bandar Radar & Modal Bandar Card */}
              {bandarmology && (
                <View style={styles.bandarCard}>
                  <View style={styles.bandarHeader}>
                    <Text style={styles.bandarTitle}>🎯 Estimasi Modal Bandar & Fase Wyckoff</Text>
                    <View style={[styles.phaseTag, { backgroundColor: bandarmology.phaseColor + '20', borderColor: bandarmology.phaseColor }]}>
                      <Text style={[styles.phaseTagText, { color: bandarmology.phaseColor }]}>
                        {bandarmology.wyckoffPhase}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.phaseDesc}>{bandarmology.phaseTitle}</Text>
                  <Text style={styles.phaseSub}>{bandarmology.phaseDesc}</Text>

                  {/* Bandar Cost & Distance Grid */}
                  <View style={styles.bandarStatsGrid}>
                    <View style={styles.bandarStatBox}>
                      <Text style={styles.bandarStatLabel}>Estimasi Avg Bandar</Text>
                      <Text style={styles.bandarStatValue}>{formatRupiah(bandarmology.avgBandar)}</Text>
                      <Text style={styles.bandarStatSub}>20D Volume-Weighted</Text>
                    </View>
                    <View style={styles.bandarStatBox}>
                      <Text style={styles.bandarStatLabel}>Jarak thdp Modal</Text>
                      <Text style={[styles.bandarStatValue, { color: bandarmology.distancePct >= 0 ? (bandarmology.distancePct > 12 ? COLORS.danger : COLORS.success) : COLORS.warning }]}>
                        {bandarmology.distancePct >= 0 ? '+' : ''}{bandarmology.distancePct}%
                      </Text>
                      <Text style={styles.bandarStatSub}>
                        {bandarmology.distancePct >= 0 ? 'Floating Profit Bandar' : 'Di Bawah Modal'}
                      </Text>
                    </View>
                  </View>

                  {/* Entry Zone Indicator */}
                  <View style={[styles.entryZoneBox, { borderColor: bandarmology.entryZoneColor }]}>
                    <Text style={[styles.entryZoneText, { color: bandarmology.entryZoneColor }]}>
                      {bandarmology.entryZone}
                    </Text>
                  </View>

                  {/* 5-Day Smart Money Trail */}
                  <View style={styles.trailSection}>
                    <Text style={styles.trailTitle}>Jejak Alur Smart Money (5 Hari Terakhir)</Text>
                    <View style={styles.trailTable}>
                      {bandarmology.trail5Days.map(day => (
                        <View key={day.dayIndex} style={styles.trailRow}>
                          <Text style={styles.trailDate}>{day.dateLabel}</Text>
                          <Text style={styles.trailPrice}>{formatRupiah(day.close)}</Text>
                          <Text style={[styles.trailChg, { color: day.changePct >= 0 ? COLORS.success : COLORS.danger }]}>
                            {formatPercent(day.changePct)}
                          </Text>
                          <View style={[styles.trailBadge, { backgroundColor: day.isAccumulation ? '#064E3B' : '#7F1D1D' }]}>
                            <Text style={[styles.trailBadgeText, { color: day.isAccumulation ? '#34D399' : '#F87171' }]}>
                              {day.isAccumulation ? 'Inflow 🟢' : 'Outflow 🔴'}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Bandar-Based Trading Plan */}
                  <View style={styles.planSection}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={styles.planTitle}>📋 Trading Plan Berbasis Modal Bandar</Text>
                      {bandarmology.tradingPlan.tickSize ? (
                        <View style={{
                          backgroundColor: 'rgba(56, 189, 248, 0.12)',
                          borderColor: 'rgba(56, 189, 248, 0.4)',
                          borderWidth: 1,
                          borderRadius: 6,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                        }}>
                          <Text style={{ color: '#38BDF8', fontSize: 10, fontWeight: '800' }}>
                            🏷️ Fraksi BEI: ± Rp {bandarmology.tradingPlan.tickSize}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.planGrid}>
                      <View style={styles.planItem}>
                        <Text style={styles.planLabel}>Area Akumulasi</Text>
                        <Text style={[styles.planValue, { color: COLORS.primary }]}>
                          {formatRupiah(bandarmology.tradingPlan.entryMin)} - {formatRupiah(bandarmology.tradingPlan.entryMax)}
                        </Text>
                      </View>
                      <View style={styles.planItem}>
                        <Text style={styles.planLabel}>Stop Loss (SL)</Text>
                        <Text style={[styles.planValue, { color: COLORS.danger }]}>
                          {formatRupiah(bandarmology.tradingPlan.stopLoss)}
                        </Text>
                      </View>
                      <View style={styles.planItem}>
                        <Text style={styles.planLabel}>Target 1 (+8%)</Text>
                        <Text style={[styles.planValue, { color: COLORS.success }]}>
                          {formatRupiah(bandarmology.tradingPlan.tp1)}
                        </Text>
                      </View>
                      <View style={styles.planItem}>
                        <Text style={styles.planLabel}>Target 2 (+18%)</Text>
                        <Text style={[styles.planValue, { color: COLORS.success }]}>
                          {formatRupiah(bandarmology.tradingPlan.tp2)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.rrBox}>
                      <Text style={styles.rrText}>
                        Risk / Reward: <Text style={styles.rrValue}>{bandarmology.tradingPlan.riskReward}</Text>
                      </Text>
                    </View>
                    <Text style={styles.planAdvice}>{bandarmology.tradingPlan.advice}</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: 🏛️ RISET 5 PILAR FUNDAMENTAL (FINMORPH LIVE)               */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === 'fundamental' && (
            <View>
              {/* LIVE FINMORPH 5-PILLARS SCORE CARD */}
              {finmorphFund?.score ? (
                <View style={styles.fundCard}>
                  <View style={styles.fundHeaderRow}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.finmorphPlatformBadge}>FINMORPH LIVE</Text>
                        <Text style={styles.fundScoreTitle}>Skor Riset Fundamental</Text>
                      </View>
                      <Text style={styles.fundScoreSub}>Metodologi 5 Pilar Tertimbang (0 - 100)</Text>
                    </View>
                    <View style={[styles.scoreBadgeCircle, { borderColor: getScoreColor(finmorphFund.score.total) }]}>
                      <Text style={[styles.scoreNumber, { color: getScoreColor(finmorphFund.score.total) }]}>
                        {finmorphFund.score.total}
                      </Text>
                      <Text style={styles.scoreMax}>/100</Text>
                    </View>
                  </View>

                  <View style={[styles.ratingBanner, { backgroundColor: getScoreColor(finmorphFund.score.total) + '20', borderColor: getScoreColor(finmorphFund.score.total) }]}>
                    <Text style={[styles.ratingBannerText, { color: getScoreColor(finmorphFund.score.total) }]}>
                      GRADE {finmorphFund.score.grade} · {finmorphFund.score.label.toUpperCase()}
                    </Text>
                  </View>

                  {/* Red Flags Alert if any (Object/String Safe) */}
                  {finmorphFund.score.red_flags && finmorphFund.score.red_flags.length > 0 && (
                    <View style={styles.redFlagCard}>
                      <Text style={styles.redFlagTitle}>⚠️ Catatan Red Flag Finmorph ({finmorphFund.score.red_flags.length} Peringatan):</Text>
                      {finmorphFund.score.red_flags.map((rf: any, idx: number) => {
                        const isObj = typeof rf === 'object' && rf !== null;
                        const label = isObj ? (rf.label || 'Peringatan Risiko') : String(rf);
                        const detail = isObj ? rf.detail : null;
                        const penalty = isObj && rf.penalty ? `(-${rf.penalty} Poin)` : '';
                        const severity = isObj && rf.severity ? rf.severity : 'medium';
                        const sevColor = severity === 'critical' ? '#EF4444' : (severity === 'high' ? '#F59E0B' : '#EAB308');

                        return (
                          <View key={idx} style={[styles.redFlagItem, { borderLeftColor: sevColor }]}>
                            <View style={styles.redFlagHeaderRow}>
                              <Text style={[styles.redFlagLabelText, { color: sevColor }]}>
                                • {label}
                              </Text>
                              {penalty ? (
                                <Text style={styles.redFlagPenaltyText}>{penalty}</Text>
                              ) : null}
                            </View>
                            {detail ? (
                              <Text style={styles.redFlagDetailText}>{detail}</Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* 5-Pillars Breakdown from Live Finmorph */}
                  <View style={styles.pillarsGrid}>
                    {finmorphFund.score.pillars?.map(pillar => (
                      <View key={pillar.key} style={styles.pillarItem}>
                        <View style={styles.pillarTop}>
                          <Text style={styles.pillarName}>{pillar.label || pillar.key}</Text>
                          <Text style={[styles.pillarScoreVal, { color: getScoreColor(pillar.score) }]}>
                            {pillar.score !== null && pillar.score !== undefined ? `${pillar.score}/100` : '—'}
                          </Text>
                        </View>
                        <View style={styles.meterTrack}>
                          <View style={[styles.meterFill, { width: `${Math.min(100, Math.max(0, pillar.score ?? 0))}%`, backgroundColor: getScoreColor(pillar.score) }]} />
                        </View>
                        {pillar.summary ? <Text style={styles.pillarSummaryText}>{pillar.summary}</Text> : null}

                        {/* Detailed Metrics */}
                        {pillar.metrics && pillar.metrics.length > 0 && (
                          <View style={styles.pillarMetricsList}>
                            {pillar.metrics.map((m, mIdx) => (
                              <View key={mIdx} style={styles.pillarMetricRow}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.metricLabel}>{m.label || 'Metrik'}</Text>
                                  {m.how ? <Text style={styles.metricHow}>{m.how}</Text> : null}
                                </View>
                                <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
                                  <Text style={styles.metricVal}>{String(m.value ?? '—')}</Text>
                                  {m.score !== null && m.score !== undefined ? (
                                    <Text style={[styles.metricScoreBadge, { color: getScoreColor(m.score) }]}>
                                      Skor: {m.score}
                                    </Text>
                                  ) : null}
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>

                  {/* Finmorph Methodology Info */}
                  {finmorphFund.score.methodology && (
                    <Text style={styles.methodologyNote}>
                      ℹ️ {finmorphFund.score.methodology}
                    </Text>
                  )}
                </View>
              ) : (
                /* Fallback local fundamental calculation */
                fundamentals ? (
                  <View style={styles.fundCard}>
                    <View style={styles.fundHeaderRow}>
                      <View>
                        <Text style={styles.fundScoreTitle}>Skor Kualitas Fundamental</Text>
                        <Text style={styles.fundScoreSub}>Metodologi 5 Pilar Riset (0 - 100)</Text>
                      </View>
                      <View style={[styles.scoreBadgeCircle, { borderColor: fundamentals.overallColor }]}>
                        <Text style={[styles.scoreNumber, { color: fundamentals.overallColor }]}>
                          {fundamentals.overallScore}
                        </Text>
                        <Text style={styles.scoreMax}>/100</Text>
                      </View>
                    </View>
                    <View style={[styles.ratingBanner, { backgroundColor: fundamentals.overallColor + '20', borderColor: fundamentals.overallColor }]}>
                      <Text style={[styles.ratingBannerText, { color: fundamentals.overallColor }]}>
                        {fundamentals.overallRating}
                      </Text>
                    </View>
                  </View>
                ) : null
              )}

              {/* LIVE FINMORPH ANALYST CONSENSUS */}
              {finmorphFund?.data?.analyst ? (
                <View style={styles.cardContainer}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={styles.finmorphPlatformBadge}>FINMORPH LIVE</Text>
                    <Text style={styles.sectionTitle}>Konsensus & Target Harga Analis</Text>
                  </View>
                  
                  {finmorphFund.data.analyst.target_mean || (finmorphFund.data.analyst.count && finmorphFund.data.analyst.count > 0) ? (
                    <>
                      <View style={styles.analystBox}>
                        <View style={styles.analystLeft}>
                          <Text style={styles.analystLabel}>Rekomendasi Konsensus</Text>
                          <Text style={styles.analystRating}>
                            {(finmorphFund.data.analyst.recommendation || 'NETRAL').replace(/_/g, ' ').toUpperCase()}
                          </Text>
                          <Text style={styles.analystCountSub}>
                            {finmorphFund.data.analyst.count ? `Berdasarkan ${finmorphFund.data.analyst.count} Analis Sekuritas` : 'Konsensus Pasar'}
                          </Text>
                        </View>
                        <View style={styles.analystRight}>
                          <Text style={styles.analystLabel}>Target Rata-rata</Text>
                          <Text style={styles.analystTargetPrice}>
                            {formatRupiah(finmorphFund.data.analyst.target_mean)}
                          </Text>
                          {finmorphFund.data.analyst.upside_pct !== null && finmorphFund.data.analyst.upside_pct !== undefined ? (
                            <Text style={[styles.analystUpside, { color: finmorphFund.data.analyst.upside_pct >= 0 ? COLORS.success : COLORS.danger }]}>
                              Potensi: {finmorphFund.data.analyst.upside_pct >= 0 ? '+' : ''}{finmorphFund.data.analyst.upside_pct}%
                            </Text>
                          ) : null}
                          {finmorphFund.data.analyst.target_low && finmorphFund.data.analyst.target_high ? (
                            <Text style={styles.analystRangeSub}>
                              Rentang: {formatRupiah(finmorphFund.data.analyst.target_low)} - {formatRupiah(finmorphFund.data.analyst.target_high)}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      {/* Analyst Trend Breakdown */}
                      {finmorphFund.data.analyst.trend && (
                        <View style={styles.analystTrendGrid}>
                          <View style={[styles.trendBox, { backgroundColor: '#064E3B' }]}>
                            <Text style={[styles.trendVal, { color: '#34D399' }]}>{finmorphFund.data.analyst.trend.strong_buy ?? 0}</Text>
                            <Text style={styles.trendLabel}>Strong Buy</Text>
                          </View>
                          <View style={[styles.trendBox, { backgroundColor: '#065F46' }]}>
                            <Text style={[styles.trendVal, { color: '#6EE7B7' }]}>{finmorphFund.data.analyst.trend.buy ?? 0}</Text>
                            <Text style={styles.trendLabel}>Buy</Text>
                          </View>
                          <View style={[styles.trendBox, { backgroundColor: '#78350F' }]}>
                            <Text style={[styles.trendVal, { color: '#FCD34D' }]}>{finmorphFund.data.analyst.trend.hold ?? 0}</Text>
                            <Text style={styles.trendLabel}>Hold</Text>
                          </View>
                          <View style={[styles.trendBox, { backgroundColor: '#7F1D1D' }]}>
                            <Text style={[styles.trendVal, { color: '#F87171' }]}>
                              {(finmorphFund.data.analyst.trend.sell ?? 0) + (finmorphFund.data.analyst.trend.strong_sell ?? 0)}
                            </Text>
                            <Text style={styles.trendLabel}>Sell</Text>
                          </View>
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={styles.analystEmptyBox}>
                      <Text style={styles.analystEmptyText}>
                        Belum ada target konsensus analis sekuritas untuk emiten ini.
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                /* Fallback local analyst info */
                fundamentals && (
                  <View style={styles.cardContainer}>
                    <Text style={styles.sectionTitle}>🎯 Konsensus & Target Harga Analis</Text>
                    <View style={styles.analystBox}>
                      <View style={styles.analystLeft}>
                        <Text style={styles.analystLabel}>Rekomendasi Konsensus</Text>
                        <Text style={styles.analystRating}>{fundamentals.analyst.rating}</Text>
                      </View>
                      <View style={styles.analystRight}>
                        <Text style={styles.analystLabel}>Target Harga Rata-rata</Text>
                        <Text style={styles.analystTargetPrice}>{formatRupiah(fundamentals.analyst.targetMean)}</Text>
                        <Text style={[styles.analystUpside, { color: fundamentals.analyst.upsidePct >= 0 ? COLORS.success : COLORS.danger }]}>
                          Potensi Kenaikan: {fundamentals.analyst.upsidePct >= 0 ? '+' : ''}{fundamentals.analyst.upsidePct}%
                        </Text>
                      </View>
                    </View>
                  </View>
                )
              )}

              {/* LIVE FINMORPH VALUATION & PROFITABILITY DETAILED TABLE */}
              {finmorphFund?.data?.valuation && (
                <View style={styles.cardContainer}>
                  <Text style={styles.sectionTitle}>Valuasi & Rasio Finansial Utama (Finmorph)</Text>
                  {renderStat('Trailing P/E Ratio (PER)', formatX(finmorphFund.data.valuation.trailing_pe))}
                  {renderStat('Forward P/E Ratio', formatX(finmorphFund.data.valuation.forward_pe))}
                  {renderStat('Price to Book (PBV)', formatX(finmorphFund.data.valuation.price_to_book))}
                  {renderStat('Price to Sales (P/S)', formatX(finmorphFund.data.valuation.price_to_sales))}
                  {renderStat('Earnings Yield', finmorphFund.data.valuation.earnings_yield !== null && finmorphFund.data.valuation.earnings_yield !== undefined ? `${finmorphFund.data.valuation.earnings_yield}%` : '—')}
                  {renderStat('EPS (Laba Bersih per Saham)', formatRupiah(finmorphFund.data.valuation.eps))}
                  {renderStat('Book Value per Share', formatRupiah(finmorphFund.data.valuation.book_value))}
                  {finmorphFund.data.profitability && (
                    <>
                      {renderStat('Return on Equity (ROE)', formatRatioPct(finmorphFund.data.profitability.roe))}
                      {renderStat('Return on Assets (ROA)', formatRatioPct(finmorphFund.data.profitability.roa))}
                      {renderStat('Operating Margin', formatRatioPct(finmorphFund.data.profitability.operating_margin))}
                      {renderStat('Net Profit Margin', formatRatioPct(finmorphFund.data.profitability.net_margin))}
                    </>
                  )}
                </View>
              )}

              {/* Empty state fallback if neither Finmorph nor local data is available */}
              {!finmorphFund?.score && !fundamentals && (
                <View style={styles.cardContainer}>
                  <Text style={styles.sectionTitle}>Data Riset Fundamental</Text>
                  <Text style={styles.analystEmptyText}>
                    Data riset fundamental untuk emiten ini belum tersedia atau sedang dalam pemutakhiran.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 3: 📐 LEVEL INTRADAY (PIVOT POINTS & VWAP BANDS)              */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === 'levels' && (
            <View>
              {/* Method Selector */}
              <View style={styles.pivotMethodBar}>
                <TouchableOpacity
                  style={[styles.pivotMethodBtn, pivotMethod === 'classic' && styles.pivotMethodBtnActive]}
                  onPress={() => setPivotMethod('classic')}
                >
                  <Text style={[styles.pivotMethodText, pivotMethod === 'classic' && styles.pivotMethodTextActive]}>Classic</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pivotMethodBtn, pivotMethod === 'fibonacci' && styles.pivotMethodBtnActive]}
                  onPress={() => setPivotMethod('fibonacci')}
                >
                  <Text style={[styles.pivotMethodText, pivotMethod === 'fibonacci' && styles.pivotMethodTextActive]}>Fibonacci</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pivotMethodBtn, pivotMethod === 'camarilla' && styles.pivotMethodBtnActive]}
                  onPress={() => setPivotMethod('camarilla')}
                >
                  <Text style={[styles.pivotMethodText, pivotMethod === 'camarilla' && styles.pivotMethodTextActive]}>Camarilla</Text>
                </TouchableOpacity>
              </View>

              {/* Ladder Table: Live Finmorph or Local Fallback */}
              <View style={styles.cardContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={styles.finmorphPlatformBadge}>FINMORPH LIVE</Text>
                  <Text style={styles.sectionTitle}>
                    Tangga Level Pivot ({pivotMethod.toUpperCase()})
                  </Text>
                </View>

                {finmorphLevels?.pivots ? (
                  <View style={styles.ladderTable}>
                    {(() => {
                      const curPrice = finmorphLevels.price || quote.regularMarketPrice;
                      const p = finmorphLevels.pivots[pivotMethod];
                      if (!p) return null;
                      
                      let rows: Array<{ label: string; value: number; type: 'res' | 'pp' | 'sup' }> = [];
                      if (pivotMethod === 'camarilla') {
                        const cam = p as any;
                        rows = [
                          { label: 'R4', value: cam.r4, type: 'res' },
                          { label: 'R3', value: cam.r3, type: 'res' },
                          { label: 'R2', value: cam.r2, type: 'res' },
                          { label: 'R1', value: cam.r1, type: 'res' },
                          { label: 'PP', value: cam.pp, type: 'pp' },
                          { label: 'S1', value: cam.s1, type: 'sup' },
                          { label: 'S2', value: cam.s2, type: 'sup' },
                          { label: 'S3', value: cam.s3, type: 'sup' },
                          { label: 'S4', value: cam.s4, type: 'sup' },
                        ];
                      } else {
                        const std = p as any;
                        rows = [
                          { label: 'R3', value: std.r3, type: 'res' },
                          { label: 'R2', value: std.r2, type: 'res' },
                          { label: 'R1', value: std.r1, type: 'res' },
                          { label: 'PP', value: std.pp, type: 'pp' },
                          { label: 'S1', value: std.s1, type: 'sup' },
                          { label: 'S2', value: std.s2, type: 'sup' },
                          { label: 'S3', value: std.s3, type: 'sup' },
                        ];
                      }

                      return rows.map((lvl, i) => {
                        let color = COLORS.text;
                        let tagColor = COLORS.textMuted;
                        if (lvl.type === 'res') { color = COLORS.danger; tagColor = COLORS.danger; }
                        else if (lvl.type === 'sup') { color = COLORS.success; tagColor = COLORS.success; }
                        else if (lvl.type === 'pp') { color = COLORS.primary; tagColor = COLORS.primary; }

                        const diff = curPrice ? ((lvl.value - curPrice) / curPrice) * 100 : 0;

                        return (
                          <View key={i} style={[styles.ladderRow, lvl.type === 'pp' && styles.ladderRowPp]}>
                            <View style={styles.ladderLabelGroup}>
                              <Text style={[styles.ladderLabel, { color: tagColor }]}>{lvl.label}</Text>
                              <Text style={styles.ladderType}>{lvl.type === 'res' ? 'Resistance' : (lvl.type === 'sup' ? 'Support' : 'Pivot Center')}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={[styles.ladderPrice, { color }]}>{formatRupiah(lvl.value)}</Text>
                              <Text style={[styles.ladderDiff, { color: diff >= 0 ? COLORS.success : COLORS.danger }]}>
                                {diff >= 0 ? '+' : ''}{diff.toFixed(2)}%
                              </Text>
                            </View>
                          </View>
                        );
                      });
                    })()}
                  </View>
                ) : (
                  pivots && (
                    <View style={styles.ladderTable}>
                      {pivots[pivotMethod].map((lvl, i) => {
                        let color = COLORS.text;
                        let tagColor = COLORS.textMuted;
                        if (lvl.type === 'res') { color = COLORS.danger; tagColor = COLORS.danger; }
                        else if (lvl.type === 'sup') { color = COLORS.success; tagColor = COLORS.success; }
                        else if (lvl.type === 'pp') { color = COLORS.primary; tagColor = COLORS.primary; }

                        const diff = quote.regularMarketPrice ? ((lvl.value - quote.regularMarketPrice) / quote.regularMarketPrice) * 100 : 0;

                        return (
                          <View key={i} style={[styles.ladderRow, lvl.type === 'pp' && styles.ladderRowPp]}>
                            <View style={styles.ladderLabelGroup}>
                              <Text style={[styles.ladderLabel, { color: tagColor }]}>{lvl.label}</Text>
                              <Text style={styles.ladderType}>{lvl.type === 'res' ? 'Resistance' : (lvl.type === 'sup' ? 'Support' : 'Pivot Center')}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={[styles.ladderPrice, { color }]}>{formatRupiah(lvl.value)}</Text>
                              <Text style={[styles.ladderDiff, { color: diff >= 0 ? COLORS.success : COLORS.danger }]}>
                                {diff >= 0 ? '+' : ''}{diff.toFixed(2)}%
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )
                )}
              </View>

              {/* Session VWAP & Sigma Bands Card: Live Finmorph or Local Fallback */}
              <View style={styles.cardContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={styles.finmorphPlatformBadge}>FINMORPH LIVE</Text>
                  <Text style={styles.sectionTitle}>Level Sesi VWAP & Rentang Deviasi (±σ)</Text>
                </View>

                {finmorphLevels?.vwap ? (
                  <View style={styles.vwapGrid}>
                    <View style={styles.vwapRow}>
                      <Text style={[styles.vwapLabel, { color: COLORS.danger }]}>+2σ (Overbought / Reversal Sell)</Text>
                      <Text style={[styles.vwapVal, { color: COLORS.danger }]}>{formatRupiah(finmorphLevels.vwap.bands.u2)}</Text>
                    </View>
                    <View style={styles.vwapRow}>
                      <Text style={[styles.vwapLabel, { color: '#F59E0B' }]}>+1σ (Upper Band)</Text>
                      <Text style={[styles.vwapVal, { color: '#F59E0B' }]}>{formatRupiah(finmorphLevels.vwap.bands.u1)}</Text>
                    </View>
                    <View style={[styles.vwapRow, { backgroundColor: COLORS.surfaceLight, paddingVertical: 8, borderRadius: 6 }]}>
                      <Text style={[styles.vwapLabel, { color: COLORS.primary, fontWeight: 'bold' }]}>🎯 Session VWAP Center ({finmorphLevels.vwap.timeframe})</Text>
                      <Text style={[styles.vwapVal, { color: COLORS.primary, fontWeight: 'bold' }]}>{formatRupiah(finmorphLevels.vwap.value)}</Text>
                    </View>
                    <View style={styles.vwapRow}>
                      <Text style={[styles.vwapLabel, { color: '#34D399' }]}>-1σ (Lower Band)</Text>
                      <Text style={[styles.vwapVal, { color: '#34D399' }]}>{formatRupiah(finmorphLevels.vwap.bands.l1)}</Text>
                    </View>
                    <View style={styles.vwapRow}>
                      <Text style={[styles.vwapLabel, { color: COLORS.success }]}>-2σ (Oversold / Reversal Buy)</Text>
                      <Text style={[styles.vwapVal, { color: COLORS.success }]}>{formatRupiah(finmorphLevels.vwap.bands.l2)}</Text>
                    </View>
                  </View>
                ) : (
                  vwapBands && (
                    <View style={styles.vwapGrid}>
                      <View style={styles.vwapRow}>
                        <Text style={[styles.vwapLabel, { color: COLORS.danger }]}>+2σ (Overbought / Reversal Sell)</Text>
                        <Text style={[styles.vwapVal, { color: COLORS.danger }]}>{formatRupiah(vwapBands.upper2)}</Text>
                      </View>
                      <View style={styles.vwapRow}>
                        <Text style={[styles.vwapLabel, { color: '#F59E0B' }]}>+1σ (Upper Band)</Text>
                        <Text style={[styles.vwapVal, { color: '#F59E0B' }]}>{formatRupiah(vwapBands.upper1)}</Text>
                      </View>
                      <View style={[styles.vwapRow, { backgroundColor: COLORS.surfaceLight, paddingVertical: 8, borderRadius: 6 }]}>
                        <Text style={[styles.vwapLabel, { color: COLORS.primary, fontWeight: 'bold' }]}>🎯 Session VWAP Center</Text>
                        <Text style={[styles.vwapVal, { color: COLORS.primary, fontWeight: 'bold' }]}>{formatRupiah(vwapBands.vwap)}</Text>
                      </View>
                      <View style={styles.vwapRow}>
                        <Text style={[styles.vwapLabel, { color: '#34D399' }]}>-1σ (Lower Band)</Text>
                        <Text style={[styles.vwapVal, { color: '#34D399' }]}>{formatRupiah(vwapBands.lower1)}</Text>
                      </View>
                      <View style={styles.vwapRow}>
                        <Text style={[styles.vwapLabel, { color: COLORS.success }]}>-2σ (Oversold / Reversal Buy)</Text>
                        <Text style={[styles.vwapVal, { color: COLORS.success }]}>{formatRupiah(vwapBands.lower2)}</Text>
                      </View>
                    </View>
                  )
                )}
              </View>
            </View>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 4: 🧮 KALKULATOR POSISI & MONEY MANAGEMENT                   */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === 'calculator' && (
            <PositionCalculator
              currentPrice={quote.regularMarketPrice}
              suggestedSl={bandarmology?.tradingPlan.stopLoss}
              suggestedTp={bandarmology?.tradingPlan.tp1}
            />
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 5: 🌐 KONGLOMERAT & SENTIMEN PASAR                           */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === 'thematic' && (
            <View>
              {/* Conglomerate Group Affiliation */}
              {thematic ? (
                <View style={styles.cardContainer}>
                  <View style={styles.thematicHeader}>
                    <Text style={styles.sectionTitle}>🏛️ Afiliasi Grup Konglomerat</Text>
                    <View style={[styles.thematicBadge, { backgroundColor: thematic.badgeColor }]}>
                      <Text style={styles.thematicBadgeText}>{thematic.owner}</Text>
                    </View>
                  </View>
                  <Text style={[styles.thematicName, { color: thematic.badgeColor }]}>{thematic.groupName}</Text>
                  <Text style={styles.thematicDesc}>{thematic.description}</Text>

                  <Text style={styles.thematicStocksTitle}>Saham Terkait dalam Satu Grup:</Text>
                  <View style={styles.thematicChipsRow}>
                    {thematic.relatedStocks.map(s => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.thematicStockChip, s === quote.symbol.replace('.JK', '') && styles.thematicStockChipActive]}
                        onPress={() => {
                          setTicker(s);
                          handleSearch(s);
                        }}
                      >
                        <Text style={[styles.thematicStockText, s === quote.symbol.replace('.JK', '') && styles.thematicStockTextActive]}>
                          {s}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.cardContainer}>
                  <Text style={styles.sectionTitle}>🏛️ Afiliasi Grup Konglomerat</Text>
                  <Text style={styles.thematicDesc}>
                    Emiten ini merupakan entitas mandiri atau belum terafiliasi dengan grup konglomerasi utama bursa.
                  </Text>
                </View>
              )}

              {/* LIVE FINMORPH FEAR & GREED MARKET SENTIMENT */}
              <View style={styles.cardContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={styles.finmorphPlatformBadge}>FINMORPH LIVE</Text>
                  <Text style={styles.sectionTitle}>Sentimen Pasar: Fear & Greed Index</Text>
                </View>

                {finmorphFng?.stock ? (
                  <View>
                    <View style={styles.fngBox}>
                      <Text style={[styles.fngScore, { color: getScoreColor(finmorphFng.stock.value) }]}>
                        {finmorphFng.stock.value}
                      </Text>
                      <Text style={[styles.fngLabel, { color: getScoreColor(finmorphFng.stock.value) }]}>
                        {finmorphFng.stock.label.toUpperCase()}
                      </Text>
                      <Text style={styles.fngLevelSub}>
                        Kategori Pasar Saham: {finmorphFng.stock.level.toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.fngMeterBar}>
                      <View style={[styles.fngPointer, { left: `${Math.min(95, Math.max(5, finmorphFng.stock.value))}%`, backgroundColor: getScoreColor(finmorphFng.stock.value) }]} />
                    </View>

                    <View style={styles.fngScaleRow}>
                      <Text style={styles.fngScaleText}>0 (Extreme Fear)</Text>
                      <Text style={styles.fngScaleText}>50 (Neutral)</Text>
                      <Text style={styles.fngScaleText}>100 (Extreme Greed)</Text>
                    </View>

                    {/* Stock Components from Finmorph */}
                    {finmorphFng.stock.components && (
                      <View style={styles.fngComponentsGrid}>
                        <View style={styles.fngComponentBox}>
                          <Text style={styles.fngComponentLabel}>Momentum</Text>
                          <Text style={styles.fngComponentVal}>{finmorphFng.stock.components.momentum}</Text>
                        </View>
                        <View style={styles.fngComponentBox}>
                          <Text style={styles.fngComponentLabel}>Volatilitas</Text>
                          <Text style={styles.fngComponentVal}>{finmorphFng.stock.components.volatility}</Text>
                        </View>
                        <View style={styles.fngComponentBox}>
                          <Text style={styles.fngComponentLabel}>Safe Haven</Text>
                          <Text style={styles.fngComponentVal}>{finmorphFng.stock.components.safe_haven}</Text>
                        </View>
                      </View>
                    )}

                    {/* Crypto Comparison from Finmorph */}
                    {finmorphFng.crypto && (
                      <View style={styles.cryptoFngBox}>
                        <Text style={styles.cryptoFngLabel}>Pembanding Pasar Kripto:</Text>
                        <Text style={[styles.cryptoFngVal, { color: getScoreColor(finmorphFng.crypto.value) }]}>
                          {finmorphFng.crypto.value}/100 ({finmorphFng.crypto.label})
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View>
                    <View style={styles.fngBox}>
                      <Text style={[styles.fngScore, { color: localFng.color }]}>{localFng.score}</Text>
                      <Text style={[styles.fngLabel, { color: localFng.color }]}>{localFng.label}</Text>
                    </View>
                    <View style={styles.fngMeterBar}>
                      <View style={[styles.fngPointer, { left: `${localFng.score}%`, backgroundColor: localFng.color }]} />
                    </View>
                  </View>
                )}
              </View>

              {/* Fundamental Overview fallback table */}
              <View style={styles.cardContainer}>
                <Text style={styles.sectionTitle}>Data Fundamental & Teknikal Dasar</Text>
                {renderStat('Previous Close', formatRupiah(quote.regularMarketPreviousClose))}
                {renderStat('Open', formatRupiah(quote.regularMarketOpen))}
                {renderStat('Rentang Harian (Low - High)', `${formatRupiah(quote.regularMarketDayLow)} - ${formatRupiah(quote.regularMarketDayHigh)}`)}
                {renderStat('Rentang 52 Minggu', `${formatRupiah(quote.fiftyTwoWeekLow)} - ${formatRupiah(quote.fiftyTwoWeekHigh)}`)}
                {renderStat('Volume Transaksi', formatVolume(quote.regularMarketVolume))}
                {renderStat('Rata-rata Volume (3 Bulan)', formatVolume(quote.averageDailyVolume3Month))}
                {renderStat('P/E Ratio (PER)', formatX(quote.trailingPE))}
                {renderStat('Price to Book (PBV)', formatX(quote.priceToBook))}
                {renderStat('Market Capitalization', formatRupiah(quote.marketCap))}
                {renderStat('Rata-rata Bergerak MA 50', formatRupiah(quote.fiftyDayAverage))}
                {renderStat('Rata-rata Bergerak MA 200', formatRupiah(quote.twoHundredDayAverage))}
              </View>
            </View>
          )}
          </ErrorBoundary>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchBox: {
    flexDirection: 'row',
    padding: SIZES.padding,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    color: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: SIZES.radius,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: SIZES.font,
  },
  btn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: SIZES.radius,
  },
  btnText: {
    color: COLORS.background,
    fontWeight: 'bold',
    fontSize: SIZES.font,
  },
  quickPicksContainer: {
    paddingVertical: 8,
    paddingHorizontal: SIZES.padding,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceLight,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.8,
    fontWeight: 'bold',
  },
  chipTextActive: {
    color: COLORS.background,
  },
  liveBannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 6,
    paddingHorizontal: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  liveBannerText: {
    color: '#94A3B8',
    fontSize: SIZES.font * 0.72,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  center: {
    paddingVertical: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textMuted,
    marginTop: 12,
  },
  resultContainer: {
    padding: SIZES.padding,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: COLORS.surface,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  companyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  companyTicker: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.5,
    fontWeight: '900',
  },
  thematicMiniBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  thematicMiniText: {
    fontSize: SIZES.font * 0.7,
    fontWeight: 'bold',
  },
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  trendBadgeText: {
    fontSize: SIZES.font * 0.75,
    fontWeight: 'bold',
  },
  companyName: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.9,
    marginTop: 4,
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  price: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.8,
    fontWeight: 'bold',
  },
  chg: {
    fontSize: SIZES.font * 0.95,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  identityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceLight,
  },
  identityText: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
  },
  tabsNavContainer: {
    marginBottom: 14,
  },
  subTab: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  subTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  subTabText: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.85,
    fontWeight: 'bold',
  },
  subTabTextActive: {
    color: COLORS.background,
  },
  finmorphPlatformBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    color: COLORS.primary,
    fontSize: SIZES.font * 0.65,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  finmorphFlowCard: {
    backgroundColor: COLORS.surface,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.5)',
  },
  finmorphFlowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  finmorphFlowTitle: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.15,
    fontWeight: 'bold',
  },
  finmorphFlowSub: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
    marginTop: 2,
  },
  verdictBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  verdictText: {
    fontSize: SIZES.font * 0.95,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  verdictGrade: {
    fontSize: SIZES.font * 0.7,
    fontWeight: 'bold',
    marginTop: 1,
  },
  flowSignalsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  flowSignalBox: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 3,
    alignItems: 'center',
  },
  flowSignalLabel: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.7,
    marginBottom: 3,
  },
  flowSignalVal: {
    fontSize: SIZES.font * 1.15,
    fontWeight: 'bold',
  },
  flowSignalDesc: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.65,
    marginTop: 2,
  },
  volumeSpikeAlert: {
    backgroundColor: '#7F1D1D',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginVertical: 8,
    alignItems: 'center',
  },
  volumeSpikeText: {
    color: '#FCA5A5',
    fontWeight: '900',
    fontSize: SIZES.font * 0.75,
  },
  finmorphNotesBox: {
    backgroundColor: COLORS.surfaceLight,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  finmorphNotesTitle: {
    color: COLORS.text,
    fontSize: SIZES.font * 0.85,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  finmorphNoteItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  finmorphNoteBullet: {
    color: COLORS.primary,
    marginRight: 6,
    fontSize: SIZES.font * 0.85,
  },
  finmorphNoteText: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.8,
    flex: 1,
    lineHeight: 18,
  },
  wantedCard: {
    backgroundColor: COLORS.surface,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  wantedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  wantedTitle: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.05,
    fontWeight: 'bold',
  },
  wantedSub: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.72,
    marginTop: 2,
  },
  wantedToggleGroup: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceLight,
    padding: 2,
    borderRadius: 6,
  },
  wantedToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  wantedToggleBtnActiveGreen: {
    backgroundColor: COLORS.success,
  },
  wantedToggleBtnActiveRed: {
    backgroundColor: COLORS.danger,
  },
  wantedToggleText: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
    fontWeight: 'bold',
  },
  wantedToggleTextActive: {
    color: '#FFFFFF',
  },
  wantedList: {
    gap: 8,
  },
  wantedItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  wantedItemRowActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  wantedRankAndTicker: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wantedRankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  wantedRankNumber: {
    color: COLORS.textMuted,
    fontWeight: 'bold',
    fontSize: SIZES.font * 0.8,
  },
  wantedSymbolText: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: SIZES.font * 1.05,
  },
  wantedDateText: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.65,
  },
  wantedHeatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 2,
  },
  wantedHeatText: {
    fontSize: SIZES.font * 0.65,
    fontWeight: '900',
  },
  wantedScoreText: {
    fontSize: SIZES.font * 0.8,
    fontWeight: 'bold',
  },
  wantedNetText: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.7,
  },
  emptyWantedText: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.8,
    textAlign: 'center',
    paddingVertical: 10,
  },
  chartContainer: {
    backgroundColor: COLORS.surface,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chartSub: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
  },
  bandarCard: {
    backgroundColor: COLORS.surface,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  bandarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bandarTitle: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.05,
    fontWeight: 'bold',
  },
  phaseTag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  phaseTagText: {
    fontSize: SIZES.font * 0.75,
    fontWeight: 'bold',
  },
  phaseDesc: {
    color: COLORS.primary,
    fontSize: SIZES.font * 1.05,
    fontWeight: 'bold',
    marginTop: 4,
  },
  phaseSub: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.85,
    marginTop: 2,
    lineHeight: 18,
  },
  bandarStatsGrid: {
    flexDirection: 'row',
    marginVertical: 12,
    justifyContent: 'space-between',
  },
  bandarStatBox: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  bandarStatLabel: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
    marginBottom: 4,
  },
  bandarStatValue: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.3,
    fontWeight: 'bold',
  },
  bandarStatSub: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.7,
    marginTop: 2,
  },
  entryZoneBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    marginBottom: 14,
  },
  entryZoneText: {
    fontWeight: 'bold',
    fontSize: SIZES.font * 0.85,
  },
  trailSection: {
    marginBottom: 14,
  },
  trailTitle: {
    color: COLORS.text,
    fontSize: SIZES.font * 0.9,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  trailTable: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    overflow: 'hidden',
  },
  trailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  trailDate: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
    width: 60,
  },
  trailPrice: {
    color: COLORS.text,
    fontSize: SIZES.font * 0.8,
    fontWeight: 'bold',
  },
  trailChg: {
    fontSize: SIZES.font * 0.75,
    fontWeight: 'bold',
  },
  trailBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  trailBadgeText: {
    fontSize: SIZES.font * 0.7,
    fontWeight: 'bold',
  },
  planSection: {
    backgroundColor: COLORS.surfaceLight,
    padding: 12,
    borderRadius: 8,
  },
  planTitle: {
    color: COLORS.text,
    fontSize: SIZES.font * 0.9,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  planGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  planItem: {
    width: '48%',
    marginBottom: 8,
  },
  planLabel: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
    marginBottom: 2,
  },
  planValue: {
    fontSize: SIZES.font * 0.9,
    fontWeight: 'bold',
  },
  rrBox: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.surface,
    marginTop: 4,
  },
  rrText: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.8,
  },
  rrValue: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  planAdvice: {
    color: COLORS.text,
    fontSize: SIZES.font * 0.8,
    lineHeight: 18,
    marginTop: 4,
    fontStyle: 'italic',
  },
  cardContainer: {
    backgroundColor: COLORS.surface,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.05,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  fundCard: {
    backgroundColor: COLORS.surface,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  fundHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fundScoreTitle: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.15,
    fontWeight: 'bold',
  },
  fundScoreSub: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
    marginTop: 2,
  },
  scoreBadgeCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
  },
  scoreNumber: {
    fontSize: SIZES.font * 1.4,
    fontWeight: '900',
    lineHeight: 24,
  },
  scoreMax: {
    fontSize: SIZES.font * 0.65,
    color: COLORS.textMuted,
  },
  ratingBanner: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 14,
  },
  ratingBannerText: {
    fontWeight: '900',
    fontSize: SIZES.font * 0.85,
    letterSpacing: 0.5,
  },
  redFlagCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
  },
  redFlagTitle: {
    color: '#F87171',
    fontWeight: 'bold',
    fontSize: SIZES.font * 0.85,
    marginBottom: 8,
  },
  redFlagItem: {
    backgroundColor: COLORS.surfaceLight,
    padding: 9,
    borderRadius: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
  },
  redFlagHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  redFlagLabelText: {
    fontWeight: 'bold',
    fontSize: SIZES.font * 0.8,
    flex: 1,
  },
  redFlagPenaltyText: {
    color: '#F87171',
    fontWeight: 'bold',
    fontSize: SIZES.font * 0.75,
    marginLeft: 8,
  },
  redFlagDetailText: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.72,
    lineHeight: 16,
    marginTop: 3,
  },
  analystEmptyBox: {
    backgroundColor: COLORS.surfaceLight,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  analystEmptyText: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.8,
    textAlign: 'center',
    lineHeight: 18,
  },
  pillarsGrid: {
    gap: 12,
  },
  pillarItem: {
    backgroundColor: COLORS.surfaceLight,
    padding: 12,
    borderRadius: 8,
  },
  pillarTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pillarName: {
    color: COLORS.text,
    fontSize: SIZES.font * 0.95,
    fontWeight: 'bold',
  },
  pillarScoreVal: {
    fontSize: SIZES.font * 0.9,
    fontWeight: '900',
  },
  meterTrack: {
    height: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  meterFill: {
    height: '100%',
    borderRadius: 3,
  },
  pillarSummaryText: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
    marginBottom: 8,
  },
  pillarMetricsList: {
    borderTopWidth: 1,
    borderTopColor: COLORS.surface,
    paddingTop: 6,
    gap: 6,
  },
  pillarMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  metricLabel: {
    color: COLORS.text,
    fontSize: SIZES.font * 0.78,
    fontWeight: 'bold',
  },
  metricHow: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.68,
    lineHeight: 14,
  },
  metricVal: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: SIZES.font * 0.85,
  },
  metricScoreBadge: {
    fontSize: SIZES.font * 0.7,
    fontWeight: 'bold',
  },
  methodologyNote: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.72,
    marginTop: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  analystBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceLight,
    padding: 12,
    borderRadius: 8,
  },
  analystLeft: {
    justifyContent: 'center',
  },
  analystRight: {
    alignItems: 'flex-end',
  },
  analystLabel: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
    marginBottom: 4,
  },
  analystRating: {
    color: COLORS.success,
    fontSize: SIZES.font * 1.3,
    fontWeight: '900',
  },
  analystCountSub: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.7,
    marginTop: 2,
  },
  analystTargetPrice: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.2,
    fontWeight: 'bold',
  },
  analystUpside: {
    fontSize: SIZES.font * 0.8,
    fontWeight: 'bold',
    marginTop: 2,
  },
  analystRangeSub: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.7,
    marginTop: 2,
  },
  analystTrendGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 6,
  },
  trendBox: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  trendVal: {
    fontWeight: '900',
    fontSize: SIZES.font * 1.05,
  },
  trendLabel: {
    color: '#FFFFFF',
    fontSize: SIZES.font * 0.65,
    fontWeight: 'bold',
    marginTop: 2,
  },
  pivotMethodBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: 6,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pivotMethodBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  pivotMethodBtnActive: {
    backgroundColor: COLORS.primary,
  },
  pivotMethodText: {
    color: COLORS.textMuted,
    fontWeight: 'bold',
    fontSize: SIZES.font * 0.85,
  },
  pivotMethodTextActive: {
    color: COLORS.background,
  },
  ladderTable: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    overflow: 'hidden',
  },
  ladderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  ladderRowPp: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  ladderLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ladderLabel: {
    fontWeight: '900',
    fontSize: SIZES.font * 0.9,
    width: 80,
  },
  ladderType: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
  },
  ladderPrice: {
    fontWeight: 'bold',
    fontSize: SIZES.font * 0.95,
  },
  ladderDiff: {
    fontSize: SIZES.font * 0.75,
    marginTop: 1,
  },
  vwapGrid: {
    gap: 8,
  },
  vwapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  vwapLabel: {
    fontSize: SIZES.font * 0.85,
  },
  vwapVal: {
    fontSize: SIZES.font * 0.9,
    fontWeight: 'bold',
  },
  thematicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  thematicBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  thematicBadgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: SIZES.font * 0.75,
  },
  thematicName: {
    fontSize: SIZES.font * 1.3,
    fontWeight: '900',
    marginBottom: 6,
  },
  thematicDesc: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.85,
    lineHeight: 20,
    marginBottom: 14,
  },
  thematicStocksTitle: {
    color: COLORS.text,
    fontSize: SIZES.font * 0.85,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  thematicChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thematicStockChip: {
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  thematicStockChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  thematicStockText: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: SIZES.font * 0.8,
  },
  thematicStockTextActive: {
    color: COLORS.background,
  },
  fngBox: {
    alignItems: 'center',
    marginVertical: 10,
  },
  fngScore: {
    fontSize: 52,
    fontWeight: '900',
    lineHeight: 56,
  },
  fngLabel: {
    fontSize: SIZES.font * 1.1,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 4,
  },
  fngLevelSub: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
    marginTop: 2,
  },
  fngMeterBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceLight,
    position: 'relative',
    marginVertical: 12,
  },
  fngPointer: {
    position: 'absolute',
    top: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  fngScaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fngScaleText: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.7,
  },
  fngComponentsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  fngComponentBox: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  fngComponentLabel: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.7,
    marginBottom: 2,
  },
  fngComponentVal: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: SIZES.font * 0.95,
  },
  cryptoFngBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    padding: 10,
    borderRadius: 6,
    marginTop: 6,
  },
  cryptoFngLabel: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.8,
  },
  cryptoFngVal: {
    fontWeight: 'bold',
    fontSize: SIZES.font * 0.85,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.9,
  },
  statValue: {
    color: COLORS.text,
    fontSize: SIZES.font * 0.9,
    fontWeight: 'bold',
  },
});
