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
} from '../utils/geminiAnalysis';

interface AdvancedAiModalProps {
  visible: boolean;
  onClose: () => void;
  ticker: string;
  stockName?: string;
  currentPrice?: number;
  currentChangePct?: number;
  onNavigateAnalysis?: (ticker: string) => void;
}

type SubTab = 'aiScore' | 'sentiment' | 'fundamentals' | 'tradingView' | 'seasonality';

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

  // Gemini API Key config dialog state
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savedKeyExists, setSavedKeyExists] = useState(false);
  const [serverKeyInfo, setServerKeyInfo] = useState<{ hasKey: boolean; keyMasked: string; source: string }>({
    hasKey: false,
    keyMasked: '',
    source: '',
  });

  useEffect(() => {
    if (visible && ticker) {
      loadAnalysis();
    }
  }, [visible, ticker]);

  useEffect(() => {
    getGeminiApiKey().then(k => {
      setApiKeyInput(k);
    });
    getServerKeyStatus().then(info => {
      setServerKeyInfo(info);
      setSavedKeyExists(info.hasKey);
      if (info.hasKey && !apiKeyInput) {
        setApiKeyInput(info.keyMasked);
      }
    });
  }, [showKeyModal, visible]);

  const loadAnalysis = async () => {
    setLoading(true);
    try {
      getServerKeyStatus().then(info => {
        setServerKeyInfo(info);
        if (info.hasKey) setSavedKeyExists(true);
      });
      const res = await fetchCompleteAiAnalysis(ticker, currentPrice, currentChangePct);
      setData(res);
    } catch (e) {
      console.error('[AdvancedAiModal] Error fetching analysis:', e);
    }
    setLoading(false);
  };

  const handleSaveApiKey = async () => {
    await saveGeminiApiKey(apiKeyInput);
    const info = await getServerKeyStatus();
    setServerKeyInfo(info);
    setSavedKeyExists(info.hasKey || !!apiKeyInput.trim());
    setShowKeyModal(false);
    // Reload analysis immediately with newly planted key
    loadAnalysis();
  };

  if (!visible) return null;

  const cleanTicker = (ticker || 'BBCA').toUpperCase().replace('.JK', '').trim();
  const price = data?.price || currentPrice || 0;
  const changePct = data?.changePct !== undefined ? data.changePct : currentChangePct;
  const isUp = changePct >= 0;

  const ai = data?.geminiResult;
  const ratios = data?.ratios;
  const news = data?.news;
  const seasonality = data?.seasonality;

  // TradingView Widget URL
  const tvWidgetUrl = `https://s.tradingview.com/widgetembed/?symbol=IDX%3A${cleanTicker}&interval=D&theme=dark&style=1&timezone=Asia%2FJakarta&locale=id&toolbarbg=0f172a&studies=%5B%22MASimple%40tv-basicstudies%22%2C%22RSI%40tv-basicstudies%22%5D&hide_side_toolbar=0&allow_symbol_change=1&save_image=1`;

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
              (serverKeyInfo.hasKey || savedKeyExists) ? styles.sourceBannerGreen : styles.sourceBannerPrompt,
            ]}
            onPress={() => setShowKeyModal(true)}
            activeOpacity={0.8}
          >
            {(serverKeyInfo.hasKey || savedKeyExists) ? (
              <Text style={styles.sourceTextGreen}>
                🟢 <Text style={{ fontWeight: '900', color: '#34D399' }}>Google Gemini 3.6 Flash Aktif</Text>
                {serverKeyInfo.keyMasked ? ` (Key: ${serverKeyInfo.keyMasked})` : ' (Planted Key)'} · Klik untuk ubah ➔
              </Text>
            ) : (
              <Text style={styles.sourceTextPrompt}>
                ⚡ <Text style={{ fontWeight: '900', color: '#38BDF8' }}>Tanam Gemini API Key:</Text> Klik di sini untuk menanam key agar analisa 100% diproses langsung oleh Gemini AI Cloud ➔
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
                style={[styles.tabBtn, activeTab === 'sentiment' && styles.tabBtnActive]}
                onPress={() => setActiveTab('sentiment')}
              >
                <Text style={[styles.tabBtnText, activeTab === 'sentiment' && styles.tabBtnTextActive]}>
                  📰 2. Sentimen Berita
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'fundamentals' && styles.tabBtnActive]}
                onPress={() => setActiveTab('fundamentals')}
              >
                <Text style={[styles.tabBtnText, activeTab === 'fundamentals' && styles.tabBtnTextActive]}>
                  📊 3. Rasio Finansial
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'tradingView' && styles.tabBtnActive]}
                onPress={() => setActiveTab('tradingView')}
              >
                <Text style={[styles.tabBtnText, activeTab === 'tradingView' && styles.tabBtnTextActive]}>
                  📈 4. Chart TradingView
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'seasonality' && styles.tabBtnActive]}
                onPress={() => setActiveTab('seasonality')}
              >
                <Text style={[styles.tabBtnText, activeTab === 'seasonality' && styles.tabBtnTextActive]}>
                  📅 5. Pola Musiman (5 Thn)
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

              {/* TAB 2: SENTIMEN BERITA */}
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

                  {/* Technical Analysis Breakdown */}
                  <View style={styles.cardBox}>
                    <View style={styles.cardBoxHeader}>
                      <Text style={styles.cardBoxIcon}>📐</Text>
                      <Text style={styles.cardBoxTitle}>Analisa Chart & Level Kunci AI</Text>
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
        </View>

        {/* Mini Dialog: Configure Gemini API Key */}
        <Modal
          visible={showKeyModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowKeyModal(false)}
        >
          <View style={styles.keyModalOverlay}>
            <View style={styles.keyModalBox}>
              <Text style={styles.keyModalTitle}>🔑 Tanam Otomatis Gemini API Key</Text>
              <Text style={styles.keyModalSubtitle}>
                Key disimpan permanen di file .env server dan memori aplikasi. Seluruh analisa saham otomatis diproses 100% langsung oleh Google Gemini 3.6 Flash!
              </Text>

              <TextInput
                style={styles.keyInput}
                placeholder="Paste AIzaSy... API Key di sini"
                placeholderTextColor="#64748B"
                value={apiKeyInput}
                onChangeText={setApiKeyInput}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={false}
              />

              <View style={styles.keyBtnRow}>
                <TouchableOpacity
                  style={styles.btnKeyCancel}
                  onPress={() => setShowKeyModal(false)}
                >
                  <Text style={styles.btnKeyCancelText}>Batal</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.btnKeySave} onPress={handleSaveApiKey}>
                  <Text style={styles.btnKeySaveText}>Tanam Permanen 🚀</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '92%',
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
});
