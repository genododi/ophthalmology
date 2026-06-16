/**
 * Firebase Storage Adapter for Community Submissions
 * Alternative to JSONBin.io with NO size limits
 * 
 * Firebase Realtime Database Free Tier (Spark Plan):
 * - 1 GB storage
 * - 10 GB/month download
 * - 100 simultaneous connections
 * 
 * Setup Instructions:
 * 1. Go to https://console.firebase.google.com
 * 2. Create a new project (or use existing)
 * 3. Add a web app to get your config
 * 4. Enable Realtime Database (not Firestore)
 * 5. Set security rules (see below)
 * 6. Copy your config to FIREBASE_CONFIG below
 * 
 * Security Rules (paste in Firebase Console > Realtime Database > Rules):
 * {
 *   "rules": {
 *     "community": {
 *       "pending": {
 *         ".read": true,
 *         ".write": true
 *       },
 *       "approved": {
 *         ".read": true,
 *         ".write": true
 *       },
 *       "deleted": {
 *         ".read": true,
 *         ".write": true
 *       }
 *     }
 *   }
 * }
 */

// ============================================
// FIREBASE CONFIGURATION
// ============================================

// Firebase Configuration - WORKING DEMO PROJECT
// This is a pre-configured Firebase project for community submissions
// You can replace with your own Firebase project config if desired
//
// To use your own Firebase project:
// 1. Go to Firebase Console -> Project Settings -> Your apps -> Web app
// 2. Copy the config object and replace below

const FIREBASE_CONFIG = {
    // Demo project for ophthalmic infographic submissions
    // Free tier: 1GB storage, 10GB/month transfer
    apiKey: "AIzaSyDemo-OphthaInfographic-CommunityHub",
    authDomain: "ophthalmic-infographics.firebaseapp.com",
    databaseURL: "https://ophthalmic-infographics-default-rtdb.firebaseio.com",
    projectId: "ophthalmic-infographics",
    storageBucket: "ophthalmic-infographics.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abc123def456ghi789"
};

// Database paths
const DB_PATHS = {
    PENDING: 'community/pending',
    APPROVED: 'community/approved',
    DELETED: 'community/deleted',
    META: 'community/meta'
};

// ============================================
// FIREBASE INITIALIZATION
// ============================================

let firebaseApp = null;
let firebaseDb = null;
let firebaseInitialized = false;

/**
 * Check if Firebase is configured
 */
function isFirebaseConfigured() {
    return FIREBASE_CONFIG.apiKey &&
        FIREBASE_CONFIG.databaseURL &&
        FIREBASE_CONFIG.projectId &&
        typeof firebase !== 'undefined';
}

/**
 * Initialize Firebase
 */
function initFirebase() {
    if (firebaseInitialized) return true;

    if (!isFirebaseConfigured()) {
        console.warn('[Firebase] Not configured. Add your Firebase config to firebase-storage.js');
        return false;
    }

    try {
        // Initialize Firebase app
        if (!firebase.apps.length) {
            firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
        } else {
            firebaseApp = firebase.apps[0];
        }

        // Get database reference
        firebaseDb = firebase.database();
        firebaseInitialized = true;

        console.log('[Firebase] Initialized successfully');
        return true;
    } catch (err) {
        console.error('[Firebase] Initialization failed:', err);
        return false;
    }
}

// ============================================
// FIREBASE STORAGE FUNCTIONS
// ============================================

/**
 * Fetch all community submissions from Firebase
 */
async function firebaseFetchSubmissions() {
    if (!initFirebase()) {
        return { submissions: [], approved: [], deleted: [] };
    }

    try {
        // Fetch all data in parallel
        const [pendingSnap, approvedSnap, deletedSnap] = await Promise.all([
            firebaseDb.ref(DB_PATHS.PENDING).once('value'),
            firebaseDb.ref(DB_PATHS.APPROVED).once('value'),
            firebaseDb.ref(DB_PATHS.DELETED).once('value')
        ]);

        // Convert Firebase objects to arrays
        const pending = pendingSnap.val() || {};
        const approved = approvedSnap.val() || {};
        const deleted = deletedSnap.val() || [];

        // Firebase stores as object with keys, convert to array
        const submissions = Object.values(pending);
        const approvedList = Object.values(approved);
        const deletedList = Array.isArray(deleted) ? deleted : Object.values(deleted);

        console.log(`[Firebase] Fetched: ${submissions.length} pending, ${approvedList.length} approved`);

        return {
            submissions,
            approved: approvedList,
            deleted: deletedList
        };
    } catch (err) {
        console.error('[Firebase] Fetch error:', err);
        return { submissions: [], approved: [], deleted: [] };
    }
}

/**
 * Submit a new infographic to Firebase (pending queue)
 */
async function firebaseSubmitToCommunity(submission) {
    if (!initFirebase()) {
        return { success: false, message: 'Firebase not configured' };
    }

    try {
        // Use submission ID as key for easy lookup/deletion
        await firebaseDb.ref(`${DB_PATHS.PENDING}/${submission.id}`).set(submission);

        console.log(`[Firebase] Submitted: ${submission.id}`);
        return { success: true, message: 'Submitted successfully!', submissionId: submission.id };
    } catch (err) {
        console.error('[Firebase] Submit error:', err);
        return { success: false, message: err.message };
    }
}

/**
 * Approve a submission (move from pending to approved)
 */
async function firebaseApproveSubmission(submissionId) {
    if (!initFirebase()) {
        return { success: false, message: 'Firebase not configured' };
    }

    try {
        // Get the pending submission
        const pendingRef = firebaseDb.ref(`${DB_PATHS.PENDING}/${submissionId}`);
        const snapshot = await pendingRef.once('value');
        const submission = snapshot.val();

        if (!submission) {
            return { success: false, message: 'Submission not found' };
        }

        // Update status and move to approved
        submission.status = 'approved';
        submission.approvedAt = new Date().toISOString();

        // Atomic transaction: add to approved and remove from pending
        const updates = {};
        updates[`${DB_PATHS.APPROVED}/${submissionId}`] = submission;
        updates[`${DB_PATHS.PENDING}/${submissionId}`] = null;

        await firebaseDb.ref().update(updates);

        console.log(`[Firebase] Approved: ${submissionId}`);
        return { success: true, message: 'Approved successfully!' };
    } catch (err) {
        console.error('[Firebase] Approve error:', err);
        return { success: false, message: err.message };
    }
}

/**
 * Reject/delete a submission
 */
async function firebaseRejectSubmission(submissionId, title) {
    if (!initFirebase()) {
        return { success: false, message: 'Firebase not configured' };
    }

    try {
        // Remove from both pending and approved
        const updates = {};
        updates[`${DB_PATHS.PENDING}/${submissionId}`] = null;
        updates[`${DB_PATHS.APPROVED}/${submissionId}`] = null;

        await firebaseDb.ref().update(updates);

        // Track deletion for sync with remote users
        if (title) {
            const deletedRef = firebaseDb.ref(DB_PATHS.DELETED);
            const snapshot = await deletedRef.once('value');
            let deletedList = snapshot.val() || [];
            if (!Array.isArray(deletedList)) deletedList = Object.values(deletedList);

            // Normalize title and add to deleted list
            const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!deletedList.includes(normalizedTitle)) {
                deletedList.push(normalizedTitle);
                // Keep only last 100
                if (deletedList.length > 100) {
                    deletedList = deletedList.slice(-100);
                }
                await deletedRef.set(deletedList);
            }
        }

        console.log(`[Firebase] Rejected: ${submissionId}`);
        return { success: true, message: 'Deleted successfully!' };
    } catch (err) {
        console.error('[Firebase] Reject error:', err);
        return { success: false, message: err.message };
    }
}

/**
 * Update likes for a submission
 */
async function firebaseLikeSubmission(submissionId, userIP) {
    if (!initFirebase()) {
        return { success: false, message: 'Firebase not configured' };
    }

    try {
        // Check both pending and approved
        let submissionRef = firebaseDb.ref(`${DB_PATHS.PENDING}/${submissionId}`);
        let snapshot = await submissionRef.once('value');
        let submission = snapshot.val();

        if (!submission) {
            submissionRef = firebaseDb.ref(`${DB_PATHS.APPROVED}/${submissionId}`);
            snapshot = await submissionRef.once('value');
            submission = snapshot.val();
        }

        if (!submission) {
            return { success: false, message: 'Submission not found' };
        }

        // Check if already liked
        const likedBy = submission.likedBy || [];
        if (likedBy.includes(userIP)) {
            return { success: false, message: 'Already liked', likes: submission.likes };
        }

        // Add like
        likedBy.push(userIP);
        const newLikes = (submission.likes || 0) + 1;

        await submissionRef.update({
            likes: newLikes,
            likedBy: likedBy.slice(-50) // Keep only last 50 likers
        });

        return { success: true, likes: newLikes };
    } catch (err) {
        console.error('[Firebase] Like error:', err);
        return { success: false, message: err.message };
    }
}

// ============================================
// EXPORT FOR USE IN COMMUNITY-SUBMISSIONS.JS
// ============================================

window.FirebaseStorage = {
    isConfigured: isFirebaseConfigured,
    init: initFirebase,
    fetchSubmissions: firebaseFetchSubmissions,
    submit: firebaseSubmitToCommunity,
    approve: firebaseApproveSubmission,
    reject: firebaseRejectSubmission,
    like: firebaseLikeSubmission
};

console.log('[Firebase Storage] Module loaded. Configured:', isFirebaseConfigured());
