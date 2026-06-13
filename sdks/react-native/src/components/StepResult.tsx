// ---------------------------------------------------------------------------
// CIP KYC React Native SDK — Step Result Display
// ---------------------------------------------------------------------------

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { CipBranding, StepResult as StepResultType, QualityIssue } from '../types';

interface StepResultProps {
  result: StepResultType;
  branding: Required<CipBranding>;
  onContinue: () => void;
  onRetry?: () => void;
}

export function StepResult({ result, branding, onContinue, onRetry }: StepResultProps) {
  const passed = result.passed;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Icon */}
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: passed ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' },
        ]}
      >
        <Text style={[styles.icon, { color: passed ? '#22C55E' : '#EF4444' }]}>
          {passed ? '\u2713' : '\u2717'}
        </Text>
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: branding.textColor }]}>
        {passed ? 'Step Passed' : 'Step Failed'}
      </Text>

      {/* Extracted data (for passed steps) */}
      {passed && result.data && Object.keys(result.data).length > 0 && (
        <View style={[styles.dataCard, { borderRadius: branding.borderRadius }]}>
          {Object.entries(result.data).map(([key, value]) => {
            if (value === null || value === undefined) return null;
            return (
              <View key={key} style={styles.dataRow}>
                <Text style={styles.dataLabel}>{formatLabel(key)}</Text>
                <Text style={[styles.dataValue, { color: branding.textColor }]}>
                  {typeof value === 'number'
                    ? key.toLowerCase().includes('score')
                      ? `${(value * 100).toFixed(1)}%`
                      : String(value)
                    : String(value)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Errors */}
      {!passed && result.errors.length > 0 && (
        <View style={styles.errorSection}>
          {result.errors.map((err, i) => (
            <View key={i} style={styles.errorCard}>
              <Text style={styles.errorText}>{err}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Quality issues */}
      {result.quality && result.quality.issues.length > 0 && (
        <View style={styles.qualitySection}>
          <Text style={[styles.qualitySectionTitle, { color: branding.textColor }]}>
            Quality Issues
          </Text>
          {result.quality.issues.map((issue: QualityIssue, i: number) => (
            <View
              key={i}
              style={[
                styles.qualityCard,
                {
                  borderLeftColor: severityColor(issue.severity),
                },
              ]}
            >
              <Text style={styles.qualityMessage}>{issue.message}</Text>
              <Text style={[styles.qualitySeverity, { color: severityColor(issue.severity) }]}>
                {issue.severity.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        {passed ? (
          <TouchableOpacity
            onPress={onContinue}
            style={[
              styles.primaryButton,
              { backgroundColor: branding.primaryColor, borderRadius: branding.borderRadius },
            ]}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onRetry}
            style={[
              styles.primaryButton,
              { backgroundColor: branding.primaryColor, borderRadius: branding.borderRadius },
            ]}
          >
            <Text style={styles.primaryButtonText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

// ---- Helpers -------------------------------------------------------------

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'high':
      return '#EF4444';
    case 'medium':
      return '#F59E0B';
    case 'low':
      return '#3B82F6';
    default:
      return '#6B7280';
  }
}

// ---- Styles --------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 36,
    fontWeight: '700',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  dataCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    marginBottom: 16,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  dataLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    flex: 1,
  },
  dataValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  errorSection: {
    width: '100%',
    marginBottom: 16,
  },
  errorCard: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
  },
  qualitySection: {
    width: '100%',
    marginBottom: 16,
  },
  qualitySectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  qualityCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qualityMessage: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    flex: 1,
  },
  qualitySeverity: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 8,
  },
  actions: {
    width: '100%',
    marginTop: 8,
  },
  primaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
