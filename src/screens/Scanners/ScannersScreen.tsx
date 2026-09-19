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
  runAraHunter,
  AlgoResult,
  SCANNER_ORDERFLOW_OPTIONS,
  OrderflowOption,
} from '../../utils/algorithms';
import { formatPercent, formatRupiah } from '../../utils/formatters';
import AdvancedAiModal from '../../components/AdvancedAiModal';

type ScannerType = 'rekomendasiBesok' | 'ara';
type AraSubFilter = 'semua' | 'open_low' | 'potensi' | 'locked';

export default function ScannersScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState<ScannerType>('rekomendasiBesok');
  const [araSubFilter, setAraSubFilter] = useState<AraSubFilter>('semua');
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
        // Full universe scanning: All 935 listed companies in Bursa Efek Indonesia
        res = await runRekomendasiBesok(ALGO_UNIVERSES.semua);
      } else if (type === 'ara') {
        // Full universe scanning: All 935 listed companies in Bursa Efek Indonesia
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

  // ARA Sub-filter counts
  const araCounts = useMemo(() => {
    if (activeTab !== 'ara') return { total: 0, openLow: 0, potensi: 0, locked: 0 };
    return {
      total: results.length,
      openLow: results.filter(r => r.isOpenEqualsLow).length,
      potensi: results.filter(r => !r.isLockedAra && (r.distanceToAraPct || 100) <= 12 && r.skor >= 60).length,
      locked: results.filter(r => r.isLockedAra).length,
    };
  }, [results, activeTab]);

  // Filter and sort results
  const filteredResults = useMemo(() => {
    let list = results;

    // 1. ARA Sub-Filter (when in ARA Hunter Pro mode)
    if (activeTab === 'ara') {
      if (araSubFilter === 'open_low') {
        list = list.filter(item => item.isOpenEqualsLow);
      } else if (araSubFilter === 'potensi') {
        list = list.filter(item => !item.isLockedAra && (item.distanceToAraPct || 100) <= 12 && item.skor >= 60);
      } else if (araSubFilter === 'locked') {
        list = list.filter(item => item.isLockedAra);
      }
    }

    // 2. Text search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(item =>
        item.ticker.toLowerCase().includes(q) ||
        (item.name && item.name.toLowerCase().includes(q))
      );
    }

    // 3. Order Flow & Bandarmology 8 criteria filters
    if (selectedFlowFilters.length === 1) {
      const targetId = selectedFlowFilters[0];
      list = list.filter(item => item.orderflowTags?.includes(targetId));
    } else if (selectedFlowFilters.length > 1) {
      const strictMatches = list.filter(item =>
        selectedFlowFilters.every(fid => item.orderflowTags?.includes(fid))
      );
      if (strictMatches.length > 0) {
        list = strictMatches;
      } else {
        list = list.filter(item =>
          selectedFlowFilters.some(fid => item.orderflowTags?.includes(fid))
        );
      }
    }

    return list;
  }, [results, searchQuery, selectedFlowFilters, activeTab, araSubFilter]);

  const activeOptionDef = useMemo(() => {
    if (!activeInfoFilter) return null;
    return SCANNER_ORDERFLOW_OPTIONS.find(o => o.id === activeInfoFilter);
  }, [activeInfoFilter]);

  const renderTab = (type: ScannerType, title: string, subtitle?: string) => {
    const isActive = activeTab === type;
    return (
      <TouchableOpacity
        key={type}
        style={[
          styles.mainTabBtn,
          isActive && styles.mainTabBtnActive,
        ]}
        onPress={() => executeScan(type)}
        activeOpacity={0.8}
      >
        <Text style={[styles.mainTabTitle, isActive && styles.mainTabTitleActive]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.mainTabSub, isActive && styles.mainTabSubActive]}>
            {subtitle}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const getBadgeStyle = (text?: string) => {
    if (!text) return { bg: COLORS.surfaceLight, fg: COLORS.textMuted };
    if (
      text.includes('LOCKED') ||
      text.includes('DIGEMBOK') ||
      text.includes('HIGH') ||
      text.includes('TOP PICK') ||
      text.includes('SUPER')
    ) {
      return { bg: '#064E3B', fg: '#34D399' }; // Emerald Green
    }
    if (
      text.includes('POTENSI') ||
      text.includes('BREAKOUT') ||
      text.includes('ACCELERATION') ||
      text.includes('MOMENTUM')
    ) {
      return { bg: '#1E3A8A', fg: '#60A5FA' }; // Blue
    }
    if (
      text.includes('ENTRY') ||
      text.includes('EARLY') ||
      text.includes('WEAKNESS')
    ) {
      return { bg: '#78350F', fg: '#FBBF24' }; // Amber
    }
    return { bg: '#7F1D1D', fg: '#F87171' }; // Red
  };

  const renderItem = (item: AlgoResult, idx: number) => {
    const isUp = item.chgPct >= 0;
    const badgeText = item.pred || item.status || item.araStage || '';
    const badgeColors = getBadgeStyle(badgeText);
    const isRekomendasiBesok = activeTab === 'rekomendasiBesok';
    const isAraHunter = activeTab === 'ara';

    return (
      <View key={`${item.ticker}-${idx}`} style={[styles.resultCard, (isRekomendasiBesok || item.isLockedAra) && styles.resultCardSpecial]}>
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
              {item.isLockedAra && (
                <View style={styles.lockedHeaderPill}>
                  <Text style={styles.lockedHeaderPillText}>🔒 ARA LOCKED</Text>
                </View>
              )}
              {item.isOpenEqualsLow && (
                <View style={styles.olHeaderPill}>
                  <Text style={styles.olHeaderPillText}>⚡ O = L</Text>
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
        {item.catalyst && isRekomendasiBesok && (
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

        {/* KHUSUS ARA HUNTER PRO: METRIK RESMI ARA & JARAK ARA */}
        {isAraHunter && (
          <View style={styles.araCardBox}>
            <View style={styles.tradingPlanRow}>
              <View style={styles.planCol}>
                <Text style={styles.planLabel}>Target Harga ARA</Text>
                <Text style={styles.araTargetPrice}>
                  {item.araPrice ? formatRupiah(item.araPrice) : '—'}
                  <Text style={{ fontSize: 11, color: '#34D399', fontWeight: '800' }}> (+{item.maxAraPct}%)</Text>
                </Text>
              </View>

              <View style={styles.planCol}>
                <Text style={styles.planLabel}>Sisa Jarak ke ARA</Text>
                {item.isLockedAra ? (
                  <View style={styles.araLockedPill}>
                    <Text style={styles.araLockedPillText}>🔒 MENTOK ARA</Text>
                  </View>
                ) : (
                  <Text style={styles.araDistanceValue}>
                    +{item.distanceToAraPct}% <Text style={{ color: '#94A3B8', fontSize: 10 }}>({item.distanceTicks} Tick)</Text>
                  </Text>
                )}
              </View>

              <View style={[styles.planCol, { alignItems: 'flex-end' }]}>
                <Text style={styles.planLabel}>Karakteristik O=L</Text>
                {item.isOpenEqualsLow ? (
                  <View style={styles.olBadgeYes}>
                    <Text style={styles.olBadgeYesText}>⚡ OPEN = LOW</Text>
                  </View>
                ) : (
                  <Text style={styles.olBadgeNoText}>Open Rp {item.open}</Text>
                )}
              </View>
            </View>

            <View style={styles.tradingPlanDivider} />

            <View style={styles.tradingPlanRow}>
              <View style={styles.planCol}>
                <Text style={styles.planLabel}>Stop Loss Proteksi</Text>
                <Text style={styles.planValueRed}>
                  {item.stopLoss ? formatRupiah(item.stopLoss) : '—'}
                </Text>
              </View>
              <View style={styles.planCol}>
                <Text style={styles.planLabel}>Risk / Reward</Text>
                <Text style={styles.planValueCyan}>{item.riskReward || '1 : 2.5'}</Text>
              </View>
              <View style={[styles.planCol, { alignItems: 'flex-end' }]}>
                <Text style={styles.planLabel}>Fraksi BEI</Text>
                <Text style={{ color: '#38BDF8', fontSize: 11, fontWeight: '800' }}>
                  ± Rp {item.tickSize} / tick
                </Text>
              </View>
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
          {item.bullPower !== undefined && (
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Bull Power</Text>
              <Text style={styles.metricValue}>{item.bullPower}%</Text>
            </View>
          )}
          {item.turnoverIdr !== undefined && item.turnoverIdr > 0 && (
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Turnover</Text>
              <Text style={styles.metricValue}>
                Rp {(item.turnoverIdr / 1000000000).toFixed(1)} M
              </Text>
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
      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => executeScan(activeTab)}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* 1. FOCUS SCREENER TABS: Rekomendasi Besok & ARA Hunter Pro */}
        <View style={styles.tabsContainer}>
        <View style={styles.mainTabsGrid}>
          {renderTab(
            'rekomendasiBesok', 
            '⭐ Rekomendasi Besok', 
            'Multi-Metode Kuantitatif + Fraksi BEI'
          )}
          {renderTab(
            'ara', 
            '🚀 ARA Hunter Pro', 
            'Semua 935 Saham BEI • Open=Low'
          )}
        </View>
      </View>

      {/* ARA Hunter Sub-Filter Selector (Only active when in ARA Hunter tab) */}
      {activeTab === 'ara' && (
        <View style={styles.araSubFilterSection}>
          <Text style={styles.araSubFilterHeader}>
            🔍 Kategori ARA ({results.length} Saham Terdeteksi dari 935 Emiten BEI):
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.araSubChipsScroll}>
            <TouchableOpacity 
              style={[styles.araSubChip, araSubFilter === 'semua' && styles.araSubChipActive]}
              onPress={() => setAraSubFilter('semua')}
            >
              <Text style={[styles.araSubChipText, araSubFilter === 'semua' && styles.araSubChipTextActive]}>
                🌐 Semua ({araCounts.total})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.araSubChip, araSubFilter === 'open_low' && styles.araSubChipActive]}
              onPress={() => setAraSubFilter('open_low')}
            >
              <Text style={[styles.araSubChipText, araSubFilter === 'open_low' && styles.araSubChipTextActive]}>
                ⚡ Open = Low ({araCounts.openLow})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.araSubChip, araSubFilter === 'potensi' && styles.araSubChipActive]}
              onPress={() => setAraSubFilter('potensi')}
            >
              <Text style={[styles.araSubChipText, araSubFilter === 'potensi' && styles.araSubChipTextActive]}>
                🔥 Potensi ARA ({araCounts.potensi})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.araSubChip, araSubFilter === 'locked' && styles.araSubChipActive]}
              onPress={() => setAraSubFilter('locked')}
            >
              <Text style={[styles.araSubChipText, araSubFilter === 'locked' && styles.araSubChipTextActive]}>
                🔒 Digembok ARA ({araCounts.locked})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* 2. THE 8 ORDER FLOW & BANDARMOLOGY OPTIONS */}
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
          Saring hasil scanner dengan karakteristik transaksi & jejak bandar:
        </Text>

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
                  {opt.icon} {opt.shortLabel}
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
          placeholder="Cari kode atau nama saham (cth: BBRI, DEWA)..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="characters"
        />
        <View style={styles.countBadgeWrap}>
          <Text style={styles.countText}>
            {loading ? 'Memindai...' : `${filteredResults.length} / ${results.length} Saham`}
          </Text>
        </View>
      </View>

      {/* 4. Results List / Loading State */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {activeTab === 'ara'
              ? 'Memindai seluruh 935 saham BEI & menghitung jarak ke harga ARA...'
              : 'Memindai seluruh 935 saham BEI & menyaring akumulasi terkuat besok...'}
          </Text>
        </View>
      ) : (
        <View style={styles.resultsWrapper}>
          {filteredResults.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>Tidak ada saham ditemukan</Text>
              <Text style={styles.emptySub}>
                {selectedFlowFilters.length > 0
                  ? 'Tidak ada emiten yang memenuhi kriteria pilihan order flow terpilih.'
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
            <>
              {/* Executive Conclusion Banner for Rekomendasi Besok */}
              {activeTab === 'rekomendasiBesok' && filteredResults.length > 0 && !searchQuery && selectedFlowFilters.length === 0 && (
                <View style={styles.conclusionCard}>
                  <View style={styles.conclusionHeader}>
                    <View style={styles.conclusionBadge}>
                      <Text style={styles.conclusionBadgeText}>🌟 KESIMPULAN & STRATEGI BESOK</Text>
                    </View>
                    <Text style={styles.conclusionUniverseText}>935 Emiten BEI Dipindai</Text>
                  </View>
                  
                  <Text style={styles.conclusionTitle}>
                    Tersaring {results.length} Saham Terkurasi dengan Akumulasi Terkuat
                  </Text>
                  <Text style={styles.conclusionDesc}>
                    Seluruh 935 emiten di Bursa Efek Indonesia telah dianalisa melalui filter likuiditas institusi (Turnover {'>'} Rp 500 Juta, Vol {'>'} 3.000 Lot), moving average (MA50/MA200), dan 8 pilar Order Flow.
                  </Text>

                  <View style={styles.conclusionGrid}>
                    <View style={styles.conclusionBox}>
                      <Text style={styles.conclusionBoxLabel}>🏆 TOP PICK #1 BESOK</Text>
                      <Text style={styles.conclusionBoxValue}>{results[0]?.ticker || '-'}</Text>
                      <Text style={styles.conclusionBoxSub}>
                        Skor: {results[0]?.skor || 0}/100 · {results[0]?.pred || 'TOP PICK'}
                      </Text>
                    </View>

                    <View style={styles.conclusionBox}>
                      <Text style={styles.conclusionBoxLabel}>⚖️ STRATEGI RISK/REWARD</Text>
                      <Text style={styles.conclusionBoxValue}>Minimal 1 : 2.0</Text>
                      <Text style={styles.conclusionBoxSub}>
                        Patuh Fraksi BEI Resmi
                      </Text>
                    </View>
                  </View>

                  <View style={styles.conclusionTipRow}>
                    <Text style={styles.conclusionTipText}>
                      💡 <Text style={{ fontWeight: '800', color: '#38BDF8' }}>Panduan Eksekusi:</Text> Masuk pada Area Beli yang tertera pada kartu rekomendasi, pasang target profit bertahap di TP1 & TP2, dan disiplin pasang Stop Loss proteksi.
                    </Text>
                  </View>
                </View>
              )}

              {filteredResults.map((r, i) => renderItem(r, i))}
            </>
          )}
        </View>
      )}

        <View style={{ height: 60 }} />
      </ScrollView>

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
  mainScrollView: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mainScrollContent: {
    flexGrow: 1,
  },
  resultsWrapper: {
    padding: SIZES.padding,
  },
  tabsContainer: {
    paddingVertical: 12,
    paddingHorizontal: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: COLORS.surface,
  },
  mainTabsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  mainTabBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTabBtnActive: {
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    borderColor: '#38BDF8',
    borderWidth: 1.5,
  },
  mainTabTitle: {
    color: '#94A3B8',
    fontSize: SIZES.font * 0.9,
    fontWeight: '700',
  },
  mainTabTitleActive: {
    color: '#38BDF8',
    fontWeight: '900',
  },
  mainTabSub: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  mainTabSubActive: {
    color: '#BAE6FD',
    fontWeight: '600',
  },

  // ARA Sub-filter
  araSubFilterSection: {
    backgroundColor: '#09121a',
    paddingVertical: 8,
    paddingHorizontal: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  araSubFilterHeader: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  araSubChipsScroll: {
    flexDirection: 'row',
    gap: 6,
  },
  araSubChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  araSubChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  araSubChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  araSubChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  // ---------------- 8 ORDER FLOW OPTIONS SECTION ----------------
  flowSection: {
    backgroundColor: '#0c1a24',
    paddingVertical: 10,
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
    fontSize: 11,
    fontWeight: '900',
    color: '#00c8ff',
    letterSpacing: 0.8,
  },
  flowSectionSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 8,
  },
  btnResetFilters: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  btnResetFiltersText: {
    color: '#f87171',
    fontSize: 10,
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
    paddingVertical: 6,
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
    fontSize: 11,
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
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  infoCalloutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  infoCalloutTitle: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  infoCalloutCount: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  infoCalloutDesc: {
    fontSize: 11,
    color: '#e2e8f0',
    fontStyle: 'italic',
    lineHeight: 15,
  },

  // ---------------- FILTER / SEARCH BAR ----------------
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    color: COLORS.text,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: SIZES.font * 0.88,
  },
  countBadgeWrap: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  countText: {
    color: COLORS.primary,
    fontSize: SIZES.font * 0.78,
    fontWeight: 'bold',
  },

  // ---------------- RESULTS CONTAINER & CARDS ----------------
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: COLORS.textMuted,
    marginTop: 12,
    fontSize: SIZES.font * 0.88,
    textAlign: 'center',
    paddingHorizontal: 20,
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
    fontSize: 44,
    marginBottom: 10,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.05,
    fontWeight: 'bold',
  },
  emptySub: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.82,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  btnEmptyReset: {
    marginTop: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  btnEmptyResetText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 11,
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
    marginRight: 4,
  },
  rankPillText: {
    color: '#0f172a',
    fontSize: 10,
    fontWeight: '900',
  },
  lockedHeaderPill: {
    backgroundColor: '#064E3B',
    borderColor: '#34D399',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 4,
  },
  lockedHeaderPillText: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '900',
  },
  olHeaderPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38BDF8',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 4,
  },
  olHeaderPillText: {
    color: '#38BDF8',
    fontSize: 9,
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
    fontSize: SIZES.font * 0.72,
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

  // ---------------- KHUSUS ARA HUNTER PRO BOX ----------------
  araCardBox: {
    backgroundColor: '#08131e',
    borderRadius: 10,
    padding: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  araTargetPrice: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '900',
  },
  araDistanceValue: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  araLockedPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  araLockedPillText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '900',
  },
  olBadgeYes: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38BDF8',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  olBadgeYesText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '900',
  },
  olBadgeNoText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
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
    fontSize: SIZES.font * 0.72,
    marginBottom: 2,
  },
  metricValue: {
    color: COLORS.text,
    fontSize: SIZES.font * 0.82,
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

  // 🌟 EXECUTIVE CONCLUSION CARD STYLES
  conclusionCard: {
    backgroundColor: '#0d1829',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  conclusionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  conclusionBadge: {
    backgroundColor: 'rgba(2, 132, 199, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  conclusionBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  conclusionUniverseText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  conclusionTitle: {
    color: '#F8FAFC',
    fontSize: SIZES.font * 1.05,
    fontWeight: '900',
    marginBottom: 6,
    lineHeight: 22,
  },
  conclusionDesc: {
    color: '#94A3B8',
    fontSize: SIZES.font * 0.78,
    lineHeight: 18,
    marginBottom: 14,
  },
  conclusionGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  conclusionBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  conclusionBoxLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  conclusionBoxValue: {
    color: '#38BDF8',
    fontSize: SIZES.font * 1.05,
    fontWeight: '900',
    marginBottom: 2,
  },
  conclusionBoxSub: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '600',
  },
  conclusionTipRow: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#38BDF8',
  },
  conclusionTipText: {
    color: '#BAE6FD',
    fontSize: SIZES.font * 0.74,
    lineHeight: 16,
  },
});
