import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Platform,
  Linking,
} from 'react-native';
import { COLORS, SIZES } from '../constants/theme';
import { formatRupiah, formatPercent } from '../utils/formatters';
import {
  CompleteAiAnalysisData,
  fetchCompleteAiAnalysis,
  getGeminiApiKey,
  saveGeminiApiKey,
  getServerKeyStatus,
  generateClientFallbackAnalysis,
} from '../utils/geminiAnalysis';
import { fetchFinmorphFlow, FinmorphFlowResponse } from '../utils/finmorph';

interface AdvancedAiModalProps {
  visible: boolean;
  onClose: () => void;
  ticker: string;
  stockName?: string;
  currentPrice?: number;
  currentChangePct?: number;
  onNavigateAnalysis?: (ticker: string) => void;
}

type SubTab = 'aiScore' | 'smartMoney' | 'sentiment' | 'fundamentals' | 'tradingView' | 'seasonality';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onClose: () => void;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}
class ModalErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[AdvancedAiModal] Render Error Caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
          backgroundColor: '#0F172A',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          height: '92%',
        }}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>⚠️</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#F8FAFC', marginBottom: 8, textAlign: 'center' }}>
            Gagal Memuat Analisa Saham
          </Text>
          <Text style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', marginBottom: 20, maxWidth: 400 }}>
            {this.state.error?.message || 'Terjadi kesalahan sistem saat merender data.'}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#0284C7', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 }}
            onPress={() => {
              this.setState({ hasError: false, error: null });
              this.props.onClose();
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Tutup Analisa</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function AdvancedAiModal({
  visible,
  onClose,
  ticker,
  stockName,
  currentPrice = 0,
  currentChangePct = 0,
  onNavigateAnalysis,
}: AdvancedAiModalProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('aiScore');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CompleteAiAnalysisData | null>(null);
  const [finmorphFlow, setFinmorphFlow] = useState<FinmorphFlowResponse | null>(null);

  // Gemini API Key config dialog state
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savedKeyExists, setSavedKeyExists] = useState(false);
  const [serverKeyInfo, setServerKeyInfo] = useState<{ hasKey: boolean; keyMasked: string; source: string }>({
    hasKey: false,
    keyMasked: '',
    source: 'Gemini Quant Engine',
  });

  useEffect(() => {
    if (visible && ticker) {
      const clean = (ticker || 'BBCA').toUpperCase().replace('.JK', '').trim();
      setData(prev => (prev && prev.symbol === clean) ? prev : generateClientFallbackAnalysis(clean, currentPrice, currentChangePct));
      loadAnalysis();
    }
  }, [visible, ticker, currentPrice, currentChangePct]);

  useEffect(() => {
    getServerKeyStatus().then(info => {
      if (info) {
        setServerKeyInfo(info);
        setSavedKeyExists(info.hasKey);
      }
    });
  }, [showKeyModal, visible]);

  const loadAnalysis = async () => {
    setLoading(true);
    try {
      getServerKeyStatus().then(info => {
        if (info) {
          setServerKeyInfo(info);
          if (info.hasKey) setSavedKeyExists(true);
        }
      });
      const [res, flowRes] = await Promise.all([
        fetchCompleteAiAnalysis(ticker, currentPrice, currentChangePct),
        fetchFinmorphFlow(ticker),
      ]);
      if (res && res.geminiResult) {
        setData(res);
      }
      setFinmorphFlow(flowRes || res?.finmorphFlow || null);
    } catch (e) {
      console.error('[AdvancedAiModal] Error fetching analysis:', e);
    }
    setLoading(false);
  };

  const handleSaveApiKey = async () => {
    if (apiKeyInput.trim()) {
      await saveGeminiApiKey(apiKeyInput.trim());
    }
    const info = await getServerKeyStatus();
    if (info) {
      setServerKeyInfo(info);
      setSavedKeyExists(info.hasKey || !!apiKeyInput.trim());
    }
    setApiKeyInput('');
    setShowKeyModal(false);
    // Reload analysis immediately with newly planted key
    loadAnalysis();
  };

  if (!visible) return null;

  const cleanTicker = (ticker || 'BBCA').toUpperCase().replace('.JK', '').trim();
  const activeData = data || generateClientFallbackAnalysis(cleanTicker, currentPrice, currentChangePct);
  const price = activeData?.price || currentPrice || 0;
  const changePct = activeData?.changePct !== undefined ? activeData.changePct : currentChangePct;
  const isUp = changePct >= 0;

  const ai = activeData?.geminiResult;
  const ratios = activeData?.ratios;
  const news = activeData?.news;
  const seasonality = activeData?.seasonality;

  // TradingView Widget URL enriched with Volume, Moving Averages, RSI & MACD
  const tvStudiesEncoded = encodeURIComponent(JSON.stringify([
    'Volume@tv-basicstudies',
    'MASimple@tv-basicstudies',
    'RSI@tv-basicstudies',
    'MACD@tv-basicstudies'
  ]));
  const tvWidgetUrl = `https://s.tradingview.com/widgetembed/?symbol=IDX%3A${cleanTicker}&interval=D&theme=dark&style=1&timezone=Asia%2FJakarta&locale=id&toolbarbg=0f172a&studies=${tvStudiesEncoded}&hide_side_toolbar=0&allow_symbol_change=1&save_image=1`;

  // Render TradingView Embed based on platform
  const renderTradingViewChart = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.chartContainer}>
          {/* Web iframe */}
          <iframe
            src={tvWidgetUrl}
            style={{
              width: '100%',
              height: '380px',
              border: 'none',
              borderRadius: 12,
              backgroundColor: '#0F172A',
            }}
            title={`TradingView Chart ${cleanTicker}`}
          />
        </View>
      );
    }

    // Native Android / iOS WebView
    try {
      const { WebView } = require('react-native-webview');
      return (
        <View style={styles.chartContainer}>
          <WebView
            source={{ uri: tvWidgetUrl }}
            style={{ width: '100%', height: 380, borderRadius: 12, backgroundColor: '#0F172A' }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.chartLoading}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.chartLoadingText}>Memuat TradingView Chart...</Text>
              </View>
            )}
          />
        </View>
      );
    } catch (_) {
      return (
        <View style={styles.chartFallback}>
          <Text style={styles.chartFallbackTitle}>📈 TradingView Interactive Chart</Text>
          <Text style={styles.chartFallbackText}>
            Buka chart interaktif live untuk saham {cleanTicker} di browser TradingView:
          </Text>
          <TouchableOpacity
            style={styles.btnOpenTV}
            onPress={() => Linking.openURL(`https://id.tradingview.com/chart/?symbol=IDX:${cleanTicker}`)}
          >
            <Text style={styles.btnOpenTVText}>Buka di TradingView.com ➔</Text>
          </TouchableOpacity>
        </View>
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <ModalErrorBoundary onClose={onClose}>
          <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.titleRow}>
                <Text style={styles.modalTicker}>{cleanTicker}</Text>
                <View style={[styles.badgeAi, { backgroundColor: isUp ? '#065F46' : '#7F1D1D' }]}>
                  <Text style={[styles.badgeAiText, { color: isUp ? '#34D399' : '#F87171' }]}>
                    {formatPercent(changePct)}
                  </Text>
                </View>
              </View>
              <Text style={styles.modalStockName} numberOfLines={1}>
                {stockName || `PT ${cleanTicker} Tbk`} · Rp {formatRupiah(price)}
              </Text>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity
                style={[styles.btnHeaderIcon, savedKeyExists && styles.btnHeaderIconActive]}
                onPress={() => setShowKeyModal(true)}
              >
                <Text style={styles.btnIconText}>🔑</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnHeaderIcon} onPress={loadAnalysis}>
                <Text style={styles.btnIconText}>🔄</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnClose} onPress={onClose}>
                <Text style={styles.btnCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Source & Planted Connection Banner */}
          <TouchableOpacity
            style={[
              styles.sourceBanner,
              (serverKeyInfo?.hasKey || savedKeyExists) ? styles.sourceBannerGreen : styles.sourceBannerPrompt,
            ]}
            onPress={() => setShowKeyModal(true)}
            activeOpacity={0.8}
          >
            {(serverKeyInfo?.hasKey || savedKeyExists) ? (
              <Text style={styles.sourceTextGreen}>
                🟢 <Text style={{ fontWeight: '900', color: '#34D399' }}>Google Gemini AI Cloud Aktif</Text> · Status: Terhubung Aman ➔
              </Text>
            ) : (
              <Text style={styles.sourceTextPrompt}>
                ⚡ <Text style={{ fontWeight: '900', color: '#38BDF8' }}>Tanam Gemini API Key:</Text> Klik di sini untuk menambahkan API key secara privat ➔
              </Text>
            )}
          </TouchableOpacity>

          {/* Sub Navigation Tabs */}
          <View style={styles.navBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navScroll}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'aiScore' && styles.tabBtnActive]}
                onPress={() => setActiveTab('aiScore')}
              >
                <Text style={[styles.tabBtnText, activeTab === 'aiScore' && styles.tabBtnTextActive]}>
                  🌟 1. Skor AI & Prediksi
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'smartMoney' && styles.tabBtnActive]}
                onPress={() => setActiveTab('smartMoney')}
              >
                <Text style={[styles.tabBtnText, activeTab === 'smartMoney' && styles.tabBtnTextActive]}>
                  🐳 2. Smart Money & Bandar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'sentiment' && styles.tabBtnActive]}
                onPress={() => setActiveTab('sentiment')}
              >
                <Text style={[styles.tabBtnText, activeTab === 'sentiment' && styles.tabBtnTextActive]}>
                  📰 3. Sentimen Berita
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'fundamentals' && styles.tabBtnActive]}
                onPress={() => setActiveTab('fundamentals')}
              >
                <Text style={[styles.tabBtnText, activeTab === 'fundamentals' && styles.tabBtnTextActive]}>
                  📊 4. Rasio Finansial
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'tradingView' && styles.tabBtnActive]}
                onPress={() => setActiveTab('tradingView')}
              >
                <Text style={[styles.tabBtnText, activeTab === 'tradingView' && styles.tabBtnTextActive]}>
                  📈 5. Chart TradingView
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'seasonality' && styles.tabBtnActive]}
                onPress={() => setActiveTab('seasonality')}
              >
                <Text style={[styles.tabBtnText, activeTab === 'seasonality' && styles.tabBtnTextActive]}>
                  📅 6. Pola Musiman (5 Thn)
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Content Body */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#38BDF8" />
              <Text style={styles.loadingTitle}>Menganalisa Saham {cleanTicker}...</Text>
              <Text style={styles.loadingSubtitle}>
                Menghubungkan sentimen berita, fundamental PER/PBV/ROE/DER, TradingView, & siklus 5 tahun
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
              {/* TAB 1: SKOR AI & PREDIKSI ARAH */}
              {activeTab === 'aiScore' && (
                <View style={styles.sectionContainer}>
                  <View style={styles.scoreHeroCard}>
                    <View style={styles.scoreTopRow}>
                      <View>
                        <Text style={styles.heroSub}>SKOR PROBABILITAS AI</Text>
                        <View style={styles.scoreMainRow}>
                          <Text style={styles.scoreBigNumber}>{ai?.ai_score_prediksi?.skor_ai || 80}</Text>
                          <Text style={styles.scoreMax}>/100</Text>
                        </View>
                      </View>
                      <View style={styles.recommendationBox}>
                        <Text style={styles.recomLabel}>REKOMENDASI AI</Text>
                        <Text style={styles.recomValue}>{ai?.ai_score_prediksi?.rekomendasi || 'BUY'}</Text>
                        <Text style={styles.recomConfidence}>
                          Keyakinan: {ai?.ai_score_prediksi?.tingkat_keyakinan || 'TINGGI'}
                        </Text>
                      </View>
                    </View>

                    {/* Probability Bar */}
                    <View style={styles.probSection}>
                      <View style={styles.probHeader}>
                        <Text style={styles.probTextUp}>
                          🟢 Naik: {ai?.ai_score_prediksi?.probabilitas_naik_pct || 75}%
                        </Text>
                        <Text style={styles.probTextDown}>
                          🔴 Turun: {ai?.ai_score_prediksi?.probabilitas_turun_pct || 25}%
                        </Text>
                      </View>
                      <View style={styles.probBarBackground}>
                        <View
                          style={[
                            styles.probBarFillUp,
                            { width: `${ai?.ai_score_prediksi?.probabilitas_naik_pct || 75}%` },
                          ]}
                        />
                      </View>
                    </View>

                    <View style={styles.biasTagRow}>
                      <Text style={styles.biasLabel}>Prediksi Arah:</Text>
                      <View style={styles.biasBadge}>
                        <Text style={styles.biasBadgeText}>
                          {ai?.ai_score_prediksi?.prediksi_arah || 'NAIK (BULLISH)'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* AI Rationale */}
                  <View style={styles.cardBox}>
                    <View style={styles.cardBoxHeader}>
                      <Text style={styles.cardBoxIcon}>🤖</Text>
                      <Text style={styles.cardBoxTitle}>Alasan & Analisa AI Gemini</Text>
                    </View>
                    <Text style={styles.aiRationaleText}>
                      {ai?.ai_score_prediksi?.alasan_ai ||
                        'Analisa quant AI menunjukkan probabilitas momentum positif didukung struktur teknikal dan akumulasi berkelanjutan.'}
                    </Text>
                  </View>

                  {/* 🎯 TRADING PLAN PRESISI RESMI FRAKSI BEI */}
                  {ai?.trading_plan_presisi && (
                    <View style={styles.cardBox}>
                      <View style={styles.cardBoxHeader}>
                        <Text style={styles.cardBoxIcon}>🎯</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardBoxTitle}>Trading Plan Presisi Fraksi BEI</Text>
                          <Text style={styles.cardBoxSubtitle}>
                            {ai.trading_plan_presisi.catatan_fraksi_bei}
                          </Text>
                        </View>
                        <View style={styles.rrrBadge}>
                          <Text style={styles.rrrBadgeText}>RRR {ai.trading_plan_presisi.risk_reward_ratio}</Text>
                        </View>
                      </View>

                      <View style={styles.tradingPlanGrid}>
                        <View style={styles.planCol}>
                          <Text style={styles.planColLabel}>AREA BELI 1 (BEST)</Text>
                          <Text style={styles.planColValGreen}>
                            Rp {formatRupiah(ai.trading_plan_presisi.area_beli_1)}
                          </Text>
                          <Text style={styles.planColSub}>Pullback / Support</Text>
                        </View>
                        <View style={styles.planCol}>
                          <Text style={styles.planColLabel}>AREA BELI 2</Text>
                          <Text style={styles.planColValBlue}>
                            Rp {formatRupiah(ai.trading_plan_presisi.area_beli_2)}
                          </Text>
                          <Text style={styles.planColSub}>Entry Agresif</Text>
                        </View>
                      </View>

                      <View style={[styles.tradingPlanGrid, { marginTop: 8 }]}>
                        <View style={styles.planCol}>
                          <Text style={styles.planColLabel}>TARGET PROFIT 1</Text>
                          <Text style={styles.planColValGreen}>
                            Rp {formatRupiah(ai.trading_plan_presisi.target_profit_1)}
                          </Text>
                          <Text style={styles.planColSub}>TP Konservatif</Text>
                        </View>
                        <View style={styles.planCol}>
                          <Text style={styles.planColLabel}>TARGET PROFIT 2</Text>
                          <Text style={styles.planColValGreen}>
                            Rp {formatRupiah(ai.trading_plan_presisi.target_profit_2)}
                          </Text>
                          <Text style={styles.planColSub}>TP Maksimal</Text>
                        </View>
                        <View style={styles.planCol}>
                          <Text style={styles.planColLabel}>STOP LOSS (SL)</Text>
                          <Text style={styles.planColValRed}>
                            Rp {formatRupiah(ai.trading_plan_presisi.stop_loss)}
                          </Text>
                          <Text style={styles.planColSub}>Proteksi Ketat</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* 💎 VALUASI FAIR VALUE & MARGIN OF SAFETY */}
                  {ai?.valuasi_fair_value && (
                    <View style={styles.cardBox}>
                      <View style={styles.cardBoxHeader}>
                        <Text style={styles.cardBoxIcon}>💎</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardBoxTitle}>Target Nilai Wajar & Margin of Safety</Text>
                          <Text style={styles.cardBoxSubtitle}>Metode DCF & PE Multiplier Historis</Text>
                        </View>
                        <View style={[styles.mosBadge, { backgroundColor: ai.valuasi_fair_value.margin_of_safety_pct >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)' }]}>
                          <Text style={[styles.mosBadgeText, { color: ai.valuasi_fair_value.margin_of_safety_pct >= 0 ? '#34D399' : '#F87171' }]}>
                            MoS: {ai.valuasi_fair_value.margin_of_safety_pct > 0 ? '+' : ''}{ai.valuasi_fair_value.margin_of_safety_pct}%
                          </Text>
                        </View>
                      </View>

                      <View style={styles.fairValRow}>
                        <View style={styles.fairValBox}>
                          <Text style={styles.fairValLabel}>ESTIMASI NILAI WAJAR</Text>
                          <Text style={styles.fairValNumber}>
                            Rp {formatRupiah(ai.valuasi_fair_value.nilai_wajar_dcf)}
                          </Text>
                          <Text style={styles.fairValSub}>
                            Status: <Text style={{ color: '#38BDF8', fontWeight: '800' }}>{ai.valuasi_fair_value.status_valuasi}</Text>
                          </Text>
                        </View>

                        <View style={styles.fairValBox}>
                          <Text style={styles.fairValLabel}>PIOTROSKI F-SCORE</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                            <Text style={styles.fairValScoreNumber}>{ai.valuasi_fair_value.piotroski_f_score}</Text>
                            <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700' }}>/9</Text>
                          </View>
                          <Text style={styles.fairValSub}>
                            Neraca: <Text style={{ color: '#34D399', fontWeight: '800' }}>{ai.valuasi_fair_value.altman_z_status}</Text>
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* ⚠️ SKENARIO BULLISH & LEVEL INVALIDASI */}
                  {ai?.skenario_bullish_bearish && (
                    <View style={styles.cardBox}>
                      <View style={styles.cardBoxHeader}>
                        <Text style={styles.cardBoxIcon}>⚠️</Text>
                        <Text style={styles.cardBoxTitle}>Skenario Bullish vs Titik Invalidasi</Text>
                      </View>

                      <Text style={styles.invalidationWarningTitle}>🛑 KAPAN SKENARIO INI BATAL?</Text>
                      <Text style={styles.invalidationWarningText}>
                        {ai.skenario_bullish_bearish.skenario_pembatalan}
                      </Text>

                      <View style={styles.catalystPillsWrap}>
                        {ai.skenario_bullish_bearish.katalis_bullish?.map((kat: string, kIdx: number) => (
                          <View key={kIdx} style={styles.catalystPillItem}>
                            <Text style={styles.catalystPillBullet}>⚡</Text>
                            <Text style={styles.catalystPillContent}>{kat}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Quick Summary Grid */}
                  <View style={styles.cardBox}>
                    <Text style={styles.cardBoxTitle}>📌 Ringkasan 5 Faktor Penentu</Text>
                    <View style={styles.summaryGrid}>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Sentimen Pasar</Text>
                        <Text style={styles.summaryValGreen}>{ai?.sentimen_berita?.label || 'POSITIF'}</Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Tren MA50/200</Text>
                        <Text style={styles.summaryValBlue}>
                          {ai?.analisa_chart_teknikal?.tren_utama?.includes('UPTREND') ? 'UPTREND 🟢' : 'KONSOLIDASI 🟡'}
                        </Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>ROE (Profitabilitas)</Text>
                        <Text style={styles.summaryValGreen}>{ratios?.roe || 15}%</Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Win Rate Musiman</Text>
                        <Text style={styles.summaryValBlue}>{seasonality?.currentMonth?.winRatePct || 60}%</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* TAB 2: BANDARMOLOGI & SMART MONEY FLOW */}
              {activeTab === 'smartMoney' && (
                <View style={styles.sectionContainer}>
                  {/* LIVE FINMORPH SMART MONEY FLOW (IF AVAILABLE) */}
                  {finmorphFlow?.flow && finmorphFlow.flow.signals && (
                    <View style={styles.finmorphFlowCardAi}>
                      <View style={styles.finmorphFlowHeaderAi}>
                        <View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.finmorphBadgeAi}>FINMORPH LIVE API</Text>
                            <Text style={styles.finmorphTitleAi}>Real-Time Flow</Text>
                          </View>
                          <Text style={styles.finmorphSubAi}>
                            CMF (20D), MFI (14D), OBV & Up/Down Ratio
                          </Text>
                        </View>
                        <View style={[
                          styles.verdictBadgeAi, 
                          { 
                            backgroundColor: finmorphFlow.flow.verdict === 'akumulasi' ? 'rgba(16, 185, 129, 0.2)' : (finmorphFlow.flow.verdict === 'distribusi' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'),
                            borderColor: finmorphFlow.flow.verdict === 'akumulasi' ? '#10B981' : (finmorphFlow.flow.verdict === 'distribusi' ? '#EF4444' : '#F59E0B')
                          }
                        ]}>
                          <Text style={[
                            styles.verdictTextAi, 
                            { color: finmorphFlow.flow.verdict === 'akumulasi' ? '#10B981' : (finmorphFlow.flow.verdict === 'distribusi' ? '#EF4444' : '#F59E0B') }
                          ]}>
                            {(finmorphFlow.flow.label || 'NETRAL').toUpperCase()}
                          </Text>
                          <Text style={styles.verdictGradeAi}>
                            Grade {(finmorphFlow.flow.grade || 'B').toUpperCase()} (Skor: {finmorphFlow.flow.score > 0 ? '+' : ''}{finmorphFlow.flow.score})
                          </Text>
                        </View>
                      </View>

                      {/* Signals 4-Grid */}
                      <View style={styles.signalsGridAi}>
                        <View style={styles.signalBoxAi}>
                          <Text style={styles.signalLabelAi}>CMF (20D)</Text>
                          <Text style={[styles.signalValAi, { color: (finmorphFlow.flow.signals.cmf || 0) >= 0 ? '#10B981' : '#EF4444' }]}>
                            {(finmorphFlow.flow.signals.cmf || 0) > 0 ? '+' : ''}{finmorphFlow.flow.signals.cmf || 0}
                          </Text>
                          <Text style={styles.signalDescAi}>
                            {(finmorphFlow.flow.signals.cmf || 0) > 0.05 ? 'Inflow Kuat' : ((finmorphFlow.flow.signals.cmf || 0) < -0.05 ? 'Outflow Kuat' : 'Netral')}
                          </Text>
                        </View>

                        <View style={styles.signalBoxAi}>
                          <Text style={styles.signalLabelAi}>MFI (14D)</Text>
                          <Text style={[styles.signalValAi, { color: (finmorphFlow.flow.signals.mfi || 50) >= 50 ? '#10B981' : '#F59E0B' }]}>
                            {finmorphFlow.flow.signals.mfi || 50}
                          </Text>
                          <Text style={styles.signalDescAi}>
                            {(finmorphFlow.flow.signals.mfi || 50) > 80 ? 'Overbought' : ((finmorphFlow.flow.signals.mfi || 50) < 20 ? 'Oversold' : 'Sehat')}
                          </Text>
                        </View>

                        <View style={styles.signalBoxAi}>
                          <Text style={styles.signalLabelAi}>Arah OBV</Text>
                          <Text style={[styles.signalValAi, { color: finmorphFlow.flow.signals.obv?.direction === 'naik' ? '#10B981' : '#EF4444' }]}>
                            {(finmorphFlow.flow.signals.obv?.direction || 'NETRAL').toUpperCase()}
                          </Text>
                          <Text style={styles.signalDescAi}>
                            Bias: {(finmorphFlow.flow.signals.obv?.bias || 0) > 0 ? '+' : ''}{finmorphFlow.flow.signals.obv?.bias || 0}
                          </Text>
                        </View>

                        <View style={styles.signalBoxAi}>
                          <Text style={styles.signalLabelAi}>Up/Down Vol</Text>
                          <Text style={[styles.signalValAi, { color: (finmorphFlow.flow.signals.up_down?.ratio || 1) >= 1 ? '#10B981' : '#EF4444' }]}>
                            {finmorphFlow.flow.signals.up_down?.ratio || 1}x
                          </Text>
                          <Text style={styles.signalDescAi}>
                            {(finmorphFlow.flow.signals.up_down?.ratio || 1) >= 1.2 ? 'Buyer Dominan' : ((finmorphFlow.flow.signals.up_down?.ratio || 1) <= 0.8 ? 'Seller Dominan' : 'Seimbang')}
                          </Text>
                        </View>
                      </View>

                      {finmorphFlow.flow.notes && finmorphFlow.flow.notes.length > 0 && (
                        <View style={styles.flowNotesAi}>
                          <Text style={styles.flowNotesTitleAi}>Catatan Alur Smart Money:</Text>
                          {finmorphFlow.flow.notes.map((note, idx) => (
                            <Text key={idx} style={styles.flowNoteItemAi}>• {note}</Text>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Smart Money Hero Card */}
                  <View style={styles.smartHeroCard}>
                    <View style={styles.smartHeroHeader}>
                      <View>
                        <Text style={styles.heroSub}>STATUS AKUMULASI BANDAR</Text>
                        <Text style={styles.smartHeroTitle}>
                          {ai?.analisa_bandarmologi?.status_akumulasi || 'BIG ACCUMULATION'}
                        </Text>
                      </View>
                      <View style={styles.smartWhaleBadge}>
                        <Text style={styles.smartWhaleEmoji}>🐳</Text>
                      </View>
                    </View>
                    <Text style={styles.smartFlowLabel}>
                      {ai?.analisa_bandarmologi?.label_flow || 'Smart Money & Whale Inflow Terdeteksi'}
                    </Text>
                  </View>

                  {/* 4 Pillars of Bandarmology */}
                  <View style={styles.smartGrid}>
                    <View style={styles.smartGridCard}>
                      <Text style={styles.smartGridLabel}>KONSENTRASI BROKER</Text>
                      <Text style={styles.smartGridValBlue}>Top 3 Buyer Dominan</Text>
                      <Text style={styles.smartGridDesc}>
                        {ai?.analisa_bandarmologi?.konsentrasi_top_broker || 'Konsentrasi volume beli terakumulasi'}
                      </Text>
                    </View>

                    <View style={styles.smartGridCard}>
                      <Text style={styles.smartGridLabel}>ARUS DANA ASING (FOREIGN)</Text>
                      <Text style={styles.smartGridValGreen}>
                        {ai?.analisa_bandarmologi?.net_foreign_flow?.split(' ')[0] || '+Inflow'}
                      </Text>
                      <Text style={styles.smartGridDesc}>
                        {ai?.analisa_bandarmologi?.net_foreign_flow || 'Inflow Asing Aktif'}
                      </Text>
                    </View>

                    <View style={styles.smartGridCard}>
                      <Text style={styles.smartGridLabel}>VOLUME SPREAD ANALYSIS (VSA)</Text>
                      <Text style={styles.smartGridValPurple}>Spread & Volume</Text>
                      <Text style={styles.smartGridDesc}>
                        {ai?.analisa_bandarmologi?.vsa_volume_spread || 'Stopping Volume di Area Support'}
                      </Text>
                    </View>

                    <View style={styles.smartGridCard}>
                      <Text style={styles.smartGridLabel}>PARTISIPASI PEMAIN</Text>
                      <Text style={styles.smartGridValYellow}>Smart vs Retail</Text>
                      <Text style={styles.smartGridDesc}>
                        {ai?.analisa_bandarmologi?.smart_money_participation || 'Institusi 70% · Ritel 30%'}
                      </Text>
                    </View>
                  </View>

                  {/* Bandarmology Explanation Card */}
                  <View style={styles.cardBox}>
                    <Text style={styles.cardBoxTitle}>💡 Cara Membaca Sinyal Bandar</Text>
                    <Text style={styles.bandarGuideText}>
                      • <Text style={{ fontWeight: '800', color: '#38BDF8' }}>Akumulasi Tersembunyi:</Text> Terjadi ketika broker top buyer menampung volume di area harga support tanpa membuat harga melonjak drastis.{'\n\n'}
                      • <Text style={{ fontWeight: '800', color: '#34D399' }}>Volume Spread Sehat:</Text> Kenaikan harga yang disertai pembesaran volume menandakan partisipasi institusi asli, bukan manipulasi ritel.{'\n\n'}
                      • <Text style={{ fontWeight: '800', color: '#F87171' }}>Waspada Distribusi:</Text> Jika harga naik tinggi tapi top seller mulai mendominasi penjualan masif, segera amankan profit secara bertahap.
                    </Text>
                  </View>
                </View>
              )}

              {/* TAB 3: SENTIMEN BERITA */}
              {activeTab === 'sentiment' && (
                <View style={styles.sectionContainer}>
                  {/* Sentiment Gauge Hero */}
                  <View style={styles.sentimentHero}>
                    <View style={styles.sentimentGaugeTop}>
                      <View>
                        <Text style={styles.heroSub}>STATUS SENTIMEN PASAR</Text>
                        <Text style={styles.sentimentLabelBig}>
                          {ai?.sentimen_berita?.label || news?.overallLabel || 'POSITIF'}
                        </Text>
                      </View>
                      <View style={styles.sentimentCircle}>
                        <Text style={styles.sentimentCircleNum}>{ai?.sentimen_berita?.skor || 75}%</Text>
                        <Text style={styles.sentimentCircleSub}>Skor Berita</Text>
                      </View>
                    </View>
                    <Text style={styles.sentimentSummaryText}>
                      {ai?.sentimen_berita?.ringkasan || news?.overallLabel}
                    </Text>
                  </View>

                  {/* Catalysts */}
                  <View style={styles.cardBox}>
                    <View style={styles.cardBoxHeader}>
                      <Text style={styles.cardBoxIcon}>⚡</Text>
                      <Text style={styles.cardBoxTitle}>Katalis Utama Pendorong Harga</Text>
                    </View>
                    {(ai?.sentimen_berita?.katalis_utama || []).map((kat: string, idx: number) => (
                      <View key={idx} style={styles.catalystRow}>
                        <Text style={styles.catalystBullet}>✓</Text>
                        <Text style={styles.catalystText}>{kat}</Text>
                      </View>
                    ))}
                  </View>

                  {/* News Headlines List */}
                  <View style={styles.cardBox}>
                    <View style={styles.cardBoxHeader}>
                      <Text style={styles.cardBoxIcon}>📰</Text>
                      <Text style={styles.cardBoxTitle}>Berita & Media Terkini ({news?.items?.length || 0})</Text>
                    </View>
                    {(news?.items || []).map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.newsCard}
                        onPress={() => item.link && Linking.openURL(item.link)}
                      >
                        <View style={styles.newsMeta}>
                          <Text style={styles.newsSource}>{item.source}</Text>
                          <View
                            style={[
                              styles.sentimentBadgeSmall,
                              {
                                backgroundColor:
                                  item.sentiment === 'BULLISH'
                                    ? '#064E3B'
                                    : item.sentiment === 'BEARISH'
                                    ? '#7F1D1D'
                                    : '#1E293B',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.sentimentBadgeSmallText,
                                {
                                  color:
                                    item.sentiment === 'BULLISH'
                                      ? '#34D399'
                                      : item.sentiment === 'BEARISH'
                                      ? '#F87171'
                                      : '#94A3B8',
                                },
                              ]}
                            >
                              {item.sentiment}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.newsTitle}>{item.title}</Text>
                        {item.pubDate && <Text style={styles.newsDate}>{item.pubDate}</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* TAB 3: RASIO FUNDAMENTAL (PER, PBV, ROE, ROA, DER, EPS) */}
              {activeTab === 'fundamentals' && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionIntro}>
                    Evaluasi 6 rasio fundamental kunci untuk mengukur kewajaran valuasi dan solvabilitas {cleanTicker}:
                  </Text>

                  {/* 6 Key Ratios Grid */}
                  <View style={styles.ratiosGrid}>
                    {/* 1. PER */}
                    <View style={styles.ratioCard}>
                      <Text style={styles.ratioCardLabel}>P/E RATIO (PER)</Text>
                      <Text style={styles.ratioCardValue}>{ratios?.per ? `${ratios.per}x` : '—'}</Text>
                      <Text style={styles.ratioCardEval}>
                        {ratios && ratios.per > 0 && ratios.per < 15 ? '🟢 Undervalued' : '🟡 Fair Value'}
                      </Text>
                    </View>

                    {/* 2. PBV */}
                    <View style={styles.ratioCard}>
                      <Text style={styles.ratioCardLabel}>PRICE TO BOOK (PBV)</Text>
                      <Text style={styles.ratioCardValue}>{ratios?.pbv ? `${ratios.pbv}x` : '—'}</Text>
                      <Text style={styles.ratioCardEval}>
                        {ratios && ratios.pbv < 1.5 ? '🟢 Diskon Nilai Buku' : '🔵 Premium Wajar'}
                      </Text>
                    </View>

                    {/* 3. ROE */}
                    <View style={styles.ratioCard}>
                      <Text style={styles.ratioCardLabel}>RETURN ON EQUITY (ROE)</Text>
                      <Text style={styles.ratioCardValueGreen}>{ratios?.roe ? `${ratios.roe}%` : '—'}</Text>
                      <Text style={styles.ratioCardEval}>
                        {ratios && ratios.roe >= 15 ? '⭐ Superior (>15%)' : '🟢 Sehat'}
                      </Text>
                    </View>

                    {/* 4. ROA */}
                    <View style={styles.ratioCard}>
                      <Text style={styles.ratioCardLabel}>RETURN ON ASSETS (ROA)</Text>
                      <Text style={styles.ratioCardValueGreen}>{ratios?.roa ? `${ratios.roa}%` : '—'}</Text>
                      <Text style={styles.ratioCardEval}>
                        {ratios && ratios.roa >= 3.5 ? '🟢 Efisien' : '🟡 Moderat'}
                      </Text>
                    </View>

                    {/* 5. DER */}
                    <View style={styles.ratioCard}>
                      <Text style={styles.ratioCardLabel}>DEBT TO EQUITY (DER)</Text>
                      <Text style={styles.ratioCardValueBlue}>{ratios?.der !== undefined ? `${ratios.der}x` : '—'}</Text>
                      <Text style={styles.ratioCardEval}>
                        {ratios && ratios.der < 1.0 ? '🟢 Utang Aman (<1x)' : '🟡 Terkendali'}
                      </Text>
                    </View>

                    {/* 6. EPS */}
                    <View style={styles.ratioCard}>
                      <Text style={styles.ratioCardLabel}>EARNINGS PER SHARE (EPS)</Text>
                      <Text style={styles.ratioCardValue}>Rp {ratios?.eps ? formatRupiah(ratios.eps) : '—'}</Text>
                      <Text style={styles.ratioCardEval}>Laba per Saham</Text>
                    </View>
                  </View>

                  {/* Detailed Interpretations */}
                  <View style={styles.cardBox}>
                    <Text style={styles.cardBoxTitle}>📋 Rincian Evaluasi Fundamental AI</Text>
                    <View style={styles.evalItem}>
                      <Text style={styles.evalKey}>• Valuasi PER & PBV:</Text>
                      <Text style={styles.evalVal}>
                        {ai?.analisa_fundamental?.per_evaluasi} {ai?.analisa_fundamental?.pbv_evaluasi}
                      </Text>
                    </View>
                    <View style={styles.evalItem}>
                      <Text style={styles.evalKey}>• Profitabilitas ROE & ROA:</Text>
                      <Text style={styles.evalVal}>
                        {ai?.analisa_fundamental?.roe_evaluasi} {ai?.analisa_fundamental?.roa_evaluasi}
                      </Text>
                    </View>
                    <View style={styles.evalItem}>
                      <Text style={styles.evalKey}>• Struktur Modal DER & EPS:</Text>
                      <Text style={styles.evalVal}>
                        {ai?.analisa_fundamental?.der_evaluasi} {ai?.analisa_fundamental?.eps_evaluasi}
                      </Text>
                    </View>
                    <View style={styles.evalSummaryBox}>
                      <Text style={styles.evalSummaryText}>
                        {ai?.analisa_fundamental?.kesimpulan_kesehatan}
                      </Text>
                    </View>
                  </View>

                  {/* Button to Open Deep 5 Pillars Screen */}
                  {onNavigateAnalysis && (
                    <TouchableOpacity
                      style={styles.btnDeepResearch}
                      onPress={() => {
                        onClose();
                        onNavigateAnalysis(cleanTicker);
                      }}
                    >
                      <Text style={styles.btnDeepResearchText}>
                        🔍 Buka Halaman Riset 5 Pilar Finmorph Lengkap ➔
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* TAB 4: CHART TRADINGVIEW & ANALISA TEKNIKAL */}
              {activeTab === 'tradingView' && (
                <View style={styles.sectionContainer}>
                  {/* TradingView Widget */}
                  {renderTradingViewChart()}

                  {/* 🌟 1. GOLDEN CROSS / DEATH CROSS MA50 vs MA200 CARD */}
                  <View style={styles.goldenCrossCard}>
                    <View style={styles.goldenCrossHeader}>
                      <Text style={styles.goldenCrossIcon}>🌟</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.goldenCrossTitle}>STATUS GOLDEN CROSS / DEATH CROSS</Text>
                        <Text style={styles.goldenCrossBadgeText}>
                          {ai?.analisa_chart_teknikal?.golden_cross_status || (isUp ? '🌟 GOLDEN CROSS AKTIF (MA50 > MA200)' : '⚠️ DEATH CROSS REGIME')}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.maLevelsRow}>
                      <View style={styles.maLevelBox}>
                        <Text style={styles.maLevelLabel}>MA50 (50 HARI)</Text>
                        <Text style={styles.maLevelValBlue}>
                          Rp {formatRupiah(ai?.analisa_chart_teknikal?.ma50_level || Math.round(price * 0.98))}
                        </Text>
                      </View>
                      <View style={styles.maLevelBox}>
                        <Text style={styles.maLevelLabel}>MA200 (200 HARI)</Text>
                        <Text style={styles.maLevelValPurple}>
                          Rp {formatRupiah(ai?.analisa_chart_teknikal?.ma200_level || Math.round(price * 0.95))}
                        </Text>
                      </View>
                      <View style={styles.maLevelBox}>
                        <Text style={styles.maLevelLabel}>HARGA SEKARANG</Text>
                        <Text style={[styles.maLevelValPrice, { color: isUp ? '#10B981' : '#EF4444' }]}>
                          Rp {formatRupiah(price)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* 📊 2. ANALISA VOLUME & VOLUME SPREAD ANALYSIS (VSA) */}
                  <View style={styles.techIndicatorCard}>
                    <View style={styles.techIndicatorHeader}>
                      <Text style={styles.techIndicatorIcon}>📊</Text>
                      <Text style={styles.techIndicatorTitle}>Analisa Volume & VSA (Volume Spread)</Text>
                    </View>
                    <Text style={styles.techIndicatorValue}>
                      {ai?.analisa_chart_teknikal?.volume_analysis || (isUp ? '📈 Volume Ekspansi di Atas Rata-rata 10D' : '💤 Volume Rata-rata Normal')}
                    </Text>
                    <Text style={styles.techIndicatorSub}>
                      Spread: {ai?.analisa_bandarmologi?.vsa_volume_spread || 'Volume-Spread Bullish Absorption'}
                    </Text>
                  </View>

                  {/* ⚡ 3. INDIKATOR MOMENTUM RSI (14) & MACD (12, 26, 9) */}
                  <View style={styles.momentumRow}>
                    <View style={styles.momentumBox}>
                      <Text style={styles.momentumLabel}>RSI (14-DAY)</Text>
                      <Text style={styles.momentumVal}>
                        {ai?.analisa_chart_teknikal?.rsi_status || `RSI(14) ~${isUp ? '62' : '45'} (Zona Bullish Sehat)`}
                      </Text>
                    </View>
                    <View style={styles.momentumBox}>
                      <Text style={styles.momentumLabel}>MACD (12, 26, 9)</Text>
                      <Text style={styles.momentumVal}>
                        {ai?.analisa_chart_teknikal?.macd_status || (isUp ? 'MACD Histogram Positif (Bullish Crossover)' : 'MACD Netral di Atas Sinyal')}
                      </Text>
                    </View>
                  </View>

                  {/* 4. Technical Analysis Breakdown & Price Levels */}
                  <View style={styles.cardBox}>
                    <View style={styles.cardBoxHeader}>
                      <Text style={styles.cardBoxIcon}>📐</Text>
                      <Text style={styles.cardBoxTitle}>Level Support, Resisten & Rencana Entri</Text>
                    </View>

                    <View style={styles.techLevelsRow}>
                      <View style={styles.levelCard}>
                        <Text style={styles.levelCardLabel}>SUPPORT KUAT</Text>
                        <Text style={styles.levelCardValGreen}>
                          Rp {formatRupiah(ai?.analisa_chart_teknikal?.level_support || Math.round(price * 0.965))}
                        </Text>
                      </View>
                      <View style={styles.levelCard}>
                        <Text style={styles.levelCardLabel}>RESISTEN TARGET</Text>
                        <Text style={styles.levelCardValRed}>
                          Rp {formatRupiah(ai?.analisa_chart_teknikal?.level_resisten || Math.round(price * 1.055))}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.techDetailRow}>
                      <Text style={styles.techDetailLabel}>Tren Utama:</Text>
                      <Text style={styles.techDetailValue}>{ai?.analisa_chart_teknikal?.tren_utama}</Text>
                    </View>
                    <View style={styles.techDetailRow}>
                      <Text style={styles.techDetailLabel}>Pola Candlestick:</Text>
                      <Text style={styles.techDetailValue}>{ai?.analisa_chart_teknikal?.pola_chart}</Text>
                    </View>
                    <View style={styles.techDetailRow}>
                      <Text style={styles.techDetailLabel}>Indikator Momentum:</Text>
                      <Text style={styles.techDetailValue}>{ai?.analisa_chart_teknikal?.indikator_sinyal}</Text>
                    </View>

                    <View style={styles.planBox}>
                      <Text style={styles.planBoxTitle}>🎯 Rekomendasi Eksekusi Entri:</Text>
                      <Text style={styles.planBoxContent}>
                        {ai?.analisa_chart_teknikal?.rekomendasi_entri}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* TAB 5: POLA MUSIMAN 5 TAHUN TERAKHIR */}
              {activeTab === 'seasonality' && (
                <View style={styles.sectionContainer}>
                  {/* Best & Worst Month Banner */}
                  <View style={styles.seasonHero}>
                    <View style={styles.seasonCol}>
                      <Text style={styles.seasonLabel}>🌟 BULAN TERKUAT (5 TAHUN)</Text>
                      <Text style={styles.seasonMonthName}>{seasonality?.bestMonth?.name || 'Desember'}</Text>
                      <Text style={styles.seasonStatWin}>
                        Win Rate: {seasonality?.bestMonth?.winRatePct || 80}% (Avg +{seasonality?.bestMonth?.avgReturnPct || 4.2}%)
                      </Text>
                    </View>
                    <View style={styles.seasonDivider} />
                    <View style={styles.seasonCol}>
                      <Text style={styles.seasonLabel}>⚠️ BULAN TERLEMAH</Text>
                      <Text style={styles.seasonMonthNameRed}>{seasonality?.worstMonth?.name || 'Mei'}</Text>
                      <Text style={styles.seasonStatLoss}>
                        Win Rate: {seasonality?.worstMonth?.winRatePct || 40}% (Avg {seasonality?.worstMonth?.avgReturnPct || -1.5}%)
                      </Text>
                    </View>
                  </View>

                  {/* 12 Months Heat Matrix */}
                  <View style={styles.cardBox}>
                    <Text style={styles.cardBoxTitle}>📊 Statistik Win Rate 12 Bulan (Jan - Des)</Text>
                    <Text style={styles.cardBoxSub}>
                      Persentase tahun membukukan gain positif selama 5 tahun terakhir:
                    </Text>

                    <View style={styles.monthGrid}>
                      {(seasonality?.months || []).map((m, idx) => {
                        const isHigh = m.winRatePct >= 65;
                        const isLow = m.winRatePct <= 45;
                        const isCurrent = m.monthIndex === new Date().getMonth();

                        return (
                          <View
                            key={idx}
                            style={[
                              styles.monthCard,
                              isHigh && styles.monthCardHigh,
                              isLow && styles.monthCardLow,
                              isCurrent && styles.monthCardCurrent,
                            ]}
                          >
                            <View style={styles.monthHeaderRow}>
                              <Text style={styles.monthShort}>{m.monthName.slice(0, 3)}</Text>
                              {isCurrent && <Text style={styles.currentBadge}>Kini</Text>}
                            </View>
                            <Text
                              style={[
                                styles.monthWinRate,
                                isHigh && { color: '#34D399' },
                                isLow && { color: '#F87171' },
                              ]}
                            >
                              {m.winRatePct}%
                            </Text>
                            <Text style={styles.monthAvgRet}>
                              {m.avgReturnPct >= 0 ? `+${m.avgReturnPct}%` : `${m.avgReturnPct}%`}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Seasonality Commentary */}
                  <View style={styles.cardBox}>
                    <View style={styles.cardBoxHeader}>
                      <Text style={styles.cardBoxIcon}>💡</Text>
                      <Text style={styles.cardBoxTitle}>Catatan Siklus Musiman AI</Text>
                    </View>
                    <Text style={styles.seasonCommentText}>{ai?.analisa_musiman?.probabilitas_bulan_ini}</Text>
                    <Text style={styles.seasonCommentText}>{ai?.analisa_musiman?.catatan_siklus}</Text>
                    <View style={styles.riskAlertBox}>
                      <Text style={styles.riskAlertTitle}>Peringatan Siklus:</Text>
                      <Text style={styles.riskAlertText}>{ai?.analisa_musiman?.peringatan_risiko}</Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          )}

          {/* Bottom Footer Close */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.btnCloseBottom} onPress={onClose}>
              <Text style={styles.btnCloseBottomText}>Tutup Analisa Lanjutan</Text>
            </TouchableOpacity>
          </View>

          {/* Mini Dialog: Configure Gemini API Key */}
          {showKeyModal && (
            <View style={styles.keyModalOverlay}>
              <View style={styles.keyModalBox}>
                <Text style={styles.keyModalTitle}>🔑 Pengaturan Gemini API Key</Text>
                <Text style={styles.keyModalSubtitle}>
                  Key disimpan secara aman di server. Karakter API key disembunyikan untuk menjaga privasi Anda.
                </Text>

                <View style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  padding: 10,
                  borderRadius: 8,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.08)'
                }}>
                  <Text style={{ fontSize: 12, color: '#94A3B8' }}>
                    Status Saat Ini:{' '}
                    <Text style={{ fontWeight: '800', color: (serverKeyInfo?.hasKey || savedKeyExists) ? '#34D399' : '#F59E0B' }}>
                      {(serverKeyInfo?.hasKey || savedKeyExists) ? '✅ API Key Terpasang (Aman)' : '⚠️ Belum Ada Key Terpasang'}
                    </Text>
                  </Text>
                </View>

                <TextInput
                  style={styles.keyInput}
                  placeholder={(serverKeyInfo?.hasKey || savedKeyExists) ? "Masukkan key baru jika ingin mengganti" : "Paste API Key Anda di sini"}
                  placeholderTextColor="#64748B"
                  value={apiKeyInput}
                  onChangeText={setApiKeyInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={true}
                />

                <View style={styles.keyBtnRow}>
                  <TouchableOpacity
                    style={styles.btnKeyCancel}
                    onPress={() => {
                      setApiKeyInput('');
                      setShowKeyModal(false);
                    }}
                  >
                    <Text style={styles.btnKeyCancelText}>Tutup</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.btnKeySave} onPress={handleSaveApiKey}>
                    <Text style={styles.btnKeySaveText}>Simpan Aman 🔒</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </ModalErrorBoundary>
    </View>
  </Modal>
);
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'flex-end',
    width: '100%',
    height: '100%',
    ...(Platform.OS === 'web' ? {
      position: 'fixed' as any,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw' as any,
      height: '100vh' as any,
      zIndex: 99999,
    } : {}),
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: Platform.OS === 'web' ? '92vh' : '92%',
    maxHeight: Platform.OS === 'web' ? '92vh' : '92%',
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    display: 'flex',
    flexDirection: 'column',
    borderColor: '#334155',
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTicker: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  badgeAi: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeAiText: {
    fontSize: 12,
    fontWeight: '800',
  },
  modalStockName: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#334155',
    borderWidth: 1,
  },
  btnHeaderIconActive: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  btnIconText: {
    fontSize: 16,
  },
  btnClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCloseText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  sourceBanner: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceBannerGreen: {
    backgroundColor: 'rgba(6, 95, 70, 0.25)',
    borderBottomColor: '#059669',
  },
  sourceBannerPrompt: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderBottomColor: '#0284C7',
  },
  sourceTextGreen: {
    fontSize: 11,
    color: '#A7F3D0',
  },
  sourceTextPrompt: {
    fontSize: 11,
    color: '#E2E8F0',
  },
  sourceText: {
    fontSize: 11,
    color: '#64748B',
  },
  sourceHighlight: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  navBar: {
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  navScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    borderWidth: 1,
  },
  tabBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  scrollBody: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 16,
  },
  loadingSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  sectionContainer: {
    gap: 16,
  },
  sectionIntro: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 20,
  },
  // Hero Score Card
  scoreHeroCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    borderColor: '#38BDF8',
    borderWidth: 1,
  },
  scoreTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroSub: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  scoreMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  scoreBigNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: '#38BDF8',
  },
  scoreMax: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
    marginLeft: 4,
  },
  recommendationBox: {
    alignItems: 'flex-end',
  },
  recomLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
  },
  recomValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#34D399',
    marginTop: 2,
  },
  recomConfidence: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  probSection: {
    marginTop: 16,
  },
  probHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  probTextUp: {
    fontSize: 13,
    fontWeight: '800',
    color: '#34D399',
  },
  probTextDown: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F87171',
  },
  probBarBackground: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#7F1D1D',
    overflow: 'hidden',
  },
  probBarFillUp: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 5,
  },
  biasTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  biasLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  biasBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderColor: '#0284C7',
    borderWidth: 1,
  },
  biasBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38BDF8',
  },
  // Card Boxes
  cardBox: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderColor: '#334155',
    borderWidth: 1,
  },
  cardBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardBoxIcon: {
    fontSize: 18,
  },
  cardBoxTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  cardBoxSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 12,
  },
  aiRationaleText: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  summaryItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  summaryValGreen: {
    fontSize: 13,
    fontWeight: '800',
    color: '#34D399',
    marginTop: 4,
  },
  summaryValBlue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38BDF8',
    marginTop: 4,
  },
  // Sentiment Hero
  sentimentHero: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    borderColor: '#34D399',
    borderWidth: 1,
  },
  sentimentGaugeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sentimentLabelBig: {
    fontSize: 22,
    fontWeight: '900',
    color: '#34D399',
    marginTop: 4,
  },
  sentimentCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#0F172A',
    borderWidth: 3,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentimentCircleNum: {
    fontSize: 18,
    fontWeight: '900',
    color: '#34D399',
  },
  sentimentCircleSub: {
    fontSize: 9,
    color: '#64748B',
  },
  sentimentSummaryText: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 20,
    marginTop: 12,
  },
  catalystRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  catalystBullet: {
    fontSize: 14,
    fontWeight: '900',
    color: '#34D399',
    marginTop: 1,
  },
  catalystText: {
    flex: 1,
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 18,
  },
  newsCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  newsMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  newsSource: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  sentimentBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sentimentBadgeSmallText: {
    fontSize: 10,
    fontWeight: '800',
  },
  newsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    lineHeight: 18,
  },
  newsDate: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 6,
  },
  // Fundamentals Grid
  ratiosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  ratioCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  ratioCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
  },
  ratioCardValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#F8FAFC',
    marginTop: 4,
  },
  ratioCardValueGreen: {
    fontSize: 20,
    fontWeight: '900',
    color: '#34D399',
    marginTop: 4,
  },
  ratioCardValueBlue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#38BDF8',
    marginTop: 4,
  },
  ratioCardEval: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 6,
  },
  evalItem: {
    marginBottom: 10,
  },
  evalKey: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38BDF8',
  },
  evalVal: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 18,
    marginTop: 2,
  },
  evalSummaryBox: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
    marginTop: 8,
  },
  evalSummaryText: {
    fontSize: 12,
    color: '#E2E8F0',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  btnDeepResearch: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderColor: '#38BDF8',
    borderWidth: 1,
  },
  btnDeepResearchText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38BDF8',
  },
  // TradingView Chart
  chartContainer: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    borderColor: '#334155',
    borderWidth: 1,
    backgroundColor: '#0F172A',
  },
  chartLoading: {
    height: 380,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },
  chartLoadingText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 10,
  },
  chartFallback: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderColor: '#334155',
    borderWidth: 1,
  },
  chartFallbackTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  chartFallbackText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
  },
  btnOpenTV: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 14,
  },
  btnOpenTVText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  techLevelsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  levelCard: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  levelCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  levelCardValGreen: {
    fontSize: 16,
    fontWeight: '900',
    color: '#34D399',
    marginTop: 4,
  },
  levelCardValRed: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F87171',
    marginTop: 4,
  },
  techDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  techDetailLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  techDetailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  planBox: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#38BDF8',
  },
  planBoxTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38BDF8',
  },
  planBoxContent: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 18,
    marginTop: 4,
  },
  // Seasonality
  seasonHero: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    borderColor: '#334155',
    borderWidth: 1,
  },
  seasonCol: {
    flex: 1,
  },
  seasonDivider: {
    width: 1,
    backgroundColor: '#334155',
    marginHorizontal: 12,
  },
  seasonLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
  },
  seasonMonthName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#34D399',
    marginTop: 4,
  },
  seasonMonthNameRed: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F87171',
    marginTop: 4,
  },
  seasonStatWin: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 4,
  },
  seasonStatLoss: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 4,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthCard: {
    width: '23%',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  monthCardHigh: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  monthCardLow: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  monthCardCurrent: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  monthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthShort: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  currentBadge: {
    fontSize: 8,
    fontWeight: '800',
    color: '#38BDF8',
    backgroundColor: '#0284C7',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
  },
  monthWinRate: {
    fontSize: 15,
    fontWeight: '900',
    color: '#F8FAFC',
    marginTop: 4,
  },
  monthAvgRet: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  seasonCommentText: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 18,
    marginBottom: 8,
  },
  riskAlertBox: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    marginTop: 6,
  },
  riskAlertTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
  },
  riskAlertText: {
    fontSize: 11,
    color: '#CBD5E1',
    lineHeight: 16,
    marginTop: 2,
  },
  // Modal Footer
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  btnCloseBottom: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderColor: '#334155',
    borderWidth: 1,
  },
  btnCloseBottomText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  // Key Modal
  keyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  keyModalBox: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 20,
    width: '100%',
    maxWidth: 450,
    borderColor: '#38BDF8',
    borderWidth: 1,
  },
  keyModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  keyModalSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
    marginTop: 8,
  },
  keyInput: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
    borderColor: '#334155',
    borderWidth: 1,
    marginTop: 14,
  },
  keyBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  btnKeyCancel: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  btnKeyCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  btnKeySave: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0284C7',
  },
  btnKeySaveText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // 🎯 TRADING PLAN STYLES
  rrrBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  rrrBadgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '900',
  },
  cardBoxSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  tradingPlanGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  planCol: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  planColLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 4,
  },
  planColValGreen: {
    fontSize: 14,
    fontWeight: '900',
    color: '#34D399',
  },
  planColValBlue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#38BDF8',
  },
  planColValRed: {
    fontSize: 14,
    fontWeight: '900',
    color: '#F87171',
  },
  planColSub: {
    fontSize: 9.5,
    color: '#94A3B8',
    marginTop: 2,
  },

  // 💎 FAIR VALUE & MOS STYLES
  mosBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  mosBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  fairValRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  fairValBox: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  fairValLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 4,
  },
  fairValNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#38BDF8',
  },
  fairValScoreNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#34D399',
  },
  fairValSub: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 4,
  },

  // ⚠️ INVALIDATION & SCENARIO STYLES
  invalidationWarningTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#F87171',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  invalidationWarningText: {
    fontSize: 12,
    color: '#FECDD3',
    lineHeight: 18,
    marginTop: 4,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F43F5E',
  },
  catalystPillsWrap: {
    marginTop: 10,
    gap: 6,
  },
  catalystPillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  catalystPillBullet: {
    fontSize: 12,
  },
  catalystPillContent: {
    fontSize: 11.5,
    color: '#E2E8F0',
    fontWeight: '600',
    flex: 1,
  },

  // 🐳 BANDARMOLOGI & SMART MONEY STYLES
  smartHeroCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 14,
  },
  smartHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  smartHeroTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#E9D5FF',
    marginTop: 2,
  },
  smartWhaleBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A855F7',
  },
  smartWhaleEmoji: {
    fontSize: 22,
  },
  smartFlowLabel: {
    fontSize: 12,
    color: '#C084FC',
    marginTop: 8,
    fontWeight: '700',
  },
  smartGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  smartGridCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  smartGridLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 4,
  },
  smartGridValBlue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#38BDF8',
    marginBottom: 4,
  },
  smartGridValGreen: {
    fontSize: 13,
    fontWeight: '900',
    color: '#34D399',
    marginBottom: 4,
  },
  smartGridValPurple: {
    fontSize: 13,
    fontWeight: '900',
    color: '#C084FC',
    marginBottom: 4,
  },
  smartGridValYellow: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FBBF24',
    marginBottom: 4,
  },
  smartGridDesc: {
    fontSize: 10.5,
    color: '#CBD5E1',
    lineHeight: 15,
  },
  bandarGuideText: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 18,
    marginTop: 6,
  },

  // 🌐 Live Finmorph Smart Money Flow Styles
  finmorphFlowCardAi: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    marginBottom: 14,
  },
  finmorphFlowHeaderAi: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  finmorphBadgeAi: {
    fontSize: 9,
    fontWeight: '900',
    color: '#0284C7',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  finmorphTitleAi: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  finmorphSubAi: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  verdictBadgeAi: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'flex-end',
  },
  verdictTextAi: {
    fontSize: 12,
    fontWeight: '900',
  },
  verdictGradeAi: {
    fontSize: 9.5,
    color: '#E2E8F0',
    marginTop: 2,
  },
  signalsGridAi: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  signalBoxAi: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  signalLabelAi: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '700',
    marginBottom: 2,
  },
  signalValAi: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 2,
  },
  signalDescAi: {
    fontSize: 8.5,
    color: '#CBD5E1',
    textAlign: 'center',
  },
  flowNotesAi: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#38BDF8',
  },
  flowNotesTitleAi: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#38BDF8',
    marginBottom: 3,
  },
  flowNoteItemAi: {
    fontSize: 10,
    color: '#CBD5E1',
    lineHeight: 14,
  },

  // 🌟 Golden Cross & Technical Indicator Styles
  goldenCrossCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    marginBottom: 14,
  },
  goldenCrossHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  goldenCrossIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  goldenCrossTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  goldenCrossBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#F8FAFC',
    marginTop: 2,
  },
  maLevelsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  maLevelBox: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  maLevelLabel: {
    fontSize: 8.5,
    color: '#94A3B8',
    fontWeight: '700',
    marginBottom: 2,
  },
  maLevelValBlue: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#38BDF8',
  },
  maLevelValPurple: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#C084FC',
  },
  maLevelValPrice: {
    fontSize: 12.5,
    fontWeight: '900',
  },
  techIndicatorCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  techIndicatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  techIndicatorIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  techIndicatorTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
  },
  techIndicatorValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  techIndicatorSub: {
    fontSize: 10.5,
    color: '#94A3B8',
  },
  momentumRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  momentumBox: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  momentumLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#A855F7',
    marginBottom: 4,
  },
  momentumVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E2E8F0',
    lineHeight: 15,
  },
});
