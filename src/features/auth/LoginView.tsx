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
  RotateCcw,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useInstitute } from '../../context/InstituteContext';

interface LoginViewProps {
  onSuccess: () => void;
  onOpenDirectExam?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess, onOpenDirectExam }) => {
  const {
    signIn,
    signUp,
    findUserForPasswordReset,
    verifyResetCode,
    resetUserPassword,
  } = useAuth();
  const { settings } = useInstitute();

  const [activeTab, setActiveTab] = useState<'student' | 'admin'>('student');
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot_password'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Student Sign In / Sign Up state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState(''); // Mobile number or email for sign in
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot Password Wizard state
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3 | 4>(1);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetUserName, setResetUserName] = useState('');
  const [resetMaskedTarget, setResetMaskedTarget] = useState('');
  const [resetOtpCode, setResetOtpCode] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // Admin form state
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Handle Student Sign In & Registration Submit
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (authMode === 'signup') {
      const cleanName = name.trim();
      const cleanPhone = phone.trim();
      const cleanEmail = email.trim();
      const cleanPass = password.trim();

      if (!cleanName) {
        setError('Please enter your Full Name');
        return;
      }
      if (!cleanPhone && !cleanEmail) {
        setError('Please enter your 10-digit Mobile Number or Email Address');
        return;
      }
      if (cleanPhone && cleanPhone.length !== 10) {
        setError('Please enter a valid 10-digit Indian Mobile Number');
        return;
      }
      if (cleanEmail && (!cleanEmail.includes('@') || !cleanEmail.includes('.'))) {
        setError('Please enter a valid Email Address');
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
        await signUp({
          name: cleanName,
          phone: cleanPhone,
          email: cleanEmail || undefined,
          password: cleanPass,
          role: 'student',
        });
        setSuccessMessage('Registration successful. You can now login.');
        setAuthMode('signin');
        setLoginIdentifier(cleanEmail || cleanPhone);
        setPassword('');
        setConfirmPassword('');
      } catch (err: any) {
        setError(err.message || 'Registration failed. Please check your details.');
      } finally {
        setLoading(false);
      }
    } else if (authMode === 'signin') {
      const cleanIdent = loginIdentifier.trim();
      const cleanPass = password.trim();

      if (!cleanIdent) {
        setError('Please enter your 10-digit Mobile Number or Email Address');
        return;
      }
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

  // FORGOT PASSWORD - STEP 1: Find user and generate OTP
  const handleForgotStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanInput = forgotIdentifier.trim();
    if (!cleanInput) {
      setError('Please enter your registered email address');
      return;
    }

    if (!cleanInput.includes('@') || !cleanInput.includes('.')) {
      setError('Please enter a valid registered email address (e.g. student@gmail.com). Password recovery is available only via email.');
      return;
    }

    setLoading(true);
    try {
      const res = await findUserForPasswordReset(cleanInput);
      setResetUserId(res.userId);
      setResetUserName(res.name);
      setResetMaskedTarget(res.maskedTarget);
      setResetOtpCode(res.code);
      setForgotStep(2);
      setSuccessMessage(`Account verified for ${res.name}. Verification code has been generated.`);
    } catch (err: any) {
      setError(err.message || 'Account not found. Please check your registered email address.');
    } finally {
      setLoading(false);
    }
  };

  // FORGOT PASSWORD - STEP 2: Verify OTP
  const handleForgotStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanCode = enteredOtp.trim();
    if (!cleanCode || cleanCode.length < 4) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    if (!resetUserId) {
      setError('Session expired. Please start over.');
      setForgotStep(1);
      return;
    }

    setLoading(true);
    try {
      await verifyResetCode(resetUserId, cleanCode);
      setForgotStep(3);
      setSuccessMessage('Code verified successfully! Now set your new password.');
    } catch (err: any) {
      setError(err.message || 'Invalid verification code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  // FORGOT PASSWORD - STEP 3: Set and save new password
  const handleForgotStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanPass = newPassword.trim();
    if (!cleanPass || cleanPass.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (cleanPass !== confirmNewPassword.trim()) {
      setError('Passwords do not match');
      return;
    }
    if (!resetUserId) {
      setError('Session expired. Please start over.');
      setForgotStep(1);
      return;
    }

    setLoading(true);
    try {
      await resetUserPassword(resetUserId, cleanPass);
      setForgotStep(4);
      setSuccessMessage('Password reset successfully! Your new password is now active.');
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // FORGOT PASSWORD - STEP 4: Login immediately with the new password
  const handleLoginWithNewPassword = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(forgotIdentifier.trim(), newPassword.trim(), 'student');
      onSuccess();
    } catch (err: any) {
      // If auto-login fails, switch to sign-in form with prefilled identifier
      setLoginIdentifier(forgotIdentifier);
      setAuthMode('signin');
      setError('Please sign in using your new password.');
    } finally {
      setLoading(false);
    }
  };

  // Admin form submit
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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto space-y-5">
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
          <div className="mt-2.5 flex flex-wrap justify-center gap-1.5 text-[11px] font-medium text-slate-600">
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
            className="w-full p-3.5 bg-linear-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl shadow-xs flex items-center justify-between text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                  <span>Direct Exam Code Access</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-white/25 text-[10px] font-extrabold uppercase tracking-wide">
                    Direct Join
                  </span>
                </div>
                <div className="text-[11px] text-emerald-100 mt-0.5">
                  Have an Exam Code? Enter with Name & Password without an account
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-white/80 group-hover:translate-x-1 transition-transform shrink-0" />
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
        <div className="bg-white py-7 px-6 sm:px-8 rounded-2xl border border-slate-200/80 shadow-sm">
          {/* Notifications */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex flex-col gap-2 text-red-700 text-xs sm:text-sm">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                <span className="font-semibold leading-relaxed">{error}</span>
              </div>
              {(error.includes('already registered') || error.includes('already exists')) && (
                <div className="pl-7">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      if (email) setLoginIdentifier(email);
                      else if (phone) setLoginIdentifier(phone);
                      setError(null);
                    }}
                    className="text-xs font-bold text-indigo-700 underline hover:text-indigo-900 cursor-pointer"
                  >
                    Switch to Sign In &rarr;
                  </button>
                </div>
              )}
              {(error.includes('not registered') || error.includes('Account not found')) && (
                <div className="pl-7">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      if (loginIdentifier.includes('@')) {
                        setEmail(loginIdentifier);
                      } else if (loginIdentifier.replace(/\D/g, '').length === 10) {
                        setPhone(loginIdentifier);
                      } else if (forgotIdentifier.includes('@')) {
                        setEmail(forgotIdentifier);
                      }
                      setError(null);
                    }}
                    className="text-xs font-bold text-indigo-700 underline hover:text-indigo-900 cursor-pointer"
                  >
                    New Student? Click here to Register &rarr;
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
              {/* If not in Forgot Password mode, show Sign In / Register toggle */}
              {authMode !== 'forgot_password' ? (
                <>
                  <div className="p-1 bg-slate-100 rounded-xl grid grid-cols-2 gap-1 text-xs sm:text-sm font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signin');
                        setError(null);
                        setSuccessMessage(null);
                      }}
                      className={`py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        authMode === 'signin'
                          ? 'bg-white text-indigo-700 shadow-xs'
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
                        setSuccessMessage(null);
                      }}
                      className={`py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        authMode === 'signup'
                          ? 'bg-white text-indigo-700 shadow-xs'
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
                      {authMode === 'signup' ? 'Student Registration' : 'Student Sign In'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {authMode === 'signup'
                        ? 'Enter your name, 10-digit mobile number, and password to create an account.'
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

                    {/* Registration: Separate Mobile Number and Email Fields */}
                    {authMode === 'signup' ? (
                      <>
                        {/* 10-digit Mobile Number */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Mobile Number (10 Digits)
                          </label>
                          <div className="relative flex">
                            <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-300 bg-slate-50 text-slate-500 text-xs font-bold">
                              +91
                            </span>
                            <div className="relative flex-1">
                              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                              <input
                                type="tel"
                                inputMode="numeric"
                                maxLength={10}
                                placeholder="9826012345"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-r-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white font-medium tracking-wide"
                              />
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Provide your 10-digit mobile number or email address (at least one is required).
                          </p>
                        </div>

                        {/* Email Address */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Email Address
                            </label>
                            <span className="text-[10px] text-slate-400">One account per email</span>
                          </div>
                          <div className="relative">
                            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                            <input
                              type="email"
                              placeholder="e.g. rahul@gmail.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Sign In Mode: Single Identifier Field */
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Mobile Number or Email *
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                          <input
                            type="text"
                            required
                            placeholder="e.g. 9826012345 or candidate@gmail.com"
                            value={loginIdentifier}
                            onChange={(e) => setLoginIdentifier(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Enter your registered 10-digit mobile number or email address.
                        </p>
                      </div>
                    )}

                    {/* Password field */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Password *
                        </label>
                        {authMode === 'signin' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setAuthMode('forgot_password');
                              setForgotStep(1);
                              setForgotIdentifier(loginIdentifier.includes('@') ? loginIdentifier : '');
                              setError(null);
                              setSuccessMessage(null);
                            }}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                          >
                            Forgot Password?
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">Min 6 characters</span>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          placeholder={
                            authMode === 'signup'
                              ? 'Create a secure password (min 6 characters)'
                              : 'Enter your password'
                          }
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
                            {showConfirmPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
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
                      {authMode === 'signup' ? (
                        <UserPlus className="w-4 h-4" />
                      ) : (
                        <LogIn className="w-4 h-4" />
                      )}
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
                </>
              ) : (
                /* FORGOT PASSWORD WIZARD */
                <div className="space-y-4">
                  {/* Step indicators */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signin');
                        setError(null);
                        setSuccessMessage(null);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Sign In</span>
                    </button>
                    <div className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                      Step {forgotStep} of 3
                    </div>
                  </div>

                  {/* STEP 1: Enter registered email only */}
                  {forgotStep === 1 && (
                    <form onSubmit={handleForgotStep1Submit} className="space-y-4">
                      <div className="text-left space-y-1">
                        <div className="flex items-center gap-2">
                          <RotateCcw className="w-5 h-5 text-indigo-600" />
                          <h3 className="text-base font-bold text-slate-900">Forgot Password</h3>
                        </div>
                        <p className="text-xs text-slate-500">
                          Password recovery is available only through your registered email address. Enter your email to receive a verification code.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Registered Email Address *
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                          <input
                            type="email"
                            required
                            placeholder="e.g. student@gmail.com"
                            value={forgotIdentifier}
                            onChange={(e) => setForgotIdentifier(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-xs transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {loading ? 'Verifying Email...' : 'Send Verification Code'}
                        {!loading && <ArrowRight className="w-4 h-4" />}
                      </button>
                    </form>
                  )}

                  {/* STEP 2: Enter Verification Code */}
                  {forgotStep === 2 && (
                    <form onSubmit={handleForgotStep2Submit} className="space-y-4">
                      <div className="text-left space-y-1">
                        <h3 className="text-base font-bold text-slate-900">Enter Verification Code</h3>
                        <p className="text-xs text-slate-500">
                          Account verified for <strong className="text-slate-800">{resetUserName}</strong>. Verification code sent to {resetMaskedTarget}.
                        </p>
                      </div>

                      {/* Display OTP for fast testing and instant recovery */}
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-600" />
                          <span className="text-xs font-medium text-amber-900">Security Verification OTP:</span>
                        </div>
                        <span className="text-base font-extrabold tracking-widest text-indigo-700 font-mono bg-white px-2.5 py-0.5 rounded-lg border border-amber-200">
                          {resetOtpCode}
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          6-Digit Verification Code *
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          required
                          placeholder="Enter 6-digit code"
                          value={enteredOtp}
                          onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                          className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-center text-lg font-bold tracking-widest text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white font-mono"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setForgotStep(1);
                            setError(null);
                          }}
                          className="w-1/3 py-2.5 px-3 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 cursor-pointer"
                        >
                          Change
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-2/3 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-xs transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                          {loading ? 'Verifying Code...' : 'Verify Code & Proceed'}
                          {!loading && <ArrowRight className="w-4 h-4" />}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* STEP 3: Set New Password */}
                  {forgotStep === 3 && (
                    <form onSubmit={handleForgotStep3Submit} className="space-y-4">
                      <div className="text-left space-y-1">
                        <h3 className="text-base font-bold text-slate-900">Set New Password</h3>
                        <p className="text-xs text-slate-500">
                          Account verified. Enter a new password of at least 6 characters.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          New Password *
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            placeholder="Enter new password (min 6 characters)"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Confirm New Password *
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                          <input
                            type={showConfirmNewPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            placeholder="Re-enter new password"
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showConfirmNewPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-xs transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {loading ? 'Saving New Password...' : 'Save New Password & Continue'}
                        {!loading && <ArrowRight className="w-4 h-4" />}
                      </button>
                    </form>
                  )}

                  {/* STEP 4: Success confirmation */}
                  {forgotStep === 4 && (
                    <div className="py-4 text-center space-y-4">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto">
                        <CheckCircle2 className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-lg font-extrabold text-slate-900">
                          Password Reset Successfully!
                        </h3>
                        <p className="text-xs text-slate-600 max-w-xs mx-auto">
                          Your new password has been saved securely and works immediately.
                        </p>
                      </div>

                      <div className="space-y-2 pt-2">
                        <button
                          type="button"
                          onClick={handleLoginWithNewPassword}
                          disabled={loading}
                          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                        >
                          <LogIn className="w-4 h-4" />
                          <span>{loading ? 'Signing in...' : 'Sign In with New Password'}</span>
                          {!loading && <ArrowRight className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('signin');
                            setLoginIdentifier(forgotIdentifier);
                            setPassword('');
                            setError(null);
                            setSuccessMessage(null);
                          }}
                          className="w-full py-2 px-3 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          Go to Sign In Form
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
