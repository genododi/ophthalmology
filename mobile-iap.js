(function () {
    const config = window.OphthalmicBillingConfig || {};
    const trialDays = Number(config.trialDays || 7);
    const appName = config.appName || 'Ophthalmic Infograph';
    const placeholderPattern = /REPLACE_WITH|^appl_REPLACE|^goog_REPLACE/;

    const defaultTiers = [
        {
            id: 'pro_annual',
            name: 'Pro Annual',
            entitlementId: 'pro',
            displayPrice: '$100/year',
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
            packageIdentifier: 'utmost_annual',
            cta: 'Unlock Utmost benefits',
            highlighted: true,
            benefits: [
                'Everything in Pro Annual',
                'Highest-benefit annual access tier for advanced users',
                'Priority access positioning for future premium mobile features'
            ]
        }
    ];

    const tiers = Array.isArray(config.tiers) && config.tiers.length ? config.tiers : defaultTiers;
    const accessEntitlementIds = Array.isArray(config.accessEntitlementIds) && config.accessEntitlementIds.length
        ? config.accessEntitlementIds
        : tiers.map(tier => tier.entitlementId).filter(Boolean);
    const ultimateEntitlementId = config.ultimateEntitlementId || tiers.find(tier => tier.highlighted)?.entitlementId || 'utmost';

    const state = {
        isNative: false,
        configured: false,
        hasAccess: false,
        activeEntitlements: [],
        activeTierId: null,
        offerings: null,
        packagesByTier: {},
        initializing: false
    };

    function getCapacitor() {
        return window.Capacitor || null;
    }

    function getPlatform() {
        const cap = getCapacitor();
        if (!cap) return 'web';
        if (typeof cap.getPlatform === 'function') return cap.getPlatform();
        return cap.platform || 'web';
    }

    function getPurchasesPlugin() {
        return getCapacitor()?.Plugins?.Purchases || window.Purchases || null;
    }

    function isNativeMobile() {
        const platform = getPlatform();
        return platform === 'ios' || platform === 'android';
    }

    function getRevenueCatApiKey() {
        const platform = getPlatform();
        const key = platform === 'ios'
            ? config.revenueCat?.iosApiKey
            : config.revenueCat?.androidApiKey;
        return typeof key === 'string' ? key.trim() : '';
    }

    function getTierProductId(tier) {
        const platform = getPlatform();
        return platform === 'ios' ? tier.iosProductId : tier.androidProductId;
    }

    function isConfiguredKey(key) {
        return key && !placeholderPattern.test(key);
    }

    function getActiveEntitlements(customerInfo) {
        return Object.keys(customerInfo?.entitlements?.active || {});
    }

    function updateAccess(customerInfo) {
        state.activeEntitlements = getActiveEntitlements(customerInfo);
        state.activeTierId = tiers.find(tier => state.activeEntitlements.includes(tier.entitlementId))?.id || null;
        state.hasAccess = accessEntitlementIds.some(entitlementId => state.activeEntitlements.includes(entitlementId));
        setLocked(!state.hasAccess);
    }

    function setStatus(message, type) {
        const status = document.getElementById('mobile-paywall-status');
        if (!status) return;
        status.textContent = message || '';
        status.className = `mobile-paywall-status${type ? ` ${type}` : ''}`;
    }

    function setLocked(locked) {
        document.body.classList.toggle('mobile-entitlement-locked', locked);
        window.dispatchEvent(new CustomEvent('ophthalmic:entitlement', {
            detail: {
                hasAccess: !locked,
                activeTierId: state.activeTierId,
                activeEntitlements: state.activeEntitlements
            }
        }));
    }

    function getOffering(offerings) {
        const offeringId = config.offeringIdentifier;
        return offeringId ? offerings?.all?.[offeringId] : offerings?.current;
    }

    function getPackageProductId(pkg) {
        return pkg?.product?.identifier
            || pkg?.product?.productIdentifier
            || pkg?.storeProduct?.identifier
            || pkg?.storeProduct?.productIdentifier
            || pkg?.productIdentifier
            || '';
    }

    function packageMatchesTier(pkg, tier) {
        const tierProductId = getTierProductId(tier);
        const pkgProductId = getPackageProductId(pkg);
        return Boolean(
            (tierProductId && pkgProductId === tierProductId)
            || (tier.packageIdentifier && pkg?.identifier === tier.packageIdentifier)
        );
    }

    function findPackageForTier(offerings, tier) {
        const offering = getOffering(offerings);
        const packages = offering?.availablePackages || [];
        return packages.find(pkg => packageMatchesTier(pkg, tier))
            || (tier.id === config.defaultTierId ? offering?.annual : null)
            || null;
    }

    function renderTierCards() {
        return tiers.map(tier => {
            const benefits = (tier.benefits || []).map(item => `<li>${item}</li>`).join('');
            return `
                <article class="mobile-tier-card${tier.highlighted ? ' highlighted' : ''}">
                    <div class="mobile-tier-heading">
                        <div>
                            <h3>${tier.name}</h3>
                            <p>${tier.displayPrice}</p>
                        </div>
                        ${tier.highlighted ? '<span class="mobile-tier-badge">Best benefits</span>' : ''}
                    </div>
                    <ul class="mobile-tier-benefits">${benefits}</ul>
                    <button type="button" class="mobile-paywall-primary" data-purchase-tier="${tier.id}">
                        ${tier.cta || `Choose ${tier.name}`}
                    </button>
                </article>
            `;
        }).join('');
    }

    function renderPaywall() {
        if (document.getElementById('mobile-paywall')) return;

        const backdrop = document.createElement('div');
        backdrop.id = 'mobile-paywall';
        backdrop.className = 'mobile-paywall-backdrop';
        backdrop.innerHTML = `
            <section class="mobile-paywall-card" role="dialog" aria-modal="true" aria-labelledby="mobile-paywall-title">
                <div class="mobile-paywall-header">
                    <h2 id="mobile-paywall-title">${appName}</h2>
                    <p>Choose annual mobile access. Store pricing and trials are managed by Apple, Google, and RevenueCat.</p>
                </div>
                <div class="mobile-paywall-body">
                    <div class="mobile-tier-grid">${renderTierCards()}</div>
                    <div class="mobile-paywall-actions">
                        <button type="button" class="mobile-paywall-secondary" id="mobile-restore-btn">Restore purchases</button>
                    </div>
                    <div class="mobile-paywall-status" id="mobile-paywall-status">Checking subscription...</div>
                    <p class="mobile-paywall-footnote">Configure the $100 annual Pro product and $200 annual Utmost product in App Store Connect and Google Play, then attach them to the RevenueCat offering. A ${trialDays}-day free trial can be enabled on the store products.</p>
                </div>
            </section>
        `;
        document.body.appendChild(backdrop);

        backdrop.querySelectorAll('[data-purchase-tier]').forEach(button => {
            button.addEventListener('click', () => purchaseTier(button.dataset.purchaseTier));
        });
        document.getElementById('mobile-restore-btn')?.addEventListener('click', restorePurchases);
    }

    async function configurePurchases() {
        const Purchases = getPurchasesPlugin();
        const apiKey = getRevenueCatApiKey();

        if (!Purchases) {
            throw new Error('RevenueCat Purchases plugin is not available. Run npm run cap:sync and rebuild the native app.');
        }

        if (!isConfiguredKey(apiKey)) {
            throw new Error('Add RevenueCat public SDK keys in mobile-billing-config.js before release.');
        }

        await Purchases.configure({ apiKey });
        state.configured = true;
    }

    async function refreshCustomerInfo() {
        const Purchases = getPurchasesPlugin();
        const result = await Purchases.getCustomerInfo();
        updateAccess(result.customerInfo);
        return result.customerInfo;
    }

    async function loadOffering() {
        const Purchases = getPurchasesPlugin();
        const result = await Purchases.getOfferings();
        state.offerings = result.offerings || result;
        state.packagesByTier = tiers.reduce((packages, tier) => {
            packages[tier.id] = findPackageForTier(state.offerings, tier);
            return packages;
        }, {});
    }

    async function purchaseTier(tierId) {
        if (!state.configured) return;
        const tier = tiers.find(item => item.id === tierId) || tiers.find(item => item.id === config.defaultTierId) || tiers[0];
        const Purchases = getPurchasesPlugin();

        try {
            setStatus(`Opening secure purchase sheet for ${tier.name}...`);
            if (!state.offerings) {
                await loadOffering();
            }

            const packageToPurchase = state.packagesByTier[tier.id];
            if (!packageToPurchase) {
                throw new Error(`No RevenueCat package was found for ${tier.name}. Check the ${getPlatform()} product ID, offering, and entitlement setup.`);
            }

            const result = await Purchases.purchasePackage({ aPackage: packageToPurchase });
            updateAccess(result.customerInfo);
            setStatus(state.hasAccess ? `${tier.name} is active. Welcome in.` : 'Purchase completed, but no active entitlement was returned yet.');
        } catch (error) {
            const cancelled = error?.code === 'PURCHASE_CANCELLED_ERROR' || /cancel/i.test(error?.message || '');
            setStatus(cancelled ? 'Purchase cancelled.' : (error?.message || 'Purchase failed.'), cancelled ? '' : 'error');
        }
    }

    async function restorePurchases() {
        if (!state.configured) return;
        const Purchases = getPurchasesPlugin();
        try {
            setStatus('Restoring purchases...');
            const result = await Purchases.restorePurchases();
            updateAccess(result.customerInfo);
            setStatus(state.hasAccess ? 'Purchases restored.' : 'No active annual subscription was found.');
        } catch (error) {
            setStatus(error?.message || 'Restore failed.', 'error');
        }
    }

    async function init() {
        state.isNative = isNativeMobile();
        window.OphthalmicMobileBilling = {
            hasAccess: () => !state.isNative || state.hasAccess,
            hasUltimateAccess: () => !state.isNative || state.activeEntitlements.includes(ultimateEntitlementId),
            getActiveTier: () => state.activeTierId,
            requireAccess: () => {
                if (!state.isNative || state.hasAccess) return true;
                setLocked(true);
                return false;
            },
            refresh: refreshCustomerInfo
        };

        if (!state.isNative || state.initializing) return;
        state.initializing = true;

        renderPaywall();
        setLocked(true);

        try {
            await configurePurchases();
            await refreshCustomerInfo();
            if (!state.hasAccess) {
                await loadOffering();
                setStatus(`Choose Pro Annual ($100/year) or Utmost Annual ($200/year) to unlock the mobile app.`);
            }
        } catch (error) {
            setLocked(true);
            setStatus(error?.message || 'Subscription setup failed.', 'error');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
