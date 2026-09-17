import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';
import { formatRupiah } from '../utils/formatters';

interface PositionCalculatorProps {
  currentPrice: number;
  suggestedSl?: number;
  suggestedTp?: number;
}

export default function PositionCalculator({ currentPrice, suggestedSl, suggestedTp }: PositionCalculatorProps) {
  const [capital, setCapital] = useState('20000000'); // 20 Juta default
  const [riskPct, setRiskPct] = useState('1.5'); // 1.5% default
  const [entryPrice, setEntryPrice] = useState(currentPrice ? currentPrice.toString() : '3000');
  const [slPrice, setSlPrice] = useState(suggestedSl ? suggestedSl.toString() : (currentPrice * 0.95).toFixed(0));
  const [tpPrice, setTpPrice] = useState(suggestedTp ? suggestedTp.toString() : (currentPrice * 1.08).toFixed(0));

  useEffect(() => {
    if (currentPrice > 0) {
      setEntryPrice(currentPrice.toString());
      if (suggestedSl) setSlPrice(suggestedSl.toString());
      if (suggestedTp) setTpPrice(suggestedTp.toString());
    }
  }, [currentPrice, suggestedSl, suggestedTp]);

  const capNum = parseFloat(capital) || 0;
  const riskNum = parseFloat(riskPct) || 0;
  const entryNum = parseFloat(entryPrice) || 0;
  const slNum = parseFloat(slPrice) || 0;
  const tpNum = parseFloat(tpPrice) || 0;

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
    if (currentPrice > 0) setEntryPrice(currentPrice.toString());
    if (suggestedSl) setSlPrice(suggestedSl.toString());
    if (suggestedTp) setTpPrice(suggestedTp.toString());
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🧮 Kalkulator Posisi & Money Management</Text>
        <TouchableOpacity style={styles.autoBtn} onPress={applyBandarLevels}>
          <Text style={styles.autoBtnText}>⚡ Terapkan Level Bandar</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.sub}>
        Hitung ukuran lot ideal berdasarkan batas toleransi risiko modal Anda, bukan spekulasi asal beli.
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
        <View style={styles.inputItem}>
          <Text style={styles.label}>Harga Beli (Entry Rp)</Text>
          <TextInput
            style={styles.input}
            value={entryPrice}
            onChangeText={setEntryPrice}
            keyboardType="numeric"
            placeholder="3300"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>
        <View style={styles.inputItem}>
          <Text style={styles.label}>Stop Loss (SL Rp)</Text>
          <TextInput
            style={styles.input}
            value={slPrice}
            onChangeText={setSlPrice}
            keyboardType="numeric"
            placeholder="3180"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>
        <View style={[styles.inputItem, { width: '100%' }]}>
          <Text style={styles.label}>Target Profit (TP Rp)</Text>
          <TextInput
            style={styles.input}
            value={tpPrice}
            onChangeText={setTpPrice}
            keyboardType="numeric"
            placeholder="3600"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>
      </View>

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
});
