import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  getCurrentLocalUser,
  mapFirebaseUser,
  signInUser,
  signUpUser,
  logOut,
  findUserForPasswordReset,
  verifyResetCode,
  resetUserPassword,
} from '../services/authService';
import { UserProfile, UserRole } from '../types/exam';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string, role?: UserRole) => Promise<UserProfile>;
  signUp: (
    emailOrPhoneOrParams:
      | string
      | {
          name: string;
          phone: string;
          email?: string;
          password: string;
          role?: UserRole;
        },
    password?: string,
    role?: UserRole,
    name?: string
  ) => Promise<UserProfile>;
  logout: () => Promise<void>;
  findUserForPasswordReset: (emailOrPhone: string) => Promise<{
    userId: string;
    name: string;
    phone?: string;
    email: string;
    maskedTarget: string;
    code: string;
    expiresAt: number;
  }>;
  verifyResetCode: (userId: string, code: string) => Promise<boolean>;
  resetUserPassword: (userId: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  updateUserProfileState: (updates: Partial<UserProfile>) => void;
  switchRoleForTesting?: (newRole: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => getCurrentLocalUser());
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // 1. Initialize user from local storage immediately if available
    const local = getCurrentLocalUser();
    if (local) {
      setUser(local);
    }
    setLoading(false);

    // 2. Synchronize with Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        const currentLocal = getCurrentLocalUser();
        const profile = mapFirebaseUser(fbUser, currentLocal?.role, currentLocal?.name);
        if (currentLocal?.phone) {
          profile.phone = currentLocal.phone;
        }
        if (currentLocal?.realEmail) {
          profile.realEmail = currentLocal.realEmail;
        }
        setUser(profile);
      }
      // Note: do not wipe session if fbUser is null, because user may be authenticated
      // via local verified credentials or recent password reset. Only explicit logout wipes session.
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async (emailOrPhone: string, password: string, role?: UserRole) => {
    setLoading(true);
    try {
      const u = await signInUser(emailOrPhone, password, role);
      setUser(u);
      return u;
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (
    emailOrPhoneOrParams:
      | string
      | {
          name: string;
          phone: string;
          email?: string;
          password: string;
          role?: UserRole;
        },
    password?: string,
    role?: UserRole,
    name?: string
  ) => {
    setLoading(true);
    try {
      const u = await signUpUser(emailOrPhoneOrParams, password, role, name);
      // Explicitly do not activate session immediately upon registration
      // The user must log in with their newly registered credentials
      setUser(null);
      return u;
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logOut();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const updateUserProfileState = (updates: Partial<UserProfile>) => {
    if (user) {
      const updated: UserProfile = { ...user, ...updates };
      setUser(updated);
      try {
        localStorage.setItem('pariksha_current_user', JSON.stringify(updated));
      } catch {
        // ignore
      }
    }
  };

  const switchRoleForTesting = (newRole: UserRole) => {
    if (user) {
      const updated: UserProfile = { ...user, role: newRole };
      setUser(updated);
      localStorage.setItem('pariksha_current_user', JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        loading,
        signIn: handleSignIn,
        signUp: handleSignUp,
        logout: handleLogout,
        findUserForPasswordReset,
        verifyResetCode,
        resetUserPassword,
        updateUserProfileState,
        switchRoleForTesting,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
