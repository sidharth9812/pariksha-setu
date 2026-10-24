import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  TestSeries,
  TestItem,
  QuestionItem,
  ExamSession,
  StudentAttempt,
  InstituteSettings,
  TestStatus,
  StudentExamStatus,
  ActivityLogEntry,
} from '../types/exam';
import {
  INITIAL_SERIES,
  INITIAL_TESTS,
  INITIAL_QUESTIONS_MP_POLICE,
  DEFAULT_INSTITUTE_SETTINGS,
} from '../data/mockExamData';
import { recordUserExamSubmission } from './authService';

// Local storage backup keys
const LOCAL_SERIES_KEY = 'pariksha_series_cache';
const LOCAL_TESTS_KEY = 'pariksha_tests_cache';
const LOCAL_QUESTIONS_KEY = 'pariksha_questions_cache';
const LOCAL_ATTEMPTS_KEY = 'pariksha_attempts_cache';
const LOCAL_SETTINGS_KEY = 'pariksha_settings_cache';
const LOCAL_SESSIONS_KEY = 'pariksha_sessions_cache';

// BroadcastChannel for cross-tab instant local sync
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('pariksha_realtime_channel');
  }
} catch {
  // ignore if not supported
}

function broadcastEvent(type: string, payload: any) {
  try {
    broadcastChannel?.postMessage({ type, payload });
  } catch {
    // ignore
  }
}

// Helpers for localStorage caching
function getLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore
  }
}

/**
 * Recursively strips undefined fields from an object so Firestore setDoc / updateDoc
 * never throws: "Unsupported field value: undefined".
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as any;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as any;
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

/**
 * Normalizes an exam access code or URL parameter
 */
export function normalizeCode(str: string): string {
  if (!str) return '';
  let s = str.trim();
  try {
    s = decodeURIComponent(s).trim();
  } catch {}
  if (s.startsWith('?exam=')) s = s.slice(6);
  else if (s.startsWith('exam=')) s = s.slice(5);
  else if (s.startsWith('?test=')) s = s.slice(6);
  else if (s.startsWith('test=')) s = s.slice(5);
  else if (s.startsWith('?code=')) s = s.slice(6);
  else if (s.startsWith('code=')) s = s.slice(5);
  if (s.startsWith('#')) s = s.slice(1);
  return s.trim();
}

/* =========================================================
   INSTITUTE SETTINGS
========================================================= */

export async function getInstituteSettings(): Promise<InstituteSettings> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'general'));
    if (snap.exists()) {
      const data = snap.data() as InstituteSettings;
      setLocal(LOCAL_SETTINGS_KEY, data);
      return data;
    }
  } catch (err) {
    console.warn('Firestore settings fetch fallback:', err);
  }
  return getLocal<InstituteSettings>(LOCAL_SETTINGS_KEY, DEFAULT_INSTITUTE_SETTINGS);
}

export async function saveInstituteSettings(settings: InstituteSettings): Promise<void> {
  setLocal(LOCAL_SETTINGS_KEY, settings);
  try {
    await setDoc(doc(db, 'settings', 'general'), {
      ...settings,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Firestore settings save fallback:', err);
  }
  broadcastEvent('SETTINGS_UPDATED', settings);
}

/* =========================================================
   TEST SERIES
========================================================= */

export async function getSeriesList(): Promise<TestSeries[]> {
  try {
    const snap = await getDocs(collection(db, 'testSeries'));
    if (!snap.empty) {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TestSeries));
      setLocal(LOCAL_SERIES_KEY, list);
      return list;
    }
  } catch (err) {
    console.warn('Firestore testSeries fetch fallback:', err);
  }
  return getLocal<TestSeries[]>(LOCAL_SERIES_KEY, []);
}

export async function createSeries(data: Omit<TestSeries, 'id' | 'createdAt'>): Promise<TestSeries> {
  const id = `series-${Date.now()}`;
  const newSeries: TestSeries = {
    ...data,
    id,
    createdAt: new Date().toISOString(),
  };

  const list = getLocal<TestSeries[]>(LOCAL_SERIES_KEY, []);
  const updated = [newSeries, ...list];
  setLocal(LOCAL_SERIES_KEY, updated);

  try {
    await setDoc(doc(db, 'testSeries', id), sanitizeForFirestore(newSeries));
  } catch (err) {
    console.warn('Firestore createSeries fallback:', err);
  }

  broadcastEvent('SERIES_UPDATED', updated);
  return newSeries;
}

export async function updateSeries(id: string, updates: Partial<TestSeries>): Promise<void> {
  const list = getLocal<TestSeries[]>(LOCAL_SERIES_KEY, []);
  const updated = list.map((s) => (s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s));
  setLocal(LOCAL_SERIES_KEY, updated);

  try {
    await updateDoc(doc(db, 'testSeries', id), sanitizeForFirestore({
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('Firestore updateSeries fallback:', err);
  }

  broadcastEvent('SERIES_UPDATED', updated);
}

export async function deleteSeries(id: string): Promise<void> {
  const list = getLocal<TestSeries[]>(LOCAL_SERIES_KEY, []);
  const filtered = list.filter((s) => s.id !== id);
  setLocal(LOCAL_SERIES_KEY, filtered);

  try {
    await deleteDoc(doc(db, 'testSeries', id));
  } catch (err) {
    console.warn('Firestore deleteSeries fallback:', err);
  }

  broadcastEvent('SERIES_UPDATED', filtered);
}

/* =========================================================
   TESTS
========================================================= */

export async function getTests(seriesId?: string): Promise<TestItem[]> {
  try {
    const snap = await getDocs(collection(db, 'tests'));
    if (!snap.empty) {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TestItem));
      setLocal(LOCAL_TESTS_KEY, list);
      return seriesId ? list.filter((t) => t.seriesId === seriesId) : list;
    } else {
      // If Firestore has 0 tests, check if local storage has any unsynced tests
      const cached = getLocal<TestItem[]>(LOCAL_TESTS_KEY, []);
      if (cached.length > 0) {
        // Sync them to Firestore
        for (const t of cached) {
          try {
            await setDoc(doc(db, 'tests', t.id), sanitizeForFirestore(t));
          } catch {}
        }
        return seriesId ? cached.filter((t) => t.seriesId === seriesId) : cached;
      }
      return [];
    }
  } catch (err) {
    console.warn('Firestore tests fetch fallback:', err);
  }

  const cached = getLocal<TestItem[]>(LOCAL_TESTS_KEY, []);
  return seriesId ? cached.filter((t) => t.seriesId === seriesId) : cached;
}

export async function getTestById(testId: string): Promise<TestItem | null> {
  if (!testId) return null;
  try {
    const snap = await getDoc(doc(db, 'tests', testId));
    if (snap.exists()) {
      const test = { id: snap.id, ...snap.data() } as TestItem;
      // Sync local cache
      const list = getLocal<TestItem[]>(LOCAL_TESTS_KEY, []);
      const updated = list.some((t) => t.id === testId)
        ? list.map((t) => (t.id === testId ? test : t))
        : [test, ...list];
      setLocal(LOCAL_TESTS_KEY, updated);
      return test;
    }
  } catch (err) {
    console.warn('Firestore getTestById fallback:', err);
  }

  const cached = getLocal<TestItem[]>(LOCAL_TESTS_KEY, []);
  const found = cached.find((t) => t.id === testId);
  if (found) return found;

  // Check downloaded offline tests
  try {
    const { getDownloadedTests } = await import('./offlineStorageService');
    const offlineList = await getDownloadedTests();
    const match = offlineList.find((ot) => ot.id === testId);
    if (match) {
      return {
        id: match.id,
        seriesId: '',
        title: match.title,
        description: match.instructions || '',
        examCategory: match.examCategory,
        totalQuestions: match.totalQuestions,
        durationMinutes: match.durationMinutes,
        marksPerQuestion: match.marksPerQuestion,
        negativeMarks: match.negativeMarks,
        instantResult: true,
        status: match.status || 'released',
        accessCode: match.accessCode || '',
        accessPassword: '',
        instructions: match.instructions,
        syllabus: match.syllabus,
        createdAt: match.downloadedAt,
      };
    }
  } catch {}

  return null;
}

export async function getTestByAccessCode(accessCodeOrId: string): Promise<TestItem | null> {
  if (!accessCodeOrId) return null;
  const clean = normalizeCode(accessCodeOrId);
  if (!clean) return null;
  const cleanUpper = clean.toUpperCase();
  const cleanAlphaNum = cleanUpper.replace(/[^A-Z0-9]/g, '');

  const matchesTest = (t: TestItem) => {
    if (!t) return false;
    const testId = (t.id || '').trim();
    const testIdUpper = testId.toUpperCase();
    const code = (t.accessCode || '').trim();
    const codeUpper = code.toUpperCase();
    const codeAlphaNum = codeUpper.replace(/[^A-Z0-9]/g, '');

    return (
      testId === clean ||
      testIdUpper === cleanUpper ||
      codeUpper === cleanUpper ||
      code === clean ||
      (cleanAlphaNum.length >= 3 && codeAlphaNum === cleanAlphaNum) ||
      (cleanAlphaNum.length >= 3 && testIdUpper.replace(/[^A-Z0-9]/g, '') === cleanAlphaNum)
    );
  };

  // 1. Direct document ID in Firestore
  try {
    const directDoc = await getDoc(doc(db, 'tests', clean));
    if (directDoc.exists()) {
      const data = { id: directDoc.id, ...directDoc.data() } as TestItem;
      const list = getLocal<TestItem[]>(LOCAL_TESTS_KEY, []);
      if (!list.some((t) => t.id === data.id)) {
        setLocal(LOCAL_TESTS_KEY, [data, ...list]);
      }
      return data;
    }
  } catch (err) {
    console.warn('Direct doc test lookup note:', err);
  }

  // 2. Query Firestore by accessCode == cleanUpper
  try {
    const q1 = query(collection(db, 'tests'), where('accessCode', '==', cleanUpper));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      const data = { id: snap1.docs[0].id, ...snap1.docs[0].data() } as TestItem;
      const list = getLocal<TestItem[]>(LOCAL_TESTS_KEY, []);
      if (!list.some((t) => t.id === data.id)) {
        setLocal(LOCAL_TESTS_KEY, [data, ...list]);
      }
      return data;
    }

    if (clean !== cleanUpper) {
      const q2 = query(collection(db, 'tests'), where('accessCode', '==', clean));
      const snap2 = await getDocs(q2);
      if (!snap2.empty) {
        const data = { id: snap2.docs[0].id, ...snap2.docs[0].data() } as TestItem;
        return data;
      }
    }
  } catch (err) {
    console.warn('Firestore query by accessCode warning:', err);
  }

  // 3. Scan all tests from Firestore with resilient matching
  try {
    const allSnap = await getDocs(collection(db, 'tests'));
    if (!allSnap.empty) {
      const allFirestoreTests = allSnap.docs.map((d) => ({ id: d.id, ...d.data() } as TestItem));
      setLocal(LOCAL_TESTS_KEY, allFirestoreTests);
      const match = allFirestoreTests.find(matchesTest);
      if (match) return match;
    }
  } catch (err) {
    console.warn('Firestore full scan fallback:', err);
  }

  // 4. Local storage fallback
  const cached = getLocal<TestItem[]>(LOCAL_TESTS_KEY, []);
  const cachedMatch = cached.find(matchesTest);
  if (cachedMatch) {
    try {
      await setDoc(doc(db, 'tests', cachedMatch.id), sanitizeForFirestore(cachedMatch));
    } catch {}
    return cachedMatch;
  }

  // 5. Offline downloaded tests fallback
  try {
    const { getDownloadedTests } = await import('./offlineStorageService');
    const dl = await getDownloadedTests();
    const match = dl.find((ot) => {
      const code = (ot.accessCode || '').trim().toUpperCase();
      return ot.id === clean || code === cleanUpper || code === clean;
    });
    if (match) {
      return {
        id: match.id,
        seriesId: '',
        title: match.title,
        description: match.instructions || '',
        examCategory: match.examCategory,
        totalQuestions: match.totalQuestions,
        durationMinutes: match.durationMinutes,
        marksPerQuestion: match.marksPerQuestion,
        negativeMarks: match.negativeMarks,
        instantResult: true,
        status: match.status || 'released',
        accessCode: match.accessCode || '',
        accessPassword: '',
        instructions: match.instructions,
        syllabus: match.syllabus,
        createdAt: match.downloadedAt,
      };
    }
  } catch {}

  return null;
}

export async function createTest(testData: Partial<TestItem>): Promise<TestItem> {
  const id = testData.id || `test-${Date.now()}`;
  const cleanCode = (testData.accessCode || `EXAM${Math.floor(1000 + Math.random() * 9000)}`).trim().toUpperCase();
  const cleanPass = (testData.accessPassword || `PASS${Math.floor(100 + Math.random() * 900)}`).trim();

  const newTest: TestItem = {
    id,
    seriesId: testData.seriesId || 'series-general',
    seriesTitle: testData.seriesTitle || 'General Series',
    title: testData.title || 'Untitled Examination',
    description: testData.description || '',
    examCategory: testData.examCategory || 'Competitive Exam',
    subject: testData.subject || 'All Subjects',
    syllabus: testData.syllabus || '',
    instructions: testData.instructions || 'Read all instructions carefully before starting.',
    totalQuestions: testData.totalQuestions || 0,
    durationMinutes: testData.durationMinutes || 60,
    startDate: testData.startDate || new Date().toISOString().slice(0, 10),
    startTime: testData.startTime || '10:00 AM',
    marksPerQuestion: testData.marksPerQuestion ?? 1,
    negativeMarks: testData.negativeMarks ?? 0.25,
    passingMarks: testData.passingMarks || 4,
    instantResult: testData.instantResult ?? false,
    status: testData.status || 'published',
    accessCode: cleanCode,
    accessPassword: cleanPass,
    createdAt: testData.createdAt || new Date().toISOString(),
  };

  const list = getLocal<TestItem[]>(LOCAL_TESTS_KEY, []);
  setLocal(LOCAL_TESTS_KEY, [newTest, ...list.filter((t) => t.id !== id)]);

  try {
    await setDoc(doc(db, 'tests', id), sanitizeForFirestore(newTest));
  } catch (err) {
    console.error('Firestore createTest error:', err);
  }

  broadcastEvent('TEST_UPDATED', newTest);
  return newTest;
}

export async function updateTest(testId: string, updates: Partial<TestItem>): Promise<void> {
  const cleanUpdates = { ...updates };
  if (cleanUpdates.accessCode) {
    cleanUpdates.accessCode = cleanUpdates.accessCode.trim().toUpperCase();
  }
  if (cleanUpdates.accessPassword) {
    cleanUpdates.accessPassword = cleanUpdates.accessPassword.trim();
  }

  const list = getLocal<TestItem[]>(LOCAL_TESTS_KEY, []);
  let updatedTest: TestItem | null = null;
  const updated = list.map((t) => {
    if (t.id === testId) {
      updatedTest = { ...t, ...cleanUpdates, updatedAt: new Date().toISOString() };
      return updatedTest;
    }
    return t;
  });
  setLocal(LOCAL_TESTS_KEY, updated);

  try {
    await setDoc(
      doc(db, 'tests', testId),
      sanitizeForFirestore({
        ...cleanUpdates,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch (err) {
    console.error('Firestore updateTest error:', err);
  }

  if (updatedTest) {
    broadcastEvent('TEST_UPDATED', updatedTest);
  }
}

/**
 * COMPLETELY DELETE TEST ON FIREBASE
 * Completely removes:
 * 1. All questions in tests/{testId}/questions subcollection
 * 2. The test document itself in tests/{testId}
 * 3. All student attempts for this test in attempts
 * 4. All live exam sessions for this test in examSessions
 * 5. All local cached entries for this test
 */
export async function deleteTest(testId: string): Promise<void> {
  // 1. Delete all questions from Firestore subcollection
  try {
    const qSnap = await getDocs(collection(db, 'tests', testId, 'questions'));
    const qPromises = qSnap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(qPromises);
  } catch (err) {
    console.warn('Firestore delete questions fallback:', err);
  }

  // 2. Delete test document from Firestore
  try {
    await deleteDoc(doc(db, 'tests', testId));
  } catch (err) {
    console.warn('Firestore deleteTest fallback:', err);
  }

  // 3. Delete all related attempts for this test from Firestore
  try {
    const attSnap = await getDocs(query(collection(db, 'attempts'), where('testId', '==', testId)));
    const attPromises = attSnap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(attPromises);
  } catch (err) {
    console.warn('Firestore delete related attempts fallback:', err);
  }

  // 4. Delete all related sessions for this test from Firestore
  try {
    const sesSnap = await getDocs(query(collection(db, 'examSessions'), where('testId', '==', testId)));
    const sesPromises = sesSnap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(sesPromises);
  } catch (err) {
    console.warn('Firestore delete related sessions fallback:', err);
  }

  // 5. Clean up local caches
  const list = getLocal<TestItem[]>(LOCAL_TESTS_KEY, []);
  setLocal(LOCAL_TESTS_KEY, list.filter((t) => t.id !== testId));

  const localStore = getLocal<Record<string, QuestionItem[]>>(LOCAL_QUESTIONS_KEY, {});
  delete localStore[testId];
  setLocal(LOCAL_QUESTIONS_KEY, localStore);

  const localAttempts = getLocal<StudentAttempt[]>(LOCAL_ATTEMPTS_KEY, []);
  setLocal(LOCAL_ATTEMPTS_KEY, localAttempts.filter((a) => a.testId !== testId));

  const localSessions = getLocal<ExamSession[]>(LOCAL_SESSIONS_KEY, []);
  setLocal(LOCAL_SESSIONS_KEY, localSessions.filter((s) => s.testId !== testId));

  broadcastEvent('TEST_DELETED', { testId });
}

export async function duplicateTest(testId: string): Promise<TestItem | null> {
  const original = await getTestById(testId);
  if (!original) return null;

  const duplicated = await createTest({
    ...original,
    title: `${original.title} (Copy)`,
    accessCode: `CPY${Math.floor(1000 + Math.random() * 9000)}`,
    status: 'draft',
  });

  // Duplicate questions
  const questions = await getQuestionsForTest(testId, 'admin');
  if (questions.length > 0) {
    await bulkImportQuestions(
      duplicated.id,
      questions.map((q) => ({
        ...q,
        testId: duplicated.id,
      }))
    );
  }

  return duplicated;
}

export async function startExam(testId: string): Promise<void> {
  const currentTest = await getTestById(testId);
  const durationMs = (currentTest?.durationMinutes || 60) * 60 * 1000;
  const now = new Date();
  const startTime = now.toISOString();
  const endTime = new Date(now.getTime() + durationMs).toISOString();

  await updateTest(testId, {
    status: 'live',
    examStartTime: startTime,
    examEndTime: endTime,
  });
}

export async function endExam(testId: string): Promise<void> {
  await updateTest(testId, {
    status: 'completed',
  });
  try {
    await recoverMissingAttemptsFromSessions(testId);
  } catch (err) {
    console.warn('recoverMissingAttemptsFromSessions on endExam warning:', err);
  }
}

export async function publishTestResults(testId: string): Promise<void> {
  await updateTest(testId, {
    status: 'result_published',
  });
  try {
    await recoverMissingAttemptsFromSessions(testId);
  } catch (err) {
    console.warn('recoverMissingAttemptsFromSessions on publishTestResults warning:', err);
  }
}

/**
 * REAL-TIME LISTENER FOR TEST UPDATES (Cloud Firestore onSnapshot + BroadcastChannel + Storage Event + Poll Fallback)
 * Transitions student waiting room to live exam across all devices instantly!
 */
export function subscribeToTest(testId: string, onUpdate: (test: TestItem) => void): () => void {
  let isUnsubscribed = false;

  // 1. Cloud Firestore Real-time listener
  let firestoreUnsub: (() => void) | null = null;
  try {
    firestoreUnsub = onSnapshot(
      doc(db, 'tests', testId),
      (snap) => {
        if (isUnsubscribed) return;
        if (snap.exists()) {
          const test = { id: snap.id, ...snap.data() } as TestItem;
          // Update local cache
          const list = getLocal<TestItem[]>(LOCAL_TESTS_KEY, []);
          setLocal(LOCAL_TESTS_KEY, list.map((t) => (t.id === testId ? test : t)));
          onUpdate(test);
        }
      },
      (error) => {
        console.warn('Firestore onSnapshot listener error, relying on sync channels:', error);
      }
    );
  } catch (err) {
    console.warn('Could not attach Firestore onSnapshot, fallback active:', err);
  }

  // 2. BroadcastChannel listener (Instant cross-tab updates)
  const handleBroadcast = (event: MessageEvent) => {
    if (isUnsubscribed) return;
    if (event.data?.type === 'TEST_UPDATED' && event.data?.payload?.id === testId) {
      const updated = event.data.payload as TestItem;
      const list = getLocal<TestItem[]>(LOCAL_TESTS_KEY, []);
      setLocal(LOCAL_TESTS_KEY, list.map((t) => (t.id === testId ? updated : t)));
      onUpdate(updated);
    }
  };
  broadcastChannel?.addEventListener('message', handleBroadcast);

  // 3. Cross-Tab Storage Event listener (fires across tabs/windows of the same domain)
  const handleStorage = (event: StorageEvent) => {
    if (isUnsubscribed) return;
    if (event.key === LOCAL_TESTS_KEY && event.newValue) {
      try {
        const tests = JSON.parse(event.newValue) as TestItem[];
        const found = tests.find((t) => t.id === testId);
        if (found) {
          onUpdate(found);
        }
      } catch {
        // ignore
      }
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }

  // 4. Polling fallback for guaranteed synchronization
  const interval = setInterval(async () => {
    if (isUnsubscribed) return;
    const t = await getTestById(testId);
    if (t) onUpdate(t);
  }, 1500);

  return () => {
    isUnsubscribed = true;
    clearInterval(interval);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
    }
    broadcastChannel?.removeEventListener('message', handleBroadcast);
    if (firestoreUnsub) firestoreUnsub();
  };
}

/**
 * REAL-TIME LISTENER FOR ALL TESTS
 * Keeps student home and admin test catalog in sync without manual refresh
 */
export function subscribeToTestsList(onUpdate: (tests: TestItem[]) => void): () => void {
  let isUnsubscribed = false;

  let firestoreUnsub: (() => void) | null = null;
  try {
    firestoreUnsub = onSnapshot(
      collection(db, 'tests'),
      (snap) => {
        if (isUnsubscribed) return;
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TestItem));
        setLocal(LOCAL_TESTS_KEY, list);
        onUpdate(list);
      },
      (error) => {
        console.warn('Firestore onSnapshot tests list error:', error);
      }
    );
  } catch (err) {
    console.warn('Could not attach tests list onSnapshot:', err);
  }

  const handleBroadcast = (event: MessageEvent) => {
    if (isUnsubscribed) return;
    if (event.data?.type === 'TEST_UPDATED' && event.data?.payload) {
      const updated = event.data.payload as TestItem;
      const list = getLocal<TestItem[]>(LOCAL_TESTS_KEY, []);
      const exists = list.some((t) => t.id === updated.id);
      const nextList = exists ? list.map((t) => (t.id === updated.id ? updated : t)) : [updated, ...list];
      setLocal(LOCAL_TESTS_KEY, nextList);
      onUpdate(nextList);
    } else if (event.data?.type === 'TEST_DELETED') {
      const list = getLocal<TestItem[]>(LOCAL_TESTS_KEY, []);
      onUpdate(list);
    }
  };
  broadcastChannel?.addEventListener('message', handleBroadcast);

  const handleStorage = (event: StorageEvent) => {
    if (isUnsubscribed) return;
    if (event.key === LOCAL_TESTS_KEY && event.newValue) {
      try {
        const tests = JSON.parse(event.newValue) as TestItem[];
        onUpdate(tests);
      } catch {
        // ignore
      }
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }

  const interval = setInterval(async () => {
    if (isUnsubscribed) return;
    const tests = await getTests();
    onUpdate(tests);
  }, 2500);

  return () => {
    isUnsubscribed = true;
    clearInterval(interval);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
    }
    broadcastChannel?.removeEventListener('message', handleBroadcast);
    if (firestoreUnsub) firestoreUnsub();
  };
}

/* =========================================================
   QUESTIONS
========================================================= */

export async function getQuestionsForTest(testId: string, role: 'student' | 'admin' = 'student'): Promise<QuestionItem[]> {
  let questions: QuestionItem[] = [];

  try {
    const snap = await getDocs(collection(db, 'tests', testId, 'questions'));
    if (!snap.empty) {
      questions = snap.docs.map((d) => ({ id: d.id, ...d.data() } as QuestionItem));
      const localStore = getLocal<Record<string, QuestionItem[]>>(LOCAL_QUESTIONS_KEY, {});
      localStore[testId] = questions;
      setLocal(LOCAL_QUESTIONS_KEY, localStore);
    }
  } catch (err) {
    console.warn('Firestore getQuestionsForTest fallback:', err);
  }

  if (questions.length === 0) {
    const localStore = getLocal<Record<string, QuestionItem[]>>(LOCAL_QUESTIONS_KEY, {});
    questions = localStore[testId] || [];
  }

  // If still empty, check downloaded offline practice tests in IndexedDB
  if (questions.length === 0) {
    try {
      const { getDownloadedQuestions } = await import('./offlineStorageService');
      questions = await getDownloadedQuestions(testId);
    } catch {
      // ignore
    }
  }

  // Sort by questionNumber
  questions.sort((a, b) => a.questionNumber - b.questionNumber);

  // Security enforcement: For students during live exam before results are published or exam completed,
  // do NOT leak the correct answer or explanation in the network payload!
  const test = await getTestById(testId);
  const isResultPublished =
    test?.status === 'result_published' ||
    test?.status === 'completed' ||
    test?.instantResult;

  if (role === 'student' && !isResultPublished) {
    return questions.map((q) => ({
      ...q,
      correctAnswer: '' as any,
      explanation: undefined,
      explanationHindi: undefined,
    }));
  }

  return questions;
}

export async function createQuestion(question: Partial<QuestionItem>): Promise<QuestionItem> {
  const testId = question.testId!;
  const id = `q-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const newQuestion: QuestionItem = {
    id,
    testId,
    questionNumber: question.questionNumber || 1,
    questionText: question.questionText || '',
    questionTextHindi: question.questionTextHindi || '',
    options: question.options || { A: '', B: '', C: '', D: '' },
    optionsHindi: question.optionsHindi || null as any,
    correctAnswer: question.correctAnswer || 'A',
    explanation: question.explanation || '',
    explanationHindi: question.explanationHindi || '',
    subject: question.subject || 'General Knowledge',
    imageUrl: question.imageUrl || null as any,
    questionImageUrl: question.questionImageUrl || null as any,
    questionImagePublicId: question.questionImagePublicId || null as any,
    optionImages: question.optionImages || null as any,
    createdAt: new Date().toISOString(),
  };

  const localStore = getLocal<Record<string, QuestionItem[]>>(LOCAL_QUESTIONS_KEY, {});
  const list = localStore[testId] || [];
  localStore[testId] = [...list, newQuestion];
  setLocal(LOCAL_QUESTIONS_KEY, localStore);

  try {
    await setDoc(doc(db, 'tests', testId, 'questions', id), sanitizeForFirestore(newQuestion));
  } catch (err) {
    console.warn('Firestore createQuestion fallback:', err);
  }

  await updateTest(testId, { totalQuestions: localStore[testId].length });
  return newQuestion;
}

export async function updateQuestion(testId: string, questionId: string, updates: Partial<QuestionItem>): Promise<void> {
  const localStore = getLocal<Record<string, QuestionItem[]>>(LOCAL_QUESTIONS_KEY, {});
  const list = localStore[testId] || [];
  localStore[testId] = list.map((q) => (q.id === questionId ? { ...q, ...updates } : q));
  setLocal(LOCAL_QUESTIONS_KEY, localStore);

  try {
    await updateDoc(doc(db, 'tests', testId, 'questions', questionId), sanitizeForFirestore(updates));
  } catch (err) {
    console.warn('Firestore updateQuestion fallback:', err);
  }
}

export async function deleteQuestion(testId: string, questionId: string): Promise<void> {
  const localStore = getLocal<Record<string, QuestionItem[]>>(LOCAL_QUESTIONS_KEY, {});
  const list = localStore[testId] || [];
  localStore[testId] = list.filter((q) => q.id !== questionId);
  setLocal(LOCAL_QUESTIONS_KEY, localStore);

  try {
    await deleteDoc(doc(db, 'tests', testId, 'questions', questionId));
  } catch (err) {
    console.warn('Firestore deleteQuestion fallback:', err);
  }

  await updateTest(testId, { totalQuestions: localStore[testId].length });
}

export async function bulkImportQuestions(
  testId: string,
  questions: Partial<QuestionItem>[],
  onProgress?: (progress: { current: number; total: number; percent: number }) => void
): Promise<number> {
  let importedCount = 0;
  const localStore = getLocal<Record<string, QuestionItem[]>>(LOCAL_QUESTIONS_KEY, {});
  const currentList = localStore[testId] || [];
  let currentMaxNum = currentList.length;
  const total = questions.length;

  for (let idx = 0; idx < questions.length; idx++) {
    const q = questions[idx];
    currentMaxNum++;
    const id = `q-${Date.now()}-${currentMaxNum}`;
    const newQ: QuestionItem = {
      id,
      testId,
      questionNumber: q.questionNumber || currentMaxNum,
      questionText: q.questionText || '',
      questionTextHindi: q.questionTextHindi || '',
      options: q.options || { A: '', B: '', C: '', D: '' },
      optionsHindi: q.optionsHindi || (null as any),
      correctAnswer: q.correctAnswer || 'A',
      explanation: q.explanation || '',
      explanationHindi: q.explanationHindi || '',
      subject: q.subject || 'General',
      imageUrl: q.imageUrl || (null as any),
      questionImageUrl: q.questionImageUrl || (null as any),
      questionImagePublicId: q.questionImagePublicId || (null as any),
      optionImages: q.optionImages || (null as any),
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'tests', testId, 'questions', id), sanitizeForFirestore(newQ));
    } catch {
      // ignore
    }
    currentList.push(newQ);
    importedCount++;

    if (onProgress) {
      onProgress({
        current: importedCount,
        total,
        percent: Math.round((importedCount / total) * 100),
      });
    }
  }

  localStore[testId] = currentList;
  setLocal(LOCAL_QUESTIONS_KEY, localStore);
  await updateTest(testId, { totalQuestions: currentList.length });

  return importedCount;
}

/* =========================================================
   EXAM SESSIONS (Real-time participant presence & waiting room)
========================================================= */

export async function joinExamSession(
  testId: string,
  student: { uid: string; name: string; email: string }
): Promise<ExamSession> {
  const sessionId = `${testId}_${student.uid}`;
  const now = new Date().toISOString();

  let existingSession: ExamSession | null = null;
  try {
    const snap = await getDoc(doc(db, 'examSessions', sessionId));
    if (snap.exists()) {
      existingSession = { id: snap.id, ...snap.data() } as ExamSession;
    }
  } catch {
    // ignore
  }

  if (!existingSession) {
    const localSessions = getLocal<ExamSession[]>(LOCAL_SESSIONS_KEY, []);
    existingSession = localSessions.find((s) => s.id === sessionId) || null;
  }

  const joinLog: ActivityLogEntry = {
    timestamp: now,
    event: 'joined_waiting_room',
    details: 'Student entered waiting room with verified password',
  };

  const session: ExamSession = existingSession
    ? {
        ...existingSession,
        id: sessionId,
        testId,
        studentId: student.uid,
        studentName: student.name || existingSession.studentName,
        studentEmail: student.email || existingSession.studentEmail,
        status:
          existingSession.status === 'submitted' || existingSession.status === 'auto_submitted'
            ? existingSession.status
            : existingSession.status === 'in_progress'
            ? 'in_progress'
            : 'waiting',
        joinedAt: existingSession.joinedAt || now,
        lastHeartbeat: now,
        tabSwitchCount: existingSession.tabSwitchCount || 0,
        activityLogs: [...(existingSession.activityLogs || []), joinLog],
      }
    : {
        id: sessionId,
        testId,
        studentId: student.uid,
        studentName: student.name,
        studentEmail: student.email,
        status: 'waiting',
        joinedAt: now,
        lastHeartbeat: now,
        tabSwitchCount: 0,
        activityLogs: [joinLog],
      };

  // Sync to local
  const sessions = getLocal<ExamSession[]>(LOCAL_SESSIONS_KEY, []);
  const filtered = sessions.filter((s) => s.id !== sessionId);
  setLocal(LOCAL_SESSIONS_KEY, [...filtered, session]);

  // Sync to Cloud Firestore
  try {
    await setDoc(doc(db, 'examSessions', sessionId), sanitizeForFirestore(session), { merge: true });
  } catch (err) {
    console.warn('Firestore joinExamSession fallback:', err);
  }

  broadcastEvent('SESSION_JOINED', session);
  return session;
}

export async function getExamSession(
  testId: string,
  studentId: string
): Promise<ExamSession | null> {
  const sessionId = `${testId}_${studentId}`;
  try {
    const snap = await getDoc(doc(db, 'examSessions', sessionId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as ExamSession;
    }
  } catch {
    // ignore
  }
  const sessions = getLocal<ExamSession[]>(LOCAL_SESSIONS_KEY, []);
  return sessions.find((s) => s.id === sessionId) || null;
}

export async function syncSessionProgress(
  testId: string,
  studentId: string,
  progress: {
    studentName?: string;
    studentEmail?: string;
    answers: Record<string, 'A' | 'B' | 'C' | 'D'>;
    visitedQuestionIds?: string[];
    markedForReviewIds?: string[];
    tabSwitchCount?: number;
    startedAt?: string;
  }
): Promise<void> {
  if (!testId || !studentId) return;
  const sessionId = `${testId}_${studentId}`;
  const now = new Date().toISOString();
  const answeredCount = Object.keys(progress.answers || {}).length;

  const updates: Record<string, any> = {
    id: sessionId,
    testId,
    studentId,
    status: 'in_progress',
    lastHeartbeat: now,
    answers: progress.answers || {},
    answeredCount,
  };
  if (progress.studentName) updates.studentName = progress.studentName;
  if (progress.studentEmail) updates.studentEmail = progress.studentEmail;
  if (progress.visitedQuestionIds) updates.visitedQuestionIds = progress.visitedQuestionIds;
  if (progress.markedForReviewIds) updates.markedForReviewIds = progress.markedForReviewIds;
  if (progress.tabSwitchCount !== undefined) updates.tabSwitchCount = progress.tabSwitchCount;
  if (progress.startedAt) updates.startedAt = progress.startedAt;

  // Update local cache
  const sessions = getLocal<ExamSession[]>(LOCAL_SESSIONS_KEY, []);
  const exists = sessions.some((s) => s.id === sessionId);
  const newSessionFallback: ExamSession = {
    id: sessionId,
    testId,
    studentId,
    studentName: progress.studentName || 'Candidate',
    studentEmail: progress.studentEmail || `${studentId}@candidate.pariksha`,
    status: 'in_progress',
    joinedAt: now,
    tabSwitchCount: progress.tabSwitchCount || 0,
    activityLogs: [],
    ...updates,
  };
  const updated = exists
    ? sessions.map((s) => (s.id === sessionId ? { ...s, ...updates } : s))
    : [...sessions, newSessionFallback];
  setLocal(LOCAL_SESSIONS_KEY, updated);

  // Sync to Cloud Firestore so admin & auto-recovery always have live answers
  try {
    await setDoc(doc(db, 'examSessions', sessionId), sanitizeForFirestore(updates), { merge: true });
  } catch (err) {
    console.warn('Firestore syncSessionProgress fallback:', err);
  }
}

export async function updateSessionStatus(
  testId: string,
  studentId: string,
  status: StudentExamStatus,
  tabSwitchCount?: number,
  logEntry?: ActivityLogEntry
): Promise<void> {
  const sessionId = `${testId}_${studentId}`;
  const now = new Date().toISOString();
  const updates: any = {
    status,
    lastHeartbeat: now,
  };

  if (status === 'submitted' || status === 'auto_submitted') updates.submittedAt = now;
  if (tabSwitchCount !== undefined) updates.tabSwitchCount = tabSwitchCount;

  // Local cache
  const sessions = getLocal<ExamSession[]>(LOCAL_SESSIONS_KEY, []);
  const updated = sessions.map((s) => {
    if (s.id === sessionId) {
      const logs = [...(s.activityLogs || [])];
      if (logEntry) logs.push(logEntry);
      return {
        ...s,
        ...updates,
        startedAt: s.startedAt || (status === 'in_progress' ? now : undefined),
        activityLogs: logs,
      };
    }
    return s;
  });
  setLocal(LOCAL_SESSIONS_KEY, updated);

  // Firestore update
  try {
    const sessionRef = doc(db, 'examSessions', sessionId);
    const snap = await getDoc(sessionRef);
    if (snap.exists()) {
      const current = snap.data() as ExamSession;
      const logs = [...(current.activityLogs || [])];
      if (logEntry) logs.push(logEntry);
      updates.activityLogs = logs;
      if (status === 'in_progress' && !current.startedAt) {
        updates.startedAt = now;
      }
      await updateDoc(sessionRef, sanitizeForFirestore(updates));
    } else {
      if (status === 'in_progress') updates.startedAt = now;
      await setDoc(sessionRef, sanitizeForFirestore(updates), { merge: true });
    }
  } catch (err) {
    console.warn('Firestore updateSessionStatus fallback:', err);
  }

  broadcastEvent('SESSION_STATUS_CHANGED', { sessionId, updates });
}

/**
 * REAL-TIME LISTENER FOR ADMIN LIVE EXAM MONITORING
 * Automatically updates connected students across all devices!
 */
export function subscribeToLiveSessions(testId: string, callback: (sessions: ExamSession[]) => void): () => void {
  let isUnsubscribed = false;

  // 1. Cloud Firestore Real-time query listener
  let firestoreUnsub: (() => void) | null = null;
  try {
    const q = query(collection(db, 'examSessions'), where('testId', '==', testId));
    firestoreUnsub = onSnapshot(
      q,
      (snapshot) => {
        if (isUnsubscribed) return;
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ExamSession));
        // Sync local cache
        const allLocal = getLocal<ExamSession[]>(LOCAL_SESSIONS_KEY, []);
        const otherTestSessions = allLocal.filter((s) => s.testId !== testId);
        setLocal(LOCAL_SESSIONS_KEY, [...otherTestSessions, ...list]);
        callback(list);
      },
      (error) => {
        console.warn('Firestore live sessions onSnapshot error, using poll fallback:', error);
      }
    );
  } catch (err) {
    console.warn('Could not attach Firestore live sessions onSnapshot:', err);
  }

  // 2. BroadcastChannel cross-tab message handler
  const handleBroadcast = () => {
    if (isUnsubscribed) return;
    const all = getLocal<ExamSession[]>(LOCAL_SESSIONS_KEY, []);
    callback(all.filter((s) => s.testId === testId));
  };
  broadcastChannel?.addEventListener('message', handleBroadcast);

  // 3. Storage event handler for cross-tab sessions
  const handleStorage = (event: StorageEvent) => {
    if (isUnsubscribed) return;
    if (event.key === LOCAL_SESSIONS_KEY && event.newValue) {
      try {
        const sessions = JSON.parse(event.newValue) as ExamSession[];
        callback(sessions.filter((s) => s.testId === testId));
      } catch {
        // ignore
      }
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }

  // 4. Guaranteed Polling fallback
  const interval = setInterval(async () => {
    if (isUnsubscribed) return;
    try {
      const q = query(collection(db, 'examSessions'), where('testId', '==', testId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExamSession));
        callback(list);
        return;
      }
    } catch {
      // ignore
    }
    const all = getLocal<ExamSession[]>(LOCAL_SESSIONS_KEY, []);
    callback(all.filter((s) => s.testId === testId));
  }, 1500);

  return () => {
    isUnsubscribed = true;
    clearInterval(interval);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
    }
    broadcastChannel?.removeEventListener('message', handleBroadcast);
    if (firestoreUnsub) firestoreUnsub();
  };
}

/**
 * REAL-TIME LISTENER FOR TEST ATTEMPTS & RESULTS LEADERBOARD
 */
export function subscribeToTestAttempts(testId: string, callback: (attempts: StudentAttempt[]) => void): () => void {
  let isUnsubscribed = false;

  let firestoreUnsub: (() => void) | null = null;
  try {
    const q = query(collection(db, 'attempts'), where('testId', '==', testId));
    firestoreUnsub = onSnapshot(
      q,
      (snapshot) => {
        if (isUnsubscribed) return;
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as StudentAttempt));
        const allLocal = getLocal<StudentAttempt[]>(LOCAL_ATTEMPTS_KEY, []);
        const otherTestAttempts = allLocal.filter((a) => a.testId !== testId);
        setLocal(LOCAL_ATTEMPTS_KEY, [...otherTestAttempts, ...list]);
        callback(list);
      },
      (error) => {
        console.warn('Firestore attempts onSnapshot error:', error);
      }
    );
  } catch (err) {
    console.warn('Could not attach Firestore attempts onSnapshot:', err);
  }

  const handleBroadcast = (event: MessageEvent) => {
    if (isUnsubscribed) return;
    if (event.data?.type === 'ATTEMPT_SUBMITTED') {
      const all = getLocal<StudentAttempt[]>(LOCAL_ATTEMPTS_KEY, []);
      callback(all.filter((a) => a.testId === testId));
    }
  };
  broadcastChannel?.addEventListener('message', handleBroadcast);

  const handleStorage = (event: StorageEvent) => {
    if (isUnsubscribed) return;
    if (event.key === LOCAL_ATTEMPTS_KEY && event.newValue) {
      try {
        const attempts = JSON.parse(event.newValue) as StudentAttempt[];
        callback(attempts.filter((a) => a.testId === testId));
      } catch {
        // ignore
      }
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }

  const interval = setInterval(async () => {
    if (isUnsubscribed) return;
    try {
      const q = query(collection(db, 'attempts'), where('testId', '==', testId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentAttempt));
        callback(list);
        return;
      }
    } catch {
      // ignore
    }
    const all = getLocal<StudentAttempt[]>(LOCAL_ATTEMPTS_KEY, []);
    callback(all.filter((a) => a.testId === testId));
  }, 2000);

  return () => {
    isUnsubscribed = true;
    clearInterval(interval);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
    }
    broadcastChannel?.removeEventListener('message', handleBroadcast);
    if (firestoreUnsub) firestoreUnsub();
  };
}

/* =========================================================
   ATTEMPTS & RESULT CALCULATION
========================================================= */

export async function submitExamAttempt(params: {
  testId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  answers: Record<string, 'A' | 'B' | 'C' | 'D'>;
  visitedQuestionIds: string[];
  markedForReviewIds: string[];
  startedAt: string;
  isAutoSubmitted: boolean;
  tabSwitchCount: number;
  activityLogs?: ActivityLogEntry[];
}): Promise<StudentAttempt> {
  const {
    testId,
    studentId,
    studentName,
    studentEmail,
    answers,
    visitedQuestionIds,
    markedForReviewIds,
    startedAt,
    isAutoSubmitted,
    tabSwitchCount,
    activityLogs,
  } = params;

  const test = await getTestById(testId);
  if (!test) throw new Error('Test not found for evaluation');

  const questions = await getQuestionsForTest(testId, 'admin');
  const totalQuestions = questions.length || test.totalQuestions || 1;
  const posMarks = test.marksPerQuestion ?? 1;
  const negMarks = test.negativeMarks ?? 0.25;

  let correctCount = 0;
  let incorrectCount = 0;
  let attemptedCount = 0;

  for (const q of questions) {
    const studentChoice = answers[q.id];
    if (studentChoice) {
      attemptedCount++;
      if (studentChoice === q.correctAnswer) {
        correctCount++;
      } else {
        incorrectCount++;
      }
    }
  }

  const unattemptedCount = Math.max(0, totalQuestions - attemptedCount);
  const rawScore = correctCount * posMarks - incorrectCount * negMarks;
  const finalScore = Number(rawScore.toFixed(2));
  const maxPossibleMarks = totalQuestions * posMarks;
  const percentage = maxPossibleMarks > 0 ? Number(((finalScore / maxPossibleMarks) * 100).toFixed(2)) : 0;
  const accuracy = attemptedCount > 0 ? Number(((correctCount / attemptedCount) * 100).toFixed(2)) : 0;

  // Retrieve prior attempts to compute attempt number
  const prevAttempts = await getAllStudentAttemptsForTest(testId, studentId, studentName);
  const attemptNumber = prevAttempts.length + 1;
  const isReleasedTest = test.status === 'released';

  // For released/reattempt tests or second+ attempts, give a unique timestamped ID
  const attemptId = isReleasedTest || prevAttempts.length > 0
    ? `att-${testId}-${studentId}-${Date.now()}`
    : `att-${testId}-${studentId}`;

  const now = new Date().toISOString();

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const attempt: StudentAttempt = {
    id: attemptId,
    testId,
    testTitle: test.title,
    studentId,
    studentName,
    studentEmail,
    attemptNumber,
    answers,
    visitedQuestionIds,
    markedForReviewIds,
    startedAt: startedAt || now,
    submittedAt: now,
    isAutoSubmitted,
    totalQuestions,
    attemptedCount,
    correctCount,
    incorrectCount,
    unattemptedCount,
    positiveMarks: posMarks,
    negativeMarks: negMarks,
    finalScore,
    percentage,
    accuracy,
    status: isAutoSubmitted ? 'auto_submitted' : 'submitted',
    tabSwitchCount,
    activityLogs: activityLogs || [],
    isOffline: !isOnline,
    synced: isOnline,
    syncedAt: isOnline ? now : undefined,
  };

  // 1. Save to local cache
  const attempts = getLocal<StudentAttempt[]>(LOCAL_ATTEMPTS_KEY, []);
  const filtered = attempts.filter((a) => a.id !== attemptId);
  setLocal(LOCAL_ATTEMPTS_KEY, [attempt, ...filtered]);

  // 2. If offline, save into offlineStorageService for pending sync
  if (!isOnline) {
    try {
      const { saveOfflineAttempt } = await import('./offlineStorageService');
      await saveOfflineAttempt(attempt);
    } catch (e) {
      console.warn('Failed to save offline attempt:', e);
    }
  } else {
    // Save individual attempt to Cloud Firestore
    try {
      await setDoc(doc(db, 'attempts', attemptId), sanitizeForFirestore(attempt));
      // For single-attempt exams, also update main pointer doc for fast lookup
      if (!isReleasedTest && prevAttempts.length === 0) {
        await setDoc(doc(db, 'attempts', `att-${testId}-${studentId}`), sanitizeForFirestore(attempt));
      }
    } catch (err) {
      console.warn('Firestore set attempt fallback (queueing offline):', err);
      attempt.isOffline = true;
      attempt.synced = false;
      try {
        const { saveOfflineAttempt } = await import('./offlineStorageService');
        await saveOfflineAttempt(attempt);
      } catch {}
    }

    // 3. Update user document in Firestore 'users' collection with submission status
    try {
      await recordUserExamSubmission({
        userId: studentId,
        testId,
        finalScore,
        percentage,
      });
    } catch (err) {
      console.warn('Firestore recordUserExamSubmission warning:', err);
    }

    // 4. Update session status
    try {
      await updateSessionStatus(testId, studentId, isAutoSubmitted ? 'auto_submitted' : 'submitted', tabSwitchCount, {
        timestamp: now,
        event: isAutoSubmitted ? 'submitted_auto' : 'submitted_manual',
        details: `Scored ${finalScore}/${maxPossibleMarks} (${percentage}%) - Attempt #${attemptNumber}`,
      });
    } catch {}

    // Flush any pending offline attempts in background
    try {
      const { syncPendingOfflineAttempts } = await import('./offlineStorageService');
      syncPendingOfflineAttempts().catch(() => {});
    } catch {}
  }

  broadcastEvent('ATTEMPT_SUBMITTED', attempt);
  return attempt;
}

/**
 * Fetches all attempts made by a specific student for a given test (ordered by submittedAt ascending)
 * Allows reviewing all attempts results and scorecards across time.
 */
export async function getAllStudentAttemptsForTest(
  testId: string,
  studentId: string,
  studentName?: string
): Promise<StudentAttempt[]> {
  const results: StudentAttempt[] = [];
  const cleanId = (studentId || '').trim();
  const cleanName = (studentName || '').trim().toLowerCase();

  try {
    const q = query(collection(db, 'attempts'), where('testId', '==', testId));
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const data = d.data() as StudentAttempt;
      const att: StudentAttempt = { ...data, id: d.id };
      const matchUid = Boolean(cleanId) && (att.studentId === cleanId || att.studentId?.toLowerCase() === cleanId.toLowerCase());
      const matchName = Boolean(cleanName) && att.studentName?.toLowerCase().trim() === cleanName;
      if (matchUid || matchName) {
        // Prevent duplicate attempts (same ID or virtually identical timestamp)
        const isDuplicate = results.some((r) =>
          r.id === att.id ||
          (Math.abs(new Date(r.submittedAt).getTime() - new Date(att.submittedAt).getTime()) < 2000 && r.finalScore === att.finalScore)
        );
        if (!isDuplicate) {
          results.push(att);
        }
      }
    });
  } catch (err) {
    console.warn('Firestore getAllStudentAttemptsForTest warning:', err);
  }

  // Also check local storage cache
  const localAttempts = getLocal<StudentAttempt[]>(LOCAL_ATTEMPTS_KEY, []);
  localAttempts.forEach((att) => {
    if (att.testId === testId) {
      const matchUid = Boolean(cleanId) && (att.studentId === cleanId || att.studentId?.toLowerCase() === cleanId.toLowerCase());
      const matchName = Boolean(cleanName) && att.studentName?.toLowerCase().trim() === cleanName;
      if (matchUid || matchName) {
        const isDuplicate = results.some((r) =>
          r.id === att.id ||
          (Math.abs(new Date(r.submittedAt).getTime() - new Date(att.submittedAt).getTime()) < 2000 && r.finalScore === att.finalScore)
        );
        if (!isDuplicate) {
          results.push(att);
        }
      }
    }
  });

  // Sort ascending by submittedAt so attempt 1, attempt 2, attempt 3...
  results.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

  // Assign indexed attempt numbers if not present
  return results.map((att, idx) => ({
    ...att,
    attemptNumber: att.attemptNumber || idx + 1,
  }));
}

export async function getStudentAttempt(testId: string, studentId: string): Promise<StudentAttempt | null> {
  const attemptId = `att-${testId}-${studentId}`;
  try {
    const snap = await getDoc(doc(db, 'attempts', attemptId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as StudentAttempt;
    }
  } catch (err) {
    console.warn('Firestore getStudentAttempt fallback:', err);
  }
  const attempts = getLocal<StudentAttempt[]>(LOCAL_ATTEMPTS_KEY, []);
  return attempts.find((a) => a.testId === testId && a.studentId === studentId) || null;
}

/**
 * Searches for a student's existing attempt by testId and either studentName, candidateId, or UID.
 * This allows students to re-login with their exam code and name/ID to see their result once the exam ends.
 */
export async function findStudentAttempt(
  testId: string,
  candidateIdentifier: string,
  candidateUid?: string
): Promise<StudentAttempt | null> {
  if (!testId) return null;

  const cleanIdent = (candidateIdentifier || '').trim().toLowerCase();
  const cleanUid = (candidateUid || '').trim();

  // Resolve alternate test ID / access code if applicable
  let resolvedId = testId;
  let resolvedCode = '';
  const tDirect = await getTestById(testId);
  if (tDirect) {
    resolvedId = tDirect.id;
    resolvedCode = (tDirect.accessCode || '').trim().toUpperCase();
  } else {
    const tByCode = await getTestByAccessCode(testId);
    if (tByCode) {
      resolvedId = tByCode.id;
      resolvedCode = (tByCode.accessCode || '').trim().toUpperCase();
    }
  }

  const isMatchingTest = (tId?: string) => {
    if (!tId) return false;
    const clean = tId.trim();
    return clean === resolvedId || clean === testId || (Boolean(resolvedCode) && clean.toUpperCase() === resolvedCode);
  };

  const normalizeAlpha = (str?: string) =>
    (str || '')
      .toLowerCase()
      .replace(/^guest_/, '')
      .replace(/^cand_/, '')
      .replace(/[^a-z0-9]/g, '');

  const targetAlpha = normalizeAlpha(candidateIdentifier);
  const targetUidAlpha = normalizeAlpha(candidateUid);

  const matchesAttempt = (a: StudentAttempt): boolean => {
    if (!a || !isMatchingTest(a.testId)) return false;
    const aStudentId = (a.studentId || '').trim();
    const aStudentName = (a.studentName || '').trim();
    const aEmail = (a.studentEmail || '').trim();

    const aIdAlpha = normalizeAlpha(aStudentId);
    const aNameAlpha = normalizeAlpha(aStudentName);
    const aEmailAlpha = normalizeAlpha(aEmail);

    return (
      // UID exact match
      (Boolean(cleanUid) && (aStudentId === cleanUid || aStudentId.toLowerCase() === cleanUid.toLowerCase())) ||
      // Identifier exact match
      (Boolean(cleanIdent) && (aStudentId.toLowerCase() === cleanIdent || aStudentName.toLowerCase() === cleanIdent || aEmail.toLowerCase() === cleanIdent)) ||
      // Normalized alphanumeric match (handles "Rahul Sharma" vs "guest_Rahul_Sharma" vs "rahulsharma")
      (targetAlpha.length >= 2 && (aNameAlpha === targetAlpha || aIdAlpha === targetAlpha || aEmailAlpha === targetAlpha)) ||
      (targetUidAlpha.length >= 2 && (aNameAlpha === targetUidAlpha || aIdAlpha === targetUidAlpha)) ||
      // Substring match if length >= 3
      (targetAlpha.length >= 3 && (aNameAlpha.includes(targetAlpha) || targetAlpha.includes(aNameAlpha)))
    );
  };

  // 1. Check quick local storage records for this browser session
  if (typeof window !== 'undefined') {
    try {
      const saved1 = localStorage.getItem(`pariksha_attempt_${testId}`);
      if (saved1) {
        const parsed = JSON.parse(saved1) as StudentAttempt;
        if (matchesAttempt(parsed)) {
          // Ensure this local attempt is synced to Cloud Firestore
          setDoc(doc(db, 'attempts', parsed.id || `att-${testId}-${parsed.studentId}`), sanitizeForFirestore(parsed), { merge: true }).catch(() => {});
          return parsed;
        }
      }
      if (cleanIdent) {
        const saved2 = localStorage.getItem(`pariksha_attempt_${testId}_${cleanIdent}`);
        if (saved2) {
          const parsed = JSON.parse(saved2) as StudentAttempt;
          if (matchesAttempt(parsed)) {
            setDoc(doc(db, 'attempts', parsed.id || `att-${testId}-${parsed.studentId}`), sanitizeForFirestore(parsed), { merge: true }).catch(() => {});
            return parsed;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Direct document check by UID if provided
  if (cleanUid) {
    const directAtt = await getStudentAttempt(testId, cleanUid);
    if (directAtt && matchesAttempt(directAtt)) return directAtt;
  }

  // 3. Direct document check by candidate identifier if provided
  if (cleanIdent) {
    const directAtt1 = await getStudentAttempt(testId, candidateIdentifier.trim());
    if (directAtt1) return directAtt1;

    const directAtt2 = await getStudentAttempt(testId, `guest_${candidateIdentifier.trim().replace(/\s+/g, '_')}`);
    if (directAtt2) return directAtt2;
  }

  // 4. Query Firestore collection 'attempts' for this testId
  try {
    const q = query(collection(db, 'attempts'), where('testId', '==', testId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const attempts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentAttempt));

      // Cache locally
      const localAttempts = getLocal<StudentAttempt[]>(LOCAL_ATTEMPTS_KEY, []);
      const otherAttempts = localAttempts.filter((a) => a.testId !== testId);
      setLocal(LOCAL_ATTEMPTS_KEY, [...otherAttempts, ...attempts]);

      const found = attempts.find(matchesAttempt);
      if (found) return found;
    }
  } catch (err) {
    console.warn('Firestore findStudentAttempt query warning:', err);
  }

  // 5. Check if student has unsubmitted answers in localStorage or examSessions for an ended/published test
  if (cleanUid && tDirect && (tDirect.status === 'completed' || tDirect.status === 'result_published' || tDirect.status === 'released')) {
    try {
      if (typeof window !== 'undefined') {
        const rawAnswers = localStorage.getItem(`pariksha_answers_${resolvedId}_${cleanUid}`);
        if (rawAnswers) {
          const parsedAnswers = JSON.parse(rawAnswers) as Record<string, 'A' | 'B' | 'C' | 'D'>;
          if (parsedAnswers && Object.keys(parsedAnswers).length > 0) {
            const rawVisited = localStorage.getItem(`pariksha_visited_${resolvedId}_${cleanUid}`);
            const rawReview = localStorage.getItem(`pariksha_reviews_${resolvedId}_${cleanUid}`);
            const rawTabs = localStorage.getItem(`pariksha_tab_switches_${resolvedId}_${cleanUid}`);
            const recovered = await submitExamAttempt({
              testId: resolvedId,
              studentId: cleanUid,
              studentName: candidateIdentifier || 'Candidate',
              studentEmail: `${cleanUid}@candidate.pariksha`,
              answers: parsedAnswers,
              visitedQuestionIds: rawVisited ? JSON.parse(rawVisited) : Object.keys(parsedAnswers),
              markedForReviewIds: rawReview ? JSON.parse(rawReview) : [],
              startedAt: tDirect.examStartTime || new Date().toISOString(),
              isAutoSubmitted: true,
              tabSwitchCount: rawTabs ? parseInt(rawTabs, 10) || 0 : 0,
            });
            localStorage.removeItem(`pariksha_answers_${resolvedId}_${cleanUid}`);
            return recovered;
          }
        }
      }
      const session = await getExamSession(resolvedId, cleanUid);
      if (session && session.answers && Object.keys(session.answers).length > 0) {
        const recovered = await submitExamAttempt({
          testId: resolvedId,
          studentId: session.studentId,
          studentName: session.studentName || candidateIdentifier || 'Candidate',
          studentEmail: session.studentEmail || `${cleanUid}@candidate.pariksha`,
          answers: session.answers,
          visitedQuestionIds: session.visitedQuestionIds || Object.keys(session.answers),
          markedForReviewIds: session.markedForReviewIds || [],
          startedAt: session.startedAt || session.joinedAt || new Date().toISOString(),
          isAutoSubmitted: true,
          tabSwitchCount: session.tabSwitchCount || 0,
          activityLogs: session.activityLogs || [],
        });
        return recovered;
      }
    } catch (e) {
      console.warn('Auto-recovery in findStudentAttempt warning:', e);
    }
  }

  // 6. Check local attempts fallback
  const localAttempts = getLocal<StudentAttempt[]>(LOCAL_ATTEMPTS_KEY, []);
  const localMatch = localAttempts.find(matchesAttempt);
  if (localMatch) {
    setDoc(doc(db, 'attempts', localMatch.id || `att-${testId}-${localMatch.studentId}`), sanitizeForFirestore(localMatch), { merge: true }).catch(() => {});
  }
  return localMatch || null;
}

/**
 * Automatically evaluates and creates missing attempt records in Firestore
 * for any examSession that recorded live student answers when the test is completed/published.
 */
export async function recoverMissingAttemptsFromSessions(testId: string): Promise<StudentAttempt[]> {
  const recoveredList: StudentAttempt[] = [];
  if (!testId) return recoveredList;

  try {
    const test = await getTestById(testId);
    if (!test) return recoveredList;

    const isEnded =
      test.status === 'completed' ||
      test.status === 'result_published' ||
      test.status === 'released';

    const [sessSnap, attSnap] = await Promise.all([
      getDocs(query(collection(db, 'examSessions'), where('testId', '==', testId))),
      getDocs(query(collection(db, 'attempts'), where('testId', '==', testId))),
    ]);

    const existingStudentIds = new Set(attSnap.docs.map((d) => (d.data() as StudentAttempt).studentId));

    for (const sDoc of sessSnap.docs) {
      const s = { id: sDoc.id, ...sDoc.data() } as ExamSession;
      if (!s.studentId || existingStudentIds.has(s.studentId)) continue;

      const hasSavedAnswers = s.answers && Object.keys(s.answers).length > 0;
      const isMarkedSubmitted = s.status === 'submitted' || s.status === 'auto_submitted';

      if (hasSavedAnswers && (isEnded || isMarkedSubmitted)) {
        const attempt = await submitExamAttempt({
          testId,
          studentId: s.studentId,
          studentName: s.studentName || 'Candidate',
          studentEmail: s.studentEmail || `${s.studentId}@candidate.pariksha`,
          answers: s.answers || {},
          visitedQuestionIds: s.visitedQuestionIds || Object.keys(s.answers || {}),
          markedForReviewIds: s.markedForReviewIds || [],
          startedAt: s.startedAt || s.joinedAt || new Date().toISOString(),
          isAutoSubmitted: s.status !== 'submitted',
          tabSwitchCount: s.tabSwitchCount || 0,
          activityLogs: s.activityLogs || [],
        });
        existingStudentIds.add(s.studentId);
        recoveredList.push(attempt);
      }
    }
  } catch (err) {
    console.warn('recoverMissingAttemptsFromSessions warning:', err);
  }

  return recoveredList;
}

/**
 * Runs on student device startup to sync any locally cached attempts or
 * auto-submit unfinished localStorage answers for tests that have already ended.
 */
export async function recoverStudentLocalExamAttempts(
  studentId: string,
  studentName: string,
  studentEmail?: string
): Promise<number> {
  if (typeof window === 'undefined' || !studentId) return 0;
  let recoveredCount = 0;

  try {
    // 1. Sync pending IndexedDB offline attempts
    try {
      const { syncPendingOfflineAttempts } = await import('./offlineStorageService');
      const res = await syncPendingOfflineAttempts();
      recoveredCount += res.syncedCount || 0;
    } catch {
      // ignore
    }

    // 2. Check all tests to see if student has local attempt or unsubmitted answers for an ended exam
    const tests = await getTests();
    const existingAttempts = await getAllAttempts();
    const myFirestoreTestIds = new Set(
      existingAttempts
        .filter((a) => a.studentId === studentId || (studentName && a.studentName?.toLowerCase().trim() === studentName.toLowerCase().trim()))
        .map((a) => a.testId)
    );

    // Sync any local cached attempts in LOCAL_ATTEMPTS_KEY that aren't in Firestore
    const localCached = getLocal<StudentAttempt[]>(LOCAL_ATTEMPTS_KEY, []);
    for (const locAtt of localCached) {
      if (locAtt.studentId === studentId && !myFirestoreTestIds.has(locAtt.testId)) {
        const docId = locAtt.id || `att-${locAtt.testId}-${studentId}`;
        await setDoc(doc(db, 'attempts', docId), sanitizeForFirestore({ ...locAtt, id: docId, synced: true }), { merge: true });
        await recordUserExamSubmission({
          userId: studentId,
          testId: locAtt.testId,
          finalScore: locAtt.finalScore,
          percentage: locAtt.percentage,
        });
        myFirestoreTestIds.add(locAtt.testId);
        recoveredCount++;
      }
    }

    for (const t of tests) {
      // Check direct localStorage attempt key `pariksha_attempt_${t.id}`
      const savedDirect = localStorage.getItem(`pariksha_attempt_${t.id}`);
      if (savedDirect && !myFirestoreTestIds.has(t.id)) {
        try {
          const parsed = JSON.parse(savedDirect) as StudentAttempt;
          if (parsed && (parsed.studentId === studentId || parsed.studentName?.toLowerCase().trim() === studentName.toLowerCase().trim())) {
            const docId = parsed.id || `att-${t.id}-${studentId}`;
            await setDoc(doc(db, 'attempts', docId), sanitizeForFirestore({ ...parsed, id: docId, studentId, synced: true }), { merge: true });
            await recordUserExamSubmission({
              userId: studentId,
              testId: t.id,
              finalScore: parsed.finalScore,
              percentage: parsed.percentage,
            });
            myFirestoreTestIds.add(t.id);
            recoveredCount++;
            continue;
          }
        } catch {
          // ignore
        }
      }

      // Check unsubmitted in-progress answers for completed/published/released tests
      const isTestFinished =
        t.status === 'completed' || t.status === 'result_published' || t.status === 'released';
      if (isTestFinished && !myFirestoreTestIds.has(t.id)) {
        let matchedAnswerKey = `pariksha_answers_${t.id}_${studentId}`;
        let rawAnswers = localStorage.getItem(matchedAnswerKey);
        let keySuffix = studentId;

        // Also scan localStorage for any pariksha_answers_<testId>_* key on this device
        if (!rawAnswers) {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            const prefix = `pariksha_answers_${t.id}_`;
            if (k && k.startsWith(prefix)) {
              const candidateVal = localStorage.getItem(k);
              if (candidateVal && candidateVal !== '{}') {
                matchedAnswerKey = k;
                rawAnswers = candidateVal;
                keySuffix = k.slice(prefix.length);
                break;
              }
            }
          }
        }

        if (rawAnswers) {
          try {
            const parsedAnswers = JSON.parse(rawAnswers) as Record<string, 'A' | 'B' | 'C' | 'D'>;
            if (parsedAnswers && Object.keys(parsedAnswers).length > 0) {
              const rawVisited = localStorage.getItem(`pariksha_visited_${t.id}_${keySuffix}`);
              const rawReview = localStorage.getItem(`pariksha_reviews_${t.id}_${keySuffix}`);
              const rawTabs = localStorage.getItem(`pariksha_tab_switches_${t.id}_${keySuffix}`);
              await submitExamAttempt({
                testId: t.id,
                studentId,
                studentName: studentName || 'Candidate',
                studentEmail: studentEmail || `${studentId}@candidate.pariksha`,
                answers: parsedAnswers,
                visitedQuestionIds: rawVisited ? JSON.parse(rawVisited) : Object.keys(parsedAnswers),
                markedForReviewIds: rawReview ? JSON.parse(rawReview) : [],
                startedAt: t.examStartTime || new Date().toISOString(),
                isAutoSubmitted: true,
                tabSwitchCount: rawTabs ? parseInt(rawTabs, 10) || 0 : 0,
              });
              localStorage.removeItem(matchedAnswerKey);
              localStorage.removeItem(`pariksha_visited_${t.id}_${keySuffix}`);
              localStorage.removeItem(`pariksha_reviews_${t.id}_${keySuffix}`);
              localStorage.removeItem(`pariksha_tab_switches_${t.id}_${keySuffix}`);
              myFirestoreTestIds.add(t.id);
              recoveredCount++;
            }
          } catch {
            // ignore
          }
        }
      }
    }
  } catch (err) {
    console.warn('recoverStudentLocalExamAttempts warning:', err);
  }

  return recoveredCount;
}

export async function getTestAttempts(testId: string): Promise<StudentAttempt[]> {
  try {
    await recoverMissingAttemptsFromSessions(testId);
  } catch {
    // ignore
  }
  try {
    const q = query(collection(db, 'attempts'), where('testId', '==', testId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentAttempt));
      return list;
    }
  } catch (err) {
    console.warn('Firestore getTestAttempts fallback:', err);
  }
  const attempts = getLocal<StudentAttempt[]>(LOCAL_ATTEMPTS_KEY, []);
  return attempts.filter((a) => a.testId === testId);
}

export async function getAllAttempts(): Promise<StudentAttempt[]> {
  try {
    const snap = await getDocs(collection(db, 'attempts'));
    if (!snap.empty) {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentAttempt));
      return list;
    }
  } catch (err) {
    console.warn('Firestore getAllAttempts fallback:', err);
  }
  return getLocal<StudentAttempt[]>(LOCAL_ATTEMPTS_KEY, []);
}

/* =========================================================
   SETTINGS INITIALIZATION (NO AUTOMATIC DEMO TESTS)
========================================================= */

export async function seedInitialDataIfEmpty(): Promise<void> {
  if (!localStorage.getItem(LOCAL_SETTINGS_KEY)) {
    setLocal(LOCAL_SETTINGS_KEY, DEFAULT_INSTITUTE_SETTINGS);
  }

  // Ensure default institute settings document in Firestore if absent
  try {
    const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
    if (!settingsSnap.exists()) {
      await setDoc(doc(db, 'settings', 'general'), DEFAULT_INSTITUTE_SETTINGS);
    }
  } catch (err) {
    console.warn('Firestore settings check fallback:', err);
  }
}

export async function resetToDemoData(): Promise<void> {
  // Only resets institute settings - does NOT generate any demo tests
  setLocal(LOCAL_SETTINGS_KEY, DEFAULT_INSTITUTE_SETTINGS);
  try {
    await setDoc(doc(db, 'settings', 'general'), DEFAULT_INSTITUTE_SETTINGS);
  } catch {
    // ignore
  }
  broadcastEvent('SETTINGS_UPDATED', DEFAULT_INSTITUTE_SETTINGS);
}
