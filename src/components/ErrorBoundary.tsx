import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Terjadi kesalahan sistem saat memuat komponen ini.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught an error]:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>
            {this.props.fallbackTitle || 'Gagal Memuat Riset Saham'}
          </Text>
          <Text style={styles.errorDesc}>
            Data emiten ini memiliki format khusus yang belum dapat diproses secara penuh.
          </Text>
          <Text style={styles.errorDetail}>
            {this.state.errorMessage}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={this.handleRetry}>
            <Text style={styles.retryBtnText}>🔄 Muat Ulang Tampilan</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: SIZES.radius,
    marginVertical: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  errorTitle: {
    color: COLORS.text,
    fontSize: SIZES.font * 1.1,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  errorDesc: {
    color: COLORS.textMuted,
    fontSize: SIZES.font * 0.85,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 10,
  },
  errorDetail: {
    color: '#EF4444',
    fontSize: SIZES.font * 0.72,
    fontFamily: 'monospace',
    marginBottom: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  retryBtnText: {
    color: COLORS.background,
    fontWeight: 'bold',
    fontSize: SIZES.font * 0.85,
  },
});
