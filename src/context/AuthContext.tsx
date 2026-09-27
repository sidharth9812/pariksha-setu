import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  getCurrentLocalUser,
  mapFirebaseUser,
  signInUser,
  signUpUser,
  logOut,
} from '../services/authService';
import { UserProfile, UserRole } from '../types/exam';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string, role?: UserRole) => Promise<UserProfile>;
  signUp: (email: string, password: string, role?: UserRole, name?: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  switchRoleForTesting?: (newRole: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => getCurrentLocalUser());
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        // Authenticate users only - do NOT query Firestore
        const local = getCurrentLocalUser();
        const profile = mapFirebaseUser(fbUser, local?.role, local?.name);
        if (local?.phone) {
          profile.phone = local.phone;
        }
        setUser(profile);
      } else {
        setUser(null);
        localStorage.removeItem('pariksha_current_user');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async (email: string, password: string, role?: UserRole) => {
    setLoading(true);
    try {
      const u = await signInUser(email, password, role);
      setUser(u);
      return u;
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (email: string, password: string, role?: UserRole, name?: string) => {
    setLoading(true);
    try {
      const u = await signUpUser(email, password, role, name);
      setUser(u);
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
