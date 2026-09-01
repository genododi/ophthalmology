(function () {
    'use strict';

    const PULSE_FEED_URL = 'feeds/ophthalmic-pulse.json';
    const DAILY_INFOGRAPHIC_URL = 'daily/latest.json';
    const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
    const TICKER_INTERVAL_MS = 9000;
    const EKB_LOGIN_URL = 'https://www.ekb.eg/en/web/guest/login';
    const OPENATHENS_GENERATOR_URL = 'https://go.openathens.net/generate';
    const LINKEDIN_API_DOCS_URL = 'https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api';

    const state = {
        feed: null,
        daily: null,
        tickerIndex: 0,
        tickerTimer: null,
        refreshTimer: null,
        lastFocus: null
    };

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function safeExternalUrl(value, fallback = '#') {
        try {
            const url = new URL(String(value || ''));
            return /^https?:$/.test(url.protocol) ? url.href : fallback;
        } catch {
            return fallback;
        }
    }

    function openExternal(url) {
        const safeUrl = safeExternalUrl(url, '');
        if (!safeUrl) return;
        const popup = window.open(safeUrl, '_blank', 'noopener,noreferrer');
        if (popup) popup.opener = null;
    }

    function createShell() {
        if (document.getElementById('ophthalmic-pulse-overlay')) return;

        const ticker = document.createElement('aside');
        ticker.className = 'ophthalmic-event-ticker';
        ticker.id = 'ophthalmic-event-ticker';
        ticker.setAttribute('aria-label', 'Upcoming ophthalmology events');
        ticker.innerHTML = `
            <div class="pulse-ticker-label"><span class="material-symbols-rounded">calendar_month</span><span>Congress live</span></div>
            <a class="pulse-ticker-link" id="pulse-ticker-link" href="#" target="_blank" rel="noopener noreferrer">
                <div class="pulse-ticker-copy"><strong>Loading verified ophthalmology events…</strong></div>
            </a>
            <button class="pulse-ticker-open" id="pulse-ticker-open" type="button"><span class="material-symbols-rounded">arrow_upward</span><span>View all</span></button>`;
        document.body.appendChild(ticker);

        const overlay = document.createElement('div');
        overlay.className = 'ophthalmic-pulse-overlay';
        overlay.id = 'ophthalmic-pulse-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = `
            <section class="ophthalmic-pulse-dialog" role="dialog" aria-modal="true" aria-labelledby="pulse-dialog-title">
                <header class="pulse-dialog-header">
                    <div class="pulse-brand-lockup">
                        <span class="pulse-brand-icon"><span class="material-symbols-rounded">language</span></span>
                        <div><h2 id="pulse-dialog-title">Ophthalmic Pulse</h2><p>Events, community signals, daily evidence and authorized article access</p></div>
                    </div>
                    <button class="pulse-close-button" id="pulse-close-button" type="button" aria-label="Close Ophthalmic Pulse"><span class="material-symbols-rounded">close</span></button>
                </header>
                <nav class="pulse-tabs" role="tablist" aria-label="Ophthalmic Pulse sections">
                    <button class="pulse-tab" role="tab" id="pulse-tab-events" aria-controls="pulse-panel-events" aria-selected="true" data-panel="events"><span class="material-symbols-rounded">event_upcoming</span>Events</button>
                    <button class="pulse-tab" role="tab" id="pulse-tab-community" aria-controls="pulse-panel-community" aria-selected="false" data-panel="community"><span class="material-symbols-rounded">diversity_3</span>Community</button>
                    <button class="pulse-tab" role="tab" id="pulse-tab-access" aria-controls="pulse-panel-access" aria-selected="false" data-panel="access"><span class="material-symbols-rounded">library_books</span>Article access</button>
                    <button class="pulse-tab" role="tab" id="pulse-tab-daily" aria-controls="pulse-panel-daily" aria-selected="false" data-panel="daily"><span class="material-symbols-rounded">auto_awesome</span>Daily infographic</button>
                </nav>
                <div class="pulse-dialog-body">
                    <section class="pulse-panel is-active" role="tabpanel" id="pulse-panel-events" aria-labelledby="pulse-tab-events"></section>
                    <section class="pulse-panel" role="tabpanel" id="pulse-panel-community" aria-labelledby="pulse-tab-community" hidden></section>
                    <section class="pulse-panel" role="tabpanel" id="pulse-panel-access" aria-labelledby="pulse-tab-access" hidden></section>
                    <section class="pulse-panel" role="tabpanel" id="pulse-panel-daily" aria-labelledby="pulse-tab-daily" hidden></section>
                </div>
            </section>`;
        document.body.appendChild(overlay);
    }

    function daysUntil(dateValue) {
        const target = new Date(`${dateValue}T00:00:00Z`);
        if (Number.isNaN(target.getTime())) return null;
        const today = new Date();
        const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
        return Math.ceil((target.getTime() - todayUtc) / 86400000);
    }

    function getUpcomingEvents() {
        const events = Array.isArray(state.feed?.events) ? state.feed.events : [];
        return events
            .filter(event => {
                const end = event.endDate || event.startDate;
                const remaining = daysUntil(end);
                return remaining === null || remaining >= 0;
            })
            .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
    }

    function formatEventDate(event) {
        const start = new Date(`${event.startDate}T12:00:00Z`);
        if (Number.isNaN(start.getTime())) return { day: '--', month: 'TBA', range: 'Dates to be confirmed' };
        const month = start.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
        const day = start.toLocaleDateString('en-US', { day: '2-digit', timeZone: 'UTC' });
        const end = event.endDate ? new Date(`${event.endDate}T12:00:00Z`) : null;
        const range = end && !Number.isNaN(end.getTime())
            ? `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}–${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`
            : start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
        return { day, month, range };
    }

    function renderTicker() {
        const link = document.getElementById('pulse-ticker-link');
        if (!link) return;
        const events = getUpcomingEvents();
        if (!events.length) {
            link.href = '#';
            link.removeAttribute('target');
            link.innerHTML = '<div class="pulse-ticker-copy"><strong>No verified upcoming event is currently listed</strong><span>Open Pulse to refresh</span></div>';
            return;
        }
        const event = events[state.tickerIndex % events.length];
        const remaining = daysUntil(event.startDate);
        const countdown = remaining === 0 ? 'Starts today' : remaining === 1 ? 'Starts tomorrow' : `${remaining} days`;
        link.href = safeExternalUrl(event.url);
        link.target = '_blank';
        link.innerHTML = `<div class="pulse-ticker-copy"><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(countdown)} · ${escapeHtml(event.location || 'Online')}</span></div>`;
    }

    function startTicker() {
        clearInterval(state.tickerTimer);
        renderTicker();
        state.tickerTimer = window.setInterval(() => {
            state.tickerIndex += 1;
            renderTicker();
        }, TICKER_INTERVAL_MS);
    }

    function renderEventsPanel() {
        const panel = document.getElementById('pulse-panel-events');
        if (!panel) return;
        const events = getUpcomingEvents();
        const updated = state.feed?.generatedAt ? new Date(state.feed.generatedAt).toLocaleString() : 'bundled feed';
        panel.innerHTML = `
            <div class="pulse-section-heading">
                <div><h3>Upcoming ophthalmology calendar</h3><p>Verified congress and subspecialty dates linked directly to organizers.</p></div>
                <span class="pulse-status-chip"><span class="material-symbols-rounded" style="font-size:.85rem">verified</span>${events.length} upcoming · ${escapeHtml(updated)}</span>
            </div>
            <div class="pulse-event-grid">
                ${events.length ? events.map(event => {
                    const date = formatEventDate(event);
                    const remaining = daysUntil(event.startDate);
                    const countdown = remaining === 0 ? 'Today' : remaining === 1 ? 'Tomorrow' : `${remaining} days away`;
                    return `<a class="pulse-event-card" href="${escapeHtml(safeExternalUrl(event.url))}" target="_blank" rel="noopener noreferrer">
                        <div class="pulse-event-date"><strong>${date.day}</strong><span>${date.month}</span></div>
                        <div class="pulse-event-copy"><h4>${escapeHtml(event.title)}</h4><p>${escapeHtml(date.range)} · ${escapeHtml(event.location || 'Online')}</p><div class="pulse-card-meta"><span>${escapeHtml(event.specialty || 'General')}</span><span>${escapeHtml(countdown)}</span><span>Official site ↗</span></div></div>
                    </a>`;
                }).join('') : '<div class="pulse-empty">No verified upcoming events. The daily updater will check again automatically.</div>'}
            </div>`;
    }

    function renderCommunityPanel() {
        const panel = document.getElementById('pulse-panel-community');
        if (!panel) return;
        const community = state.feed?.community || {};
        const pages = Array.isArray(community.pages) ? community.pages : [];
        const posts = Array.isArray(community.posts) ? community.posts : [];
        const apiConnected = community.mode === 'linkedin-api';
        panel.innerHTML = `
            <div class="pulse-section-heading">
                <div><h3>LinkedIn ophthalmology community</h3><p>${apiConnected ? 'Recent organization posts retrieved through the authorized LinkedIn API.' : 'A curated watchlist of high-signal ophthalmology organizations and live LinkedIn topic searches.'}</p></div>
                <span class="pulse-status-chip"><span class="material-symbols-rounded" style="font-size:.85rem">${apiConnected ? 'cloud_done' : 'shield_lock'}</span>${apiConnected ? 'Official API connected' : 'Safe watchlist mode'}</span>
            </div>
            <div class="pulse-notice"><span class="material-symbols-rounded">info</span><span>${apiConnected
                ? 'Engagement-ranked content is refreshed by the daily feed job using an approved LinkedIn organization token.'
                : `LinkedIn restricts post retrieval to approved applications and authorized organization roles. This portal never scrapes profiles or stores LinkedIn credentials. Add the repository secrets described in the setup guide to enable official post retrieval. <a href="${LINKEDIN_API_DOCS_URL}" target="_blank" rel="noopener noreferrer">LinkedIn API requirements ↗</a>`}</span></div>
            <div class="pulse-community-grid">
                ${pages.map(page => `<article class="pulse-community-card"><div class="pulse-card-kicker"><span class="material-symbols-rounded">verified</span>Community page</div><h4>${escapeHtml(page.name)}</h4><p>${escapeHtml(page.description || 'Ophthalmology professional community')}</p><a class="pulse-card-link" href="${escapeHtml(safeExternalUrl(page.url))}" target="_blank" rel="noopener noreferrer"><span class="material-symbols-rounded">open_in_new</span>Open on LinkedIn</a></article>`).join('')}
                ${posts.map(post => `<article class="pulse-community-card"><div class="pulse-card-kicker"><span class="material-symbols-rounded">trending_up</span>${escapeHtml(post.label || (apiConnected ? 'Recent post' : 'Live topic search'))}</div><h4>${escapeHtml(post.title)}</h4><p>${escapeHtml(post.summary || post.author || '')}</p><a class="pulse-card-link" href="${escapeHtml(safeExternalUrl(post.url))}" target="_blank" rel="noopener noreferrer"><span class="material-symbols-rounded">open_in_new</span>${apiConnected ? 'Read post' : 'View current posts'}</a></article>`).join('')}
                ${!pages.length && !posts.length ? '<div class="pulse-empty">Community links will appear after the feed refresh.</div>' : ''}
            </div>`;
    }

    function renderAccessPanel() {
        const panel = document.getElementById('pulse-panel-access');
        if (!panel) return;
        panel.innerHTML = `
            <div class="pulse-section-heading"><div><h3>Scientific article access portal</h3><p>Find a lawful open-access copy first, then continue through your own EKB or OpenAthens entitlement.</p></div><span class="pulse-status-chip"><span class="material-symbols-rounded" style="font-size:.85rem">lock_open</span>Authorized access only</span></div>
            <div class="pulse-notice"><span class="material-symbols-rounded">privacy_tip</span><span>This portal does not collect institutional usernames or passwords and does not bypass publisher paywalls. Sign-in happens only on the official EKB, OpenAthens, or publisher website.</span></div>
            <div class="pulse-access-layout">
                <article class="pulse-access-card">
                    <h4>Find the best available full text</h4>
                    <p>Paste a DOI, PMID, PubMed URL, or article title. The checker prioritizes legal open-access locations and preserves the publisher link for institutional access.</p>
                    <form class="pulse-article-form" id="pulse-article-form">
                        <input class="pulse-article-input" id="pulse-article-input" type="search" autocomplete="off" placeholder="10.1016/… · PMID 12345678 · article title" aria-label="DOI, PMID or article title">
                        <button class="pulse-primary-action" type="submit"><span class="material-symbols-rounded">manage_search</span>Find full text</button>
                    </form>
                    <div class="pulse-access-result" id="pulse-access-result" aria-live="polite"></div>
                </article>
                <article class="pulse-access-card">
                    <h4>Institutional access</h4>
                    <p>Open your authorized session first. For deep links, the official OpenAthens generator will match the target URL to your institution.</p>
                    <div class="pulse-access-actions">
                        <a class="pulse-primary-action" href="${EKB_LOGIN_URL}" target="_blank" rel="noopener noreferrer"><span class="material-symbols-rounded">account_balance</span>Sign in to EKB</a>
                        <a class="pulse-secondary-action" href="${OPENATHENS_GENERATOR_URL}" target="_blank" rel="noopener noreferrer"><span class="material-symbols-rounded">vpn_key</span>OpenAthens link generator</a>
                        <a class="pulse-secondary-action" href="https://pubmed.ncbi.nlm.nih.gov/" target="_blank" rel="noopener noreferrer"><span class="material-symbols-rounded">biotech</span>Search PubMed</a>
                    </div>
                    <p class="pulse-privacy-note">Tip: keep the EKB tab signed in, then return here and open the publisher target. Availability depends on your personal or institutional subscription.</p>
                </article>
            </div>`;
        panel.querySelector('#pulse-article-form')?.addEventListener('submit', handleArticleLookup);
    }

    function parseArticleIdentifier(value) {
        const raw = String(value || '').trim();
        const doiMatch = raw.match(/(?:doi(?:\.org)?[/:\s]+)?(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i);
        const pmidMatch = raw.match(/(?:PMID\s*[:#]?\s*|pubmed\.ncbi\.nlm\.nih\.gov\/)(\d{5,10})/i);
        if (doiMatch) return { type: 'doi', value: doiMatch[1].replace(/[).,;]+$/, '') };
        if (pmidMatch) return { type: 'pmid', value: pmidMatch[1] };
        return { type: 'title', value: raw };
    }

    function articleSearchLinks(identifier) {
        const query = identifier.type === 'doi' ? identifier.value : identifier.value;
        const encoded = encodeURIComponent(query);
        const publisherUrl = identifier.type === 'doi' ? `https://doi.org/${identifier.value}` : `https://pubmed.ncbi.nlm.nih.gov/?term=${encoded}`;
        return { publisherUrl, pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/?term=${encoded}`, scholarUrl: `https://scholar.google.com/scholar?q=${encoded}` };
    }

    async function lookupOpenAlexByDoi(doi) {
        const response = await fetch(`https://api.openalex.org/works/https://doi.org/${doi}`, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`OpenAlex returned ${response.status}`);
        const work = await response.json();
        const locations = [work.best_oa_location, ...(work.locations || [])].filter(Boolean);
        const openLocation = locations.find(location => location.pdf_url) || locations.find(location => location.is_oa || location.landing_page_url);
        return {
            title: work.title || doi,
            isOpen: Boolean(work.open_access?.is_oa || openLocation?.is_oa),
            fullTextUrl: safeExternalUrl(openLocation?.pdf_url || openLocation?.landing_page_url, ''),
            publisherUrl: safeExternalUrl(work.primary_location?.landing_page_url || `https://doi.org/${doi}`),
            status: work.open_access?.oa_status || ''
        };
    }

    async function lookupEuropePmc(identifier) {
        const query = identifier.type === 'pmid' ? `EXT_ID:${identifier.value}`
            : identifier.type === 'doi' ? `DOI:"${identifier.value}"`
                : `TITLE:"${identifier.value.replace(/"/g, '')}"`;
        const params = new URLSearchParams({ query, format: 'json', pageSize: '1', resultType: 'core' });
        const response = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params.toString()}`, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`Europe PMC returned ${response.status}`);
        const article = (await response.json())?.resultList?.result?.[0];
        if (!article) return null;
        const openUrl = article.pmcid ? `https://europepmc.org/articles/${article.pmcid}` : '';
        return {
            title: article.title || identifier.value,
            isOpen: Boolean(article.isOpenAccess === 'Y' || article.pmcid),
            fullTextUrl: openUrl,
            publisherUrl: article.doi ? `https://doi.org/${article.doi}` : (article.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/` : ''),
            status: article.journalTitle || 'Europe PMC record'
        };
    }

    function renderArticleResult(result, identifier) {
        const host = document.getElementById('pulse-access-result');
        if (!host) return;
        const links = articleSearchLinks(identifier);
        const title = result?.title || identifier.value;
        const openUrl = result?.fullTextUrl;
        const publisherUrl = result?.publisherUrl || links.publisherUrl;
        const stateName = openUrl && result?.isOpen ? 'open' : 'closed';
        host.innerHTML = `<div class="pulse-result-card" data-state="${stateName}">
            <strong>${stateName === 'open' ? 'Open full text found' : 'No verified open copy found yet'}</strong>
            <p>${escapeHtml(title)}${result?.status ? ` · ${escapeHtml(result.status)}` : ''}</p>
            <div class="pulse-result-actions">
                ${stateName === 'open' ? `<a class="pulse-primary-action" href="${escapeHtml(openUrl)}" target="_blank" rel="noopener noreferrer"><span class="material-symbols-rounded">download</span>Open full text</a>` : ''}
                <a class="pulse-secondary-action" href="${escapeHtml(publisherUrl)}" target="_blank" rel="noopener noreferrer"><span class="material-symbols-rounded">open_in_new</span>Publisher target</a>
                <button class="pulse-secondary-action" id="pulse-result-openathens" type="button"><span class="material-symbols-rounded">vpn_key</span>Use OpenAthens</button>
                <a class="pulse-secondary-action" href="${escapeHtml(links.pubmedUrl)}" target="_blank" rel="noopener noreferrer">PubMed</a>
            </div>
        </div>`;
        host.querySelector('#pulse-result-openathens')?.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(publisherUrl); } catch { /* clipboard can be blocked */ }
            openExternal(OPENATHENS_GENERATOR_URL);
        });
    }

    async function handleArticleLookup(event) {
        event.preventDefault();
        const input = document.getElementById('pulse-article-input');
        const host = document.getElementById('pulse-access-result');
        const identifier = parseArticleIdentifier(input?.value);
        if (!host || !identifier.value) return;
        host.innerHTML = '<div class="pulse-result-card"><strong>Checking trusted open-access indexes…</strong><p>Searching OpenAlex and Europe PMC.</p></div>';
        try {
            let result = null;
            if (identifier.type === 'doi') {
                try { result = await lookupOpenAlexByDoi(identifier.value); } catch { /* continue to Europe PMC */ }
            }
            if (!result?.fullTextUrl) {
                try {
                    const europePmc = await lookupEuropePmc(identifier);
                    if (europePmc?.fullTextUrl || !result) result = europePmc || result;
                } catch { /* use publisher/search fallback */ }
            }
            renderArticleResult(result, identifier);
        } catch (error) {
            const links = articleSearchLinks(identifier);
            host.innerHTML = `<div class="pulse-result-card" data-state="error"><strong>The open-access check is temporarily unavailable</strong><p>${escapeHtml(error.message || 'Please continue with the trusted search links.')}</p><div class="pulse-result-actions"><a class="pulse-secondary-action" href="${escapeHtml(links.pubmedUrl)}" target="_blank" rel="noopener noreferrer">Search PubMed</a><a class="pulse-secondary-action" href="${escapeHtml(links.scholarUrl)}" target="_blank" rel="noopener noreferrer">Search Scholar</a></div></div>`;
        }
    }

    function renderDailyPanel() {
        const panel = document.getElementById('pulse-panel-daily');
        if (!panel) return;
        const item = state.daily;
        const data = item?.data || item;
        panel.innerHTML = `
            <div class="pulse-section-heading"><div><h3>Autogenerated daily infographic</h3><p>Built from the current ophthalmology evidence feed and published only after validation succeeds.</p></div><span class="pulse-status-chip"><span class="material-symbols-rounded" style="font-size:.85rem">cloud_done</span>${item ? 'Published' : 'Awaiting first run'}</span></div>
            ${item ? `<article class="pulse-daily-card"><div class="pulse-daily-eyebrow">Today’s evidence radar</div><h4>${escapeHtml(data?.title || item.title || 'Daily Ophthalmology Research Pulse')}</h4><p>${escapeHtml(data?.summary || item.summary || 'A concise review of new ophthalmic evidence.')}</p><div class="pulse-daily-actions"><button class="pulse-primary-action" id="pulse-open-daily" type="button"><span class="material-symbols-rounded">visibility</span>Open infographic</button><a class="pulse-secondary-action" href="${DAILY_INFOGRAPHIC_URL}" target="_blank" rel="noopener noreferrer"><span class="material-symbols-rounded">data_object</span>View source data</a></div><div class="pulse-daily-source">Generated ${escapeHtml(item.date ? new Date(item.date).toLocaleString() : 'by the daily workflow')} · Evidence links remain attached to each section.</div></article>`
                : '<div class="pulse-empty">The daily automation has not published an infographic yet. A validated item will appear here after the next scheduled run.</div>'}`;
        panel.querySelector('#pulse-open-daily')?.addEventListener('click', () => {
            if (!data) return;
            closeDialog();
            document.dispatchEvent(new CustomEvent('ophthalmic:open-infographic', { detail: { data, source: 'daily' } }));
        });
    }

    function renderAllPanels() {
        renderEventsPanel();
        renderCommunityPanel();
        renderAccessPanel();
        renderDailyPanel();
        startTicker();
    }

    async function fetchJson(url) {
        const joiner = url.includes('?') ? '&' : '?';
        const response = await fetch(`${url}${joiner}v=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`${url} returned ${response.status}`);
        return response.json();
    }

    async function refreshData() {
        const results = await Promise.allSettled([fetchJson(PULSE_FEED_URL), fetchJson(DAILY_INFOGRAPHIC_URL)]);
        if (results[0].status === 'fulfilled') state.feed = results[0].value;
        if (results[1].status === 'fulfilled') state.daily = results[1].value;
        renderAllPanels();
    }

    function selectPanel(name, focusTab = false) {
        document.querySelectorAll('.pulse-tab').forEach(tab => {
            const selected = tab.dataset.panel === name;
            tab.setAttribute('aria-selected', String(selected));
            if (selected && focusTab) tab.focus();
        });
        document.querySelectorAll('.pulse-panel').forEach(panel => {
            const selected = panel.id === `pulse-panel-${name}`;
            panel.classList.toggle('is-active', selected);
            panel.hidden = !selected;
        });
    }

    function openDialog(panel = 'events') {
        const overlay = document.getElementById('ophthalmic-pulse-overlay');
        if (!overlay) return;
        state.lastFocus = document.activeElement;
        selectPanel(panel);
        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        window.setTimeout(() => overlay.querySelector('.pulse-close-button')?.focus(), 0);
    }

    function closeDialog() {
        const overlay = document.getElementById('ophthalmic-pulse-overlay');
        if (!overlay) return;
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        state.lastFocus?.focus?.();
    }

    function trapDialogFocus(event) {
        if (event.key !== 'Tab') return;
        const overlay = document.getElementById('ophthalmic-pulse-overlay');
        if (!overlay?.classList.contains('is-open')) return;
        const focusable = [...overlay.querySelectorAll('button:not([disabled]), a[href], input:not([disabled])')].filter(node => node.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    function wireInteractions() {
        document.getElementById('ophthalmic-pulse-btn')?.addEventListener('click', () => openDialog('events'));
        document.getElementById('pulse-ticker-open')?.addEventListener('click', () => openDialog('events'));
        document.getElementById('pulse-close-button')?.addEventListener('click', closeDialog);
        const overlay = document.getElementById('ophthalmic-pulse-overlay');
        overlay?.addEventListener('click', event => { if (event.target === overlay) closeDialog(); });
        overlay?.addEventListener('keydown', trapDialogFocus);
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && overlay?.classList.contains('is-open')) closeDialog();
        });
        document.querySelectorAll('.pulse-tab').forEach(tab => tab.addEventListener('click', () => selectPanel(tab.dataset.panel)));
    }

    function init() {
        createShell();
        wireInteractions();
        renderAllPanels();
        refreshData();
        clearInterval(state.refreshTimer);
        state.refreshTimer = window.setInterval(refreshData, REFRESH_INTERVAL_MS);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
