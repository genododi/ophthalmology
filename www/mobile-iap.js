(function () {
    const config = window.OphthalmicBillingConfig || {};
    const entitlementId = config.entitlementId || 'pro';
    const trialDays = Number(config.trialDays || 7);
    const placeholderPattern = /REPLACE_WITH|^appl_REPLACE|^goog_REPLACE/;

    const state = {
        isNative: false,
        configured: false,
        hasAccess: false,
        packageToPurchase: null,
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

    function isConfiguredKey(key) {
        return key && !placeholderPattern.test(key);
    }

    function hasActiveEntitlement(customerInfo) {
        const active = customerInfo?.entitlements?.active || {};
        return Boolean(active[entitlementId]);
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
            detail: { hasAccess: !locked }
        }));
    }

    function pickPurchasePackage(offerings) {
        const offeringId = config.offeringIdentifier;
        const offering = offeringId
            ? offerings?.all?.[offeringId]
            : offerings?.current;
        if (!offering) return null;
        return offering.availablePackages?.[0] || offering.monthly || offering.annual || null;
    }

    function renderPaywall() {
        if (document.getElementById('mobile-paywall')) return;

        const backdrop = document.createElement('div');
        backdrop.id = 'mobile-paywall';
        backdrop.className = 'mobile-paywall-backdrop';
        backdrop.innerHTML = `
            <section class="mobile-paywall-card" role="dialog" aria-modal="true" aria-labelledby="mobile-paywall-title">
                <div class="mobile-paywall-header">
                    <h2 id="mobile-paywall-title">Ophthalmic Infograph Pro</h2>
                    <p>Start your ${trialDays}-day trial to use the mobile app.</p>
                </div>
                <div class="mobile-paywall-body">
                    <ul class="mobile-paywall-list">
                        <li><span class="material-symbols-rounded">auto_awesome</span><span>Generate ophthalmic infographics from topics, notes, PDFs, and DOCX resources.</span></li>
                        <li><span class="material-symbols-rounded">inventory_2</span><span>Use the bundled clinical library and save your own knowledge base locally.</span></li>
                        <li><span class="material-symbols-rounded">school</span><span>Create reports, flashcards, quizzes, mind maps, and slide decks from your work.</span></li>
                    </ul>
                    <div class="mobile-paywall-actions">
                        <button type="button" class="mobile-paywall-primary" id="mobile-start-trial-btn">Start ${trialDays}-day free trial</button>
                        <button type="button" class="mobile-paywall-secondary" id="mobile-restore-btn">Restore purchases</button>
                    </div>
                    <div class="mobile-paywall-status" id="mobile-paywall-status">Checking subscription...</div>
                    <p class="mobile-paywall-footnote">The free trial is configured on your App Store Connect and Google Play subscription products through RevenueCat.</p>
                </div>
            </section>
        `;
        document.body.appendChild(backdrop);

        document.getElementById('mobile-start-trial-btn')?.addEventListener('click', purchasePackage);
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
        state.hasAccess = hasActiveEntitlement(result.customerInfo);
        setLocked(!state.hasAccess);
        return result.customerInfo;
    }

    async function loadOffering() {
        const Purchases = getPurchasesPlugin();
        const result = await Purchases.getOfferings();
        const offerings = result.offerings || result;
        state.packageToPurchase = pickPurchasePackage(offerings);
    }

    async function purchasePackage() {
        if (!state.configured) return;
        const Purchases = getPurchasesPlugin();
        try {
            setStatus('Opening secure purchase sheet...');
            if (!state.packageToPurchase) {
                await loadOffering();
            }
            if (!state.packageToPurchase) {
                throw new Error('No RevenueCat offering/package is available. Check product setup in App Store Connect, Google Play, and RevenueCat.');
            }

            const result = await Purchases.purchasePackage({ aPackage: state.packageToPurchase });
            state.hasAccess = hasActiveEntitlement(result.customerInfo);
            setLocked(!state.hasAccess);
            setStatus(state.hasAccess ? 'Subscription active. Welcome in.' : 'Purchase completed, but the pro entitlement is not active yet.');
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
            state.hasAccess = hasActiveEntitlement(result.customerInfo);
            setLocked(!state.hasAccess);
            setStatus(state.hasAccess ? 'Purchases restored.' : 'No active pro subscription was found.');
        } catch (error) {
            setStatus(error?.message || 'Restore failed.', 'error');
        }
    }

    async function init() {
        state.isNative = isNativeMobile();
        window.OphthalmicMobileBilling = {
            hasAccess: () => !state.isNative || state.hasAccess,
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
                setStatus(`Start your ${trialDays}-day trial to unlock the app.`);
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
