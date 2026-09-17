import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line, Text as SvgText } from 'react-native-svg';
import { COLORS, SIZES } from '../constants/theme';
import { formatRupiah } from '../utils/formatters';

interface StockChartProps {
  data: number[];
  width?: number;
  height?: number;
  avgBandar?: number;
}

export default function StockChart({ data, width, height = 190, avgBandar }: StockChartProps) {
  const chartWidth = width || Dimensions.get('window').width - SIZES.padding * 2 - 32;

  if (!data || data.length < 2) {
    return (
      <View style={[styles.emptyContainer, { height }]}>
        <Text style={styles.emptyText}>Data historis tidak mencukupi</Text>
      </View>
    );
  }

  // Factor in avgBandar into min/max scale so the bandar line is always in view
  let min = Math.min(...data);
  let max = Math.max(...data);
  if (avgBandar && avgBandar > 0) {
    min = Math.min(min, avgBandar * 0.98);
    max = Math.max(max, avgBandar * 1.02);
  }

  const range = max - min === 0 ? 1 : max - min;
  
  const padX = 16;
  const padTop = 22;
  const padBottom = 25;
  const usableWidth = chartWidth - padX * 2;
  const usableHeight = height - padTop - padBottom;

  const points = data.map((val, idx) => {
    const x = padX + (idx / (data.length - 1)) * usableWidth;
    const y = padTop + usableHeight - ((val - min) / range) * usableHeight;
    return { x, y, val };
  });

  // Construct line path
  const linePath = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  // Construct area fill path
  const firstPt = points[0];
  const lastPt = points[points.length - 1];
  const fillPath = `${linePath} L ${lastPt.x} ${height - padBottom} L ${firstPt.x} ${height - padBottom} Z`;

  const isUpTrend = data[data.length - 1] >= data[0];
  const strokeColor = isUpTrend ? COLORS.primary : '#F87171';
  const gradientColor = isUpTrend ? COLORS.primary : '#EF4444';

  // Calculate Avg Bandar horizontal line position
  let avgBandarY: number | null = null;
  if (avgBandar && avgBandar > 0) {
    avgBandarY = padTop + usableHeight - ((avgBandar - min) / range) * usableHeight;
  }

  return (
    <View style={styles.container}>
      {/* High, Low, and Bandar Legend header */}
      <View style={styles.statsHeader}>
        <Text style={styles.statTag}>
          Tertinggi: <Text style={styles.highVal}>{formatRupiah(Math.max(...data))}</Text>
        </Text>
        {avgBandar ? (
          <View style={styles.bandarLegend}>
            <View style={styles.bandarDot} />
            <Text style={styles.bandarLegendText}>
              Avg Bandar: <Text style={styles.bandarLegendVal}>{formatRupiah(avgBandar)}</Text>
            </Text>
          </View>
        ) : null}
        <Text style={styles.statTag}>
          Terendah: <Text style={styles.lowVal}>{formatRupiah(Math.min(...data))}</Text>
        </Text>
      </View>

      <Svg width={chartWidth} height={height}>
        <Defs>
          <LinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={gradientColor} stopOpacity="0.4" />
            <Stop offset="100%" stopColor={gradientColor} stopOpacity="0.0" />
          </LinearGradient>
        </Defs>

        {/* Baseline grid lines */}
        <Line 
          x1={padX} 
          y1={padTop + usableHeight / 2} 
          x2={chartWidth - padX} 
          y2={padTop + usableHeight / 2} 
          stroke={COLORS.border} 
          strokeDasharray="4 4" 
          strokeWidth="1" 
        />
        <Line 
          x1={padX} 
          y1={padTop + usableHeight} 
          x2={chartWidth - padX} 
          y2={padTop + usableHeight} 
          stroke={COLORS.border} 
          strokeWidth="1" 
        />

        {/* Filled Area */}
        <Path d={fillPath} fill="url(#chartGradient)" />

        {/* Price Line */}
        <Path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2.5" />

        {/* Avg Bandar Golden Dashed Line */}
        {avgBandarY !== null && avgBandarY >= padTop && avgBandarY <= (padTop + usableHeight) && (
          <>
            <Line
              x1={padX}
              y1={avgBandarY}
              x2={chartWidth - padX}
              y2={avgBandarY}
              stroke="#F59E0B"
              strokeWidth="1.8"
              strokeDasharray="6 4"
            />
            <SvgText
              x={chartWidth - padX - 8}
              y={avgBandarY - 4}
              textAnchor="end"
              fill="#F59E0B"
              fontSize="10"
              fontWeight="bold"
            >
              Avg Bandar
            </SvgText>
          </>
        )}

        {/* Current / Last Value Dot */}
        <Circle cx={lastPt.x} cy={lastPt.y} r="5" fill={strokeColor} />
      </Svg>

      {/* X-Axis labels */}
      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>30 Hari Lalu</Text>
        <Text style={styles.axisLabel}>15 Hari Lalu</Text>
        <Text style={[styles.axisLabel, { color: strokeColor }]}>Hari Ini</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  statTag: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
  },
  highVal: {
    color: COLORS.success,
    fontWeight: 'bold',
  },
  lowVal: {
    color: COLORS.danger,
    fontWeight: 'bold',
  },
  bandarLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#78350F',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bandarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
    marginRight: 4,
  },
  bandarLegendText: {
    color: '#FEF3C7',
    fontSize: SIZES.font * 0.75,
  },
  bandarLegendVal: {
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 12,
    marginTop: 4,
  },
  axisLabel: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.75,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.85,
  },
});
