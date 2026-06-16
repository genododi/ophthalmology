# Mobile Release Setup

## Android Build Environment

This machine now has local Android build tooling configured:

- JDK: `/Users/mahmoudsami/.local/jdks/temurin-21/Contents/Home`
- Android SDK: `/Users/mahmoudsami/Library/Android/sdk`
- Project SDK pointer: `android/local.properties`
- Gradle JDK pointer: root npm scripts set `JAVA_HOME` for Android builds

Useful commands:

```bash
npm run android:debug
npm run android:bundle
```

The Android scripts sync only the Android platform to avoid unnecessary iOS asset copies on low disk space.

The verified debug APK was built at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## iOS Build Environment

The iOS project is generated at `ios/App/App.xcodeproj` and uses Capacitor Swift Package Manager dependencies at `ios/App/CapApp-SPM/Package.swift`.

Full iOS compilation still requires Apple Xcode.app. This machine currently only has Command Line Tools selected, so `xcodebuild` and `simctl` cannot build or run the app yet. After installing Xcode, select it with:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
npm run cap:sync
npm run ios
```

## In-App Purchases And Trial

The app code expects RevenueCat entitlement `pro` and a default offering containing a subscription product with a 7-day free trial.

Project config file:

```text
mobile-billing-config.js
```

Replace these placeholders after the RevenueCat project exists:

```js
iosApiKey: 'appl_REPLACE_WITH_REVENUECAT_IOS_PUBLIC_KEY'
androidApiKey: 'goog_REPLACE_WITH_REVENUECAT_ANDROID_PUBLIC_KEY'
```

External dashboard setup required:

1. Create App Store Connect subscription product with a 7-day introductory free trial.
2. Create Google Play Console subscription product/base plan/offer with a 7-day free trial.
3. Connect both products in RevenueCat.
4. Create RevenueCat entitlement `pro`.
5. Create/default a RevenueCat offering that includes the subscription package.
