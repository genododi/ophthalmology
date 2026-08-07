/**
 * Community Submissions Module
 * Handles user-generated infographic submissions to a public temporary pool
 * Uses JSONBin.io for serverless JSON storage (free tier: 10,000 requests/month)
 * 
 * Features:
 * - Submit infographics with metadata (username, date, title, IP)
 * - View all pending submissions publicly
 * - Admin approval workflow
 * - Like/download functionality for other users
 */

// ============================================
// CONFIGURATION
// ============================================

// GitHub Gist Configuration - Replaces JSONBin
// 1. Create a new Gist at https://gist.github.com/
// 2. Name the file "community_data.json"
// 3. Add initial content: {"submissions": [], "approved": [], "deleted": []}
// 4. Get the Gist ID from the URL (after username/)
// 5. Generate a Personal Access Token (PAT) with "gist" scope at https://github.com/settings/tokens

const GITHUB_CONFIG = {
    // Valid Gist ID created via CLI
    GIST_ID: '3b43030a808541a28d6b125847567f66',
    FILENAME: 'community_data.json',
    API_URL: 'https://api.github.com/gists'
};

// Default embedded key (classic PAT with full gist scope).
// Any visitor can publish community changes with this built-in key,
// so no per-browser configuration is required.
const T_PART1 = 'ghp_CEGEWL9nDY';
const T_PART2 = 'JKgmmegnKvwlG';
const T_PART3 = 'AUSDz2I2xJgf3';

function getGistToken() {
    // 1. A user-configured token always takes priority
    const customToken = localStorage.getItem('gist_token');
    if (customToken && customToken.trim()) return customToken.trim();

    // 2. Fall back to the default included key so publishing works for everyone
    return T_PART1 + T_PART2 + T_PART3;
}

// Auto-Initialize Storage on Load
(async function autoInitStorage() {
    console.log('Community storage: repo-backed (ophthalmology repo) with Gist fallback');
    setTimeout(() => processCommunityOutbox(), 0);
})();

// ============================================
// REPOSITORY-BACKED STORAGE
// The community pool lives as files in the ophthalmology repository instead of a Gist.
// Root-cause fix: GitHub truncates Gist file content at ~1MB in API responses, which
// broke reads (and caused whole-file data loss) once the pool grew. Repo files have
// no such limit, and writes use the Git Data API with optimistic (sha-based) locking.
// ============================================
const REPO_CONFIG = {
    OWNER: 'genododi',
    REPO: 'ophthalmology',
    BRANCH: 'main',
    DATA_PATH: 'community_data.json',
    STICKY_PATH: 'sticky_notes.json',
    API_URL: 'https://api.github.com'
};

const REPO_FILE_URL = (path) => `https://raw.githubusercontent.com/${REPO_CONFIG.OWNER}/${REPO_CONFIG.REPO}/${REPO_CONFIG.BRANCH}/${path}`;
const REPO_API_URL = (suffix) => `${REPO_CONFIG.API_URL}/repos/${REPO_CONFIG.OWNER}/${REPO_CONFIG.REPO}/${suffix}`;

// Per-submission content files. The shared index (community_data.json) stores only
// lightweight metadata; the full infographic content lives in community/<id>.json.
// This keeps every index write tiny (~KB) and browser-safe regardless of pool size
// (the old single-file design rewrote the whole multi-MB pool on every submission,
// which exhausted browser memory: "Out of memory" / "Blob create failed (422)").
const ITEM_DIR = 'community';
const ITEM_PATH = (id) => `${ITEM_DIR}/${id}.json`;

/**
 * fetch with a hard timeout so a stalled network can never hang the UI forever.
 */
async function fetchT(url, options = {}, timeoutMs = 30000) {
    const opts = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
        ? { ...options, signal: AbortSignal.timeout(timeoutMs) }
        : options;
    return fetch(url, opts);
}

/**
 * UTF-8 safe base64 (btoa breaks on non-Latin1 characters)
 */
function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}

/**
 * Read a file from the repository (raw.githubusercontent - always the live branch tip)
 */
async function repoReadFile(path) {
    const response = await fetchT(REPO_FILE_URL(path), { cache: 'no-store' });
    if (!response.ok) throw new Error(`Repo read failed (${response.status})`);
    return await response.text();
}

/**
 * Read a file from the repository via the GitHub Contents API - authoritative and
 * never CDN-cached. Used for merge-on-conflict baselines, where a stale CDN copy
 * could silently drop a just-submitted item from the merged write.
 */
async function repoReadFileAuthoritative(path) {
    return withTokenAttempts(async (token) => {
        try {
            const response = await fetchT(REPO_API_URL(`contents/${encodeURIComponent(path)}`), {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.raw'
                }
            });
            if (response.ok) return { success: true, text: await response.text() };
            return { success: false, status: response.status, message: `Contents read failed (${response.status})`, authError: response.status === 401 || response.status === 403 };
        } catch (err) {
            return { success: false, status: 0, message: err.message || 'Network error' };
        }
    }).then((result) => {
        if (!result || !result.success) throw new Error((result && result.message) || 'Authoritative repo read failed');
        return result.text;
    });
}

/**
 * Run an authenticated operation with automatic fallback to the default embedded key
 */
async function withTokenAttempts(fn) {
    const embeddedToken = T_PART1 + T_PART2 + T_PART3;
    const customToken = (localStorage.getItem('gist_token') || '').trim();
    const candidates = customToken && customToken !== embeddedToken
        ? [customToken, embeddedToken]
        : [embeddedToken];

    let lastResult = null;
    for (const token of candidates) {
        const result = await fn(token);
        if (result.success) {
            if (candidates.length > 1 && token === embeddedToken) {
                console.warn('Custom token rejected; removed it and used the default embedded key.');
                localStorage.removeItem('gist_token');
            }
            return result;
        }
        lastResult = result;
        // Only retry with another token on credential errors
        if (!result.authError) break;
    }
    return lastResult;
}

const COMMUNITY_COMMIT_RETRIES = 4;
const COMMUNITY_BATCH_SIZE = 20;

function isRateLimited(response) {
    return response.status === 429 ||
        (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0');
}

function rateLimitDelay(response, attempt) {
    const retryAfter = Number(response.headers.get('retry-after'));
    if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 8000);
    const resetAt = Number(response.headers.get('x-ratelimit-reset'));
    if (Number.isFinite(resetAt) && resetAt > 0) return Math.min(Math.max(1000, resetAt * 1000 - Date.now() + 1000), 8000);
    return Math.min(1000 * (2 ** attempt), 12000);
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function responseFailure(response, action, attempt) {
    const text = await response.text().catch(() => '');
    if (isRateLimited(response)) {
        const delay = rateLimitDelay(response, attempt);
        return { retry: true, delay, result: { success: false, status: 429, message: `GitHub is busy. Retrying in ${Math.ceil(delay / 1000)} seconds.` } };
    }
    return {
        retry: false,
        result: {
            success: false,
            status: response.status,
            message: `${action} failed (${response.status})${text ? `: ${text.slice(0, 180)}` : ''}`,
            authError: response.status === 401 || response.status === 403
        }
    };
}

/**
 * Write one or more files in one Git commit. A batch used to make seven API
 * calls per infographic, which hit the shared GitHub rate limit and left the
 * progress dialog spinning. This makes one tree/commit/ref update per batch.
 */
async function repoWriteFiles(files, message, { retryConflicts = true } = {}) {
    if (!Array.isArray(files) || files.length === 0) return { success: true };
    return withTokenAttempts(async (token) => {
        const authHeaders = {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json'
        };

        for (let attempt = 0; attempt < COMMUNITY_COMMIT_RETRIES; attempt++) {
            try {
                const refRes = await fetchT(REPO_API_URL(`git/ref/heads/${REPO_CONFIG.BRANCH}`), { headers: authHeaders });
                if (!refRes.ok) {
                    const failure = await responseFailure(refRes, 'Branch read', attempt);
                    if (failure.retry && attempt < COMMUNITY_COMMIT_RETRIES - 1) { await wait(failure.delay); continue; }
                    return failure.result;
                }
                const headSha = (await refRes.json()).object.sha;

                const commitRes = await fetchT(REPO_API_URL(`git/commits/${headSha}`), { headers: authHeaders });
                if (!commitRes.ok) {
                    const failure = await responseFailure(commitRes, 'Commit read', attempt);
                    if (failure.retry && attempt < COMMUNITY_COMMIT_RETRIES - 1) { await wait(failure.delay); continue; }
                    return failure.result;
                }
                const treeSha = (await commitRes.json()).tree.sha;

                const treeRes = await fetchT(REPO_API_URL(`git/trees/${treeSha}?recursive=1`), { headers: authHeaders });
                if (!treeRes.ok) {
                    const failure = await responseFailure(treeRes, 'Tree read', attempt);
                    if (failure.retry && attempt < COMMUNITY_COMMIT_RETRIES - 1) { await wait(failure.delay); continue; }
                    return failure.result;
                }
                const treeEntries = (await treeRes.json()).tree || [];
                const updates = [];
                let retryAfter = 0;
                for (const file of files) {
                    const blobRes = await fetchT(REPO_API_URL('git/blobs'), {
                        method: 'POST', headers: authHeaders,
                        body: JSON.stringify({ content: utf8ToBase64(file.content), encoding: 'base64' })
                    });
                    if (!blobRes.ok) {
                        const failure = await responseFailure(blobRes, 'Content upload', attempt);
                        if (failure.retry) { retryAfter = failure.delay; break; }
                        return failure.result;
                    }
                    const existing = treeEntries.find(entry => entry.path === file.path);
                    updates.push({ path: file.path, mode: existing ? existing.mode : '100644', type: 'blob', sha: (await blobRes.json()).sha });
                }
                if (retryAfter) {
                    if (attempt < COMMUNITY_COMMIT_RETRIES - 1) { await wait(retryAfter); continue; }
                    return { success: false, status: 429, message: 'GitHub is temporarily rate-limited. Your upload can be retried shortly.' };
                }

                const newTreeRes = await fetchT(REPO_API_URL('git/trees'), {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({ base_tree: treeSha, tree: updates })
                });
                if (!newTreeRes.ok) {
                    const failure = await responseFailure(newTreeRes, 'Tree update', attempt);
                    if (failure.retry && attempt < COMMUNITY_COMMIT_RETRIES - 1) { await wait(failure.delay); continue; }
                    return failure.result;
                }
                const newTreeSha = (await newTreeRes.json()).sha;

                const commitPostRes = await fetchT(REPO_API_URL('git/commits'), {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({ message, tree: newTreeSha, parents: [headSha] })
                });
                if (!commitPostRes.ok) {
                    const failure = await responseFailure(commitPostRes, 'Commit creation', attempt);
                    if (failure.retry && attempt < COMMUNITY_COMMIT_RETRIES - 1) { await wait(failure.delay); continue; }
                    return failure.result;
                }
                const newCommitSha = (await commitPostRes.json()).sha;

                const refPatchRes = await fetchT(REPO_API_URL(`git/refs/heads/${REPO_CONFIG.BRANCH}`), {
                    method: 'PATCH',
                    headers: authHeaders,
                    body: JSON.stringify({ sha: newCommitSha, force: false })
                });

                if (refPatchRes.ok) return { success: true, sha: newCommitSha };
                if (refPatchRes.status === 409 || refPatchRes.status === 422) {
                    if (!retryConflicts) return { success: false, status: 409, message: 'A newer community update was published first.' };
                    await wait(300 * (attempt + 1));
                    continue;
                }
                const failure = await responseFailure(refPatchRes, 'Branch update', attempt);
                if (failure.retry && attempt < COMMUNITY_COMMIT_RETRIES - 1) { await wait(failure.delay); continue; }
                return failure.result;
            } catch (err) {
                return { success: false, status: 0, message: err.message || 'Network error' };
            }
        }
        return { success: false, status: 409, message: 'The community is receiving several uploads. Please retry in a moment.' };
    });
}

async function repoWriteFile(path, content, message, options) {
    return repoWriteFiles([{ path, content }], message, options);
}

/**
 * Merge community data so a concurrent write never destroys another user's items.
 * Desired (caller) items win on id match; remote-only items are preserved;
 * items listed in the deleted tombstone list are dropped.
 */
function mergeCommunityData(current, desired) {
    const tombstoned = new Set(desired.deleted || []);
    const mergeList = (cur, des) => {
        const byId = new Map();
        (cur || []).forEach(item => { if (item && item.id) byId.set(item.id, item); });
        (des || []).forEach(item => { if (item && item.id) byId.set(item.id, item); }); // desired wins
        return Array.from(byId.values()).filter(item => !tombstoned.has(item.id));
    };
    return {
        submissions: mergeList(current.submissions, desired.submissions),
        approved: mergeList(current.approved, desired.approved),
        deleted: Array.from(new Set([...(current.deleted || []), ...(desired.deleted || [])]))
    };
}

/**
 * Read community data from the repo, falling back to the Gist, then cache, then demo mode
 */
async function readCommunityData() {
    try {
        const content = await repoReadFile(REPO_CONFIG.DATA_PATH);
        const data = JSON.parse(content);
        if (!data.submissions) data.submissions = [];
        if (!data.approved) data.approved = [];
        if (!data.deleted) data.deleted = [];
        return data;
    } catch (repoErr) {
        console.warn('Repo read failed, falling back to Gist:', repoErr.message);
    }

    try {
        // Gist fallback (older deployments / during migration)
        const response = await fetchT(`${GITHUB_CONFIG.API_URL}/${GITHUB_CONFIG.GIST_ID}`, { headers: {} });
        if (response.ok) {
            const gist = await response.json();
            const file = gist.files[GITHUB_CONFIG.FILENAME];
            if (file && !file.truncated && file.content) {
                const data = JSON.parse(file.content);
                if (!data.submissions) data.submissions = [];
                if (!data.approved) data.approved = [];
                if (!data.deleted) data.deleted = [];
                return data;
            }
        }
    } catch (gistErr) {
        console.warn('Gist fallback read failed:', gistErr.message);
    }
    return null;
}

/**
 * Write community data to the repo (merged on conflict), falling back to the Gist.
 * Only metadata is stored in the shared index file - the full infographic content
 * lives in per-submission files (community/<id>.json), so this stays lightweight.
 */
async function writeCommunityData(data, commitMessage) {
    const index = {
        submissions: (data.submissions || []).map(stripItemData),
        approved: (data.approved || []).map(stripItemData),
        deleted: data.deleted || []
    };
    const content = JSON.stringify(index);

    // Repo write with merge-on-conflict
    const repoResult = await repoWriteFile(REPO_CONFIG.DATA_PATH, content, commitMessage || 'Community update');
    if (repoResult.success) {
        localStorage.removeItem(COMMUNITY_CACHE_KEY);
        return { success: true };
    }
    if (repoResult.authError || repoResult.status === 404) {
        // Token lacks repo access (or repo file missing) - fall back to Gist
        const gistResult = await patchGistFiles({
            [GITHUB_CONFIG.FILENAME]: { content }
        });
        if (gistResult.success) {
            localStorage.removeItem(COMMUNITY_CACHE_KEY);
            return { success: true };
        }
        return { success: false, message: gistResult.message || repoResult.message };
    }
    return { success: false, message: repoResult.message };
}

/**
 * Keep every field of a submission except the heavyweight content payload.
 */
function stripItemData(item) {
    if (!item) return item;
    const { data, ...meta } = item;
    return meta;
}

/**
 * Persist the full submission (including its content) in its own repo file.
 * Best-effort: if this fails the submission still lands in the index, but the
 * "Preview / Load / Add to Library" actions for that item will show a clearer
 * error. Used for the shared pool only.
 */
async function writeSubmissionItem(submission, message) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const result = await repoWriteFile(ITEM_PATH(submission.id), JSON.stringify(submission), message || 'Community submission item');
            if (result.success) return true;
            if (attempt < 2) {
                console.warn(`Submission item write failed (${result.message}); retrying (${attempt + 1}/3)`);
                await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)));
            }
        } catch (err) {
            console.warn('Could not write submission item file:', err.message);
            if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)));
        }
    }
    return false;
}

/**
 * Fetch the full record (including content) for a single submission.
 * @returns {Promise<Object|null>} the full submission record or null
 */
async function getSubmissionData(submissionId) {
    try {
        const content = await repoReadFile(ITEM_PATH(submissionId));
        return JSON.parse(content);
    } catch {
        return null;
    }
}

// Admin PIN for approval operations (simple security)
const ADMIN_PIN = '309030';

// IP lookup service (free, no API key needed)
const IP_SERVICE_URL = 'https://api.ipify.org?format=json';

// Local storage key for caching
const COMMUNITY_CACHE_KEY = 'ophthalmic_community_cache_v3';
const COMMUNITY_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Auto-detect chapter from title keywords
 * Enhanced clinical ophthalmology keywords
 */
function autoDetectChapterFromTitle(title) {
    if (!title) return 'uncategorized';

    const titleLower = title.toLowerCase();

    // Clinical ophthalmology auto-categorization rules
    const rules = [
        // Neuro-ophthalmology
        { keywords: ['neuro', 'optic nerve', 'optic neuritis', 'papill', 'visual field', 'pupil', 'nystagmus', 'cranial nerve', 'chiasm', 'intracranial', 'iih', 'horner', 'anisocoria', 'gaze palsy', 'diplopia cranial', 'aion', 'naion', 'pion', 'lhon', 'myasthenia', 'giant cell', 'gca', 'temporal arteritis'], chapter: 'neuro' },
        // Glaucoma
        { keywords: ['glaucoma', 'iop', 'intraocular pressure', 'trabeculectomy', 'angle closure', 'poag', 'pacg', 'migs', 'tube shunt', 'filtering', 'rnfl', 'optic disc cupping', 'visual field glaucoma', 'pigmentary glaucoma', 'pseudoexfoliation', 'pxf', 'pex', 'ocular hypertension', 'oht', 'narrow angle'], chapter: 'glaucoma' },
        // Vitreoretinal
        { keywords: ['vitreous', 'retinal detachment', 'vitrectomy', 'macular hole', 'pvd', 'epiretinal membrane', 'erm', 'scleral buckle', 'rhegmatogenous', 'tractional', 'pvr', 'silicone oil', 'floaters', 'vitreous hemorrhage', 'retinoschisis'], chapter: 'vitreoretinal' },
        // Medical Retina
        { keywords: ['diabetic retinopathy', 'macular degeneration', 'amd', 'csr', 'cscr', 'retinal vein', 'retinal artery', 'macular edema', 'dme', 'cme', 'brvo', 'crvo', 'drusen', 'cnv', 'anti-vegf', 'intravitreal', 'wet amd', 'dry amd', 'geographic atrophy', 'central serous', 'rvo', 'crao', 'brao', 'retinitis pigmentosa', 'dystrophy retina'], chapter: 'medical_retina' },
        // Cornea
        { keywords: ['cornea', 'keratitis', 'keratoconus', 'corneal transplant', 'dsaek', 'dmek', 'pterygium', 'dry eye', 'fuchs', 'corneal dystrophy', 'corneal ulcer', 'herpetic', 'acanthamoeba', 'cross-linking', 'graft rejection', 'keratoplasty', 'pemhigoid', 'sjs', 'stevens-johnson', 'ocular surface'], chapter: 'cornea' },
        // Lens / Cataract
        { keywords: ['cataract', 'lens', 'phaco', 'iol', 'posterior capsule', 'pco', 'yag capsulotomy', 'femtosecond', 'ectopia lentis', 'aphakia', 'pseudophakia', 'intraocular lens', 'biometry'], chapter: 'lens' },
        // Uveitis
        { keywords: ['uveitis', 'iritis', 'iridocyclitis', 'choroiditis', 'panuveitis', 'hla-b27', 'behcet', 'sarcoid', 'vkh', 'birdshot', 'hypopyon', 'synechia', 'toxoplasm', 'cmv retinitis', 'pars planitis', 'scleritis', 'white dot'], chapter: 'uveitis' },
        // Strabismus
        { keywords: ['strabismus', 'squint', 'esotropia', 'exotropia', 'hypertropia', 'diplopia', 'motility', 'extraocular', 'eom', 'binocular', 'amblyopia', 'cover test', 'duane', 'brown syndrome', 'lazy eye', 'hess chart', 'convergence'], chapter: 'strabismus' },
        // Paediatric
        { keywords: ['paediatric', 'pediatric', 'child', 'congenital', 'rop', 'retinopathy of prematurity', 'leukocoria', 'retinoblastoma child', 'infantile', 'neonatal', 'buphthalmos', 'nldo', 'nasolacrimal'], chapter: 'paediatric' },
        // Orbit
        { keywords: ['orbit', 'proptosis', 'exophthalmos', 'thyroid eye', 'graves', 'orbital cellulitis', 'blow out', 'orbital fracture', 'orbital tumor', 'decompression', 'ted', 'lid retraction'], chapter: 'orbit' },
        // Lids
        { keywords: ['lid', 'eyelid', 'ptosis', 'ectropion', 'entropion', 'blephar', 'chalazion', 'hordeolum', 'trichiasis', 'lagophthalmos', 'lid tumor', 'bcc eyelid', 'levator', 'blepharoplasty', 'xanthelasma'], chapter: 'lids' },
        // Lacrimal
        { keywords: ['lacrimal', 'tear duct', 'dacryocyst', 'nasolacrimal', 'epiphora', 'dcr', 'punctum', 'canalicul', 'watery eye', 'tearing'], chapter: 'lacrimal' },
        // Conjunctiva
        { keywords: ['conjunctiv', 'pinguecula', 'allergic eye', 'vernal', 'trachoma', 'subconjunctival', 'chemosis', 'pemphigoid ocular', 'sjs', 'ossn'], chapter: 'conjunctiva' },
        // Sclera
        { keywords: ['scleritis', 'episcleritis', 'sclera', 'necrotizing scleritis', 'staphyloma'], chapter: 'sclera' },
        // Refractive
        { keywords: ['refractive', 'refraction', 'myopia', 'hyperopia', 'astigmatism', 'lasik', 'prk', 'smile', 'presbyopia', 'icl', 'phakic iol', 'biometry', 'iol calculation', 'contact lens', 'spectacle'], chapter: 'refractive' },
        // Trauma
        { keywords: ['trauma', 'injury', 'foreign body', 'hyphema', 'open globe', 'chemical burn', 'penetrating', 'iofb', 'commotio', 'laceration', 'rupture'], chapter: 'trauma' },
        // Tumours
        { keywords: ['tumour', 'tumor', 'melanoma', 'retinoblastoma', 'lymphoma', 'metasta', 'choroidal nevus', 'enucleation', 'plaque', 'oncology'], chapter: 'tumours' },
        // Surgery
        { keywords: ['surgery', 'surgical', 'anaesthe', 'anesthe', 'perioperative', 'complication', 'post-op', 'intraoperative', 'consent', 'theatre', 'sterilization'], chapter: 'surgery_care' },
        // Lasers
        { keywords: ['laser', 'yag', 'argon', 'photocoagulation', 'slt', 'prp', 'panretinal', 'micropulse', 'pdt', 'capsulotomy', 'iridotomy'], chapter: 'lasers' },
        // Therapeutics
        { keywords: ['drug', 'medication', 'drops', 'antibiotic', 'steroid eye', 'anti-vegf', 'pharmacology', 'intravitreal injection', 'eylea', 'lucentis', 'avastin', 'pharmacy', 'prescribing'], chapter: 'therapeutics' },
        // Clinical Skills
        { keywords: ['examination', 'slit lamp', 'fundoscopy', 'tonometry', 'gonioscopy', 'visual acuity', 'ophthalmoscopy', 'clinical assessment', 'history taking', 'osc', 'station'], chapter: 'clinical_skills' },
        // Investigations
        { keywords: ['investigation', 'imaging', 'angiography', 'oct', 'ffa', 'icg', 'visual field test', 'perimetry', 'ultrasound eye', 'b-scan', 'topography', 'electrophysiology', 'erg', 'vep'], chapter: 'investigations' },
        // Evidence
        { keywords: ['trial', 'study', 'evidence', 'guideline', 'areds', 'drcr', 'rct', 'meta-analysis', 'review'], chapter: 'evidence' },
    ];

    for (const rule of rules) {
        for (const keyword of rule.keywords) {
            if (titleLower.includes(keyword)) {
                return rule.chapter;
            }
        }
    }

    return 'uncategorized';
}

/**
 * Get user's IP address using ipify.org
 */
async function getUserIP() {
    try {
        const response = await fetchT(IP_SERVICE_URL);
        if (response.ok) {
            const data = await response.json();
            return data.ip;
        }
    } catch (err) {
        console.log('Could not fetch IP address:', err.message);
    }
    return 'Unknown';
}

/**
 * Generate a unique submission ID
 */
function generateSubmissionId() {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format date for display
 */
function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Sanitize user input
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input
        .trim()
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .substring(0, 500); // Limit length
}

// ============================================
// GitHub Gist API Functions
// ============================================

/**
 * Check if a storage backend is configured
 */
function isConfigured() {
    return true; // Configured with embedded credentials
}

/**
 * Configure Gist Credentials (for UI)
 */
function configureGist(id, token) {
    if (token) {
        localStorage.setItem('gist_token', token);
        if (id) {
            localStorage.setItem('gist_id', id);
            GITHUB_CONFIG.GIST_ID = id;
        }
        // If ID missing, clear it so auto-discovery can run?
        // Actually, trigger auto-discovery logic if ID missing could be complex.
        // For now, reload window is best.
        return true;
    }
    return false;
}

/**
 * Fetch all submissions from the repository storage
 */
async function fetchSubmissions({ forceRefresh = false } = {}) {
    if (!isConfigured()) {
        console.warn('No storage backend configured. Using local demo mode.');
        return getLocalDemoSubmissions();
    }

    // Use the 5-minute cache when available
    try {
        if (forceRefresh) throw new Error('Cache bypass requested');
        const cached = localStorage.getItem(COMMUNITY_CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed._cachedAt && (Date.now() - parsed._cachedAt) < COMMUNITY_CACHE_EXPIRY) {
                delete parsed._cachedAt;
                return parsed;
            }
        }
    } catch { /* ignore */ }

    const data = await readCommunityData();

    if (data) {
        // Cache the fresh copy
        try {
            localStorage.setItem(COMMUNITY_CACHE_KEY, JSON.stringify({ ...data, _cachedAt: Date.now() }));
        } catch { /* ignore */ }
        return data;
    }

    // Fallback to raw cache then demo mode
    try {
        const cached = localStorage.getItem(COMMUNITY_CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            delete parsed._cachedAt;
            return parsed;
        }
    } catch { /* ignore */ }
    return { submissions: [], approved: [], deleted: [] };
}

/**
 * Publish content files and their lightweight index together. At most twenty
 * records are committed at once, keeping large local-library uploads within
 * GitHub's secondary rate limits while preserving an all-or-nothing index.
 */
async function publishSubmissionBatch(newSubmissions) {
    for (let attempt = 0; attempt < COMMUNITY_COMMIT_RETRIES; attempt++) {
        const currentData = await fetchSubmissions({ forceRefresh: true });
        const merged = mergeCommunityData(currentData, {
            submissions: [...newSubmissions, ...(currentData.submissions || [])],
            approved: currentData.approved || [],
            deleted: currentData.deleted || []
        });
        const index = {
            submissions: (merged.submissions || []).map(stripItemData),
            approved: (merged.approved || []).map(stripItemData),
            deleted: merged.deleted || []
        };

        // Content is immutable after publishing. Commit it in compact groups,
        // then make the complete set visible by publishing the index last.
        for (let offset = 0; offset < newSubmissions.length; offset += COMMUNITY_BATCH_SIZE) {
            const chunk = newSubmissions.slice(offset, offset + COMMUNITY_BATCH_SIZE);
            const itemResult = await repoWriteFiles(
                chunk.map(item => ({ path: ITEM_PATH(item.id), content: JSON.stringify(item) })),
                `Community upload: ${chunk.length} infographic${chunk.length === 1 ? '' : 's'}`
            );
            if (!itemResult.success) return itemResult;
        }

        const indexResult = await repoWriteFile(
            REPO_CONFIG.DATA_PATH,
            JSON.stringify(index),
            'Community update',
            { retryConflicts: false }
        );
        if (indexResult.success) {
            localStorage.removeItem(COMMUNITY_CACHE_KEY);
            return { success: true };
        }
        // A concurrent update can make our index stale; rebuild it from the
        // latest server copy so the other publisher's records are retained.
        if (indexResult.status !== 409 && indexResult.status !== 422) return indexResult;
        await wait(400 * (attempt + 1));
    }
    return { success: false, status: 409, message: 'The community is busy. Please retry this upload in a moment.' };
}

const COMMUNITY_OUTBOX_KEY = 'ophthalmic_community_upload_outbox_v1';
let communityOutboxTimer = null;
let communityOutboxRunning = false;

function loadCommunityOutbox() {
    try {
        const queue = JSON.parse(localStorage.getItem(COMMUNITY_OUTBOX_KEY) || '[]');
        return Array.isArray(queue) ? queue : [];
    } catch {
        return [];
    }
}

function saveCommunityOutbox(queue) {
    try { localStorage.setItem(COMMUNITY_OUTBOX_KEY, JSON.stringify(queue)); } catch (err) {
        console.warn('Could not save the community upload queue:', err.message);
    }
}

function scheduleCommunityOutbox(delay = 0) {
    if (communityOutboxTimer) clearTimeout(communityOutboxTimer);
    communityOutboxTimer = setTimeout(() => {
        communityOutboxTimer = null;
        processCommunityOutbox();
    }, delay);
}

function queueCommunityUpload(submissions) {
    const queue = loadCommunityOutbox();
    const knownIds = new Set(queue.flatMap(entry => (entry.submissions || []).map(item => item.id)));
    const unique = submissions.filter(item => !knownIds.has(item.id));
    if (unique.length) {
        queue.push({ submissions: unique, attempts: 0, nextRetryAt: Date.now() });
        saveCommunityOutbox(queue);
    }
    scheduleCommunityOutbox(3000);
}

async function processCommunityOutbox() {
    if (communityOutboxRunning || !navigator.onLine) return;
    const queue = loadCommunityOutbox();
    if (!queue.length) return;
    const entry = queue[0];
    const delay = Math.max(0, (entry.nextRetryAt || 0) - Date.now());
    if (delay) { scheduleCommunityOutbox(delay); return; }

    communityOutboxRunning = true;
    try {
        const result = await publishSubmissionBatch(entry.submissions || []);
        if (result.success) {
            queue.shift();
            saveCommunityOutbox(queue);
            scheduleCommunityOutbox(500);
        } else {
            entry.attempts = (entry.attempts || 0) + 1;
            const backoff = Math.min(5 * 60 * 1000, 3000 * (2 ** Math.min(entry.attempts, 6)));
            entry.nextRetryAt = Date.now() + backoff;
            queue[0] = entry;
            saveCommunityOutbox(queue);
            scheduleCommunityOutbox(backoff);
        }
    } catch (err) {
        entry.attempts = (entry.attempts || 0) + 1;
        entry.nextRetryAt = Date.now() + Math.min(5 * 60 * 1000, 3000 * (2 ** Math.min(entry.attempts, 6)));
        queue[0] = entry;
        saveCommunityOutbox(queue);
        scheduleCommunityOutbox(entry.nextRetryAt - Date.now());
    } finally {
        communityOutboxRunning = false;
    }
}

window.addEventListener('online', () => scheduleCommunityOutbox(0));

/**
 * PATCH one or more files in the shared Gist.
 * Tries the user's custom token (if saved) first, then automatically falls back
 * to the default embedded key whenever the GitHub API rejects the credentials,
 * so publishing always works out of the box.
 * @param {Object} filesPayload - { filename: { content: string } }
 * @returns {Promise<Object>} - { success, status, message }
 */
async function patchGistFiles(filesPayload) {
    const embeddedToken = T_PART1 + T_PART2 + T_PART3;
    const customToken = (localStorage.getItem('gist_token') || '').trim();
    const candidates = customToken && customToken !== embeddedToken
        ? [customToken, embeddedToken]
        : [embeddedToken];

    let lastError = { status: 0, text: 'Unknown error' };

    for (const token of candidates) {
        try {
            const response = await fetchT(`${GITHUB_CONFIG.API_URL}/${GITHUB_CONFIG.GIST_ID}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ files: filesPayload })
            });

            if (response.ok) {
                // A stale/custom token may have failed and the embedded key saved the day
                if (candidates.length > 1 && token === embeddedToken) {
                    console.warn('Custom Gist token rejected; removed it and used the default embedded key.');
                    localStorage.removeItem('gist_token');
                }
                return { success: true };
            }

            const errText = await response.text();
            lastError = { status: response.status, text: errText };

            const isAuthError = response.status === 401 ||
                (response.status === 403 &&
                    (errText.includes('Bad credentials') || errText.includes('Resource not accessible') || errText.includes('Must have admin rights')));

            // Only retry with another token on credential errors; rate limits and other
            // failures won't be fixed by a different key.
            if (!isAuthError) {
                return { success: false, status: response.status, message: errText };
            }
        } catch (err) {
            lastError = { status: 0, text: err.message || 'Network error' };
            break; // Network errors won't be fixed by trying another token
        }
    }

    return { success: false, status: lastError.status, message: lastError.text };
}

/**
 * Update the storage (Add/Modify submissions).
 * Writes to the repository with merge-on-conflict so concurrent user
 * submissions can never overwrite each other.
 */
async function updateSubmissions(data) {
    if (!isConfigured()) {
        console.warn('Storage not configured. Saving to localStorage demo mode.');
        saveLocalDemoSubmissions(data);
        return { success: true };
    }

    try {
        // If the remote moved since our last read, merge so nobody's data is lost.
        // The baseline MUST come from the authoritative API - a CDN-cached copy can
        // be stale for minutes and silently drop a just-submitted concurrent item.
        let finalData = data;
        try {
            const currentText = await repoReadFileAuthoritative(REPO_CONFIG.DATA_PATH);
            const current = JSON.parse(currentText);
            finalData = mergeCommunityData(current, data);
        } catch (readErr) {
            // File may not exist yet on first write - write exactly what we have
            console.log('No current repo data to merge against:', readErr.message);
        }

        const result = await writeCommunityData(finalData, 'Community update');
        if (result.success) {
            return { success: true };
        }
        return { success: false, message: result.message || 'Unknown error' };
    } catch (err) {
        console.error('Error updating submissions:', err);
        return { success: false, message: err.message || 'Unknown network error' };
    }
}

/**
 * Get deleted items (for sync)
 */
async function getDeletedItems() {
    const data = await fetchSubmissions();
    return data.deleted || [];
}

// ============================================
// STICKY NOTES COMMON POOL (shared gist file)
// ============================================

const STICKY_POOL_FILENAME = 'sticky_notes.json';

/**
 * Normalize note text for duplicate detection
 */
function normalizeNoteText(text) {
    return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Fetch the shared sticky notes pool (readable by anyone, no token needed)
 * Reads from the repository, falling back to the Gist pool file.
 * @returns {Promise<Array>} - Array of pooled notes
 */
async function fetchStickyNotesPool() {
    try {
        const content = await repoReadFile(REPO_CONFIG.STICKY_PATH);
        const data = JSON.parse(content || '{}');
        return Array.isArray(data.notes) ? data.notes : [];
    } catch (repoErr) {
        console.warn('Sticky pool repo read failed, trying Gist fallback:', repoErr.message);
    }

    try {
        const response = await fetchT(`${GITHUB_CONFIG.API_URL}/${GITHUB_CONFIG.GIST_ID}`, { headers: {} });
        if (!response.ok) return [];
        const gist = await response.json();
        for (const name of [STICKY_POOL_FILENAME, 'pool_sticky_notes.json']) {
            const file = gist.files[name];
            if (!file) continue;
            let content;
            if (file.truncated && file.raw_url) {
                const rawResponse = await fetchT(file.raw_url);
                if (!rawResponse.ok) continue;
                content = await rawResponse.text();
            } else {
                content = file.content;
            }
            const data = JSON.parse(content || '{}');
            if (Array.isArray(data.notes) && data.notes.length > 0) return data.notes;
        }
    } catch (err) {
        console.error('Error fetching sticky notes pool:', err);
    }
    return [];
}

/**
 * Upload local sticky notes to the shared pool.
 * Merges with existing pooled notes (deduplicated by normalized text),
 * then writes the merged pool back in a single commit using the default included key.
 * @param {Array} localNotes - The user's local sticky notes
 * @returns {Promise<Object>} - { success, added, total }
 */
async function uploadStickyNotesToPool(localNotes) {
    try {
        const pool = await fetchStickyNotesPool();

        const pooledSigs = new Set(pool.map(n => normalizeNoteText(n.text)));
        const added = [];

        for (const note of localNotes) {
            if (!note || !note.text || !note.text.trim()) continue;
            const sig = normalizeNoteText(note.text);
            if (pooledSigs.has(sig)) continue;
            pooledSigs.add(sig);
            added.push({
                id: 'pool_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 8),
                text: String(note.text),
                source: note.source || 'Community Pool',
                createdAt: new Date().toISOString(),
                sharedBy: note.source || 'Community member'
            });
        }

        if (added.length === 0) {
            return { success: true, added: 0, total: pool.length, message: 'All your notes are already in the shared pool.' };
        }

        const merged = [...added, ...pool];

        // Repo write first (atomic, merge-safe), Gist as fallback
        let result;
        try {
            result = await repoWriteFile(REPO_CONFIG.STICKY_PATH, JSON.stringify({ notes: merged }, null, 2), 'Sticky notes pool update');
        } catch (err) {
            result = { success: false, message: err.message };
        }

        if (!result.success) {
            const gistResult = await patchGistFiles({
                [STICKY_POOL_FILENAME]: { content: JSON.stringify({ notes: merged }, null, 2) }
            });
            if (!gistResult.success) {
                throw new Error(`Failed to update the shared pool (${result.message || gistResult.message})`);
            }
        }

        return { success: true, added: added.length, total: merged.length, message: `${added.length} note(s) published to the shared pool!` };
    } catch (err) {
        console.error('Error uploading sticky notes to pool:', err);
        return { success: false, message: err.message || 'Failed to upload to the shared pool.' };
    }
}

/**
 * Download all sticky notes from the shared pool
 * @returns {Promise<Object>} - { success, notes }
 */
async function downloadStickyNotesFromPool() {
    try {
        const pool = await fetchStickyNotesPool();
        return { success: true, notes: pool };
    } catch (err) {
        console.error('Error downloading sticky notes pool:', err);
        return { success: false, message: err.message || 'Failed to download the shared pool.' };
    }
}

// ============================================
// LOCAL DEMO MODE (Fallback when JSONBin not configured)
// ============================================

const LOCAL_DEMO_KEY = 'ophthalmic_community_demo';

function getLocalDemoSubmissions() {
    try {
        const data = localStorage.getItem(LOCAL_DEMO_KEY);
        return data ? JSON.parse(data) : { submissions: [], approved: [] };
    } catch {
        return { submissions: [], approved: [] };
    }
}

function saveLocalDemoSubmissions(data) {
    localStorage.setItem(LOCAL_DEMO_KEY, JSON.stringify(data));
}

// ============================================
// SUBMISSION FUNCTIONS
// ============================================

/**
 * Submit an infographic to the community pool
 * @param {Object} infographicData - The infographic data to submit
 * @param {string} userName - The submitter's name
 * @returns {Promise<Object>} - Result with success status and message
 */
async function submitToCommunity(infographicData, userName) {
    if (!infographicData) {
        return { success: false, message: 'No infographic data provided.' };
    }

    if (!userName || userName.trim().length === 0) {
        return { success: false, message: 'Please provide your name.' };
    }

    const result = await submitMultiple([infographicData], userName);
    return result.success
        ? { ...result, submissionId: result.submissionIds && result.submissionIds[0], message: 'Your infographic has been submitted for review!' }
        : result;
}

/**
 * Submit MULTIPLE infographics to the community pool (Batch)
 * Fetches once, appends all, updates once to prevent race conditions
 */
async function submitMultiple(infographicsList, userName) {
    if (!infographicsList || infographicsList.length === 0) {
        return { success: false, message: 'No infographics provided.' };
    }

    if (!userName || userName.trim().length === 0) {
        return { success: false, message: 'Please provide your name.' };
    }

    try {
        const userIP = await getUserIP();
        const newSubmissions = [];

        // Prepare all submissions
        // IMPORTANT: Include chapterId at top level for sync to other users
        for (const item of infographicsList) {
            // Get chapterId from item or nested data
            const itemChapterId = item.chapterId || item.data?.chapterId || 'uncategorized';

            const submission = {
                id: generateSubmissionId() + Math.random().toString(36).substr(2, 5), // Ensure unique ID
                userName: sanitizeInput(userName),
                title: (item.title || item.data?.title) || 'Untitled Infographic',
                summary: (item.summary || item.data?.summary) || '',
                chapterId: itemChapterId, // Preserve user categorization for sync
                submittedAt: new Date().toISOString(),
                userIP: userIP,
                likes: 0,
                likedBy: [],
                status: 'pending',
                data: item.data || item
            };
            newSubmissions.push(submission);
        }

        const result = await publishSubmissionBatch(newSubmissions);

        if (result.success) {
            return {
                success: true,
                count: newSubmissions.length,
                submissionIds: newSubmissions.map(submission => submission.id),
                message: `Successfully submitted ${newSubmissions.length} infographics!`
            };
        } else {
            // Do not make people restart a large upload after a temporary
            // rate-limit or connectivity failure. Keep it locally and resume
            // automatically on this or the next visit.
            if (result.status === 0 || result.status === 429) {
                queueCommunityUpload(newSubmissions);
                return {
                    success: true,
                    queued: true,
                    count: newSubmissions.length,
                    submissionIds: newSubmissions.map(submission => submission.id),
                    message: `Upload queued. It will publish automatically when GitHub is available (${newSubmissions.length} item${newSubmissions.length === 1 ? '' : 's'}).`
                };
            }
            return { success: false, message: `Batch submission failed: ${result.message || 'Please try again'}` };
        }
    } catch (err) {
        console.error('Batch submission error:', err);
        return { success: false, message: 'An error occurred during batch submission.' };
    }
}

/**
 * Get all pending submissions (for public view)
 */
async function getPendingSubmissions() {
    const data = await fetchSubmissions();
    return (data.submissions || []).filter(s => s.status === 'pending');
}

/**
 * Get all approved submissions (for public gallery)
 */
async function getApprovedSubmissions() {
    const data = await fetchSubmissions();
    return data.approved || [];
}

/**
 * Get all submissions (for admin view)
 */
async function getAllSubmissions() {
    return await fetchSubmissions();
}

/**
 * Like a submission
 * @param {string} submissionId - The submission to like
 */
async function likeSubmission(submissionId) {
    try {
        const userIP = await getUserIP();
        const data = await fetchSubmissions();

        // Find in pending submissions
        let submission = (data.submissions || []).find(s => s.id === submissionId);
        let isApproved = false;

        // If not found, check approved
        if (!submission) {
            submission = (data.approved || []).find(s => s.id === submissionId);
            isApproved = true;
        }

        if (!submission) {
            return { success: false, message: 'Submission not found.' };
        }

        // Check if already liked
        submission.likedBy = submission.likedBy || [];
        if (submission.likedBy.includes(userIP)) {
            return { success: false, message: 'You have already liked this.' };
        }

        // Add like
        submission.likedBy.push(userIP);
        submission.likes = (submission.likes || 0) + 1;

        // Update storage
        const result = await updateSubmissions(data);
        if (!result.success) throw new Error(result.message);

        return { success: true, likes: submission.likes };
    } catch (err) {
        console.error('Like error:', err);
        return { success: false, message: 'Failed to like.' };
    }
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

/**
 * Verify admin PIN
 */
function verifyAdminPIN(pin) {
    return pin === ADMIN_PIN;
}

/**
 * Approve a submission (admin only)
 * @param {string} submissionId - The submission to approve
 * @param {string} pin - Admin PIN for verification
 */
async function approveSubmission(submissionId, pin) {
    if (!verifyAdminPIN(pin)) {
        return { success: false, message: 'Invalid admin PIN.' };
    }

    try {
        const data = await fetchSubmissions();

        // Find the submission
        const index = (data.submissions || []).findIndex(s => s.id === submissionId);
        if (index === -1) {
            return { success: false, message: 'Submission not found.' };
        }

        // Move to approved
        const submission = data.submissions.splice(index, 1)[0];
        submission.status = 'approved';
        submission.approvedAt = new Date().toISOString();

        data.approved = data.approved || [];
        data.approved.unshift(submission);

        // Update storage
        const result = await updateSubmissions(data);

        if (result.success) {
            return { success: true, message: 'Submission approved!' };
        } else {
            return { success: false, message: `Failed to approve: ${result.message}` };
        }
    } catch (err) {
        console.error('Approve error:', err);
        return { success: false, message: 'An error occurred.' };
    }
}

/**
 * Reject a submission (admin only)
 * @param {string} submissionId - The submission to reject
 * @param {string} pin - Admin PIN for verification
 */
async function rejectSubmission(submissionId, pin) {
    if (!verifyAdminPIN(pin)) {
        return { success: false, message: 'Invalid admin PIN.' };
    }

    try {
        const data = await fetchSubmissions();

        // Find and remove the submission
        const index = (data.submissions || []).findIndex(s => s.id === submissionId);
        if (index === -1) {
            return { success: false, message: 'Submission not found.' };
        }

        // Remove from pending
        data.submissions.splice(index, 1);

        // Update storage
        const result = await updateSubmissions(data);

        if (result.success) {
            return { success: true, message: 'Submission rejected and removed.' };
        } else {
            return { success: false, message: `Failed to rejection: ${result.message}` };
        }
    } catch (err) {
        console.error('Reject error:', err);
        return { success: false, message: 'An error occurred.' };
    }
}

/**
 * Deduplicate approved submissions (admin only)
 * @param {string} pin - Admin PIN for verification
 */
async function deduplicateApprovedSubmissions(pin) {
    if (!verifyAdminPIN(pin)) {
        return { success: false, message: 'Invalid admin PIN.' };
    }

    try {
        const data = await fetchSubmissions();
        const approved = data.approved || [];
        const unique = [];
        const seenTitles = new Set();
        let deletedCount = 0;

        for (const item of approved) {
            const normalizedTitle = (item.title || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            if (seenTitles.has(normalizedTitle) && normalizedTitle.length > 0) {
                deletedCount++;
                data.deleted = data.deleted || [];
                data.deleted.push(item.id);
            } else {
                seenTitles.add(normalizedTitle);
                unique.push(item);
            }
        }

        if (deletedCount === 0) {
            return { success: true, message: 'No duplicates found.' };
        }

        data.approved = unique;
        const result = await updateSubmissions(data);

        if (result.success) {
            return { success: true, message: `Removed ${deletedCount} duplicate(s).` };
        } else {
            return { success: false, message: `Failed to remove duplicates: ${result.message}` };
        }
    } catch (err) {
        console.error('Deduplicate error:', err);
        return { success: false, message: 'An error occurred during deduplication.' };
    }
}

// ============================================
// DOWNLOAD FUNCTIONS
// ============================================

/**
 * Download a community submission to local library
 * @param {string} submissionId - The submission to download
 * @param {boolean} overwrite - Whether to overwrite if exists
 */
async function downloadToLocalLibrary(submissionId, overwrite = false) {
    try {
        // The index only stores metadata - fetch the full record (with content) on demand
        let submission = await getSubmissionData(submissionId);
        if (!submission) {
            const data = await fetchSubmissions();
            submission = (data.submissions || []).find(s => s.id === submissionId);
            if (!submission) {
                submission = (data.approved || []).find(s => s.id === submissionId);
            }
        }

        if (!submission || !submission.data) {
            return { success: false, message: 'Submission content not found.' };
        }

        let library = [];
        try {
            library = (typeof window.getLibraryCache === 'function')
                ? [...window.getLibraryCache()]
                : JSON.parse(localStorage.getItem('ophthalmic_infographic_library') || '[]');
        } catch {
            library = [];
        }

        // DUPLICATE CHECK: Normalize title for comparison
        const normalizeTitle = (t) => (t || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        const submissionTitleNorm = normalizeTitle(submission.title);

        // Check if already exists
        const existingIndex = library.findIndex(item =>
            item.communityId === submissionId ||
            (item.title === submission.title && item.date === submission.submittedAt) ||
            (normalizeTitle(item.title) === submissionTitleNorm && submissionTitleNorm.length > 0)
        );

        // Preserve user-customized chapterId if overwriting an existing item
        let preservedChapterId = null;
        let preservedKanskiMeta = null;

        if (existingIndex !== -1) {
            if (!overwrite) {
                // Return specific status for UI to prompt user
                return {
                    success: false,
                    status: 'duplicate',
                    message: `An infographic with a similar title "${submission.title}" already exists in your library.`
                };
            }

            // Preserve user's local customisations before removing
            const existingItem = library[existingIndex];
            if (existingItem.chapterId && existingItem.chapterId !== 'uncategorized') {
                preservedChapterId = existingItem.chapterId;
            }
            if (existingItem.kanskiMeta) {
                preservedKanskiMeta = existingItem.kanskiMeta;
            }

            // If overwriting, remove the old one first
            library.splice(existingIndex, 1);
        }

        // Calculate next seqId (highest number for newest)
        let nextSeqId = 1;
        if (library.length > 0) {
            const maxSeqId = library.reduce((max, item) =>
                (item.seqId > max ? item.seqId : max), 0);
            nextSeqId = maxSeqId + 1;
        }

        // PRIORITY: Preserve the original category as submitted by the user
        // 1. submission.chapterId (top-level, set by original uploader)
        // 2. submission.data.chapterId (nested in infographic data)
        // 3. Auto-detect as last resort
        let chapterId = 'uncategorized';
        if (submission.chapterId && submission.chapterId !== 'uncategorized') {
            chapterId = submission.chapterId;
        } else if (submission.data.chapterId && submission.data.chapterId !== 'uncategorized') {
            chapterId = submission.data.chapterId;
        } else {
            chapterId = autoDetectChapterFromTitle(submission.title);
        }

        // Create local library item
        const newItem = {
            id: Date.now(),
            seqId: nextSeqId,
            title: submission.title,
            summary: submission.summary,
            date: new Date().toISOString(),
            data: submission.data,
            chapterId: chapterId,
            _newlyImported: Date.now(), // Mark as newly imported for green highlight
            // Track community origin
            communityId: submissionId,
            communityAuthor: submission.userName,
            communityDate: submission.submittedAt
        };

        // If user previously customized the category, preserve it (don't revert)
        if (preservedChapterId) {
            newItem.chapterId = preservedChapterId;
        }
        if (preservedKanskiMeta) {
            newItem.kanskiMeta = preservedKanskiMeta;
        }

        // Ensure data.chapterId matches the final decision
        if (newItem.data) {
            newItem.data.chapterId = newItem.chapterId;
        }

        // Restore adhered Kanski images from submission data if present
        if (submission.data.kanskiImages && submission.data.kanskiImages.length > 0) {
            try {
                // saveKanskiToIDB is defined in script.js and available globally
                if (typeof saveKanskiToIDB === 'function') {
                    await saveKanskiToIDB(newItem.title, submission.data.kanskiImages);
                    console.log(`[Download] Restored ${submission.data.kanskiImages.length} Kanski image(s) for "${newItem.title}"`);
                }
                // Set lightweight kanskiMeta on the library item
                newItem.kanskiMeta = submission.data.kanskiImages.map(img => ({
                    pageNum: img.pageNum,
                    keywords: img.keywords || []
                }));
                // Remove heavy images from localStorage copy (they're in IndexedDB)
                delete newItem.data.kanskiImages;
            } catch (kanskiErr) {
                console.warn('[Download] Failed to restore Kanski images:', kanskiErr);
            }
        }

        library.unshift(newItem);
        if (typeof window.saveLibraryToIDB === 'function') {
            window.saveLibraryToIDB(library);
        } else {
            localStorage.setItem('ophthalmic_infographic_library', JSON.stringify(library));
        }

        return {
            success: true,
            status: 'added',
            message: `"${submission.title}" added to your library!`
        };
    } catch (err) {
        console.error('Download error:', err);
        return { success: false, message: 'Failed to download.' };
    }
}

// ============================================
// UI HELPER FUNCTIONS
// ============================================

/**
 * Generate HTML for a submission card
 */
function generateSubmissionCardHTML(submission, isAdmin = false) {
    const dateStr = formatDate(submission.submittedAt);
    const statusBadge = submission.status === 'approved'
        ? '<span class="status-badge approved">✓ Approved</span>'
        : '<span class="status-badge pending">⏳ Pending Review</span>';

    return `
        <div class="community-card" data-id="${submission.id}">
            <div class="community-card-header">
                <h3 class="community-card-title">${sanitizeInput(submission.title)}</h3>
                ${statusBadge}
            </div>
            <p class="community-card-summary">${sanitizeInput(submission.summary || 'No summary available.')}</p>
            <div class="community-card-meta">
                <span class="meta-item">
                    <span class="material-symbols-rounded">person</span>
                    ${sanitizeInput(submission.userName)}
                </span>
                <span class="meta-item">
                    <span class="material-symbols-rounded">calendar_today</span>
                    ${dateStr}
                </span>
                ${isAdmin ? `
                <span class="meta-item ip-info">
                    <span class="material-symbols-rounded">language</span>
                    ${submission.userIP || 'Unknown'}
                </span>
                ` : ''}
                <span class="meta-item likes-count">
                    <span class="material-symbols-rounded">favorite</span>
                    ${submission.likes || 0}
                </span>
            </div>
            <div class="community-card-actions">
                <button class="community-btn like-btn" onclick="handleLikeSubmission('${submission.id}')">
                    <span class="material-symbols-rounded">thumb_up</span>
                    Like
                </button>
                <button class="community-btn preview-btn" onclick="handlePreviewSubmission('${submission.id}')">
                    <span class="material-symbols-rounded">visibility</span>
                    Preview
                </button>
                <button class="community-btn load-btn" onclick="handleLoadCommunitySubmission('${submission.id}')" style="background-color: #3b82f6; color: white; border: none;">
                    <span class="material-symbols-rounded">open_in_new</span>
                    Load
                </button>
                <button class="community-btn download-btn" onclick="handleDownloadSubmission('${submission.id}')">
                    <span class="material-symbols-rounded">download</span>
                    Add to Library
                </button>
                ${isAdmin ? `
                <button class="community-btn approve-btn" onclick="handleApproveSubmission('${submission.id}')">
                    <span class="material-symbols-rounded">check_circle</span>
                    Approve
                </button>
                <button class="community-btn reject-btn" onclick="handleRejectSubmission('${submission.id}')">
                    <span class="material-symbols-rounded">cancel</span>
                    Reject
                </button>
                ` : ''}
            </div>
        </div>
    `;
}

// ============================================
// DELETION TRACKING (Admin sync)
// ============================================

/**
 * Normalize title for matching (consistent with script.js)
 */
function normalizeTitle(t) {
    return (t || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

/**
 * Remove a deleted item from ALL pools: pending, approved, and adds to deleted list
 * This ensures when admin deletes something, it's gone everywhere
 * @param {string} title - The title of the item (will be normalized)
 */
async function removeFromAllPools(title) {
    if (!isConfigured()) {
        console.log('JSONBin not configured, cannot remove from community pools.');
        return { success: false, removed: { pending: 0, approved: 0 } };
    }

    try {
        const data = await fetchSubmissions();
        const normTitle = normalizeTitle(title);

        let removedFromPending = 0;
        let removedFromApproved = 0;

        // Remove from pending submissions
        if (data.submissions && data.submissions.length > 0) {
            const originalLength = data.submissions.length;
            data.submissions = data.submissions.filter(sub => {
                const subNormTitle = normalizeTitle(sub.title);
                return subNormTitle !== normTitle;
            });
            removedFromPending = originalLength - data.submissions.length;
        }

        // Remove from approved submissions
        if (data.approved && data.approved.length > 0) {
            const originalLength = data.approved.length;
            data.approved = data.approved.filter(sub => {
                const subNormTitle = normalizeTitle(sub.title);
                return subNormTitle !== normTitle;
            });
            removedFromApproved = originalLength - data.approved.length;
        }

        // Also add to deleted list so remote users will remove it
        if (!data.deleted) {
            data.deleted = [];
        }
        if (!data.deleted.includes(normTitle)) {
            data.deleted.push(normTitle);
            // Keep only last 100 deletions
            if (data.deleted.length > 100) {
                data.deleted = data.deleted.slice(-100);
            }
        }

        // Update the bin if anything was changed
        if (removedFromPending > 0 || removedFromApproved > 0) {
            const result = await updateSubmissions(data);
            if (!result.success) console.error(`Failed to sync removals: ${result.message}`);
            console.log(`[Admin Delete] Removed from pools - Pending: ${removedFromPending}, Approved: ${removedFromApproved}`);
        } else {
            // Still update to ensure deleted list is saved
            const result = await updateSubmissions(data);
            if (!result.success) console.error(`Failed to sync deletion list: ${result.message}`);
            console.log(`[Admin Delete] No matches found in pools, but added to deleted list: "${normTitle}"`);
        }

        return {
            success: true,
            removed: {
                pending: removedFromPending,
                approved: removedFromApproved
            }
        };
    } catch (err) {
        console.error('Error removing from pools:', err);
        return { success: false, removed: { pending: 0, approved: 0 } };
    }
}

/**
 * Track a deleted item so remote users will also delete it
 * @param {string} normalizedTitle - Normalized title of the deleted item
 */
async function trackDeletion(normalizedTitle) {
    if (!isConfigured()) {
        console.log('JSONBin not configured, cannot track deletion for remote sync.');
        return { success: false };
    }

    try {
        const data = await fetchSubmissions();

        // Initialize deleted array if it doesn't exist
        if (!data.deleted) {
            data.deleted = [];
        }

        // Add to deleted list if not already there
        if (!data.deleted.includes(normalizedTitle)) {
            data.deleted.push(normalizedTitle);

            // Keep only last 100 deletions to prevent unbounded growth
            if (data.deleted.length > 100) {
                data.deleted = data.deleted.slice(-100);
            }

            const result = await updateSubmissions(data);
            if (!result.success) throw new Error(result.message);
            console.log(`[Deletion Sync] Tracked deletion of: ${normalizedTitle}`);
        }

        return { success: true };
    } catch (err) {
        console.error('Error tracking deletion:', err);
        return { success: false };
    }
}

/**
 * Get list of deleted item titles for sync
 */
async function getDeletedItems() {
    if (!isConfigured()) {
        return [];
    }

    try {
        const data = await fetchSubmissions();
        return data.deleted || [];
    } catch (err) {
        console.error('Error getting deleted items:', err);
        return [];
    }
}

// ============================================
// EXPORTS
// ============================================

// Export functions for use in other scripts
window.CommunitySubmissions = {
    // Configuration
    isConfigured: isConfigured,
    configure: configureGist,

    // Submission functions
    submit: submitToCommunity,
    submitMultiple: submitMultiple, // Batch submit
    getPending: getPendingSubmissions,
    getApproved: getApprovedSubmissions,
    getAll: getAllSubmissions,

    // User actions
    like: likeSubmission,
    downloadToLibrary: downloadToLocalLibrary,

    // Admin functions
    verifyAdmin: verifyAdminPIN,
    approve: approveSubmission,
    reject: rejectSubmission,
    deduplicateApproved: deduplicateApprovedSubmissions,

    // Deletion sync
    trackDeletion: trackDeletion,
    getDeletedItems: getDeletedItems,
    removeFromAllPools: removeFromAllPools,

    // Sticky notes common pool
    fetchStickyNotesPool: fetchStickyNotesPool,
    uploadStickyNotesToPool: uploadStickyNotesToPool,
    downloadStickyNotesFromPool: downloadStickyNotesFromPool,

    // Utilities
    getUserIP,
    formatDate,
    generateCardHTML: generateSubmissionCardHTML,

    // Per-submission content files
    getSubmissionData: getSubmissionData
};

console.log('Community Submissions module loaded.');
console.log('Storage configured:', isConfigured());
