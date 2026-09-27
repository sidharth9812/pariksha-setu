import React, { useState } from 'react';
import {
  Clock,
  AlertCircle,
  BookOpen,
  Award,
  RotateCw,
  ArrowLeft,
  ArrowRight,
  Shield,
  FileText,
  Globe,
  CheckCircle2,
  Check,
  AlertTriangle,
  Scale,
  Target,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { TestItem } from '../../types/exam';

interface ReattemptInstructionsViewProps {
  test: TestItem;
  candidateName: string;
  onStartExam: (test: TestItem) => void;
  onCancel: () => void;
}

type InstructionLanguage = 'standard' | 'detailed' | 'simplified';

export const ReattemptInstructionsView: React.FC<ReattemptInstructionsViewProps> = ({
  test,
  candidateName,
  onStartExam,
  onCancel,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<InstructionLanguage>('standard');
  const [hasAgreed, setHasAgreed] = useState<boolean>(false);

  const totalMarks = test.totalQuestions * (test.marksPerQuestion || 1);
  const passingMarks =
    test.passingMarks !== undefined && test.passingMarks > 0
      ? test.passingMarks
      : Math.ceil(totalMarks * 0.4);

  const hasNegativeMarking = Boolean(test.negativeMarks && test.negativeMarks > 0);

  // Dynamic syllabus parsing & fallback topics
  const defaultSyllabusTopics = [
    {
      title: 'General Knowledge & Current Affairs',
      topics: 'State & National History, Geography, Indian Constitution, Polity, Key Events & Awards',
    },
    {
      title: 'Reasoning & Analytical Ability',
      topics: 'Analogies, Syllogisms, Number Series, Coding-Decoding, Direction Sense, Blood Relations',
    },
    {
      title: 'Numerical & Mathematical Ability',
      topics: 'Averages, Ratio & Proportion, Percentages, Profit & Loss, Time & Work, Speed & Distance',
    },
    {
      title: 'General Science & Environment',
      topics: 'Basic Physics, Chemistry, Biology, Human Anatomy, Environmental Ecology & Daily Life Science',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Portal</span>
          </button>

          {/* Language Selector Dropdown */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="hidden sm:inline">Instruction Language:</span>
            </div>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value as InstructionLanguage)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all"
            >
              <option value="standard">English (Standard Exam Guidelines)</option>
              <option value="detailed">English (Detailed Regulations & Policy)</option>
              <option value="simplified">English (Simplified Quick Checklist)</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Banner Card */}
        <div className="bg-linear-to-r from-indigo-900 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 opacity-10 pointer-events-none">
            <RotateCw className="w-64 h-64 text-white" />
          </div>

          <div className="relative z-10 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                <RotateCw className="w-3.5 h-3.5 animate-spin-reverse" />
                <span>Reattempt Mode</span>
              </span>
              <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/10 text-slate-200 border border-white/10">
                {test.examCategory || 'Competitive Examination'}
              </span>
              {test.seriesTitle && (
                <span className="hidden md:inline-block px-3 py-1 rounded-full text-[11px] font-medium bg-indigo-500/20 text-indigo-200 border border-indigo-400/20">
                  {test.seriesTitle}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white">
              {test.title}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {selectedLanguage === 'detailed'
                ? 'Welcome to the reattempt session. Carefully review all examination parameters including marking scheme, time allowance, question counts, and syllabus domain before commencing.'
                : selectedLanguage === 'simplified'
                ? 'Review the test details below. Once you click Start, your fresh reattempt will begin immediately.'
                : 'Please review all examination details, negative marking rules, time allocation, and syllabus topics below before starting your reattempt.'}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-emerald-400">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Candidate: {candidateName}</span>
              <span>&bull;</span>
              <span className="text-emerald-300 font-bold bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-400/30">
                No Password or Code Required
              </span>
              <span>&bull;</span>
              <span>All previous attempt scores remain saved</span>
            </div>
          </div>
        </div>

        {/* Essential Exam Parameters (Grid Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Time / Duration */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Time
              </span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">
                {test.durationMinutes} <span className="text-sm font-semibold text-slate-500">Mins</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                Continuous countdown timer. Test will automatically submit when timer reaches 00:00.
              </p>
            </div>
          </div>

          {/* Card 2: No. of Questions */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Questions
              </span>
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">
                {test.totalQuestions} <span className="text-sm font-semibold text-slate-500">MCQs</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                Multiple-choice questions with 4 choices each. You can mark questions for review.
              </p>
            </div>
          </div>

          {/* Card 3: Negative Marking */}
          <div
            className={`rounded-2xl p-5 border shadow-xs flex flex-col justify-between space-y-3 ${
              hasNegativeMarking
                ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Negative Marking
              </span>
              <div
                className={`p-2 rounded-xl ${
                  hasNegativeMarking ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
                }`}
              >
                <Scale className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black">
                {hasNegativeMarking ? (
                  <>
                    -{test.negativeMarks}{' '}
                    <span className="text-sm font-semibold text-amber-800">per wrong</span>
                  </>
                ) : (
                  <span className="text-emerald-700">No Penalty</span>
                )}
              </div>
              <p className="text-[11px] mt-1 leading-normal opacity-90">
                {hasNegativeMarking
                  ? `Each incorrect answer deducts ${test.negativeMarks} marks. Unattempted questions have 0 penalty.`
                  : 'Zero negative marks. You may answer all questions without point deductions.'}
              </p>
            </div>
          </div>

          {/* Card 4: Marks Scheme & Passing */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Scoring Scheme
              </span>
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <Target className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">
                +{test.marksPerQuestion || 1} <span className="text-sm font-semibold text-slate-500">/ Question</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                Max Marks: <strong>{totalMarks}</strong> &bull; Passing Marks: <strong>{passingMarks}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* SYLLABUS SECTION (IN A PROPER, STRUCTURED BOX) */}
        <div className="bg-white rounded-3xl border-2 border-indigo-100 shadow-sm overflow-hidden">
          {/* Syllabus Header */}
          <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Official Examination Syllabus & Subject Coverage
                </h2>
                <p className="text-xs text-indigo-200">
                  Detailed curriculum scope tested in this examination paper
                </p>
              </div>
            </div>

            <span className="self-start sm:self-auto text-[11px] font-bold px-3 py-1 rounded-full bg-white/10 text-white border border-white/15">
              Subject: {test.subject || test.examCategory || 'Standard Syllabus'}
            </span>
          </div>

          {/* Proper Syllabus Box Content */}
          <div className="p-6 space-y-5">
            {test.syllabus ? (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line font-medium">
                {test.syllabus}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  This examination tests candidates across standard competitive exam modules. Questions in this test paper are sampled according to the following subject topics:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {defaultSyllabusTopics.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100/80 space-y-1.5 transition-all hover:bg-indigo-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                          {item.title}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-600 pl-7 leading-relaxed">
                        {item.topics}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Syllabus summary notice inside box */}
            <div className="p-3.5 bg-blue-50/80 rounded-2xl border border-blue-200/80 flex items-start gap-3 text-xs text-blue-900">
              <Shield className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-blue-950">Standardized Assessment Policy: </span>
                <span>
                  All questions adhere to official competitive exam standards with randomized options sequence to ensure fair reattempt assessment.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Examination Guidelines & Reattempt Rules Box */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <HelpCircle className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              {selectedLanguage === 'detailed'
                ? 'Important Instructions & Assessment Rules'
                : selectedLanguage === 'simplified'
                ? 'Quick Test Rules'
                : 'Examination Guidelines & Instructions'}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900">Independent Reattempt Recording: </span>
                <span>
                  This reattempt will be recorded as an independent submission with its own scorecard. All past attempt scores remain safely stored.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900">Timed Countdown: </span>
                <span>
                  You will have {test.durationMinutes} minutes. The clock will begin immediately upon clicking Start Test.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900">Negative Marks Reminder: </span>
                <span>
                  {hasNegativeMarking
                    ? `Be careful with uncertain questions. An incorrect choice deducts ${test.negativeMarks} marks.`
                    : 'There is zero negative deduction. It is recommended to attempt all questions.'}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900">Navigation & Review: </span>
                <span>
                  You can freely navigate between questions, change your selected choices, and mark questions for later review before final submission.
                </span>
              </div>
            </div>
          </div>

          {/* Student Declaration & Agreement Checkbox */}
          <div className="pt-2">
            <label className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 cursor-pointer select-none transition-all hover:bg-indigo-50">
              <input
                type="checkbox"
                checked={hasAgreed}
                onChange={(e) => setHasAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <div className="space-y-0.5">
                <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                  I have read and understood all the test rules, time duration, negative marking, and syllabus.
                </span>
                <span className="text-[11px] text-slate-600 block">
                  I confirm that I am ready to start my reattempt under timed examination conditions.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 pb-8">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-sm cursor-pointer transition-colors shadow-xs"
          >
            Cancel & Return to Portal
          </button>

          <button
            type="button"
            onClick={() => onStartExam(test)}
            disabled={!hasAgreed}
            className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-md cursor-pointer ${
              hasAgreed
                ? 'bg-linear-to-r from-emerald-600 via-teal-600 to-indigo-700 hover:from-emerald-700 hover:to-indigo-800 text-white hover:shadow-lg active:scale-98'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
            }`}
          >
            <span>Start Test Now</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </main>
    </div>
  );
};
