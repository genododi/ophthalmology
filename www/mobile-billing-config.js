window.OphthalmicBillingConfig = {
  appName: 'Ophthalmic Infograph',
  defaultTierId: 'pro_annual',
  accessEntitlementIds: ['pro', 'utmost'],
  ultimateEntitlementId: 'utmost',
  trialDays: 7,
  revenueCat: {
    iosApiKey: 'appl_REPLACE_WITH_REVENUECAT_IOS_PUBLIC_KEY',
    androidApiKey: 'goog_REPLACE_WITH_REVENUECAT_ANDROID_PUBLIC_KEY'
  },
  offeringIdentifier: null,
  tiers: [
    {
      id: 'pro_annual',
      name: 'Pro Annual',
      entitlementId: 'pro',
      displayPrice: '$100/year',
      iosProductId: 'ophthalmic_infograph_pro_annual_100',
      androidProductId: 'ophthalmic_infograph_pro_annual_100',
      packageIdentifier: '$rc_annual',
      cta: 'Start Pro annual',
      benefits: [
        'Full mobile app access',
        'Infographic generation from topics, notes, PDFs, and DOCX resources',
        'Clinical library, reports, flashcards, quizzes, mind maps, and slide decks'
      ]
    },
    {
      id: 'utmost_annual',
      name: 'Utmost Annual',
      entitlementId: 'utmost',
      displayPrice: '$200/year',
      iosProductId: 'ophthalmic_infograph_utmost_annual_200',
      androidProductId: 'ophthalmic_infograph_utmost_annual_200',
      packageIdentifier: 'utmost_annual',
      cta: 'Unlock Utmost benefits',
      highlighted: true,
      benefits: [
        'Everything in Pro Annual',
        'Highest-benefit annual access tier for advanced users',
        'Priority access positioning for future premium mobile features'
      ]
    }
  ]
};
