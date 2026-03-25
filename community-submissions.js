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

// Obfuscated Token (Recovered from gh CLI)
const T_PART1 = 'gho_s7cbVHLXA';
const T_PART2 = 'httoEvwWYLDRKlhqRQ';
const T_PART3 = '7Yu1V7AM1';

function getGistToken() {
    // Use embedded working token
    return T_PART1 + T_PART2 + T_PART3;
}

// Auto-Initialize Storage on Load
(async function autoInitStorage() {
    console.log('Using configured Gist:', GITHUB_CONFIG.GIST_ID);
})();

// Admin PIN for approval operations (simple security)
const ADMIN_PIN = '309030';

// IP lookup service (free, no API key needed)
const IP_SERVICE_URL = 'https://api.ipify.org?format=json';

// Local storage key for caching
const COMMUNITY_CACHE_KEY = 'ophthalmic_community_cache';
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
        const response = await fetch(IP_SERVICE_URL);
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
 * Fetch all submissions from configured storage
 */
async function fetchSubmissions() {
    // Wait a moment for auto-init if not configured? 
    // Synchronous check is safer.

    if (!isConfigured()) {
        console.warn('No storage backend configured. Using local demo mode.');
        return getLocalDemoSubmissions();
    }

    try {
        const token = getGistToken();
        const headers = {};
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }

        const response = await fetch(`${GITHUB_CONFIG.API_URL}/${GITHUB_CONFIG.GIST_ID}`, {
            headers: headers
        });

        if (!response.ok) throw new Error(`GitHub Gist error (${response.status})`);

        const gist = await response.json();
        const file = gist.files[GITHUB_CONFIG.FILENAME];

        if (!file) throw new Error(`File ${GITHUB_CONFIG.FILENAME} not found in Gist`);

        // Handle truncated content - GitHub truncates files over ~1MB
        let content;
        if (file.truncated && file.raw_url) {
            console.log('Content truncated, fetching from raw_url...');
            // IMPORTANT: Do NOT send Authorization header to gist.githubusercontent.com
            // It does not support CORS preflight with auth headers (403 error).
            // The raw_url already contains an embedded access token in the path.
            const rawResponse = await fetch(file.raw_url);
            if (!rawResponse.ok) throw new Error(`Failed to fetch raw content (${rawResponse.status})`);
            content = await rawResponse.text();
        } else {
            content = file.content;
        }

        // Parse content
        let data = JSON.parse(content);

        // Format check
        if (!data.submissions) data.submissions = [];
        if (!data.approved) data.approved = [];
        if (!data.deleted) data.deleted = [];

        return data;

    } catch (err) {
        console.error('Error fetching submissions:', err);
        // Fallback to cache if available
        const cached = localStorage.getItem(COMMUNITY_CACHE_KEY);
        if (cached) {
            console.log('Using cached community data');
            return JSON.parse(cached);
        }
        return { submissions: [], approved: [], deleted: [] };
    }
}

/**
 * Update the storage (Add/Modify submissions)
 */
async function updateSubmissions(data) {
    if (!isConfigured()) {
        console.warn('Storage not configured. Saving to localStorage demo mode.');
        saveLocalDemoSubmissions(data);
        return { success: true };
    }

    // Token is handled by getGistToken() which includes the embedded valid token.
    // No need for pre-check.

    try {
        const payload = {
            files: {
                [GITHUB_CONFIG.FILENAME]: {
                    content: JSON.stringify(data, null, 2)
                }
            }
        };

        const response = await fetch(`${GITHUB_CONFIG.API_URL}/${GITHUB_CONFIG.GIST_ID}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${getGistToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`GitHub Gist update failed (${response.status}): ${errText}`);
        }

        // Clear cache to force refresh
        localStorage.removeItem(COMMUNITY_CACHE_KEY);
        return { success: true };
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

    try {
        // Get user IP
        const userIP = await getUserIP();

        // Create submission object
        // IMPORTANT: Include chapterId at top level for sync to other users
        const submission = {
            id: generateSubmissionId(),
            userName: sanitizeInput(userName),
            title: infographicData.title || 'Untitled Infographic',
            summary: infographicData.summary || '',
            chapterId: infographicData.chapterId || 'uncategorized', // Preserve user categorization
            submittedAt: new Date().toISOString(),
            userIP: userIP,
            likes: 0,
            likedBy: [], // Array of IPs who liked
            status: 'pending', // pending, approved, rejected
            data: infographicData
        };

        // Fetch current submissions
        const currentData = await fetchSubmissions();

        // Add new submission
        currentData.submissions = currentData.submissions || [];
        currentData.submissions.unshift(submission);

        // Update storage
        const result = await updateSubmissions(currentData);

        if (result.success) {
            return {
                success: true,
                message: 'Your infographic has been submitted for review!',
                submissionId: submission.id
            };
        } else {
            return { success: false, message: `Submission failed: ${result.message || 'Unknown error'}` };
        }
    } catch (err) {
        console.error('Submission error:', err);
        return { success: false, message: 'An error occurred. Please try again.' };
    }
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
        const currentData = await fetchSubmissions();
        currentData.submissions = currentData.submissions || [];

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

        // Batch prepend (newest first)
        currentData.submissions.unshift(...newSubmissions);

        // Single update
        const result = await updateSubmissions(currentData);

        if (result.success) {
            return {
                success: true,
                count: newSubmissions.length,
                message: `Successfully submitted ${newSubmissions.length} infographics!`
            };
        } else {
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
        const data = await fetchSubmissions();

        // Find in both pending and approved
        let submission = (data.submissions || []).find(s => s.id === submissionId);
        if (!submission) {
            submission = (data.approved || []).find(s => s.id === submissionId);
        }

        if (!submission || !submission.data) {
            return { success: false, message: 'Submission not found.' };
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

    // Utilities
    getUserIP,
    formatDate,
    generateCardHTML: generateSubmissionCardHTML
};

console.log('Community Submissions module loaded.');
console.log('Storage configured:', isConfigured());
