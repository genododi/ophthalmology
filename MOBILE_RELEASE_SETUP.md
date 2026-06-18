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

The app code uses RevenueCat and expects two annual mobile purchase tiers:

| Tier | Price | Entitlement | iOS product ID | Android product ID |
| --- | ---: | --- | --- | --- |
| Pro Annual | `$100/year` | `pro` | `ophthalmic_infograph_pro_annual_100` | `ophthalmic_infograph_pro_annual_100` |
| Utmost Annual | `$200/year` | `utmost` | `ophthalmic_infograph_utmost_annual_200` | `ophthalmic_infograph_utmost_annual_200` |

Either entitlement unlocks the app. The `utmost` entitlement is reserved for the highest-benefit annual tier and future premium-only mobile features.

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

1. Create the two App Store Connect auto-renewable annual subscription products listed above. Set the customer-facing prices to `$100/year` and `$200/year`.
2. Create the matching Google Play Console annual subscription products/base plans. Set the customer-facing prices to `$100/year` and `$200/year`.
3. Optional: add a 7-day introductory free trial on the store products/base-plan offers.
4. Connect both products in RevenueCat.
5. Create RevenueCat entitlement `pro` for the `$100/year` product.
6. Create RevenueCat entitlement `utmost` for the `$200/year` product.
7. Create/default a RevenueCat offering that includes both annual packages. Use package identifier `$rc_annual` for Pro and `utmost_annual` for Utmost, or keep the product IDs exactly as listed above.

After changing mobile billing files, refresh the native projects with:

```bash
npm run cap:sync
```
