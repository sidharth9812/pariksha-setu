import React, { useState, useEffect } from 'react';
import {
  Shield,
  User,
  LogOut,
  GraduationCap,
  Wifi,
  WifiOff,
  Menu,
  X,
  PlayCircle,
  BarChart2,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useInstitute } from '../../context/InstituteContext';
import { PWAInstallButton } from '../PWAInstallButton';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenJoinModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, onOpenJoinModal }) => {
  const { user, role, logout } = useAuth();
  const { settings } = useInstitute();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={() => onNavigate(role === 'admin' ? 'admin-dashboard' : 'student-home')}
          >
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-600 to-blue-700 flex items-center justify-center text-white shadow-sm font-bold text-lg overflow-hidden">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt={settings.instituteName} className="w-full h-full object-contain p-0.5 bg-white" />
              ) : (
                <GraduationCap className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-lg tracking-tight">
                  {settings.instituteName || 'ParikshaSetu'}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {role === 'admin' ? 'Admin Portal' : 'Exam Portal'}
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block truncate max-w-xs">
                {settings.tagline || 'Online Competitive Examination System'}
              </p>
            </div>
          </div>

          {/* Center / Navigation Actions */}
          <div className="hidden md:flex items-center gap-3">
            {/* Network status */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                  <span>Offline</span>
                </>
              )}
            </div>

            {/* Quick action buttons */}
            <PWAInstallButton />
            <button
              onClick={onOpenJoinModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Join Exam / Check Result</span>
            </button>

            {role === 'admin' && (
              <button
                onClick={() => onNavigate('admin-live')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  currentView === 'admin-live'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>Live Monitor</span>
              </button>
            )}
          </div>

          {/* User Profile & Actions */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-800 leading-tight">
                    {user.name}
                  </div>
                  <div className="text-xs text-slate-500 truncate max-w-[140px]">
                    {user.email || (role === 'admin' ? 'Administrator' : 'Student')}
                  </div>
                </div>

                <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold overflow-hidden">
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>

                <button
                  onClick={logout}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => onNavigate('login')}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
              >
                Login
              </button>
            )}
          </div>

          {/* Mobile menu hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            <PWAInstallButton />
            <button
              onClick={onOpenJoinModal}
              className="p-2 rounded-lg bg-indigo-50 text-indigo-700 font-medium text-xs flex items-center gap-1 cursor-pointer"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Join</span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-4 space-y-3">
          {user ? (
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">{user.name}</div>
                  <div className="text-xs text-slate-500">{role === 'admin' ? 'Administrator' : 'Student'}</div>
                </div>
              </div>
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="text-xs text-red-600 font-medium px-2 py-1 bg-red-50 rounded cursor-pointer"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                onNavigate('login');
                setMobileMenuOpen(false);
              }}
              className="w-full py-2 text-center text-sm font-medium bg-indigo-600 text-white rounded-lg"
            >
              Sign In
            </button>
          )}

          <div className="grid grid-cols-2 gap-2 text-sm">
            <button
              onClick={() => {
                onOpenJoinModal();
                setMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-lg bg-indigo-50 text-indigo-700 font-medium text-center flex items-center justify-center gap-1.5"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Exam / Result</span>
            </button>

            {role === 'admin' ? (
              <button
                onClick={() => {
                  onNavigate('admin-dashboard');
                  setMobileMenuOpen(false);
                }}
                className="p-2.5 rounded-lg bg-slate-100 text-slate-800 font-medium text-center flex items-center justify-center gap-1.5"
              >
                <Shield className="w-4 h-4" />
                <span>Admin Panel</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  onNavigate('student-home');
                  setMobileMenuOpen(false);
                }}
                className="p-2.5 rounded-lg bg-slate-100 text-slate-800 font-medium text-center flex items-center justify-center gap-1.5"
              >
                <GraduationCap className="w-4 h-4" />
                <span>Tests</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
