import React, { useState } from 'react';
import {
  GraduationCap,
  Shield,
  KeyRound,
  Mail,
  User,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  Phone,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useInstitute } from '../../context/InstituteContext';

interface LoginViewProps {
  onSuccess: () => void;
  onOpenDirectExam?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess, onOpenDirectExam }) => {
  const { signIn, signUp } = useAuth();
  const { settings } = useInstitute();

  const [activeTab, setActiveTab] = useState<'student' | 'admin'>('student');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Student form state
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState(''); // Mobile number or email
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Admin form state
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanIdent = identifier.trim();
    const cleanPass = password.trim();

    if (!cleanIdent) {
      setError('Please enter your 10-digit Mobile Number or Email');
      return;
    }

    if (authMode === 'signup') {
      const cleanName = name.trim();
      if (!cleanName) {
        setError('Please enter your Full Name');
        return;
      }
      if (cleanPass.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      if (cleanPass !== confirmPassword.trim()) {
        setError('Passwords do not match');
        return;
      }

      setLoading(true);
      try {
        await signUp(cleanIdent, cleanPass, 'student', cleanName);
        setSuccessMessage('Registration successful! Logging in to your student dashboard...');
        setTimeout(() => {
          onSuccess();
        }, 300);
      } catch (err: any) {
        setError(err.message || 'Registration failed. Please verify your details.');
      } finally {
        setLoading(false);
      }
    } else {
      // Sign In mode
      if (!cleanPass) {
        setError('Please enter your password');
        return;
      }

      setLoading(true);
      try {
        await signIn(cleanIdent, cleanPass, 'student');
        onSuccess();
      } catch (err: any) {
        setError(err.message || 'Email/Mobile or password is incorrect');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      await signIn(adminEmail.trim(), adminPassword.trim(), 'admin');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Admin email or password is incorrect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto space-y-6">
        {/* Header Branding */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-tr from-indigo-600 to-blue-600 text-white shadow-md mb-3">
            <GraduationCap className="w-9 h-9" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {settings.instituteName}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Online Competitive Examination Portal
          </p>

          {/* Exam Badges */}
          <div className="mt-3 flex flex-wrap justify-center gap-1.5 text-[11px] font-medium text-slate-600">
            <span className="px-2 py-0.5 rounded-full bg-slate-200/80">MP Police Constable</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-200/80">MP SI</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-200/80">SSC CGL / GD</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-200/80">State Exams</span>
          </div>
        </div>

        {/* Direct Exam Access Button (No login required) */}
        {onOpenDirectExam && (
          <button
            type="button"
            onClick={onOpenDirectExam}
            className="w-full p-4 bg-linear-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl shadow-sm flex items-center justify-between text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                  <span>Direct Exam Link Access & Result Check</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/25 text-[10px] font-extrabold uppercase tracking-wide">
                    Direct Code
                  </span>
                </div>
                <div className="text-[11px] text-emerald-100 mt-0.5">
                  Have an Exam Code? Enter directly with your Name & Password without account
                </div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition-transform" />
          </button>
        )}

        {/* Tab Switcher: Student vs Admin */}
        <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-xs flex">
          <button
            type="button"
            onClick={() => {
              setActiveTab('student');
              setError(null);
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'student'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Student Portal</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setError(null);
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Admin Portal</span>
          </button>
        </div>

        {/* Card Body */}
        <div className="bg-white py-8 px-6 sm:px-8 rounded-2xl border border-slate-200/80 shadow-sm">
          {/* Notifications */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex flex-col gap-2 text-red-700 text-xs sm:text-sm">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                <span className="font-semibold leading-relaxed">{error}</span>
              </div>
              {error.includes('already exists') && (
                <div className="pl-7">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setError(null);
                    }}
                    className="text-xs font-bold text-indigo-700 underline hover:text-indigo-900 cursor-pointer"
                  >
                    Switch to Sign In &rarr;
                  </button>
                </div>
              )}
              {error.includes('incorrect') && authMode === 'signin' && (
                <div className="pl-7">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setError(null);
                    }}
                    className="text-xs font-bold text-indigo-700 underline hover:text-indigo-900 cursor-pointer"
                  >
                    New user? Click here to Register &rarr;
                  </button>
                </div>
              )}
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-emerald-800 text-xs sm:text-sm">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          {/* STUDENT TAB */}
          {activeTab === 'student' ? (
            <div className="space-y-5">
              {/* Prominent Student Mode Toggle: Sign In vs Sign Up */}
              <div className="p-1 bg-slate-100 rounded-xl grid grid-cols-2 gap-1 text-xs sm:text-sm font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setError(null);
                  }}
                  className={`py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    authMode === 'signin'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setError(null);
                  }}
                  className={`py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    authMode === 'signup'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Register</span>
                </button>
              </div>

              {/* Form Title & Description */}
              <div className="text-left space-y-0.5">
                <h2 className="text-lg font-bold text-slate-900">
                  {authMode === 'signup'
                    ? 'Student Registration'
                    : 'Student Sign In'}
                </h2>
                <p className="text-xs text-slate-500">
                  {authMode === 'signup'
                    ? 'Enter your name, mobile/email, and password to create account.'
                    : 'Sign in using your registered mobile number or email.'}
                </p>
              </div>

              {/* Student Form */}
              <form onSubmit={handleStudentSubmit} className="space-y-4">
                {/* Full Name field (Only in Sign Up mode) */}
                {authMode === 'signup' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rahul Sharma"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* Mobile Number or Email field */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Mobile Number or Email *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      inputMode="email"
                      required
                      placeholder="e.g. 9826012345 or candidate@gmail.com"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {authMode === 'signup'
                      ? 'You can register with your 10-digit mobile number or personal email address.'
                      : 'Enter the mobile number or email used during registration.'}
                  </p>
                </div>

                {/* Password field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Password *
                    </label>
                    <span className="text-[10px] text-slate-400">Min 6 characters</span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder={authMode === 'signup' ? 'Create a secure password (min 6 characters)' : 'Enter your password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password field (Only in Sign Up mode) */}
                {authMode === 'signup' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-xs transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                >
                  {authMode === 'signup' ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                  <span>
                    {loading
                      ? authMode === 'signup'
                        ? 'Creating Account...'
                        : 'Signing in...'
                      : authMode === 'signup'
                      ? 'Register & Create Account'
                      : 'Sign In to Portal'}
                  </span>
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>

              {/* Mode switch helper link */}
              <div className="pt-2 text-center text-xs text-slate-600 border-t border-slate-100">
                {authMode === 'signup' ? (
                  <span>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signin');
                        setError(null);
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer ml-1"
                    >
                      Sign In here
                    </button>
                  </span>
                ) : (
                  <span>
                    New student?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signup');
                        setError(null);
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer ml-1"
                    >
                      Register here
                    </button>
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* ADMIN TAB */
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="text-left space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-slate-900">
                    Administrator Sign In
                  </h2>
                </div>
                <p className="text-xs text-slate-500">
                  Authorized institute staff and exam coordinators only.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Admin Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@institute.edu"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Admin Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm shadow-xs transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              >
                <KeyRound className="w-4 h-4" />
                <span>
                  {loading ? 'Verifying Admin Access...' : 'Sign In as Administrator'}
                </span>
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400">
          Secure Examination System &bull; ParikshaSetu Cloud Authentication
        </p>
      </div>
    </div>
  );
};
