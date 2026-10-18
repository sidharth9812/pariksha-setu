import React, { useState, useRef } from 'react';
import { Settings, Save, CheckCircle2, Shield, Building2, Upload, Image, Loader2, X } from 'lucide-react';
import { useInstitute } from '../../context/InstituteContext';
import { InstituteSettings } from '../../types/exam';
import { uploadInstituteLogo } from '../../services/storageService';

export const SettingsManager: React.FC = () => {
  const { settings, updateSettings } = useInstitute();

  const [instituteName, setInstituteName] = useState(settings.instituteName);
  const [tagline, setTagline] = useState(settings.tagline);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || '');
  const [contactEmail, setContactEmail] = useState(settings.contactEmail || '');
  const [contactPhone, setContactPhone] = useState(settings.contactPhone || '');
  const [defaultDurationMinutes, setDefaultDurationMinutes] = useState(settings.defaultDurationMinutes || 60);
  const [defaultMarksPerQuestion, setDefaultMarksPerQuestion] = useState(settings.defaultMarksPerQuestion || 1);
  const [defaultNegativeMarks, setDefaultNegativeMarks] = useState(settings.defaultNegativeMarks || 0.25);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    setUploadProgress(0);
    try {
      const url = await uploadInstituteLogo(file, (progress) => {
        setUploadProgress(progress);
      });
      setLogoUrl(url);
    } catch (err: any) {
      alert(err.message || 'Media upload failed. Please try again.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: InstituteSettings = {
      ...settings,
      instituteName,
      tagline,
      logoUrl,
      contactEmail,
      contactPhone,
      defaultDurationMinutes: Number(defaultDurationMinutes),
      defaultMarksPerQuestion: Number(defaultMarksPerQuestion),
      defaultNegativeMarks: Number(defaultNegativeMarks),
    };
    await updateSettings(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Institute Branding & Examination Defaults
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Configure coaching academy identity, exam default marking schemes and system configurations.
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
          <Building2 className="w-5 h-5 text-indigo-600" />
          <h2 className="font-bold text-base text-slate-900">Coaching Institute Profile</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Coaching Institute Name *
            </label>
            <input
              type="text"
              required
              value={instituteName}
              onChange={(e) => setInstituteName(e.target.value)}
              placeholder="e.g. Utkarsh Competitive Examination Academy"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Cloudinary Media Logo Upload */}
          <div className="sm:col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Institute Logo (Cloudinary Media)
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Upload your academy logo or emblem. Supported formats: PNG, JPG, WebP, SVG (Max 5MB).
                </p>
              </div>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl('')}
                  className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Logo Preview */}
              <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Institute Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <Building2 className="w-8 h-8 text-slate-300" />
                )}
              </div>

              {/* Upload Action */}
              <div className="flex-1 w-full space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoUpload}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isUploadingLogo}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors disabled:opacity-60"
                  >
                    {isUploadingLogo ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading ({uploadProgress}%)...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Choose Logo File</span>
                      </>
                    )}
                  </button>

                  <span className="text-[11px] text-slate-400">
                    Stored securely in Firebase Cloud Storage bucket
                  </span>
                </div>

                {isUploadingLogo && (
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Tagline / Subheading
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Premier Institute for MP Police, MP SI, SSC & State Services"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Official Contact Email
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contact@institute.org"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Helpline Phone / WhatsApp
            </label>
            <input
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+91 98270 XXXXX"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-4 pb-2 border-t border-slate-200">
          <Settings className="w-5 h-5 text-indigo-600" />
          <h2 className="font-bold text-base text-slate-900">Default Examination Settings</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Default Duration (Minutes)
            </label>
            <input
              type="number"
              min={5}
              max={360}
              value={defaultDurationMinutes}
              onChange={(e) => setDefaultDurationMinutes(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Default Positive Marks (+Marks)
            </label>
            <input
              type="number"
              step="0.25"
              value={defaultMarksPerQuestion}
              onChange={(e) => setDefaultMarksPerQuestion(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Default Negative Marks (-Marks)
            </label>
            <input
              type="number"
              step="0.05"
              value={defaultNegativeMarks}
              onChange={(e) => setDefaultNegativeMarks(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          {savedSuccess && (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Settings saved successfully!</span>
            </div>
          )}
          {!savedSuccess && <div />}

          <button
            type="submit"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </form>

      {/* Firestore Connection Diagnostic */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>Cloud Firestore Status</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Verify live connectivity between your app and Google Cloud Firestore.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                const { doc, setDoc, getDoc } = await import('firebase/firestore');
                const { db } = await import('../../firebase/config');
                const testRef = doc(db, '_connection_test', 'status');
                await setDoc(testRef, {
                  connectedAt: new Date().toISOString(),
                  status: 'OK',
                  source: 'SettingsManager'
                });
                const snap = await getDoc(testRef);
                if (snap.exists()) {
                  alert('🎉 Firestore is LIVE and connected! Successfully wrote and read test document.');
                }
              } catch (err: any) {
                console.error('Firestore check error:', err);
                alert(`⚠️ Firestore connection issue:\n\n${err?.message || err}\n\nPlease verify your Firebase Rules and Database creation in Firebase Console.`);
              }
            }}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-semibold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Test Live Firestore Connection</span>
          </button>
        </div>
      </div>
    </div>
  );
};
