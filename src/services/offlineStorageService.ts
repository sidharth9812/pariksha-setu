import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  TestItem,
  QuestionItem,
  StudentAttempt,
  OfflineTestRecord,
  OfflineDownloadProgress,
} from '../types/exam';
import { getQuestionsForTest, getTestById, sanitizeForFirestore } from './examService';
import { recordUserExamSubmission } from './authService';

const DB_NAME = 'parikshasetu_offline_db';
const DB_VERSION = 1;

const STORE_TESTS = 'downloaded_tests';
const STORE_QUESTIONS = 'downloaded_questions';
const STORE_MEDIA = 'cached_media';
const STORE_ATTEMPTS = 'pending_attempts';

// In-memory progress tracking
const activeDownloads = new Map<string, OfflineDownloadProgress>();
const progressListeners = new Set<(progress: OfflineDownloadProgress) => void>();

export function subscribeToDownloadProgress(listener: (progress: OfflineDownloadProgress) => void): () => void {
  progressListeners.add(listener);
  return () => {
    progressListeners.delete(listener);
  };
}

function notifyProgress(progress: OfflineDownloadProgress) {
  activeDownloads.set(progress.testId, progress);
  progressListeners.forEach((l) => l(progress));
}

export function getActiveDownloadProgress(testId: string): OfflineDownloadProgress | undefined {
  return activeDownloads.get(testId);
}

/**
 * Open or upgrade IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported on this environment.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_TESTS)) {
        db.createObjectStore(STORE_TESTS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORE_QUESTIONS)) {
        const qStore = db.createObjectStore(STORE_QUESTIONS, { keyPath: 'id' });
        qStore.createIndex('testId', 'testId', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        db.createObjectStore(STORE_MEDIA, { keyPath: 'url' });
      }

      if (!db.objectStoreNames.contains(STORE_ATTEMPTS)) {
        const aStore = db.createObjectStore(STORE_ATTEMPTS, { keyPath: 'id' });
        aStore.createIndex('synced', 'synced', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open offline database'));
  });
}

/**
 * Perform a transaction in IndexedDB
 */
async function performTx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);

    let resultReq: IDBRequest<T> | void;
    try {
      resultReq = callback(store);
    } catch (err) {
      reject(err);
      return;
    }

    tx.oncomplete = () => {
      resolve(resultReq ? resultReq.result : (undefined as unknown as T));
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

/**
 * Cache an image asset locally as base64 / blob
 */
export async function cacheMediaAsset(url: string): Promise<string> {
  if (!url || !url.startsWith('http')) return url;

  try {
    // Check if already cached in IndexedDB
    const existing = await performTx<{ url: string; dataUrl: string; sizeBytes: number } | undefined>(
      STORE_MEDIA,
      'readonly',
      (store) => store.get(url)
    );

    if (existing && existing.dataUrl) {
      return existing.dataUrl;
    }

    // Attempt to fetch media
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'force-cache',
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Could not cache media ${url}: HTTP ${response.status}`);
      return url;
    }

    const blob = await response.blob();
    const sizeBytes = blob.size;

    // Convert to DataURL for immediate synchronous rendering offline
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Store in IndexedDB
    await performTx(STORE_MEDIA, 'readwrite', (store) => {
      store.put({
        url,
        dataUrl,
        sizeBytes,
        mimeType: blob.type,
        cachedAt: new Date().toISOString(),
      });
    });

    return dataUrl;
  } catch (err) {
    console.warn('Media caching warning (will fallback to direct URL):', err);
    return url;
  }
}

/**
 * Get cached image dataUrl if available, otherwise return original url
 */
export async function getCachedMediaUrl(originalUrl: string): Promise<string> {
  if (!originalUrl || !originalUrl.startsWith('http')) return originalUrl;

  try {
    const existing = await performTx<{ url: string; dataUrl: string } | undefined>(
      STORE_MEDIA,
      'readonly',
      (store) => store.get(originalUrl)
    );

    if (existing && existing.dataUrl) {
      return existing.dataUrl;
    }
  } catch {
    // ignore
  }

  return originalUrl;
}

/**
 * Check if a practice test is downloaded for offline use
 */
export async function isTestDownloaded(testId: string): Promise<boolean> {
  try {
    const record = await performTx<OfflineTestRecord | undefined>(
      STORE_TESTS,
      'readonly',
      (store) => store.get(testId)
    );
    return Boolean(record);
  } catch {
    // Fallback to localStorage check
    try {
      const flag = localStorage.getItem(`pariksha_offline_${testId}`);
      return flag === 'true';
    } catch {
      return false;
    }
  }
}

/**
 * Get all tests downloaded for offline practice
 */
export async function getDownloadedTests(): Promise<OfflineTestRecord[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TESTS, 'readonly');
      const store = tx.objectStore(STORE_TESTS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * Get downloaded questions for an offline practice test
 */
export async function getDownloadedQuestions(testId: string): Promise<QuestionItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUESTIONS, 'readonly');
      const store = tx.objectStore(STORE_QUESTIONS);
      const index = store.index('testId');
      const req = index.getAll(testId);
      req.onsuccess = () => {
        const list = (req.result || []) as QuestionItem[];
        list.sort((a, b) => a.questionNumber - b.questionNumber);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback to local storage cache if available
    try {
      const raw = localStorage.getItem('pariksha_questions_cache');
      if (raw) {
        const map = JSON.parse(raw);
        return map[testId] || [];
      }
    } catch {}
    return [];
  }
}

/**
 * Download a practice test completely for offline use
 * Includes questions, options, images, scoring parameters, and instructions.
 */
export async function downloadPracticeTestForOffline(
  test: TestItem,
  onProgress?: (percent: number, msg: string) => void
): Promise<void> {
  const testId = test.id;

  const update = (pct: number, msg: string, err: string | null = null) => {
    const p: OfflineDownloadProgress = {
      testId,
      isDownloading: pct < 100 && !err,
      percent: pct,
      statusMessage: msg,
      error: err,
    };
    notifyProgress(p);
    if (onProgress) onProgress(pct, msg);
  };

  try {
    update(5, 'Connecting and fetching test details...');

    // 1. Fetch complete questions (with answers for offline practice evaluation)
    const questions = await getQuestionsForTest(testId, 'admin');

    if (!questions || questions.length === 0) {
      throw new Error('This test has no questions available to download.');
    }

    update(25, `Loaded ${questions.length} questions. Caching questions data...`);

    // 2. Save questions to IndexedDB
    const db = await openDB();
    const qTx = db.transaction(STORE_QUESTIONS, 'readwrite');
    const qStore = qTx.objectStore(STORE_QUESTIONS);

    for (const q of questions) {
      qStore.put({
        ...q,
        testId,
      });
    }

    await new Promise((resolve, reject) => {
      qTx.oncomplete = resolve;
      qTx.onerror = reject;
    });

    update(40, 'Checking diagrams and question media...');

    // 3. Collect media URLs to cache
    const mediaUrls: string[] = [];
    questions.forEach((q) => {
      if (q.questionImageUrl) mediaUrls.push(q.questionImageUrl);
      if (q.imageUrl) mediaUrls.push(q.imageUrl);
      if (q.optionImages) {
        if (q.optionImages.A?.imageUrl) mediaUrls.push(q.optionImages.A.imageUrl);
        if (q.optionImages.B?.imageUrl) mediaUrls.push(q.optionImages.B.imageUrl);
        if (q.optionImages.C?.imageUrl) mediaUrls.push(q.optionImages.C.imageUrl);
        if (q.optionImages.D?.imageUrl) mediaUrls.push(q.optionImages.D.imageUrl);
      }
    });

    const uniqueMediaUrls = Array.from(new Set(mediaUrls.filter(Boolean)));
    let cachedMediaCount = 0;
    let approxMediaBytes = 0;

    if (uniqueMediaUrls.length > 0) {
      const stepPct = 45 / uniqueMediaUrls.length;
      for (let i = 0; i < uniqueMediaUrls.length; i++) {
        const mUrl = uniqueMediaUrls[i];
        update(
          Math.min(90, Math.round(45 + i * stepPct)),
          `Downloading image ${i + 1} of ${uniqueMediaUrls.length}...`
        );
        try {
          const cachedDataUrl = await cacheMediaAsset(mUrl);
          if (cachedDataUrl && cachedDataUrl.startsWith('data:')) {
            cachedMediaCount++;
            approxMediaBytes += cachedDataUrl.length;
          }
        } catch {
          // ignore individual media failure; continue saving test
        }
      }
    }

    update(92, 'Finalizing offline test package...');

    // 4. Save OfflineTestRecord
    const record: OfflineTestRecord = {
      id: test.id,
      title: test.title,
      examCategory: test.examCategory,
      durationMinutes: test.durationMinutes,
      totalQuestions: questions.length,
      marksPerQuestion: test.marksPerQuestion ?? 1,
      negativeMarks: test.negativeMarks ?? 0.25,
      instructions: test.instructions || '',
      syllabus: test.syllabus || '',
      accessCode: test.accessCode || '',
      seriesTitle: test.seriesTitle || '',
      downloadedAt: new Date().toISOString(),
      questionsCount: questions.length,
      mediaCount: cachedMediaCount,
      approxSizeBytes: approxMediaBytes + questions.length * 1024,
      status: test.status,
    };

    await performTx(STORE_TESTS, 'readwrite', (store) => {
      store.put(record);
    });

    // Also set flag in localStorage as fast fallback
    try {
      localStorage.setItem(`pariksha_offline_${testId}`, 'true');
    } catch {}

    update(100, 'Available Offline');

    // Dispatch global event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pariksha_offline_tests_updated', { detail: { testId } }));
    }
  } catch (err: any) {
    console.error('Offline test download error:', err);
    update(0, err.message || 'Download failed', err.message || 'Download failed');
    throw err;
  }
}

/**
 * Remove / Delete a downloaded offline practice test to free storage
 */
export async function deleteDownloadedTest(testId: string): Promise<void> {
  try {
    const db = await openDB();

    // 1. Delete record from STORE_TESTS
    const tTx = db.transaction(STORE_TESTS, 'readwrite');
    tTx.objectStore(STORE_TESTS).delete(testId);
    await new Promise((resolve) => {
      tTx.oncomplete = resolve;
      tTx.onerror = resolve;
    });

    // 2. Delete all questions for this test
    const qTx = db.transaction(STORE_QUESTIONS, 'readwrite');
    const qStore = qTx.objectStore(STORE_QUESTIONS);
    const index = qStore.index('testId');
    const req = index.getAllKeys(testId);

    req.onsuccess = () => {
      const keys = req.result;
      keys.forEach((k) => qStore.delete(k));
    };

    await new Promise((resolve) => {
      qTx.oncomplete = resolve;
      qTx.onerror = resolve;
    });

    // Clean fast flag
    try {
      localStorage.removeItem(`pariksha_offline_${testId}`);
    } catch {}

    activeDownloads.delete(testId);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pariksha_offline_tests_updated', { detail: { testId } }));
    }
  } catch (err) {
    console.error('Failed to delete offline test:', err);
  }
}

/**
 * Save an offline practice attempt locally with pending sync status
 */
export async function saveOfflineAttempt(attempt: StudentAttempt): Promise<void> {
  const offlineAttempt: StudentAttempt = {
    ...attempt,
    isOffline: true,
    synced: false,
  };

  try {
    await performTx(STORE_ATTEMPTS, 'readwrite', (store) => {
      store.put(offlineAttempt);
    });
  } catch (err) {
    console.warn('Failed to save attempt to IndexedDB, fallback to localStorage:', err);
  }

  // Backup in localStorage
  try {
    const pendingKey = 'pariksha_pending_offline_attempts';
    const raw = localStorage.getItem(pendingKey);
    const list: StudentAttempt[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((a) => a.id !== offlineAttempt.id);
    localStorage.setItem(pendingKey, JSON.stringify([offlineAttempt, ...filtered]));

    // Also update general attempts cache
    const allAttemptsRaw = localStorage.getItem('pariksha_attempts_cache');
    const allList: StudentAttempt[] = allAttemptsRaw ? JSON.parse(allAttemptsRaw) : [];
    const allFiltered = allList.filter((a) => a.id !== offlineAttempt.id);
    localStorage.setItem('pariksha_attempts_cache', JSON.stringify([offlineAttempt, ...allFiltered]));
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pariksha_offline_attempts_changed', { detail: offlineAttempt }));
  }
}

/**
 * Get all offline attempts that have not yet synced to Firestore
 */
export async function getPendingOfflineAttempts(): Promise<StudentAttempt[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_ATTEMPTS, 'readonly');
      const store = tx.objectStore(STORE_ATTEMPTS);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result || []) as StudentAttempt[];
        resolve(all.filter((a) => a.synced !== true));
      };
      req.onerror = () => {
        // Fallback to localStorage
        try {
          const raw = localStorage.getItem('pariksha_pending_offline_attempts');
          resolve(raw ? JSON.parse(raw) : []);
        } catch {
          resolve([]);
        }
      };
    });
  } catch {
    try {
      const raw = localStorage.getItem('pariksha_pending_offline_attempts');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

/**
 * Synchronize all pending offline attempts to Firestore
 */
export async function syncPendingOfflineAttempts(): Promise<{
  syncedCount: number;
  failedCount: number;
}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { syncedCount: 0, failedCount: 0 };
  }

  const pending = await getPendingOfflineAttempts();
  if (pending.length === 0) {
    return { syncedCount: 0, failedCount: 0 };
  }

  let syncedCount = 0;
  let failedCount = 0;

  for (const att of pending) {
    try {
      const syncedNow = new Date().toISOString();
      const updatedAttempt: StudentAttempt = {
        ...att,
        synced: true,
        syncedAt: syncedNow,
      };

      // 1. Write to Firestore 'attempts' collection
      await setDoc(doc(db, 'attempts', att.id), sanitizeForFirestore(updatedAttempt), { merge: true });

      // 2. Update user profile record if student email/ID is available
      try {
        await recordUserExamSubmission({
          userId: att.studentId,
          testId: att.testId,
          finalScore: att.finalScore,
          percentage: att.percentage,
        });
      } catch {
        // non-blocking
      }

      // 3. Mark synced in IndexedDB
      try {
        await performTx(STORE_ATTEMPTS, 'readwrite', (store) => {
          store.put(updatedAttempt);
        });
      } catch {}

      // 4. Update in localStorage caches
      try {
        const pendingKey = 'pariksha_pending_offline_attempts';
        const raw = localStorage.getItem(pendingKey);
        if (raw) {
          const list: StudentAttempt[] = JSON.parse(raw);
          const remaining = list.filter((a) => a.id !== att.id);
          localStorage.setItem(pendingKey, JSON.stringify(remaining));
        }

        const allRaw = localStorage.getItem('pariksha_attempts_cache');
        if (allRaw) {
          const allList: StudentAttempt[] = JSON.parse(allRaw);
          const next = allList.map((a) => (a.id === att.id ? updatedAttempt : a));
          localStorage.setItem('pariksha_attempts_cache', JSON.stringify(next));
        }
      } catch {}

      syncedCount++;
    } catch (err) {
      console.warn('Failed to sync attempt to server:', att.id, err);
      failedCount++;
    }
  }

  if (syncedCount > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('pariksha_offline_attempts_synced', {
        detail: { syncedCount, failedCount },
      })
    );
  }

  return { syncedCount, failedCount };
}

// Auto-sync whenever internet connectivity returns
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    // Delay slightly to ensure reliable connectivity handshake
    setTimeout(() => {
      syncPendingOfflineAttempts().catch(() => {});
    }, 2000);
  });
}
