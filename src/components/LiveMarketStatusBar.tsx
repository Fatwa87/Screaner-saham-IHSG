import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  subscribeLiveStatus,
  setCustomApiUrl,
  testServerConnection,
  SERVER_PRESETS,
  getApiBaseUrl,
} from '../utils/apiConfig';
import { fetchQuotes } from '../utils/yfinance';

export default function LiveMarketStatusBar() {
  const [status, setStatus] = useState({
    connected: false,
    lastUpdate: null as Date | null,
    latency: null as number | null,
    serverUrl: getApiBaseUrl(),
    error: null as string | null,
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latency: number;
    sampleQuotes?: Record<string, { price: number; change: number }>;
    error?: string;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeLiveStatus(newStatus => {
      setStatus(newStatus);
      if (!inputUrl) {
        setInputUrl(newStatus.serverUrl);
      }
    });
    return unsubscribe;
  }, []);

  const handleOpenModal = () => {
    setInputUrl(status.serverUrl);
    setTestResult(null);
    setModalVisible(true);
  };

  const handleRunTest = async (urlToTest?: string) => {
    const target = urlToTest || inputUrl;
    if (!target) return;
    setTesting(true);
    setTestResult(null);
    const res = await testServerConnection(target);
    setTesting(false);
    setTestResult(res);
  };

  const handleApplyServer = async (targetUrl?: string) => {
    const finalUrl = (targetUrl !== undefined ? targetUrl : inputUrl).trim();
    await setCustomApiUrl(finalUrl || null);
    setModalVisible(false);
    // Trigger immediate re-fetch of sample leaders
    fetchQuotes(['BBCA', 'BBRI', 'BMRI', '^JKSE']).catch(() => {});
  };

  const formatTime = (d: Date | null) => {
    if (!d) return '--:--:--';
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <>
      {/* Top Banner Status Bar */}
      <View style={[styles.barContainer, status.connected ? styles.barConnected : styles.barDisconnected]}>
        <View style={styles.barLeft}>
          <View style={styles.dotWrapper}>
            <View style={[styles.dotAura, status.connected ? styles.dotAuraGreen : styles.dotAuraRed]} />
            <View style={[styles.dot, status.connected ? styles.dotGreen : styles.dotRed]} />
          </View>
          <Text style={styles.barTitle}>
            {status.connected ? 'LIVE MARKET DATA TERHUBUNG' : 'SERVER DATA BURSA OFFLINE'}
          </Text>
          {status.connected && status.latency !== null ? (
            <View style={styles.latencyBadge}>
              <Text style={styles.latencyText}>⚡ {status.latency}ms • {formatTime(status.lastUpdate)} WIB</Text>
            </View>
          ) : (
            <Text style={styles.barSubAlert}>
              Klik Hubungkan untuk aktifkan data real-time
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.btnAction, status.connected ? styles.btnActionGreen : styles.btnActionRed]}
          onPress={handleOpenModal}
          activeOpacity={0.8}
        >
          <Text style={styles.btnActionText}>
            {status.connected ? '⚙️ Server Cloud' : '🔌 Hubungkan'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal Settings & Tester */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>🔌 Koneksi Data Real-Time</Text>
                <Text style={styles.modalSubtitle}>
                  Data Bursa Efek Indonesia (IDX) & Yahoo Finance 100% Bebas Bias
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.btnClose}>
                <Text style={styles.btnCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Current Active URL Banner */}
            <View style={styles.currentUrlBox}>
              <Text style={styles.currentUrlLabel}>Server Aktif Saat Ini:</Text>
              <Text style={styles.currentUrlValue} numberOfLines={1}>{status.serverUrl || 'Default'}</Text>
              <View style={styles.currentStatusRow}>
                <View style={[styles.statusBadge, status.connected ? styles.badgeGreen : styles.badgeRed]}>
                  <Text style={styles.badgeText}>
                    {status.connected ? '🟢 TERHUBUNG 100% LIVE' : '🔴 TERPUTUS / OFFLINE'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick Presets */}
            <Text style={styles.sectionHeading}>PILIHAN SERVER CEPAT (PRESET):</Text>
            {SERVER_PRESETS.map(preset => {
              const isActive = status.serverUrl === preset.url;
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[styles.presetCard, isActive && styles.presetCardActive]}
                  onPress={() => {
                    setInputUrl(preset.url);
                    handleRunTest(preset.url);
                  }}
                >
                  <View style={styles.presetTop}>
                    <Text style={styles.presetName}>{preset.name}</Text>
                    {isActive && <Text style={styles.activeTag}>AKTIF</Text>}
                  </View>
                  <Text style={styles.presetDesc}>{preset.desc}</Text>
                  <Text style={styles.presetUrl}>{preset.url}</Text>
                </TouchableOpacity>
              );
            })}

            {/* Custom Input */}
            <Text style={[styles.sectionHeading, { marginTop: 12 }]}>ATAU MASUKKAN URL BACKEND CLOUD:</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                placeholder="https://screaner-saham-ihsg.onrender.com"
                placeholderTextColor="#64748B"
                value={inputUrl}
                onChangeText={setInputUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.btnTest}
                onPress={() => handleRunTest()}
                disabled={testing || !inputUrl}
              >
                {testing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.btnTestText}>⚡ Tes</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Test Result Display */}
            {testResult && (
              <View style={[styles.testBox, testResult.success ? styles.testSuccess : styles.testFail]}>
                {testResult.success ? (
                  <>
                    <Text style={styles.testTitleSuccess}>
                      ✅ Koneksi Sukses! Latensi: {testResult.latency}ms
                    </Text>
                    <Text style={styles.testDescSuccess}>
                      Sampel Harga Bursa Live:
                      {testResult.sampleQuotes?.['BBCA.JK']
                        ? ` BBCA: Rp ${testResult.sampleQuotes['BBCA.JK'].price.toLocaleString('id-ID')} (${testResult.sampleQuotes['BBCA.JK'].change > 0 ? '+' : ''}${testResult.sampleQuotes['BBCA.JK'].change.toFixed(2)}%)`
                        : ''}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.testTitleFail}>❌ Gagal Terhubung</Text>
                    <Text style={styles.testDescFail}>{testResult.error}</Text>
                  </>
                )}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.btnCancelText}>Tutup</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnApply}
                onPress={() => handleApplyServer()}
              >
                <Text style={styles.btnApplyText}>Simpan & Terapkan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    zIndex: 999,
  },
  barConnected: {
    backgroundColor: '#0A1713',
    borderBottomColor: 'rgba(16, 185, 129, 0.3)',
  },
  barDisconnected: {
    backgroundColor: '#1C0E14',
    borderBottomColor: 'rgba(244, 63, 94, 0.3)',
  },
  barLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    gap: 6,
  },
  dotWrapper: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  dotAura: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dotAuraGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.35)',
  },
  dotAuraRed: {
    backgroundColor: 'rgba(244, 63, 94, 0.35)',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotGreen: {
    backgroundColor: '#10B981',
  },
  dotRed: {
    backgroundColor: '#F43F5E',
  },
  barTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  latencyBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  latencyText: {
    fontSize: 10,
    color: '#34D399',
    fontWeight: '700',
  },
  barSubAlert: {
    fontSize: 10,
    color: '#FB7185',
    fontWeight: '600',
  },
  btnAction: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 7,
    marginLeft: 8,
  },
  btnActionGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  btnActionRed: {
    backgroundColor: '#E11D48',
  },
  btnActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    width: '100%',
    maxWidth: 520,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  btnClose: {
    padding: 6,
  },
  btnCloseText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: 'bold',
  },
  currentUrlBox: {
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  currentUrlLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  currentUrlValue: {
    fontSize: 13,
    color: '#38BDF8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    marginVertical: 4,
  },
  currentStatusRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeGreen: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  badgeRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  presetCard: {
    backgroundColor: '#1E293B',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetCardActive: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  presetTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  presetName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  activeTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  presetDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginVertical: 2,
  },
  presetUrl: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
  },
  btnTest: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnTestText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  testBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  testSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: '#22c55e',
  },
  testFail: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#ef4444',
  },
  testTitleSuccess: {
    color: '#4ade80',
    fontWeight: '700',
    fontSize: 12,
  },
  testDescSuccess: {
    color: '#bbf7d0',
    fontSize: 12,
    marginTop: 4,
  },
  testTitleFail: {
    color: '#f87171',
    fontWeight: '700',
    fontSize: 12,
  },
  testDescFail: {
    color: '#fca5a5',
    fontSize: 11,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  btnCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  btnCancelText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  btnApply: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#10B981',
  },
  btnApplyText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
