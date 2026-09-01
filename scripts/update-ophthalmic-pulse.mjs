#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const sourcePath = path.join(rootDir, 'feeds', 'pulse-sources.json');
const outputPath = path.join(rootDir, 'feeds', 'ophthalmic-pulse.json');
const USER_AGENT = 'Ophthalmic-Infographic-Creator/2.1 (+https://genododi.github.io/ophthalmology/)';

function isoDate(date) {
    return date.toISOString().slice(0, 10);
}

function stripMarkup(value) {
    return String(value || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&gt;/gi, '>').replace(/&lt;/gi, '<').replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"').replace(/&#0*39;|&apos;/gi, "'")
        .replace(/\s+/g, ' ').trim();
}

function safeUrl(value, fallback = '') {
    try {
        const url = new URL(String(value || ''));
        return /^https?:$/.test(url.protocol) ? url.href : fallback;
    } catch {
        return fallback;
    }
}

async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, ...(options.headers || {}) }
        });
        if (!response.ok) throw new Error(`${url} returned ${response.status}`);
        return response.json();
    } finally {
        clearTimeout(timeout);
    }
}

function articleEvidenceType(article) {
    const text = `${article.title || ''} ${article.pubType || ''}`.toLowerCase();
    if (/meta-analysis|systematic review/.test(text)) return 'Systematic review';
    if (/randomized|randomised|clinical trial|controlled trial/.test(text)) return 'Clinical trial';
    if (/guideline|consensus|recommendation/.test(text)) return 'Guideline / consensus';
    if (/cohort|case-control|cross-sectional|observational/.test(text)) return 'Observational study';
    if (/review/.test(text)) return 'Review';
    return 'Newly indexed study';
}

function normalizeEuropePmcArticle(article) {
    const doi = stripMarkup(article.doi).replace(/^https?:\/\/doi\.org\//i, '');
    const pmid = stripMarkup(article.pmid || article.id);
    const url = doi ? `https://doi.org/${doi}`
        : article.pmcid ? `https://europepmc.org/articles/${article.pmcid}`
            : pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : '';
    return {
        id: article.pmcid || pmid || doi || stripMarkup(article.title).slice(0, 80),
        title: stripMarkup(article.title),
        authors: stripMarkup(article.authorString),
        journal: stripMarkup(article.journalTitle || article.journalInfo?.journal?.title),
        publicationDate: stripMarkup(article.firstPublicationDate || article.electronicPublicationDate || article.journalInfo?.printPublicationDate),
        evidenceType: articleEvidenceType(article),
        citedByCount: Number(article.citedByCount) || 0,
        doi,
        pmid,
        isOpenAccess: article.isOpenAccess === 'Y' || Boolean(article.pmcid),
        url: safeUrl(url)
    };
}

async function fetchOphthalmicResearch() {
    const today = new Date();
    const from = new Date(today.getTime() - 14 * 86400000);
    // Title-level matching is intentionally strict. Abstract-only terms such
    // as "visual endpoint" can otherwise pull unrelated neurology research
    // into an ophthalmology feed.
    const topicClause = '(TITLE:ophthalmolog* OR TITLE:retina* OR TITLE:ocular OR TITLE:cornea* OR TITLE:glaucoma* OR TITLE:cataract* OR TITLE:uveitis OR TITLE:"optic nerve" OR TITLE:macula* OR TITLE:myopia OR TITLE:kerat* OR TITLE:fundus OR TITLE:"visual field")';
    const query = `${topicClause} AND FIRST_PDATE:[${isoDate(from)} TO ${isoDate(today)}]`;
    const params = new URLSearchParams({ query, format: 'json', pageSize: '40', resultType: 'core', sort: 'CITED desc' });
    const payload = await fetchJson(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params.toString()}`);
    const seen = new Set();
    return (payload?.resultList?.result || [])
        .map(normalizeEuropePmcArticle)
        .filter(article => article.title && article.url)
        .filter(article => /\b(ophthalm\w*|retina\w*|ocular|cornea\w*|glaucoma\w*|cataract\w*|uveitis|optic\s+nerve|macula\w*|myopia|kerat(?:itis|oconus|opathy|oplasty|ectomy|ometr\w*|oprosthesis|oglobus)\w*|fundus|visual\s+field)\b/i.test(article.title))
        .filter(article => !/\b(canine|dog|feline|cat|lynx|horse|equine|bovine|cattle|rabbit|mouse|mice|rat|avian|bird|fish|veterinary|zoolog\w*)\b/i.test(article.title))
        .filter(article => {
            const key = (article.doi || article.title).toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((a, b) => b.citedByCount - a.citedByCount || String(b.publicationDate).localeCompare(String(a.publicationDate)))
        .slice(0, 12);
}

function linkedinPostUrl(postUrn) {
    return safeUrl(`https://www.linkedin.com/feed/update/${postUrn}`);
}

async function fetchLinkedInEngagement(postUrn, accessToken, version) {
    try {
        const payload = await fetchJson(`https://api.linkedin.com/rest/socialActions/${encodeURIComponent(postUrn)}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'LinkedIn-Version': version,
                'X-Restli-Protocol-Version': '2.0.0'
            }
        });
        const likes = Number(payload?.likesSummary?.totalLikes) || 0;
        const comments = Number(payload?.commentsSummary?.totalFirstLevelComments) || 0;
        return { likes, comments, score: likes + comments * 2 };
    } catch {
        return { likes: 0, comments: 0, score: 0 };
    }
}

async function fetchLinkedInPosts() {
    const accessToken = String(process.env.LINKEDIN_ACCESS_TOKEN || '').trim();
    const organizations = String(process.env.LINKEDIN_ORGANIZATION_URNS || '')
        .split(',').map(value => value.trim()).filter(Boolean);
    if (!accessToken || !organizations.length) return null;
    const version = String(process.env.LINKEDIN_VERSION || '202608').replace(/[^0-9]/g, '').slice(0, 6);
    const collected = [];
    for (const author of organizations.slice(0, 8)) {
        const params = new URLSearchParams({ q: 'author', author, count: '20', sortBy: 'LAST_MODIFIED' });
        const payload = await fetchJson(`https://api.linkedin.com/rest/posts?${params.toString()}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'LinkedIn-Version': version,
                'X-Restli-Protocol-Version': '2.0.0'
            }
        });
        for (const post of payload?.elements || []) {
            const urn = stripMarkup(post.id);
            if (!urn) continue;
            const engagement = await fetchLinkedInEngagement(urn, accessToken, version);
            collected.push({
                id: urn,
                title: stripMarkup(post.commentary || post.content?.article?.title || 'Ophthalmology community update').slice(0, 180),
                summary: stripMarkup(post.content?.article?.description || '').slice(0, 220),
                author,
                publishedAt: post.publishedAt ? new Date(Number(post.publishedAt)).toISOString() : '',
                label: engagement.score ? `${engagement.likes} likes · ${engagement.comments} comments` : 'Recent organization post',
                engagement,
                url: linkedinPostUrl(urn)
            });
        }
    }
    return collected
        .filter(post => post.url)
        .sort((a, b) => b.engagement.score - a.engagement.score || String(b.publishedAt).localeCompare(String(a.publishedAt)))
        .slice(0, 12);
}

async function readPreviousFeed() {
    try { return JSON.parse(await fs.readFile(outputPath, 'utf8')); }
    catch { return null; }
}

async function main() {
    const sources = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
    const previous = await readPreviousFeed();
    const now = new Date();
    const events = (sources.events || [])
        .filter(event => new Date(`${event.endDate || event.startDate}T23:59:59Z`).getTime() >= now.getTime() - 86400000)
        .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));

    let research = [];
    try { research = await fetchOphthalmicResearch(); }
    catch (error) {
        console.warn(`Europe PMC refresh failed: ${error.message}`);
        research = Array.isArray(previous?.research) ? previous.research : [];
    }

    let linkedInPosts = null;
    try { linkedInPosts = await fetchLinkedInPosts(); }
    catch (error) { console.warn(`LinkedIn refresh failed: ${error.message}`); }

    const feed = {
        schemaVersion: 1,
        generatedAt: now.toISOString(),
        events,
        community: {
            mode: linkedInPosts?.length ? 'linkedin-api' : 'watchlist',
            pages: sources.community?.pages || [],
            posts: linkedInPosts?.length ? linkedInPosts : (sources.community?.fallbackPosts || [])
        },
        research,
        sources: ['Official congress organizer pages', 'Europe PMC', linkedInPosts?.length ? 'LinkedIn official API' : 'LinkedIn live topic links']
    };

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const tempPath = `${outputPath}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(feed, null, 2)}\n`, 'utf8');
    await fs.rename(tempPath, outputPath);
    console.log(`Pulse feed updated: ${events.length} events, ${research.length} research records, ${feed.community.mode}.`);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
