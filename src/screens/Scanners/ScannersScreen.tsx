import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';
import { ALGO_UNIVERSES } from '../../constants/universe';
import {
  runRekomendasiBesok,
  runAlgoPrediksi,
  runAlgoScalping,
  runAraHunter,
  runScanner,
  runRecehScanner,
  AlgoResult,
  SCANNER_ORDERFLOW_OPTIONS,
  OrderflowOption,
} from '../../utils/algorithms';
import { formatPercent, formatRupiah } from '../../utils/formatters';
import AdvancedAiModal from '../../components/AdvancedAiModal';

type ScannerType = 'rekomendasiBesok' | 'prediksi' | 'scalping' | 'ara' | 'superEasy' | 'receh' | 'semua';

export default function ScannersScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState<ScannerType>('rekomendasiBesok');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AlgoResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected Order Flow & Bandarmology filters (from the 8 user criteria)
  const [selectedFlowFilters, setSelectedFlowFilters] = useState<string[]>([]);
  const [activeInfoFilter, setActiveInfoFilter] = useState<string | null>(null);

  // Advanced AI Gemini Modal State
  const [selectedAiStock, setSelectedAiStock] = useState<AlgoResult | null>(null);
  const [isAiModalVisible, setIsAiModalVisible] = useState(false);

  const handleOpenAiAnalysis = (stock: AlgoResult) => {
    setSelectedAiStock(stock);
    setIsAiModalVisible(true);
  };

  const handleCloseAiAnalysis = () => {
    setIsAiModalVisible(false);
    setSelectedAiStock(null);
  };

  // Execute scan for given scanner category
  const executeScan = async (type: ScannerType) => {
    setActiveTab(type);
    setLoading(true);
    setResults([]);
    try {
      let res: AlgoResult[] = [];
      if (type === 'rekomendasiBesok') {
        res = await runRekomendasiBesok(ALGO_UNIVERSES.rekomendasiBesok);
      } else if (type === 'prediksi') {
        res = await runAlgoPrediksi(ALGO_UNIVERSES.prediksi);
      } else if (type === 'scalping') {
        res = await runAlgoScalping(ALGO_UNIVERSES.scalping);
      } else if (type === 'ara') {
        res = await runAraHunter(ALGO_UNIVERSES.arahunter);
      } else if (type === 'superEasy') {
        res = await runScanner(ALGO_UNIVERSES.superEasy);
      } else if (type === 'receh') {
        res = await runRecehScanner(ALGO_UNIVERSES.receh);
      } else if (type === 'semua') {
        // Full comprehensive universe covering all active IDX stocks & FCA
        res = await runAraHunter(ALGO_UNIVERSES.semua);
      }
      setResults(res);
    } catch (e) {
      console.error('[ScannersScreen] Error during scan:', e);
    }
    setLoading(false);
  };

  // Auto-scan on initial screen load (Default: Rekomendasi Saham Besok)
  useEffect(() => {
    executeScan('rekomendasiBesok');
  }, []);

  // Toggle order flow filter
  const toggleFlowFilter = (filterId: string) => {
    setActiveInfoFilter(filterId);
    setSelectedFlowFilters(prev => {
      if (prev.includes(filterId)) {
        const next = prev.filter(id => id !== filterId);
        if (next.length === 0) setActiveInfoFilter(null);
        return next;
      } else {
        return [...prev, filterId];
      }
    });
  };

  // Reset all flow filters
  const handleResetFlowFilters = () => {
    setSelectedFlowFilters([]);
    setActiveInfoFilter(null);
  };

  // Quick select single filter
  const handleSingleSelectFilter = (filterId: string) => {
    if (selectedFlowFilters.length === 1 && selectedFlowFilters[0] === filterId) {
      setSelectedFlowFilters([]);
      setActiveInfoFilter(null);
    } else {
      setSelectedFlowFilters([filterId]);
      setActiveInfoFilter(filterId);
    }
  };

  // Calculate match counts for all 8 criteria in current results
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    SCANNER_ORDERFLOW_OPTIONS.forEach(opt => {
      counts[opt.id] = results.filter(r => r.orderflowTags?.includes(opt.id)).length;
    });
    return counts;
  }, [results]);

  // Filter and sort results
  const filteredResults = useMemo(() => {
    let list = results;

    // 1. Text search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(item =>
        item.ticker.toLowerCase().includes(q) ||
        (item.name && item.name.toLowerCase().includes(q))
      );
    }

    // 2. Order Flow & Bandarmology 8 criteria filters
    if (selectedFlowFilters.length === 1) {
      const targetId = selectedFlowFilters[0];
      list = list.filter(item => item.orderflowTags?.includes(targetId));
    } else if (selectedFlowFilters.length > 1) {
      // Prioritize stocks that match ALL selected filters
      const strictMatches = list.filter(item =>
        selectedFlowFilters.every(fid => item.orderflowTags?.includes(fid))
      );

      if (strictMatches.length > 0) {
        list = strictMatches;
      } else {
        // Otherwise show stocks that match any, sorted by match count descending
        list = list
          .map(item => ({
            ...item,
            _matchCount: selectedFlowFilters.filter(fid => item.orderflowTags?.includes(fid)).length,
          }))
          .filter((item: any) => item._matchCount > 0)
          .sort((a: any, b: any) => b._matchCount - a._matchCount);
      }
    }

    return list;
  }, [results, searchQuery, selectedFlowFilters]);

  const activeOptionDef = useMemo(() => {
    const idToFind = activeInfoFilter || (selectedFlowFilters.length > 0 ? selectedFlowFilters[0] : null);
    return idToFind ? SCANNER_ORDERFLOW_OPTIONS.find(o => o.id === idToFind) : null;
  }, [activeInfoFilter, selectedFlowFilters]);

  const renderTab = (type: ScannerType, label: string) => {
    const isSpecial = type === 'rekomendasiBesok';
    return (
      <TouchableOpacity
        key={type}
        style={[
          styles.tab,
          isSpecial && styles.tabSpecial,
          activeTab === type && (isSpecial ? styles.tabSpecialActive : styles.tabActive),
        ]}
        onPress={() => executeScan(type)}
      >
        <Text
          style={[
            styles.tabText,
            isSpecial && styles.tabSpecialText,
            activeTab === type && styles.tabTextActive,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const getBadgeStyle = (text?: string) => {
    if (!text) return { bg: COLORS.surfaceLight, fg: COLORS.textMuted };
    if (
      text.includes('HIGH') ||
      text.includes('HOT') ||
      text.includes('ARA') ||
      text.includes('STRONG BUY') ||
      text.includes('TOP PICK') ||
      text.includes('RECEH POTENSIAL')
    ) {
      return { bg: '#064E3B', fg: '#34D399' }; // Emerald Green
    }
    if (
      text.includes('ACCUMULATION') ||
      text.includes('AKTIF') ||
      text.includes('BUY') ||
      text.includes('BANDAR') ||
      text.includes('SCALP') ||
      text.includes('SWING')
    ) {
      return { bg: '#1E3A8A', fg: '#60A5FA' }; // Blue
    }
    if (
      text.includes('SPECULATIVE') ||
      text.includes('WAIT') ||
      text.includes('NEUTRAL') ||
      text.includes('CONFIRM') ||
      text.includes('FCA')
    ) {
      return { bg: '#78350F', fg: '#FBBF24' }; // Amber
    }
    return { bg: '#7F1D1D', fg: '#F87171' }; // Red
  };

  const renderItem = (item: AlgoResult, idx: number) => {
    const isUp = item.chgPct >= 0;
    const badgeText = item.pred || item.status || item.action || '';
    const badgeColors = getBadgeStyle(badgeText);
    const isRekomendasiBesok = activeTab === 'rekomendasiBesok' || !!item.buyArea;

    return (
      <View key={`${item.ticker}-${idx}`} style={[styles.resultCard, isRekomendasiBesok && styles.resultCardSpecial]}>
        {/* Card Header: Ticker, Name, Badge, Price */}
        <View style={styles.cardHeader}>
          <View style={styles.tickerGroup}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <Text style={styles.ticker}>{item.ticker}</Text>
              {isRekomendasiBesok && (
                <View style={styles.rankPill}>
                  <Text style={styles.rankPillText}>#{idx + 1}</Text>
                </View>
              )}
              <View style={[styles.statusBadge, { backgroundColor: badgeColors.bg }]}>
                <Text style={[styles.statusText, { color: badgeColors.fg }]}>{badgeText}</Text>
              </View>
            </View>
            {item.name ? <Text style={styles.stockName}>{item.name}</Text> : null}
          </View>
          <View style={styles.priceGroup}>
            <Text style={styles.price}>{formatRupiah(item.price)}</Text>
            <Text style={[styles.chg, { color: isUp ? COLORS.success : COLORS.danger }]}>
              {isUp ? '▲' : '▼'} {formatPercent(item.chgPct)}
            </Text>
          </View>
        </View>

        {/* Katalis & Analisis Bandar (For Rekomendasi Besok) */}
        {item.catalyst && (
          <View style={styles.catalystBox}>
            <Text style={styles.catalystLabel}>💡 Analisis Bandar & Katalis:</Text>
            <Text style={styles.catalystText}>{item.catalyst}</Text>
          </View>
        )}

        {/* 8 Order Flow Matched Tags for this Stock */}
        {item.orderflowTags && item.orderflowTags.length > 0 && (
          <View style={styles.stockFlowTagsContainer}>
            <Text style={styles.stockFlowLabel}>Order Flow / Bandar ({item.orderflowTags.length} Kriteria):</Text>
            <View style={styles.stockFlowBadgesWrap}>
              {item.orderflowTags.map(tagId => {
                const opt = SCANNER_ORDERFLOW_OPTIONS.find(o => o.id === tagId);
                if (!opt) return null;
                const isFilterActive = selectedFlowFilters.includes(tagId);
                return (
                  <TouchableOpacity
                    key={tagId}
                    style={[
                      styles.stockTagBadge,
                      { borderColor: opt.color, backgroundColor: opt.bgColor },
                      isFilterActive && styles.stockTagBadgeHighlighted,
                    ]}
                    onPress={() => handleSingleSelectFilter(tagId)}
                  >
                    <Text style={[styles.stockTagText, { color: opt.color }]}>
                      {opt.icon} {opt.shortLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* TRADING PLAN GRID (Khusus Rekomendasi Saham Besok) */}
        {isRekomendasiBesok && item.buyArea && (
          <View style={styles.tradingPlanContainer}>
            <View style={styles.tradingPlanRow}>
              <View style={styles.planCol}>
                <Text style={styles.planLabel}>Area Beli (Entry)</Text>
                <Text style={styles.planValueGreen}>{item.buyArea}</Text>
              </View>
              <View style={styles.planCol}>
                <Text style={styles.planLabel}>Risk / Reward</Text>
                <Text style={styles.planValueCyan}>{item.riskReward}</Text>
              </View>
              {item.tickSize && (
                <View style={[styles.planCol, { alignItems: 'flex-end' }]}>
                  <Text style={styles.planLabel}>Fraksi BEI</Text>
                  <View style={{
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: 'rgba(56, 189, 248, 0.3)',
                    marginTop: 2,
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#38BDF8' }}>
                      ± Rp {item.tickSize}
                    </Text>
                  </View>
                </View>
              )}
            </View>
            <View style={styles.tradingPlanDivider} />
            <View style={styles.tradingPlanRow}>
              <View style={styles.planCol}>
                <Text style={styles.planLabel}>Target Profit 1</Text>
                <Text style={styles.planValueBlue}>
                  {item.targetPrice1 ? formatRupiah(item.targetPrice1) : '—'} (+{item.tp1PctActual !== undefined ? item.tp1PctActual : 5}%)
                </Text>
              </View>
              <View style={styles.planCol}>
                <Text style={styles.planLabel}>Target 2 (ARA)</Text>
                <Text style={styles.planValueBlue}>
                  {item.targetPrice2 ? formatRupiah(item.targetPrice2) : '—'} (+{item.tp2PctActual !== undefined ? item.tp2PctActual : 10}%)
                </Text>
              </View>
              <View style={styles.planCol}>
                <Text style={styles.planLabel}>Stop Loss (SL)</Text>
                <Text style={styles.planValueRed}>
                  {item.stopLoss ? formatRupiah(item.stopLoss) : '—'} (-{item.slPctActual !== undefined ? item.slPctActual : 3.5}%)
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Key Numerical Metrics */}
        <View style={styles.cardFooter}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Skor Quant</Text>
            <Text style={styles.metricValue}>{item.skor}/100</Text>
          </View>
          {item.volSpike !== undefined && (
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Vol Spike</Text>
              <Text style={styles.metricValue}>{item.volSpike}x</Text>
            </View>
          )}
          {item.trend && (
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Tren</Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: item.trend === 'UPTREND' ? COLORS.success : COLORS.danger },
                ]}
              >
                {item.trend}
              </Text>
            </View>
          )}
          {item.bullPower !== undefined && (
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Bull Power</Text>
              <Text style={styles.metricValue}>{item.bullPower}%</Text>
            </View>
          )}
          {item.volat !== undefined && (
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Volatilitas</Text>
              <Text style={styles.metricValue}>{item.volat}%</Text>
            </View>
          )}
        </View>

        {/* Action Buttons: AI Advanced Analysis & 5 Pillars Finmorph */}
        <View style={styles.cardActionsContainer}>
          <TouchableOpacity
            style={styles.btnAiAction}
            onPress={() => handleOpenAiAnalysis(item)}
          >
            <Text style={styles.btnAiActionText}>
              🤖 Analisa Lanjutan AI (Gemini) ➔
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnAction}
            onPress={() => navigation?.navigate('Analysis', { ticker: item.ticker })}
          >
            <Text style={styles.btnActionText}>
              🔍 Riset 5 Pilar Finmorph ({item.ticker})
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. Base Scanner Category Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {renderTab('rekomendasiBesok', '⭐ Rekomendasi Besok')}
          {renderTab('prediksi', 'Algo Prediksi')}
          {renderTab('scalping', 'Scalping Intraday')}
          {renderTab('ara', 'ARA Hunter v3.0')}
          {renderTab('superEasy', 'Trend Follower')}
          {renderTab('receh', 'Saham Receh (1-150)')}
          {renderTab('semua', 'Semua Saham (Master)')}
        </ScrollView>
      </View>

      {/* 2. THE 8 ORDER FLOW & BANDARMOLOGY OPTIONS (Available in EVERY Scanner) */}
      <View style={styles.flowSection}>
        <View style={styles.flowSectionHeader}>
          <View style={styles.flowHeaderLeft}>
            <View style={styles.flowDot} />
            <Text style={styles.flowSectionTitle}>8 PILIHAN ORDER FLOW & BANDAR</Text>
          </View>
          {selectedFlowFilters.length > 0 && (
            <TouchableOpacity onPress={handleResetFlowFilters} style={styles.btnResetFilters}>
              <Text style={styles.btnResetFiltersText}>Reset Filter ({selectedFlowFilters.length})</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.flowSectionSubtitle}>
          Saring hasil scanner dengan karakteristik transaksi & jejak bandar di bawah ini:
        </Text>

        {/* Horizontal Chips for the 8 User Options */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.flowChipsScroll}
        >
          {/* Quick "Semua" Pill */}
          <TouchableOpacity
            style={[
              styles.flowChip,
              selectedFlowFilters.length === 0 && styles.flowChipAllActive,
            ]}
            onPress={handleResetFlowFilters}
          >
            <Text
              style={[
                styles.flowChipText,
                selectedFlowFilters.length === 0 && styles.flowChipTextActive,
              ]}
            >
              ✨ Semua ({results.length})
            </Text>
          </TouchableOpacity>

          {/* The 8 Specific User Options */}
          {SCANNER_ORDERFLOW_OPTIONS.map((opt: OrderflowOption) => {
            const isSelected = selectedFlowFilters.includes(opt.id);
            const count = filterCounts[opt.id] || 0;

            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.flowChip,
                  isSelected && {
                    backgroundColor: opt.color,
                    borderColor: opt.color,
                  },
                ]}
                onPress={() => toggleFlowFilter(opt.id)}
              >
                <Text
                  style={[
                    styles.flowChipText,
                    isSelected && { color: '#0F172A', fontWeight: '900' },
                  ]}
                >
                  {opt.icon} {opt.label}
                </Text>
                <View
                  style={[
                    styles.flowCountBadge,
                    isSelected
                      ? { backgroundColor: '#0F172A' }
                      : { backgroundColor: 'rgba(255,255,255,0.08)' },
                  ]}
                >
                  <Text
                    style={[
                      styles.flowCountBadgeText,
                      isSelected ? { color: opt.color } : { color: COLORS.textMuted },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Explanation Card when an Option is Active */}
        {activeOptionDef && (
          <View
            style={[
              styles.infoCallout,
              { borderLeftColor: activeOptionDef.color, backgroundColor: activeOptionDef.bgColor },
            ]}
          >
            <View style={styles.infoCalloutHeader}>
              <Text style={[styles.infoCalloutTitle, { color: activeOptionDef.color }]}>
                {activeOptionDef.icon} {activeOptionDef.label}
              </Text>
              <Text style={styles.infoCalloutCount}>
                {filterCounts[activeOptionDef.id] || 0} Saham Terdeteksi
              </Text>
            </View>
            <Text style={styles.infoCalloutDesc}>
              "{activeOptionDef.desc}"
            </Text>
          </View>
        )}
      </View>

      {/* 3. Search and Count Summary Bar */}
      <View style={styles.filterBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari kode atau nama saham (cth: BBRI)..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="characters"
        />
        <View style={styles.countBadgeWrap}>
          <Text style={styles.countText}>
            {loading ? 'Scanning...' : `${filteredResults.length} / ${results.length} Saham`}
          </Text>
        </View>
      </View>

      {/* 4. Results List / Loading State */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {activeTab === 'rekomendasiBesok'
              ? 'Menghitung skor multi-metode & rencana trading besok...'
              : 'Menjalankan scan & menganalisis orderflow...'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.resultsContainer}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => executeScan(activeTab)}
              tintColor={COLORS.primary}
            />
          }
        >
          {filteredResults.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>Tidak ada saham ditemukan</Text>
              <Text style={styles.emptySub}>
                {selectedFlowFilters.length > 0
                  ? `Tidak ada emiten di "${activeTab}" yang memenuhi kriteria pilihan order flow terpilih.`
                  : searchQuery
                  ? 'Coba ubah kata kunci pencarian.'
                  : 'Kondisi pasar saat ini belum memenuhi kriteria scanner.'}
              </Text>
              {selectedFlowFilters.length > 0 && (
                <TouchableOpacity
                  style={styles.btnEmptyReset}
                  onPress={handleResetFlowFilters}
                >
                  <Text style={styles.btnEmptyResetText}>Reset Pilihan Order Flow</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredResults.map((r, i) => renderItem(r, i))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Advanced AI Gemini Analysis Modal */}
      {selectedAiStock && (
        <AdvancedAiModal
          visible={isAiModalVisible}
          onClose={handleCloseAiAnalysis}
          ticker={selectedAiStock.ticker}
          stockName={selectedAiStock.name}
          currentPrice={selectedAiStock.price}
          currentChangePct={selectedAiStock.chgPct}
          onNavigateAnalysis={(t) => navigation?.navigate('Analysis', { ticker: t })}
        />
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
    paddingVertical: 10,
    paddingHorizontal: SIZES.padding / 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: COLORS.surface,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabActive: {
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    borderColor: '#38BDF8',
  },
  tabSpecial: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  tabSpecialActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  tabSpecialText: {
    color: '#FBBF24',
    fontWeight: '800',
  },
  tabText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: SIZES.font * 0.85,
  },
  tabTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },

  // ---------------- 8 ORDER FLOW OPTIONS SECTION ----------------
  flowSection: {
    backgroundColor: '#0c1a24',
    paddingVertical: 12,
    paddingHorizontal: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: '#1e3345',
  },
  flowSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  flowHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00c8ff',
    marginRight: 8,
  },
  flowSectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#00c8ff',
    letterSpacing: 1,
  },
  flowSectionSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 10,
  },
  btnResetFilters: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  btnResetFiltersText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: 'bold',
  },
  flowChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  flowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  flowChipAllActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  flowChipText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  flowChipTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  flowCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  flowCountBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  infoCallout: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  infoCalloutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  infoCalloutTitle: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoCalloutCount: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  infoCalloutDesc: {
    fontSize: 12,
    color: '#e2e8f0',
    fontStyle: 'italic',
    lineHeight: 16,
  },

  // ---------------- FILTER / SEARCH BAR ----------------
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchInput: {
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
  countBadgeWrap: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  countText: {
    color: COLORS.primary,
    fontSize: SIZES.font * 0.8,
    fontWeight: 'bold',
  },

  // ---------------- RESULTS CONTAINER & CARDS ----------------
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textMuted,
    marginTop: 12,
    fontSize: SIZES.font * 0.9,
  },
  resultsContainer: {
    padding: SIZES.padding,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
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
    lineHeight: 18,
  },
  btnEmptyReset: {
    marginTop: 14,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  btnEmptyResetText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 12,
  },
  resultCard: {
    backgroundColor: '#111827',
    padding: SIZES.padding,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  resultCardSpecial: {
    borderColor: 'rgba(245, 158, 11, 0.5)',
    backgroundColor: '#101A26',
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 10,
    marginBottom: 8,
  },
  tickerGroup: {
    flex: 1,
  },
  ticker: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: SIZES.font * 1.25,
    marginRight: 6,
  },
  rankPill: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 6,
  },
  rankPillText: {
    color: '#0f172a',
    fontSize: 10,
    fontWeight: '900',
  },
  stockName: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: SIZES.font * 0.75,
    fontWeight: 'bold',
  },
  priceGroup: {
    alignItems: 'flex-end',
  },
  price: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.15,
    fontWeight: 'bold',
  },
  chg: {
    fontSize: SIZES.font * 0.85,
    fontWeight: 'bold',
    marginTop: 2,
  },

  // Katalis box
  catalystBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
  },
  catalystLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fbbf24',
    marginBottom: 2,
  },
  catalystText: {
    fontSize: 11,
    color: '#e2e8f0',
    lineHeight: 16,
  },

  // Stock card order flow badges
  stockFlowTagsContainer: {
    marginVertical: 6,
  },
  stockFlowLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  stockFlowBadgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stockTagBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  stockTagBadgeHighlighted: {
    borderWidth: 1.5,
    elevation: 2,
  },
  stockTagText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // ---------------- TRADING PLAN GRID (REKOMENDASI BESOK) ----------------
  tradingPlanContainer: {
    backgroundColor: '#0b1620',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#1e3345',
  },
  tradingPlanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tradingPlanDivider: {
    height: 1,
    backgroundColor: '#1e3345',
    marginVertical: 8,
  },
  planCol: {
    alignItems: 'flex-start',
  },
  planLabel: {
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 2,
    fontWeight: '600',
  },
  planValueGreen: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '900',
  },
  planValueCyan: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '900',
  },
  planValueBlue: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '700',
  },
  planValueRed: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '700',
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
    marginBottom: 2,
  },
  metricValue: {
    color: COLORS.text,
    fontSize: SIZES.font * 0.85,
    fontWeight: 'bold',
  },
  btnAction: {
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnActionText: {
    color: '#38BDF8',
    fontSize: SIZES.font * 0.82,
    fontWeight: '700',
  },
  cardActionsContainer: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 12,
  },
  btnAiAction: {
    backgroundColor: 'rgba(168, 85, 247, 0.16)',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    borderColor: '#A855F7',
    borderWidth: 1,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  btnAiActionText: {
    color: '#E9D5FF',
    fontSize: SIZES.font * 0.88,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
