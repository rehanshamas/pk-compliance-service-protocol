# @cip/kyc-web-sdk

CIP KYC Web SDK — embed identity verification in your web app.

## Installation

```bash
npm install @cip/kyc-web-sdk
```

## Quick Start

```html
<div id="kyc-container" style="width:100%;height:600px;"></div>

<script type="module">
  import { CipKyc } from '@cip/kyc-web-sdk';

  const kyc = new CipKyc({
    apiKey: 'your-api-key',
    sessionId: 'session-id-from-backend',
    containerId: 'kyc-container',
    verificationLevel: 'basic',
    branding: {
      primaryColor: '#F28A17',
      companyName: 'Your VASP',
      logo: 'https://example.com/logo.png',
    },
    onComplete: (result) => {
      console.log('Verification complete:', result);
    },
    onStepComplete: (step, data) => {
      console.log(`Step ${step} done:`, data);
    },
    onError: (error) => {
      console.error('KYC error:', error);
    },
    onCancel: () => {
      console.log('User cancelled');
    },
  });

  kyc.start();
</script>
```

## Configuration

| Option              | Type     | Default               | Description                            |
|---------------------|----------|-----------------------|----------------------------------------|
| `apiKey`            | string   | *required*            | CIP API key                            |
| `sessionId`         | string   | *required*            | KYC session ID from backend            |
| `apiBaseUrl`        | string   | `https://api.cip.app` | Backend base URL                       |
| `containerId`       | string   | —                     | DOM element ID (fullscreen if omitted) |
| `verificationLevel` | string   | `basic`               | `basic` or `advanced`                  |
| `branding`          | object   | —                     | Visual customization                   |
| `locale`            | string   | `en`                  | Locale code                            |
| `strings`           | object   | —                     | Custom string overrides                |
| `onComplete`        | function | —                     | Called when flow completes              |
| `onStepComplete`    | function | —                     | Called after each step                  |
| `onError`           | function | —                     | Called on errors                        |
| `onCancel`          | function | —                     | Called when user cancels                |

### Branding

| Property          | Default          |
|-------------------|------------------|
| `primaryColor`    | `#F28A17`        |
| `backgroundColor` | `#0A0A0C`        |
| `textColor`       | `#F5F5F5`        |
| `logo`            | —                |
| `companyName`     | `CIP`            |
| `fontFamily`      | system font      |
| `borderRadius`    | `12px`           |

## Verification Levels

**Basic** — Document front + back, selfie.

**Advanced** — Document front + back, selfie, liveness check, document-in-hand.

## API

### `new CipKyc(config)`

Create an SDK instance.

### `kyc.start(): Promise<void>`

Start the verification flow. Mounts UI, opens camera, and begins step sequence.

### `kyc.destroy(): void`

Tear down the SDK. Stops camera, removes all DOM elements and injected styles.

## Backend Integration

The SDK expects a CIP backend with these endpoints:

- `GET /api/v1/kyc-sessions/{id}/verify` — session details
- `POST /api/v1/kyc-sessions/{id}/process-frame` — process a captured frame
- `POST /api/v1/kyc-sessions/{id}/process-liveness` — process liveness frames
- `POST /api/v1/kyc-sessions/{id}/complete-step` — mark a step complete

All requests include `X-API-Key` header.

## Requirements

- Modern browser with `getUserMedia` support
- HTTPS (camera access requires secure context)
- Works in mobile WebView (iOS Safari, Android Chrome)
