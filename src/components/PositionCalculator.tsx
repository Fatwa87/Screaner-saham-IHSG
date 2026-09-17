import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';
import { formatRupiah } from '../utils/formatters';
import { getIdxTickSize, roundToIdxTick } from '../utils/idxTickSize';

interface PositionCalculatorProps {
  currentPrice: number;
  suggestedSl?: number;
  suggestedTp?: number;
}

export default function PositionCalculator({ currentPrice, suggestedSl, suggestedTp }: PositionCalculatorProps) {
  const [capital, setCapital] = useState('20000000'); // 20 Juta default
  const [riskPct, setRiskPct] = useState('1.5'); // 1.5% default
  const [entryPrice, setEntryPrice] = useState(currentPrice ? roundToIdxTick(currentPrice).toString() : '3000');
  const [slPrice, setSlPrice] = useState(
    suggestedSl 
      ? roundToIdxTick(suggestedSl, 'floor').toString() 
      : (currentPrice ? roundToIdxTick(currentPrice * 0.95, 'floor').toString() : '2850')
  );
  const [tpPrice, setTpPrice] = useState(
    suggestedTp 
      ? roundToIdxTick(suggestedTp, 'floor').toString() 
      : (currentPrice ? roundToIdxTick(currentPrice * 1.08, 'floor').toString() : '3240')
  );

  useEffect(() => {
    if (currentPrice > 0) {
      setEntryPrice(roundToIdxTick(currentPrice).toString());
      if (suggestedSl) setSlPrice(roundToIdxTick(suggestedSl, 'floor').toString());
      if (suggestedTp) setTpPrice(roundToIdxTick(suggestedTp, 'floor').toString());
    }
  }, [currentPrice, suggestedSl, suggestedTp]);

  const capNum = parseFloat(capital) || 0;
  const riskNum = parseFloat(riskPct) || 0;
  const entryNum = parseFloat(entryPrice) || 0;
  const slNum = parseFloat(slPrice) || 0;
  const tpNum = parseFloat(tpPrice) || 0;

  // IDX Tick Size metrics
  const activeTickPrice = entryNum > 0 ? entryNum : (currentPrice || 1000);
  const currentTickSize = getIdxTickSize(activeTickPrice);

  const entrySnapped = roundToIdxTick(entryNum);
  const isEntryTickValid = entryNum > 0 && entryNum === entrySnapped;

  const slSnapped = roundToIdxTick(slNum, 'floor');
  const isSlTickValid = slNum > 0 && slNum === slSnapped;

  const tpSnapped = roundToIdxTick(tpNum, 'floor');
  const isTpTickValid = tpNum > 0 && tpNum === tpSnapped;

  const hasInvalidTick = !isEntryTickValid || !isSlTickValid || !isTpTickValid;

  // Calculation
  const maxRiskAmount = (capNum * riskNum) / 100;
  const riskPerShare = Math.abs(entryNum - slNum);
  
  let recommendedLots = 0;
  let totalInvestment = 0;
  let actualRisk = 0;
  let potentialProfit = 0;
  let rrRatio = '—';
  let isRrGood = false;

  if (entryNum > 0 && slNum > 0 && riskPerShare > 0) {
    const rawShares = maxRiskAmount / riskPerShare;
    recommendedLots = Math.max(1, Math.floor(rawShares / 100));
    const totalShares = recommendedLots * 100;
    totalInvestment = totalShares * entryNum;
    actualRisk = totalShares * riskPerShare;

    if (tpNum > entryNum) {
      potentialProfit = totalShares * (tpNum - entryNum);
      const rrVal = ((tpNum - entryNum) / riskPerShare).toFixed(2);
      rrRatio = `1 : ${rrVal}`;
      isRrGood = parseFloat(rrVal) >= 2.0;
    }
  }

  const applyBandarLevels = () => {
    if (currentPrice > 0) setEntryPrice(roundToIdxTick(currentPrice).toString());
    if (suggestedSl) setSlPrice(roundToIdxTick(suggestedSl, 'floor').toString());
    if (suggestedTp) setTpPrice(roundToIdxTick(suggestedTp, 'floor').toString());
  };

  const snapAllToIdxTicks = () => {
    if (entryNum > 0) setEntryPrice(entrySnapped.toString());
    if (slNum > 0) setSlPrice(slSnapped.toString());
    if (tpNum > 0) setTpPrice(tpSnapped.toString());
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>🧮 Kalkulator Posisi & Money Management</Text>
          <View style={styles.tickHeaderBadge}>
            <Text style={styles.tickHeaderBadgeText}>
              🏷️ Fraksi BEI Resmi: ± Rp {currentTickSize} / tick
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity style={styles.autoBtn} onPress={applyBandarLevels}>
            <Text style={styles.autoBtnText}>⚡ Level Bandar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sub}>
        Hitung ukuran lot ideal berdasarkan toleransi risiko modal dan pastikan harga order patuh pada fraksi resmi BEI agar tidak ditolak bursa.
      </Text>

      {/* Input Fields Grid */}
      <View style={styles.inputGrid}>
        <View style={styles.inputItem}>
          <Text style={styles.label}>Modal Trading (Rp)</Text>
          <TextInput
            style={styles.input}
            value={capital}
            onChangeText={setCapital}
            keyboardType="numeric"
            placeholder="20000000"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>
        <View style={styles.inputItem}>
          <Text style={styles.label}>Toleransi Risiko (%)</Text>
          <TextInput
            style={styles.input}
            value={riskPct}
            onChangeText={setRiskPct}
            keyboardType="numeric"
            placeholder="1.5"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>

        {/* Harga Beli */}
        <View style={styles.inputItem}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Harga Beli (Entry Rp)</Text>
            {!isEntryTickValid && entryNum > 0 && (
              <TouchableOpacity onPress={() => setEntryPrice(entrySnapped.toString())}>
                <Text style={styles.snapHintText}>➔ Rp {entrySnapped}</Text>
              </TouchableOpacity>
            )}
          </View>
          <TextInput
            style={[styles.input, !isEntryTickValid && entryNum > 0 && styles.inputWarning]}
            value={entryPrice}
            onChangeText={setEntryPrice}
            keyboardType="numeric"
            placeholder="3300"
            placeholderTextColor={COLORS.textMuted}
          />
          {!isEntryTickValid && entryNum > 0 && (
            <Text style={styles.errorTickText}>Bukan kelipatan Rp {getIdxTickSize(entryNum)}</Text>
          )}
        </View>

        {/* Stop Loss */}
        <View style={styles.inputItem}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Stop Loss (SL Rp)</Text>
            {!isSlTickValid && slNum > 0 && (
              <TouchableOpacity onPress={() => setSlPrice(slSnapped.toString())}>
                <Text style={styles.snapHintText}>➔ Rp {slSnapped}</Text>
              </TouchableOpacity>
            )}
          </View>
          <TextInput
            style={[styles.input, !isSlTickValid && slNum > 0 && styles.inputWarning]}
            value={slPrice}
            onChangeText={setSlPrice}
            keyboardType="numeric"
            placeholder="3180"
            placeholderTextColor={COLORS.textMuted}
          />
          {!isSlTickValid && slNum > 0 && (
            <Text style={styles.errorTickText}>Bukan kelipatan Rp {getIdxTickSize(slNum)}</Text>
          )}
        </View>

        {/* Target Profit */}
        <View style={[styles.inputItem, { width: '100%' }]}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Target Profit (TP Rp)</Text>
            {!isTpTickValid && tpNum > 0 && (
              <TouchableOpacity onPress={() => setTpPrice(tpSnapped.toString())}>
                <Text style={styles.snapHintText}>➔ Sesuaikan ke Rp {tpSnapped}</Text>
              </TouchableOpacity>
            )}
          </View>
          <TextInput
            style={[styles.input, !isTpTickValid && tpNum > 0 && styles.inputWarning]}
            value={tpPrice}
            onChangeText={setTpPrice}
            keyboardType="numeric"
            placeholder="3600"
            placeholderTextColor={COLORS.textMuted}
          />
          {!isTpTickValid && tpNum > 0 && (
            <Text style={styles.errorTickText}>
              Bukan kelipatan Rp {getIdxTickSize(tpNum)}. Klik tombol panah di atas untuk membulatkan ke fraksi sah terdekat.
            </Text>
          )}
        </View>
      </View>

      {/* Snap All helper button if any invalid ticks */}
      {hasInvalidTick && (
        <TouchableOpacity style={styles.snapAllBtn} onPress={snapAllToIdxTicks}>
          <Text style={styles.snapAllBtnText}>⚡ Rapikan Semua Harga ke Fraksi BEI Terdekat</Text>
        </TouchableOpacity>
      )}

      {/* Results Card */}
      <View style={styles.resultBox}>
        <View style={styles.resultRow}>
          <View>
            <Text style={styles.resLabel}>Rekomendasi Beli</Text>
            <Text style={styles.resLotValue}>{recommendedLots} LOT</Text>
            <Text style={styles.resShares}>({(recommendedLots * 100).toLocaleString('id-ID')} Lembar)</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.resLabel}>Modal Terpakai</Text>
            <Text style={styles.resInvestValue}>{formatRupiah(totalInvestment)}</Text>
            <Text style={styles.resPct}>({((totalInvestment / (capNum || 1)) * 100).toFixed(1)}% dari modal)</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.resultRow}>
          <View>
            <Text style={styles.resLabel}>Risiko Maksimal (SL)</Text>
            <Text style={[styles.resRiskValue, { color: COLORS.danger }]}>{formatRupiah(actualRisk)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.resLabel}>Potensi Profit (TP)</Text>
            <Text style={[styles.resRiskValue, { color: COLORS.success }]}>{formatRupiah(potentialProfit)}</Text>
          </View>
        </View>

        <View style={styles.rrContainer}>
          <View style={styles.rrLeft}>
            <Text style={styles.rrTitle}>Risk : Reward</Text>
            <Text style={[styles.rrBig, { color: isRrGood ? COLORS.success : COLORS.warning }]}>{rrRatio}</Text>
          </View>
          <View style={[styles.rrBadge, { backgroundColor: isRrGood ? '#064E3B' : '#78350F' }]}>
            <Text style={[styles.rrBadgeText, { color: isRrGood ? '#34D399' : '#FBBF24' }]}>
              {isRrGood ? 'SANGAT LAYAK (> 1:2)' : 'MODERAT (< 1:2)'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.05,
    fontWeight: 'bold',
  },
  autoBtn: {
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  autoBtnText: {
    color: COLORS.primary,
    fontSize: SIZES.font * 0.75,
    fontWeight: 'bold',
  },
  sub: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.8,
    marginBottom: 12,
    lineHeight: 18,
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  inputItem: {
    width: '48%',
    marginBottom: 10,
  },
  label: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.surfaceLight,
    color: COLORS.text,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: SIZES.font * 0.9,
    fontWeight: 'bold',
  },
  resultBox: {
    backgroundColor: COLORS.surfaceLight,
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resLabel: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
  },
  resLotValue: {
    color: COLORS.primary,
    fontSize: SIZES.font * 1.4,
    fontWeight: '900',
  },
  resShares: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
  },
  resInvestValue: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.1,
    fontWeight: 'bold',
  },
  resPct: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.7,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.surface,
    marginVertical: 10,
  },
  resRiskValue: {
    fontSize: SIZES.font * 0.95,
    fontWeight: 'bold',
    marginTop: 2,
  },
  rrContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.surface,
  },
  rrLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rrTitle: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.8,
    marginRight: 8,
  },
  rrBig: {
    fontSize: SIZES.font * 1.1,
    fontWeight: '900',
  },
  rrBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rrBadgeText: {
    fontSize: SIZES.font * 0.75,
    fontWeight: 'bold',
  },
  tickHeaderBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  tickHeaderBadgeText: {
    color: '#38BDF8',
    fontSize: SIZES.font * 0.72,
    fontWeight: '800',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  snapHintText: {
    color: '#38BDF8',
    fontSize: SIZES.font * 0.7,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  inputWarning: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  errorTickText: {
    color: '#F59E0B',
    fontSize: 10,
    marginTop: 3,
    fontWeight: '600',
  },
  snapAllBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38BDF8',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  snapAllBtnText: {
    color: '#38BDF8',
    fontSize: SIZES.font * 0.78,
    fontWeight: 'bold',
  },
});
