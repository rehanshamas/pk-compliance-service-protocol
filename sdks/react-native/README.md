# @cip/kyc-react-native

CIP KYC React Native SDK — embed identity verification in your React Native / Expo mobile app.

## Installation

```bash
npm install @cip/kyc-react-native
# or
yarn add @cip/kyc-react-native
```

### Peer Dependencies

Ensure you have the following installed:

```bash
npx expo install expo-camera
```

Or for bare React Native:

```bash
npm install expo-camera
```

## Quick Start

```tsx
import { CipKyc } from '@cip/kyc-react-native';

function KycScreen({ navigation }) {
  return (
    <CipKyc
      apiKey="your-vasp-api-key"
      sessionId="session-id-from-backend"
      verificationLevel="basic"
      branding={{
        primaryColor: '#F28A17',
        backgroundColor: '#0A0A0C',
        textColor: '#F5F5F5',
        companyName: 'Your Company',
      }}
      onComplete={(result) => {
        console.log('KYC complete:', result);
        navigation.goBack();
      }}
      onStepComplete={(step, data) => {
        console.log(`Step ${step} done:`, data);
      }}
      onError={(error) => {
        console.error('KYC error:', error);
      }}
      onCancel={() => {
        navigation.goBack();
      }}
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `apiKey` | `string` | Yes | API key issued by CIP for your VASP |
| `sessionId` | `string` | Yes | KYC session ID from the CIP backend |
| `apiBaseUrl` | `string` | No | CIP backend URL (default: `https://api.cip.app`) |
| `verificationLevel` | `'basic' \| 'advanced'` | No | Verification level (default: `basic`) |
| `branding` | `CipBranding` | No | Visual branding overrides |
| `locale` | `string` | No | Locale code (default: `en`) |
| `strings` | `Record<string, string>` | No | Custom string overrides |
| `onComplete` | `(result: CipKycResult) => void` | No | Called when verification completes |
| `onStepComplete` | `(step: string, data: any) => void` | No | Called after each step |
| `onError` | `(error: CipKycError) => void` | No | Called on errors |
| `onCancel` | `() => void` | No | Called when user cancels |

## Verification Levels

- **basic**: Document front + back + selfie (3 steps)
- **advanced**: Document front + back + selfie + liveness check + document-in-hand (5 steps)

## Branding

```typescript
interface CipBranding {
  primaryColor?: string;    // Accent color (default: #F28A17)
  backgroundColor?: string; // Background (default: #0A0A0C)
  textColor?: string;       // Text color (default: #F5F5F5)
  logo?: string;            // Logo URL
  companyName?: string;     // Company name
  fontFamily?: string;      // Font family (default: System)
  borderRadius?: number;    // Border radius (default: 12)
}
```

## Camera Permissions

The SDK handles camera permission requests automatically. On first launch, it presents a permission screen explaining why camera access is needed before requesting the system permission dialog.

For iOS, add to your `Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Camera access is required for identity verification</string>
```

For Android, add to `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
```

## Architecture

The SDK is a single full-screen React Native component that manages the entire KYC flow:

1. Initializes session via the CIP API
2. Requests camera permission
3. Walks through each verification step
4. Uploads captured images to the CIP backend
5. Shows results and completion screen

All API communication uses React Native's built-in `fetch`. Camera capture uses `expo-camera`'s `CameraView` component.

## License

MIT
