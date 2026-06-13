// ---------------------------------------------------------------------------
// CIP KYC React Native SDK — Root Container
// ---------------------------------------------------------------------------

import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { CipBranding, DEFAULT_BRANDING } from '../types';
import { Stepper } from './Stepper';

interface KycContainerProps {
  branding: Required<CipBranding>;
  title: string;
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
  completedSteps: Set<string>;
  stepIds: string[];
  onCancel?: () => void;
  children: React.ReactNode;
}

export function KycContainer({
  branding,
  title,
  currentStep,
  totalSteps,
  stepLabels,
  completedSteps,
  stepIds,
  onCancel,
  children,
}: KycContainerProps) {
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: branding.backgroundColor }]}>
      <StatusBar barStyle="light-content" backgroundColor={branding.backgroundColor} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {branding.logo ? (
              <Image source={{ uri: branding.logo }} style={styles.logo} resizeMode="contain" />
            ) : null}
            <Text
              style={[
                styles.title,
                { color: branding.textColor, fontFamily: branding.fontFamily },
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onCancel}
            style={styles.cancelButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.cancelText, { color: branding.textColor }]}>&#10005;</Text>
          </TouchableOpacity>
        </View>

        {/* Stepper */}
        <Stepper
          steps={stepLabels}
          stepIds={stepIds}
          currentStep={currentStep}
          completedSteps={completedSteps}
          branding={branding}
        />

        {/* Content */}
        <View style={styles.content}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logo: {
    width: 32,
    height: 32,
    marginRight: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 4,
  },
  cancelText: {
    fontSize: 20,
    fontWeight: '300',
    opacity: 0.7,
  },
  content: {
    flex: 1,
  },
});
