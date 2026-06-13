// ---------------------------------------------------------------------------
// CIP KYC React Native SDK — Step Progress Bar
// ---------------------------------------------------------------------------

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CipBranding } from '../types';

interface StepperProps {
  steps: string[];
  stepIds: string[];
  currentStep: number;
  completedSteps: Set<string>;
  branding: Required<CipBranding>;
}

export function Stepper({ steps, stepIds, currentStep, completedSteps, branding }: StepperProps) {
  return (
    <View style={styles.container}>
      {steps.map((label, index) => {
        const isCompleted = completedSteps.has(stepIds[index]);
        const isActive = index === currentStep;
        const isPast = index < currentStep || isCompleted;

        return (
          <View key={index} style={styles.stepWrapper}>
            {/* Connector line */}
            {index > 0 && (
              <View
                style={[
                  styles.connector,
                  {
                    backgroundColor: isPast
                      ? branding.primaryColor
                      : 'rgba(255,255,255,0.15)',
                  },
                ]}
              />
            )}

            {/* Dot */}
            <View
              style={[
                styles.dot,
                isCompleted && { backgroundColor: branding.primaryColor, borderColor: branding.primaryColor },
                isActive && !isCompleted && {
                  backgroundColor: 'transparent',
                  borderColor: branding.primaryColor,
                  borderWidth: 2,
                },
                !isActive && !isCompleted && {
                  backgroundColor: 'transparent',
                  borderColor: 'rgba(255,255,255,0.25)',
                  borderWidth: 1.5,
                },
              ]}
            >
              {isCompleted && <Text style={styles.checkmark}>&#10003;</Text>}
              {isActive && !isCompleted && (
                <View
                  style={[styles.activeDotInner, { backgroundColor: branding.primaryColor }]}
                />
              )}
            </View>

            {/* Label */}
            <Text
              style={[
                styles.label,
                {
                  color: isActive || isCompleted
                    ? branding.textColor
                    : 'rgba(255,255,255,0.4)',
                  fontFamily: branding.fontFamily,
                },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stepWrapper: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  connector: {
    position: 'absolute',
    top: 10,
    left: -20,
    right: 20,
    height: 2,
    zIndex: -1,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  activeDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
});
