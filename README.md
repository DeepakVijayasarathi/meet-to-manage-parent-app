# Meet to Manage family app

Expo/React Native app for parents and students. Families can view schedules, join live classes, track attendance and progress, pay fees through the web portal, access recordings/resources, complete enrollment, and contact support.

## Requirements

- Node.js 22.13 or newer
- npm
- An Expo development build for camera, notifications, biometrics, and other native features

## Configuration

Set these variables locally and in the matching EAS build/update profile:

```env
EXPO_PUBLIC_API_BASE_URL=https://api.example.com
# Optional privacy-safe analytics/error collector accepting JSON POST requests
EXPO_PUBLIC_TELEMETRY_URL=https://telemetry.example.com/events
```

The API returns tenant-specific branding, web portal URL, announcement, welcome content, and support details from `GET /api/app/config`. Every request includes `X-Client: parent-app`.

## Development

```bash
npm install
npx expo start
```

Use a development build when testing native features:

```bash
npx expo run:android
npx expo run:ios
```

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npx expo-doctor
```

## Releases

Build profiles are defined in `eas.json`.

```bash
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --platform android
npx eas-cli@latest submit --platform ios
```

Test notification permission, scheduled class reminders, biometric lock, camera/microphone permissions, deep links, payment portal, and live-class joining on physical Android and iOS devices before release.

## Notifications

Class reminders are scheduled locally from the signed-in family's two-week schedule and open the corresponding class when tapped. The current backend does not expose a device-token registration API, so remote server push requires a separate backend delivery implementation.

## Privacy and telemetry

Telemetry is disabled unless `EXPO_PUBLIC_TELEMETRY_URL` is configured. Events must never include access tokens, names, messages, form answers, or other family data. The built-in error boundary sends only error type, message, stack, context, and timestamp.
