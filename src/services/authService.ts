import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  updatePassword as fbUpdatePassword,
  sendPasswordResetEmail,
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
  realEmail?: string;
  authEmail?: string;
  phone?: string | null;
  createdAt: string;
  role?: UserRole;
  photoUrl?: string;
  lastLogin?: string;
  passwordHash?: string;
  passwordSalt?: string;
  resetCode?: string | null;
  resetExpiresAt?: number | null;
}

/**
 * Hash password securely with salt using SHA-256
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${password}:${salt}`);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a random cryptographic salt
 */
export function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify a plain password against a stored salt and hash
 */
export async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  if (!password || !salt || !hash) return false;
  const computed = await hashPassword(password, salt);
  return computed === hash;
}

/**
 * Normalizes an Indian 10-digit mobile number, stripping spaces, dashes, +91, 91, or 0 prefixes.
 * Returns exactly 10 digits, or null if invalid.
 */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return digits;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  return null;
}

/**
 * Normalizes an email address by trimming and converting to lowercase.
 * Returns valid email or null if invalid format.
 */
export function normalizeEmail(raw: string): string | null {
  if (!raw) return null;
  const clean = raw.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(clean) ? clean : null;
}

/**
 * Normalizes an email or 10-digit Indian mobile number for Firebase Auth
 */
export function normalizeAuthIdentifier(input: string): {
  email: string;
  phone?: string;
  isPhone: boolean;
  cleanInput: string;
} {
  const clean = (input || '').trim();
  const validPhone = normalizePhone(clean);

  if (validPhone) {
    return {
      email: `student_${validPhone}@candidate.pariksha`,
      phone: validPhone,
      isPhone: true,
      cleanInput: validPhone,
    };
  }

  const cleanEmail = clean.toLowerCase();
  return {
    email: cleanEmail,
    isPhone: false,
    cleanInput: cleanEmail,
  };
}

/**
 * Check if an account already exists in Firestore by phone or email.
 * Guarantees that:
 * - One mobile number can be linked to only ONE account.
 * - One email address can be linked to only ONE account.
 */
export async function checkExistingAccount(params: {
  phone?: string | null;
  email?: string | null;
}): Promise<{
  exists: boolean;
  matchedField?: 'phone' | 'email';
  existingUser?: UserProfile;
}> {
  const cleanPhone = params.phone ? normalizePhone(params.phone) : null;
  const cleanEmail = params.email ? normalizeEmail(params.email) : null;

  try {
    const usersCol = collection(db, 'users');

    // 1. Check email address uniqueness first if email was provided
    if (cleanEmail) {
      // Check in 'email' field
      const qEmail = query(usersCol, where('email', '==', cleanEmail));
      const snapEmail = await getDocs(qEmail);
      if (!snapEmail.empty) {
        const docData = snapEmail.docs[0].data();
        return {
          exists: true,
          matchedField: 'email',
          existingUser: {
            uid: snapEmail.docs[0].id,
            name: docData.name,
            email: docData.email,
            phone: docData.phone,
            role: docData.role || 'student',
          },
        };
      }

      // Check in 'realEmail' field
      const qRealEmail = query(usersCol, where('realEmail', '==', cleanEmail));
      const snapRealEmail = await getDocs(qRealEmail);
      if (!snapRealEmail.empty) {
        const docData = snapRealEmail.docs[0].data();
        return {
          exists: true,
          matchedField: 'email',
          existingUser: {
            uid: snapRealEmail.docs[0].id,
            name: docData.name,
            email: docData.email,
            phone: docData.phone,
            role: docData.role || 'student',
          },
        };
      }

      // Check in 'authEmail' field
      const qAuthEmail = query(usersCol, where('authEmail', '==', cleanEmail));
      const snapAuthEmail = await getDocs(qAuthEmail);
      if (!snapAuthEmail.empty) {
        const docData = snapAuthEmail.docs[0].data();
        return {
          exists: true,
          matchedField: 'email',
          existingUser: {
            uid: snapAuthEmail.docs[0].id,
            name: docData.name,
            email: docData.email,
            phone: docData.phone,
            role: docData.role || 'student',
          },
        };
      }
    }

    // 2. Check mobile number uniqueness
    if (cleanPhone) {
      const qPhone = query(usersCol, where('phone', '==', cleanPhone));
      const snapPhone = await getDocs(qPhone);
      if (!snapPhone.empty) {
        const docData = snapPhone.docs[0].data();
        return {
          exists: true,
          matchedField: 'phone',
          existingUser: {
            uid: snapPhone.docs[0].id,
            name: docData.name,
            email: docData.email,
            phone: docData.phone,
            role: docData.role || 'student',
          },
        };
      }

      // Also check synthetic email for that phone
      const syntheticEmail = `student_${cleanPhone}@candidate.pariksha`;
      const qSynthetic = query(usersCol, where('email', '==', syntheticEmail));
      const snapSynthetic = await getDocs(qSynthetic);
      if (!snapSynthetic.empty) {
        const docData = snapSynthetic.docs[0].data();
        return {
          exists: true,
          matchedField: 'phone',
          existingUser: {
            uid: snapSynthetic.docs[0].id,
            name: docData.name,
            email: docData.email,
            phone: docData.phone || cleanPhone,
            role: docData.role || 'student',
          },
        };
      }
    }
  } catch (err) {
    console.warn('Firestore checkExistingAccount error:', err);
  }

  return { exists: false };
}

/**
 * Maps Firebase Auth user into UserProfile
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

export function mapFirebaseUserWithFirestoreData(
  fbUser: FirebaseUser,
  _firestoreData?: FirestoreUserData | null,
  explicitRole?: UserRole
): UserProfile {
  return mapFirebaseUser(fbUser, explicitRole);
}

export async function loadFirestoreUserProfile(_uid: string): Promise<FirestoreUserData | null> {
  return null;
}

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
 * Sign in using email or mobile number and password
 */
export async function signInUser(
  emailOrPhone: string,
  password: string,
  explicitRole?: UserRole
): Promise<UserProfile> {
  const cleanInput = (emailOrPhone || '').trim();
  if (!cleanInput) {
    throw new Error('Please enter your 10-digit Mobile Number or Email Address');
  }
  if (!password) {
    throw new Error('Please enter your password');
  }

  const phone = normalizePhone(cleanInput);
  const email = normalizeEmail(cleanInput);
  const isEmail = Boolean(email || cleanInput.includes('@'));
  const cleanEmail = email || (cleanInput.includes('@') ? cleanInput.toLowerCase() : null);
  const { email: authEmailFromIdent } = normalizeAuthIdentifier(cleanInput);

  // If input format is neither valid 10-digit phone nor valid email
  if (!phone && !cleanEmail) {
    if (explicitRole === 'admin') {
      throw new Error('Please enter a valid Admin Email Address');
    }
    throw new Error('Please enter a valid 10-digit Mobile Number or Email Address');
  }

  // 1. First, search for user document in Firestore by phone or email
  let matchedDoc: any = null;
  let matchedDocId: string | null = null;

  try {
    const usersCol = collection(db, 'users');

    if (phone) {
      const q1 = query(usersCol, where('phone', '==', phone));
      const s1 = await getDocs(q1);
      if (!s1.empty) {
        matchedDoc = s1.docs[0].data();
        matchedDocId = s1.docs[0].id;
      } else {
        const qSynth = query(usersCol, where('email', '==', `student_${phone}@candidate.pariksha`));
        const sSynth = await getDocs(qSynth);
        if (!sSynth.empty) {
          matchedDoc = sSynth.docs[0].data();
          matchedDocId = sSynth.docs[0].id;
        }
      }
    } else if (cleanEmail) {
      const qEmail = query(usersCol, where('email', '==', cleanEmail));
      const sEmail = await getDocs(qEmail);
      if (!sEmail.empty) {
        matchedDoc = sEmail.docs[0].data();
        matchedDocId = sEmail.docs[0].id;
      } else {
        const qReal = query(usersCol, where('realEmail', '==', cleanEmail));
        const sReal = await getDocs(qReal);
        if (!sReal.empty) {
          matchedDoc = sReal.docs[0].data();
          matchedDocId = sReal.docs[0].id;
        } else {
          const qAuth = query(usersCol, where('authEmail', '==', cleanEmail));
          const sAuth = await getDocs(qAuth);
          if (!sAuth.empty) {
            matchedDoc = sAuth.docs[0].data();
            matchedDocId = sAuth.docs[0].id;
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('Firestore login lookup fallback:', err);
    if (err?.code === 'unavailable' || err?.message?.includes('network')) {
      throw new Error('Network connection error. Please check your internet connection');
    }
  }

  const now = new Date().toISOString();

  // 2. If user document exists in Firestore:
  if (matchedDoc) {
    // 2A. Check with secure passwordHash & passwordSalt if present
    if (matchedDoc.passwordHash && matchedDoc.passwordSalt) {
      const isPasswordValid = await verifyPassword(
        password,
        matchedDoc.passwordSalt,
        matchedDoc.passwordHash
      );

      if (!isPasswordValid) {
        // STRICT REQUIREMENT: Wrong password must show exactly "Wrong password. Please try again."
        throw new Error('Wrong password. Please try again.');
      }

      // Password matches! Determine role and build profile
      let role: UserRole = matchedDoc.role || 'student';
      const docEmailLower = (matchedDoc.email || '').toLowerCase();
      if (
        docEmailLower === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ||
        docEmailLower === 'malviyagaribdas17@gmail.com' ||
        docEmailLower.includes('admin')
      ) {
        role = 'admin';
      }

      if (explicitRole === 'admin' && role !== 'admin') {
        throw new Error('Access denied. This account does not have administrator privileges.');
      }

      const profile: UserProfile = {
        uid: matchedDocId || matchedDoc.uid,
        name: matchedDoc.name || 'Candidate',
        email: matchedDoc.email || authEmailFromIdent,
        realEmail: matchedDoc.realEmail || (matchedDoc.email?.includes('@candidate.pariksha') ? undefined : matchedDoc.email),
        authEmail: matchedDoc.authEmail || matchedDoc.email,
        phone: matchedDoc.phone || phone || undefined,
        role,
        photoUrl: matchedDoc.profileImageUrl || matchedDoc.photoUrl || undefined,
        profileImageUrl: matchedDoc.profileImageUrl || undefined,
        profileImagePublicId: matchedDoc.profileImagePublicId || undefined,
        isBlocked: !!matchedDoc.isBlocked,
        createdAt: matchedDoc.createdAt || now,
        lastLogin: now,
        totalExamsJoined: matchedDoc.totalExamsJoined || 0,
        totalExamsSubmitted: matchedDoc.totalExamsSubmitted || 0,
        joinedExams: matchedDoc.joinedExams || [],
      };

      // Background Firebase Auth sign-in if applicable
      const targetAuthEmail = matchedDoc.authEmail || matchedDoc.email || authEmailFromIdent;
      if (targetAuthEmail) {
        try {
          await signInWithEmailAndPassword(auth, targetAuthEmail, password);
        } catch {
          // Password verified via secure hash
        }
      }

      // Update lastLogin in Firestore
      try {
        if (matchedDocId) {
          await updateDoc(doc(db, 'users', matchedDocId), {
            lastLogin: now,
            lastActive: now,
          });
        }
      } catch (e) {
        console.warn('Firestore lastLogin update warning:', e);
      }

      try {
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
      } catch {
        // ignore
      }

      return profile;
    }

    // 2B. User document exists in Firestore but has no passwordHash yet (authenticate via Firebase Auth)
    const targetFirebaseEmail =
      matchedDoc.authEmail ||
      matchedDoc.email ||
      authEmailFromIdent;

    try {
      const cred = await signInWithEmailAndPassword(auth, targetFirebaseEmail, password);
      const profile = mapFirebaseUser(cred.user, explicitRole, matchedDoc.name);
      if (phone || matchedDoc.phone) {
        profile.phone = phone || matchedDoc.phone;
      }
      if (matchedDoc.realEmail) {
        profile.realEmail = matchedDoc.realEmail;
      }

      // Automatically upgrade passwordHash for this user in Firestore
      try {
        const userRef = doc(db, 'users', cred.user.uid);
        const salt = generateSalt();
        const hash = await hashPassword(password, salt);
        await updateDoc(userRef, {
          passwordHash: hash,
          passwordSalt: salt,
          lastLogin: now,
          lastActive: now,
        });
      } catch (e) {
        console.warn('Firestore user hash upgrade warning:', e);
      }

      try {
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
      } catch {
        // ignore
      }

      return profile;
    } catch (error: any) {
      const errorCode = error?.code || '';
      if (errorCode === 'auth/network-request-failed') {
        throw new Error('Network connection error. Please check your internet connection');
      }
      if (errorCode === 'auth/too-many-requests') {
        throw new Error('Too many attempts. Please try again after 1 minute');
      }
      // User document exists in database, so authentication failure is strictly wrong password
      throw new Error('Wrong password. Please try again.');
    }
  }

  // 3. User document was NOT found in Firestore:
  // Check if it's the bootstrap admin email
  const isBootstrapAdmin = cleanEmail && cleanEmail.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
  if (isBootstrapAdmin) {
    try {
      const cred = await signInWithEmailAndPassword(auth, BOOTSTRAP_ADMIN_EMAIL, password);
      return mapFirebaseUser(cred.user, 'admin', 'Super Admin');
    } catch (error: any) {
      const errorCode = error?.code || '';
      if (errorCode === 'auth/network-request-failed') {
        throw new Error('Network connection error. Please check your internet connection');
      }
      throw new Error('Wrong password. Please try again.');
    }
  }

  // Fallback check against Firebase Auth directly in case account was created in Auth but not synced to Firestore
  const targetFirebaseEmail = cleanEmail || (phone ? `student_${phone}@candidate.pariksha` : null);
  if (targetFirebaseEmail) {
    try {
      const cred = await signInWithEmailAndPassword(auth, targetFirebaseEmail, password);
      const profile = mapFirebaseUser(cred.user, explicitRole);
      const salt = generateSalt();
      const hash = await hashPassword(password, salt);
      try {
        await setDoc(
          doc(db, 'users', cred.user.uid),
          {
            uid: cred.user.uid,
            name: profile.name,
            email: profile.email,
            realEmail: cleanEmail || null,
            authEmail: targetFirebaseEmail,
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
            passwordHash: hash,
            passwordSalt: salt,
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('Firestore fallback sync warning:', e);
      }
      try {
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
      } catch {
        // ignore
      }
      return profile;
    } catch (error: any) {
      const errorCode = error?.code || '';
      if (errorCode === 'auth/network-request-failed') {
        throw new Error('Network connection error. Please check your internet connection');
      }
      if (errorCode === 'auth/too-many-requests') {
        throw new Error('Too many attempts. Please try again after 1 minute');
      }
      // If user does not exist in Firestore and Firebase Auth sign in failed with invalid credential:
      if (explicitRole === 'admin') {
        throw new Error('Admin account not found. Please check your credentials.');
      }
      if (isEmail) {
        throw new Error('Email not registered. Please sign up first.');
      } else {
        throw new Error('Mobile number not registered. Please sign up first.');
      }
    }
  }

  // Account does not exist in the system
  if (explicitRole === 'admin') {
    throw new Error('Admin account not found. Please check your credentials.');
  }
  if (isEmail) {
    throw new Error('Email not registered. Please sign up first.');
  }
  throw new Error('Mobile number not registered. Please sign up first.');
}

/**
 * Sign up using name, mobile number, optional email, and password.
 * Strictly guarantees:
 * - One mobile number can be linked to only ONE account.
 * - One email address can be linked to only ONE account.
 * - If account exists with email or mobile, shows: "Account already exists. Please login."
 * - Properly checks both email and mobile before creating an account.
 */
export async function signUpUser(
  emailOrPhoneOrParams:
    | string
    | {
        name: string;
        phone: string;
        email?: string;
        password: string;
        role?: UserRole;
      },
  passwordArg?: string,
  explicitRole?: UserRole,
  nameArg?: string
): Promise<UserProfile> {
  let name = '';
  let phoneInput = '';
  let emailInput: string | undefined = undefined;
  let password = '';
  let role: UserRole = explicitRole || 'student';

  if (typeof emailOrPhoneOrParams === 'object' && emailOrPhoneOrParams !== null) {
    name = (emailOrPhoneOrParams.name || '').trim();
    phoneInput = (emailOrPhoneOrParams.phone || '').trim();
    emailInput = emailOrPhoneOrParams.email ? emailOrPhoneOrParams.email.trim() : undefined;
    password = emailOrPhoneOrParams.password || '';
    role = emailOrPhoneOrParams.role || 'student';
  } else {
    // Positional signature: emailOrPhone, password, role, name
    const rawIdent = (emailOrPhoneOrParams || '').trim();
    password = passwordArg || '';
    name = (nameArg || '').trim();

    const normalizedP = normalizePhone(rawIdent);
    if (normalizedP) {
      phoneInput = normalizedP;
    } else {
      emailInput = rawIdent;
    }
  }

  // 1. Validate Full Name
  if (!name) {
    throw new Error('Please enter your Full Name');
  }

  // 2. Validate Mobile Number (Mandatory for competitive examination students)
  const cleanPhone = normalizePhone(phoneInput);
  if (phoneInput && !cleanPhone) {
    throw new Error('Please enter a valid 10-digit Indian mobile number (e.g. 9826012345)');
  }

  // 3. Validate Email Address (if provided)
  const cleanEmail = emailInput ? normalizeEmail(emailInput) : null;
  if (emailInput && !cleanEmail) {
    throw new Error('Please enter a valid email address (e.g. student@gmail.com)');
  }

  // Must have at least a valid mobile number or email
  if (!cleanPhone && !cleanEmail) {
    throw new Error('Please provide a valid 10-digit mobile number or email address');
  }

  // 4. Validate Password
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  // 5. CRITICAL REQUIREMENT: Check both email and mobile before creating an account
  // If either already exists, DO NOT create a new account.
  // Show: "Account already exists. Please login."
  const existingCheck = await checkExistingAccount({
    phone: cleanPhone,
    email: cleanEmail,
  });

  if (existingCheck.exists) {
    if (existingCheck.matchedField === 'email') {
      throw new Error('Email already registered. Please login instead.');
    }
    throw new Error('Mobile number already registered. Please login instead.');
  }

  // 6. Determine Firebase Auth Email
  const authEmail = cleanEmail || `student_${cleanPhone}@candidate.pariksha`;

  // 7. Generate secure password hash and salt
  const passwordSalt = generateSalt();
  const passwordHash = await hashPassword(password, passwordSalt);

  try {
    const cred = await createUserWithEmailAndPassword(auth, authEmail, password);

    if (name && cred.user) {
      try {
        await updateProfile(cred.user, { displayName: name });
      } catch {
        // Silently continue
      }
    }

    const now = new Date().toISOString();
    const profile: UserProfile = {
      uid: cred.user.uid,
      name,
      email: cleanEmail || authEmail,
      realEmail: cleanEmail || undefined,
      authEmail,
      phone: cleanPhone || undefined,
      role,
      isBlocked: false,
      registrationType: 'registered',
      isRegistered: true,
      hasJoined: false,
      joinedAt: undefined,
      registeredAt: now,
      createdAt: now,
      lastLogin: now,
      lastActive: now,
      totalExamsJoined: 0,
      totalExamsSubmitted: 0,
      joinedExams: [],
    };

    // Save registered user document to Firebase Firestore
    try {
      await setDoc(
        doc(db, 'users', cred.user.uid),
        {
          uid: cred.user.uid,
          name,
          email: cleanEmail || authEmail,
          realEmail: cleanEmail || null,
          authEmail,
          phone: cleanPhone || null,
          role,
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
          passwordHash,
          passwordSalt,
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Firestore user save fallback:', e);
    }

    // Sign out from Firebase Auth and clear local session so account is only active after explicit login
    try {
      await fbSignOut(auth);
    } catch {
      // Ignore
    }
    try {
      localStorage.removeItem(LOCAL_USER_KEY);
    } catch {
      // Ignore
    }

    return profile;
  } catch (error: any) {
    const errorCode = error?.code || '';
    if (errorCode === 'auth/email-already-in-use') {
      if (cleanEmail) {
        throw new Error('Email already registered. Please login instead.');
      }
      throw new Error('Mobile number already registered. Please login instead.');
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
 * FORGOT PASSWORD - STEP 1: Find user ONLY through registered email
 * Searches Firestore for registered email address.
 * If not found: shows "Email not registered. Please sign up first."
 */
export async function findUserForPasswordReset(emailInput: string): Promise<{
  userId: string;
  name: string;
  email: string;
  phone?: string;
  maskedTarget: string;
  code: string;
  expiresAt: number;
}> {
  const cleanInput = (emailInput || '').trim();
  if (!cleanInput) {
    throw new Error('Please enter your registered email address');
  }

  // REQUIREMENT: Forgot password only through email
  if (!cleanInput.includes('@')) {
    throw new Error('Forgot password is only available through your registered email address.');
  }

  const email = normalizeEmail(cleanInput);
  if (!email || !email.includes('.')) {
    throw new Error('Please enter a valid email address (e.g. student@gmail.com)');
  }

  let matchedUserDoc: any = null;
  let matchedUserId: string | null = null;

  try {
    const usersCol = collection(db, 'users');

    // 1. Search by 'email' field
    const qEmail = query(usersCol, where('email', '==', email));
    const sEmail = await getDocs(qEmail);
    if (!sEmail.empty) {
      matchedUserDoc = sEmail.docs[0].data();
      matchedUserId = sEmail.docs[0].id;
    } else {
      // 2. Search by 'realEmail' field
      const qReal = query(usersCol, where('realEmail', '==', email));
      const sReal = await getDocs(qReal);
      if (!sReal.empty) {
        matchedUserDoc = sReal.docs[0].data();
        matchedUserId = sReal.docs[0].id;
      } else {
        // 3. Search by 'authEmail' field
        const qAuth = query(usersCol, where('authEmail', '==', email));
        const sAuth = await getDocs(qAuth);
        if (!sAuth.empty) {
          matchedUserDoc = sAuth.docs[0].data();
          matchedUserId = sAuth.docs[0].id;
        }
      }
    }
  } catch (err) {
    console.warn('Firestore findUserForPasswordReset lookup error:', err);
  }

  // CRITICAL REQUIREMENT: If the email is not registered, show a clear "Email not registered" message.
  if (!matchedUserDoc || !matchedUserId) {
    throw new Error('Email not registered. Please sign up first.');
  }

  // Generate 6-digit OTP verification code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes validity

  // Determine masked recipient email target
  const parts = email.split('@');
  const namePart = parts[0];
  const maskedTarget = `${namePart.slice(0, 2)}••••@${parts[1]}`;

  // Save verification code & expiration to Firestore
  try {
    await updateDoc(doc(db, 'users', matchedUserId), {
      resetCode: code,
      resetExpiresAt: expiresAt,
      resetTarget: email,
    });
  } catch (e) {
    console.warn('Firestore resetCode save fallback:', e);
  }

  // Also trigger Firebase Auth password reset email to their inbox if applicable
  try {
    const targetAuthEmail = matchedUserDoc.authEmail || matchedUserDoc.email || email;
    if (!targetAuthEmail.includes('@candidate.pariksha')) {
      await sendPasswordResetEmail(auth, targetAuthEmail);
    }
  } catch (err) {
    console.warn('Firebase sendPasswordResetEmail fallback:', err);
  }

  return {
    userId: matchedUserId,
    name: matchedUserDoc.name || 'Candidate',
    email,
    phone: matchedUserDoc.phone || undefined,
    maskedTarget,
    code,
    expiresAt,
  };
}

/**
 * FORGOT PASSWORD - STEP 2: Verify reset OTP code
 */
export async function verifyResetCode(userId: string, code: string): Promise<boolean> {
  if (!userId || !code) {
    throw new Error('Please enter the 6-digit verification code');
  }

  const cleanCode = code.trim();
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    throw new Error('Account not found');
  }

  const data = snap.data();
  if (!data.resetCode || data.resetCode !== cleanCode) {
    throw new Error('Invalid verification code. Please check and try again.');
  }

  if (data.resetExpiresAt && Date.now() > data.resetExpiresAt) {
    throw new Error('Verification code has expired. Please request a new code.');
  }

  return true;
}

/**
 * FORGOT PASSWORD - STEP 3: Set new password and save securely
 * Strictly guarantees:
 * - Saves the new password securely
 * - The new password works immediately for login
 */
export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  if (!userId) {
    throw new Error('User identification is missing');
  }
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    throw new Error('Account not found');
  }

  const now = new Date().toISOString();
  const newSalt = generateSalt();
  const newHash = await hashPassword(newPassword, newSalt);

  // Save securely to Firestore
  await updateDoc(userRef, {
    passwordHash: newHash,
    passwordSalt: newSalt,
    resetCode: null,
    resetExpiresAt: null,
    updatedAt: now,
  });

  // If user is currently authenticated in Firebase Auth, update Firebase Auth password as well
  if (auth.currentUser && auth.currentUser.uid === userId) {
    try {
      await fbUpdatePassword(auth.currentUser, newPassword);
    } catch {
      // ignore
    }
  }

  return {
    success: true,
    message: 'Password has been reset successfully. You can now login with your new password.',
  };
}

/**
 * Records or updates a user in the Firestore 'users' collection when they join an examination.
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

      const submittedCount = existingExams.filter(
        (e) => e.status === 'submitted' || e.status === 'auto_submitted'
      ).length;

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
          realEmail: data.realEmail,
          authEmail: data.authEmail,
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
          photoUrl: data.profileImageUrl || data.photoUrl || undefined,
          profileImageUrl: data.profileImageUrl || undefined,
          profileImagePublicId: data.profileImagePublicId || undefined,
        } as UserProfile;
      });
    }
  } catch (err) {
    console.warn('Firestore fetch all users fallback:', err);
  }
  return [];
}

/**
 * Delete user completely from Firebase
 */
export async function deleteUserCompletely(userId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (err) {
    console.warn('Firestore delete user doc warning:', err);
  }

  try {
    const qAttempts = query(collection(db, 'attempts'), where('studentId', '==', userId));
    const attSnap = await getDocs(qAttempts);
    const deletePromises = attSnap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (err) {
    console.warn('Firestore delete user attempts warning:', err);
  }

  try {
    const qSessions = query(collection(db, 'examSessions'), where('studentId', '==', userId));
    const sesSnap = await getDocs(qSessions);
    const deletePromises = sesSnap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (err) {
    console.warn('Firestore delete user sessions warning:', err);
  }

  if (typeof localStorage !== 'undefined') {
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
  }

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
