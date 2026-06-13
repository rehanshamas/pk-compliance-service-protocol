// ---------------------------------------------------------------------------
// CIP KYC React Native SDK — Final Completion Screen
// ---------------------------------------------------------------------------

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { CipBranding, CipKycResult, DEFAULT_STRINGS } from '../types';

interface CompletionScreenProps {
  result: CipKycResult;
  branding: Required<CipBranding>;
  strings: Record<string, string>;
  onDone: () => void;
}

export function CompletionScreen({ result, branding, strings, onDone }: CompletionScreenProps) {
  const mergedStrings = { ...DEFAULT_STRINGS, ...strings };

  const isApproved = result.status === 'approved';
  const isRejected = result.status === 'rejected';
  const isPending = result.status === 'pending';

  const statusColor = isApproved ? '#22C55E' : isRejected ? '#EF4444' : '#F59E0B';
  const statusBg = isApproved
    ? 'rgba(34,197,94,0.15)'
    : isRejected
    ? 'rgba(239,68,68,0.15)'
    : 'rgba(245,158,11,0.15)';

  const subtitle = isApproved
    ? mergedStrings['result.complete.approved']
    : isPending
    ? mergedStrings['result.complete.pending']
    : mergedStrings['result.complete.rejected'];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Status icon */}
      <View style={[styles.iconCircle, { backgroundColor: statusBg }]}>
        <Text style={[styles.icon, { color: statusColor }]}>
          {isApproved ? '\u2713' : isRejected ? '\u2717' : '\u2026'}
        </Text>
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: branding.textColor }]}>
        {mergedStrings['result.complete.title']}
      </Text>

      {/* Status badge */}
      <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>
          {result.status.toUpperCase()}
        </Text>
      </View>

      {/* Subtitle */}
      <Text style={styles.subtitle}>{subtitle}</Text>

      {/* Verified data summary */}
      {result.data && Object.keys(result.data).length > 0 && (
        <View style={[styles.dataCard, { borderRadius: branding.borderRadius }]}>
          <Text style={[styles.dataTitle, { color: branding.textColor }]}>Verified Data</Text>
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

      {/* Session ID */}
      <Text style={styles.sessionId}>Session: {result.sessionId}</Text>

      {/* Done button */}
      <TouchableOpacity
        onPress={onDone}
        style={[
          styles.doneButton,
          { backgroundColor: branding.primaryColor, borderRadius: branding.borderRadius },
        ]}
      >
        <Text style={styles.doneButtonText}>{mergedStrings['done.button']}</Text>
      </TouchableOpacity>
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
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 24,
  },
  icon: {
    fontSize: 44,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  dataCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    marginBottom: 20,
  },
  dataTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
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
  sessionId: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    marginBottom: 24,
  },
  doneButton: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
