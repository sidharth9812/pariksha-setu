import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { UserProfile, UserRole } from '../types/exam';

const BOOTSTRAP_ADMIN_EMAIL = 'sidmalviya9827@gmail.com';
const LOCAL_USER_KEY = 'pariksha_current_user';

export interface FirestoreUserData {
  uid: string;
  name: string;
  email: string;
  createdAt: string;
  role?: UserRole;
  photoUrl?: string;
  lastLogin?: string;
}

/**
 * Maps Firebase Auth user into UserProfile without saving to Firestore
 * Authenticate users only - Do NOT save user profile data
 */
export function mapFirebaseUser(
  fbUser: FirebaseUser,
  explicitRole?: UserRole,
  customName?: string
): UserProfile {
  let role: UserRole = explicitRole || 'student';
  const emailLower = (fbUser.email || '').toLowerCase();
  if (
    emailLower === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ||
    emailLower === 'malviyagaribdas17@gmail.com' ||
    emailLower.includes('admin')
  ) {
    role = 'admin';
  }

  const derivedName =
    customName?.trim() ||
    fbUser.displayName ||
    (fbUser.email ? fbUser.email.split('@')[0] : 'Candidate');

  const profile: UserProfile = {
    uid: fbUser.uid,
    name: derivedName,
    email: fbUser.email || '',
    role,
    photoUrl: fbUser.photoURL || undefined,
    isBlocked: false,
    createdAt: fbUser.metadata?.creationTime || new Date().toISOString(),
    lastLogin: fbUser.metadata?.lastSignInTime || new Date().toISOString(),
  };

  try {
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage issues
  }
  return profile;
}

/**
 * Backward compatibility alias
 */
export function mapFirebaseUserWithFirestoreData(
  fbUser: FirebaseUser,
  _firestoreData?: FirestoreUserData | null,
  explicitRole?: UserRole
): UserProfile {
  return mapFirebaseUser(fbUser, explicitRole);
}

/**
 * Compatibility placeholder - Do NOT use Firestore yet
 */
export async function loadFirestoreUserProfile(_uid: string): Promise<FirestoreUserData | null> {
  return null;
}

/**
 * Compatibility placeholder - Do NOT save user profile data
 */
export async function createFirestoreUserIfNotExists(
  fbUser: FirebaseUser,
  customName?: string,
  role?: UserRole
): Promise<FirestoreUserData> {
  return {
    uid: fbUser.uid,
    name: customName || fbUser.displayName || fbUser.email?.split('@')[0] || 'Candidate',
    email: fbUser.email || '',
    createdAt: new Date().toISOString(),
    role: role || 'student',
  };
}

/**
 * Normalizes an email or 10-digit Indian mobile number for Firebase Auth
 */
export function normalizeAuthIdentifier(input: string): { email: string; phone?: string; isPhone: boolean } {
  const clean = (input || '').trim();
  const digitsOnly = clean.replace(/[^0-9]/g, '');

  // Check if it's a mobile number (10 digits, or prefixed with +91, 91, or 0)
  if (
    (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly)) ||
    (digitsOnly.length === 11 && digitsOnly.startsWith('0') && /^[6-9]/.test(digitsOnly.slice(1))) ||
    (digitsOnly.length === 12 && digitsOnly.startsWith('91') && /^[6-9]/.test(digitsOnly.slice(2)))
  ) {
    const tenDigits = digitsOnly.slice(-10);
    return {
      email: `student_${tenDigits}@candidate.pariksha`,
      phone: tenDigits,
      isPhone: true,
    };
  }

  return {
    email: clean.toLowerCase(),
    isPhone: false,
  };
}

/**
 * Sign in using email or mobile number and password
 */
export async function signInUser(
  emailOrPhone: string,
  password: string,
  explicitRole?: UserRole
): Promise<UserProfile> {
  const { email, phone } = normalizeAuthIdentifier(emailOrPhone);

  if (!email) {
    throw new Error('Please enter your email or 10-digit mobile number');
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = mapFirebaseUser(cred.user, explicitRole);
    if (phone) {
      profile.phone = phone;
    }

    // Sync profile to Firestore
    try {
      const now = new Date().toISOString();
      const userRef = doc(db, 'users', cred.user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: cred.user.uid,
          name: profile.name,
          email: profile.email,
          phone: phone || null,
          role: profile.role,
          isBlocked: false,
          registrationType: 'registered',
          isRegistered: true,
          hasJoined: false,
          joinedAt: null,
          registeredAt: now,
          createdAt: now,
          lastLogin: now,
          lastActive: now,
          totalExamsJoined: 0,
          totalExamsSubmitted: 0,
          joinedExams: [],
        });
      } else {
        await updateDoc(userRef, {
          lastLogin: now,
          lastActive: now,
        });
      }
    } catch (e) {
      console.warn('Firestore user sync fallback:', e);
    }

    return profile;
  } catch (error: any) {
    const errorCode = error?.code || '';
    if (
      errorCode === 'auth/invalid-credential' ||
      errorCode === 'auth/wrong-password' ||
      errorCode === 'auth/user-not-found' ||
      errorCode === 'auth/invalid-email' ||
      errorCode === 'auth/invalid-login-credentials'
    ) {
      throw new Error('Email/Mobile or password is incorrect');
    }
    if (errorCode === 'auth/network-request-failed') {
      throw new Error('Network connection error. Please check your internet connection');
    }
    throw new Error(error?.message || 'Email or password is incorrect');
  }
}

/**
 * Sign up using email or mobile number and password
 */
export async function signUpUser(
  emailOrPhone: string,
  password: string,
  explicitRole?: UserRole,
  name?: string
): Promise<UserProfile> {
  const { email, phone } = normalizeAuthIdentifier(emailOrPhone);

  if (!email || (!email.includes('@') && !phone)) {
    throw new Error('Please enter a valid 10-digit mobile number or email address');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const trimmedName = name?.trim() || (phone ? `Candidate ${phone.slice(-4)}` : '');
    if (trimmedName && cred.user) {
      try {
        await updateProfile(cred.user, { displayName: trimmedName });
      } catch {
        // Silently continue
      }
    }

    const profile = mapFirebaseUser(cred.user, explicitRole, trimmedName);
    if (phone) {
      profile.phone = phone;
    }

    // Save registered user document to Firebase Firestore
    try {
      const now = new Date().toISOString();
      await setDoc(
        doc(db, 'users', cred.user.uid),
        {
          uid: cred.user.uid,
          name: profile.name,
          email: profile.email,
          phone: phone || null,
          role: profile.role,
          isBlocked: false,
          registrationType: 'registered',
          isRegistered: true,
          hasJoined: false,
          joinedAt: null,
          registeredAt: now,
          createdAt: now,
          lastLogin: now,
          lastActive: now,
          totalExamsJoined: 0,
          totalExamsSubmitted: 0,
          joinedExams: [],
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Firestore user save fallback:', e);
    }

    return profile;
  } catch (error: any) {
    const errorCode = error?.code || '';
    if (errorCode === 'auth/email-already-in-use') {
      throw new Error('User already exists with this mobile/email. Please Sign In');
    }
    if (errorCode === 'auth/weak-password') {
      throw new Error('Password must be at least 6 characters');
    }
    if (errorCode === 'auth/invalid-email') {
      throw new Error('Please enter a valid 10-digit mobile number or email address');
    }
    if (errorCode === 'auth/network-request-failed') {
      throw new Error('Network connection error. Please check your internet connection');
    }
    if (errorCode === 'auth/too-many-requests') {
      throw new Error('Too many attempts. Please try again after 1 minute');
    }
    throw new Error(error?.message || 'Failed to create student account');
  }
}

/**
 * Records or updates a user in the Firestore 'users' collection when they join an examination.
 * This guarantees every participant (registered or direct guest candidate) has an up-to-date
 * document in the 'users' collection with their joined exam history.
 */
export async function recordUserExamJoin(params: {
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  testId: string;
  testTitle: string;
  accessCode?: string;
}): Promise<void> {
  const { userId, name, email, phone, role = 'student', testId, testTitle, accessCode } = params;
  if (!userId) return;

  const now = new Date().toISOString();
  const userRef = doc(db, 'users', userId);

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const existingExams: any[] = Array.isArray(data.joinedExams) ? [...data.joinedExams] : [];
      
      const examIndex = existingExams.findIndex((e) => e.testId === testId);
      if (examIndex >= 0) {
        existingExams[examIndex] = {
          ...existingExams[examIndex],
          testTitle: testTitle || existingExams[examIndex].testTitle,
          accessCode: accessCode || existingExams[examIndex].accessCode,
          joinedAt: existingExams[examIndex].joinedAt || now,
          lastJoinedAt: now,
          status: existingExams[examIndex].status === 'submitted' ? 'submitted' : 'waiting',
        };
      } else {
        existingExams.push({
          testId,
          testTitle,
          accessCode: accessCode || '',
          joinedAt: now,
          status: 'waiting',
        });
      }

      await setDoc(
        userRef,
        {
          name: name || data.name,
          email: email || data.email,
          phone: phone || data.phone || null,
          role: data.role || role,
          hasJoined: true,
          joinedAt: data.joinedAt || now,
          lastActive: now,
          totalExamsJoined: existingExams.length,
          joinedExams: existingExams,
        },
        { merge: true }
      );
    } else {
      // New direct candidate joining without prior registration
      const newRecord = {
        testId,
        testTitle,
        accessCode: accessCode || '',
        joinedAt: now,
        status: 'waiting',
      };

      await setDoc(userRef, {
        uid: userId,
        name: name || 'Candidate',
        email: email || `${userId}@candidate.pariksha`,
        phone: phone || null,
        role: 'student',
        isBlocked: false,
        registrationType: 'direct_exam_join',
        isRegistered: false,
        hasJoined: true,
        joinedAt: now,
        registeredAt: null,
        createdAt: now,
        lastLogin: now,
        lastActive: now,
        totalExamsJoined: 1,
        totalExamsSubmitted: 0,
        joinedExams: [newRecord],
      });
    }
  } catch (err) {
    console.warn('Firestore recordUserExamJoin warning:', err);
  }
}

/**
 * Updates a user's record in the Firestore 'users' collection when an examination is submitted
 */
export async function recordUserExamSubmission(params: {
  userId: string;
  testId: string;
  finalScore: number;
  percentage: number;
}): Promise<void> {
  const { userId, testId, finalScore, percentage } = params;
  if (!userId) return;

  const now = new Date().toISOString();
  const userRef = doc(db, 'users', userId);

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const existingExams: any[] = Array.isArray(data.joinedExams) ? [...data.joinedExams] : [];
      
      const examIndex = existingExams.findIndex((e) => e.testId === testId);
      if (examIndex >= 0) {
        existingExams[examIndex] = {
          ...existingExams[examIndex],
          status: 'submitted',
          score: finalScore,
          percentage: percentage,
          submittedAt: now,
        };
      } else {
        existingExams.push({
          testId,
          testTitle: 'Examination',
          joinedAt: now,
          status: 'submitted',
          score: finalScore,
          percentage: percentage,
          submittedAt: now,
        });
      }

      const submittedCount = existingExams.filter((e) => e.status === 'submitted' || e.status === 'auto_submitted').length;

      await setDoc(
        userRef,
        {
          hasJoined: true,
          lastActive: now,
          totalExamsSubmitted: submittedCount,
          totalExamsJoined: existingExams.length,
          joinedExams: existingExams,
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.warn('Firestore recordUserExamSubmission warning:', err);
  }
}

/**
 * Fetch all users from Firebase Firestore (both registered and exam joiners)
 */
export async function getAllRegisteredUsers(): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    if (!snap.empty) {
      return snap.docs.map((d) => {
        const data = d.data();
        const joinedExams = Array.isArray(data.joinedExams) ? data.joinedExams : [];
        return {
          uid: data.uid || d.id,
          name: data.name || data.email?.split('@')[0] || 'Candidate',
          email: data.email || '',
          phone: data.phone || undefined,
          role: data.role || 'student',
          isBlocked: !!data.isBlocked,
          registrationType: data.registrationType || (data.isRegistered ? 'registered' : 'direct_exam_join'),
          isRegistered: data.isRegistered !== undefined ? data.isRegistered : true,
          hasJoined: data.hasJoined !== undefined ? data.hasJoined : joinedExams.length > 0,
          joinedAt: data.joinedAt || undefined,
          registeredAt: data.registeredAt || data.createdAt || undefined,
          createdAt: data.createdAt || new Date().toISOString(),
          lastLogin: data.lastLogin || data.createdAt || new Date().toISOString(),
          lastActive: data.lastActive || data.lastLogin || data.createdAt || new Date().toISOString(),
          totalExamsJoined: data.totalExamsJoined !== undefined ? data.totalExamsJoined : joinedExams.length,
          totalExamsSubmitted: data.totalExamsSubmitted || 0,
          joinedExams: joinedExams,
          photoUrl: data.photoUrl,
        } as UserProfile;
      });
    }
  } catch (err) {
    console.warn('Firestore fetch all users fallback:', err);
  }
  return [];
}

/**
 * COMPLETELY DELETE USER ON FIREBASE
 * Completely removes user document, all their exam attempts, and all their sessions
 */
export async function deleteUserCompletely(userId: string): Promise<void> {
  // 1. Delete user document from Firestore
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (err) {
    console.warn('Firestore delete user doc warning:', err);
  }

  // 2. Query and delete all student attempts from Firestore
  try {
    const qAttempts = query(collection(db, 'attempts'), where('studentId', '==', userId));
    const attSnap = await getDocs(qAttempts);
    const deletePromises = attSnap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (err) {
    console.warn('Firestore delete user attempts warning:', err);
  }

  // 3. Query and delete all student sessions from Firestore
  try {
    const qSessions = query(collection(db, 'examSessions'), where('studentId', '==', userId));
    const sesSnap = await getDocs(qSessions);
    const deletePromises = sesSnap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (err) {
    console.warn('Firestore delete user sessions warning:', err);
  }

  // 4. Clean up local storage caches
  try {
    const blockedRaw = localStorage.getItem('pariksha_blocked_students');
    if (blockedRaw) {
      const blocked: string[] = JSON.parse(blockedRaw);
      localStorage.setItem('pariksha_blocked_students', JSON.stringify(blocked.filter((id) => id !== userId)));
    }

    const attemptsRaw = localStorage.getItem('pariksha_attempts_cache');
    if (attemptsRaw) {
      const atts: any[] = JSON.parse(attemptsRaw);
      localStorage.setItem('pariksha_attempts_cache', JSON.stringify(atts.filter((a) => a.studentId !== userId)));
    }

    const sessionsRaw = localStorage.getItem('pariksha_sessions_cache');
    if (sessionsRaw) {
      const sess: any[] = JSON.parse(sessionsRaw);
      localStorage.setItem('pariksha_sessions_cache', JSON.stringify(sess.filter((s) => s.studentId !== userId)));
    }

    const localUserRaw = localStorage.getItem(LOCAL_USER_KEY);
    if (localUserRaw) {
      const u = JSON.parse(localUserRaw);
      if (u?.uid === userId) {
        localStorage.removeItem(LOCAL_USER_KEY);
      }
    }
  } catch (err) {
    console.warn('Local cache cleanup warning:', err);
  }

  // 5. Broadcast user deletion across tabs
  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel('pariksha_realtime_channel');
      bc.postMessage({ type: 'USER_DELETED', payload: { userId } });
      bc.close();
    }
  } catch {
    // ignore
  }
}

/**
 * Sign out user and remove local session
 */
export async function logOut(): Promise<void> {
  try {
    await fbSignOut(auth);
  } catch (err) {
    console.warn('Sign out warning:', err);
  }
  localStorage.removeItem(LOCAL_USER_KEY);
}

/**
 * Get current cached user profile from localStorage
 */
export function getCurrentLocalUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
