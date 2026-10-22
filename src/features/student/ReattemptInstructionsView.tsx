import React, { useState } from 'react';
import {
  Clock,
  BookOpen,
  RotateCw,
  ArrowLeft,
  ArrowRight,
  Shield,
  FileText,
  Globe,
  CheckCircle2,
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

  const defaultSyllabusTopics = [
    {
      title: 'General Knowledge & Current Affairs',
      topics:
        'State & National History, Geography, Indian Constitution, Polity, Key Events & Awards',
    },
    {
      title: 'Reasoning & Analytical Ability',
      topics:
        'Analogies, Syllogisms, Number Series, Coding-Decoding, Direction Sense, Blood Relations',
    },
    {
      title: 'Numerical & Mathematical Ability',
      topics:
        'Averages, Ratio & Proportion, Percentages, Profit & Loss, Time & Work, Speed & Distance',
    },
    {
      title: 'General Science & Environment',
      topics:
        'Basic Physics, Chemistry, Biology, Human Anatomy, Environmental Ecology & Daily Life Science',
    },
  ];

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface flex flex-col antialiased">
      {/* Top App Bar */}
      <header className="bg-surface/90 backdrop-blur-md border-b border-outline-variant/20 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 font-headline text-xs sm:text-sm font-bold text-on-surface hover:text-primary transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Portal</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant">
              <Globe className="w-4 h-4 text-primary shrink-0" />
              <span className="hidden sm:inline">Guidelines:</span>
            </div>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value as InstructionLanguage)}
              className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 rounded-xl text-xs font-headline font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary cursor-pointer transition-all"
            >
              <option value="standard">English (Standard Guidelines)</option>
              <option value="detailed">English (Detailed Regulations)</option>
              <option value="simplified">English (Quick Checklist)</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Hero Exam Banner Card */}
        <div className="bg-linear-to-br from-primary via-primary-container to-surface-tint rounded-2xl p-6 sm:p-7 text-on-primary shadow-md relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10 blur-2xl pointer-events-none" />

          <div className="relative z-10 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-headline font-bold uppercase tracking-wider bg-white/20 text-white flex items-center gap-1.5">
                <RotateCw className="w-3.5 h-3.5" />
                <span>Practice &amp; Reattempt Mode</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-headline font-bold uppercase tracking-wider bg-white/15 text-on-primary-container">
                {test.examCategory || 'Competitive Exam'}
              </span>
              {test.seriesTitle && (
                <span className="hidden md:inline-block px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-white/10 text-on-primary-container">
                  {test.seriesTitle}
                </span>
              )}
            </div>

            <h1 className="font-headline text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              {test.title}
            </h1>

            <p className="text-xs sm:text-sm text-on-primary-container max-w-2xl leading-relaxed">
              {selectedLanguage === 'detailed'
                ? 'Welcome to the examination session. Carefully review all parameters including marking scheme, time allowance, question count, and syllabus scope before commencing.'
                : selectedLanguage === 'simplified'
                ? 'Review the test details below. Once you click Start Test Now, your timed session will begin immediately.'
                : 'Please review the examination marking rules, time allocation, and syllabus topics below before starting your test.'}
            </p>

            <div className="pt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-white">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <span>Candidate: {candidateName}</span>
              <span>&bull;</span>
              <span className="bg-white/15 px-2 py-0.5 rounded text-[11px] font-headline font-bold">
                All previous attempts remain saved
              </span>
            </div>
          </div>
        </div>

        {/* 2x2 / 4-Column Exam Parameters Bento Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
          <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/20 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-headline font-bold uppercase tracking-wider text-on-surface-variant">
                Total Time
              </span>
              <div className="w-7 h-7 rounded-lg bg-primary-fixed text-primary flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="font-headline text-2xl font-extrabold text-on-surface">
                {test.durationMinutes}{' '}
                <span className="text-xs font-semibold text-on-surface-variant">Mins</span>
              </div>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Auto-submits when timer ends
              </p>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/20 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-headline font-bold uppercase tracking-wider text-on-surface-variant">
                Questions
              </span>
              <div className="w-7 h-7 rounded-lg bg-secondary-fixed text-secondary flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="font-headline text-2xl font-extrabold text-on-surface">
                {test.totalQuestions}{' '}
                <span className="text-xs font-semibold text-on-surface-variant">MCQs</span>
              </div>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                4 options per question
              </p>
            </div>
          </div>

          <div
            className={`rounded-xl p-4 border flex flex-col justify-between space-y-2 ${
              hasNegativeMarking
                ? 'bg-error-container/25 border-error/20'
                : 'bg-emerald-50/70 border-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-headline font-bold uppercase tracking-wider text-on-surface-variant">
                Negative Mark
              </span>
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  hasNegativeMarking
                    ? 'bg-error-container text-error'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div
                className={`font-headline text-2xl font-extrabold ${
                  hasNegativeMarking ? 'text-error' : 'text-emerald-700'
                }`}
              >
                {hasNegativeMarking ? `-${test.negativeMarks}` : 'None'}
              </div>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                {hasNegativeMarking ? 'Deducted per wrong answer' : 'Zero penalty for wrong'}
              </p>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/20 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-headline font-bold uppercase tracking-wider text-on-surface-variant">
                Scoring
              </span>
              <div className="w-7 h-7 rounded-lg bg-tertiary-fixed text-tertiary flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="font-headline text-2xl font-extrabold text-primary">
                +{test.marksPerQuestion || 1}{' '}
                <span className="text-xs font-semibold text-on-surface-variant">/ Q</span>
              </div>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Max: <strong>{totalMarks}</strong> &bull; Pass: <strong>{passingMarks}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Official Examination Syllabus Card */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-2xs overflow-hidden">
          <div className="bg-surface-container-low px-5 py-3.5 border-b border-outline-variant/15 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <h2 className="font-headline text-sm font-bold text-on-surface">
                Official Examination Syllabus &amp; Subject Coverage
              </h2>
            </div>
            <span className="text-[11px] font-headline font-bold px-2.5 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed">
              {test.subject || test.examCategory || 'Standard Syllabus'}
            </span>
          </div>

          <div className="p-5 space-y-4">
            {test.syllabus ? (
              <div className="p-4 bg-surface-container-low rounded-xl text-xs sm:text-sm text-on-surface leading-relaxed whitespace-pre-line font-medium">
                {test.syllabus}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {defaultSyllabusTopics.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-surface-container-low space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary text-on-primary text-[10px] font-headline font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <h3 className="font-headline font-bold text-on-surface text-xs sm:text-sm">
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-xs text-on-surface-variant pl-7 leading-relaxed">
                      {item.topics}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Examination Guidelines & Declaration */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-2xs p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-outline-variant/15">
            <HelpCircle className="w-4 h-4 text-primary" />
            <h3 className="font-headline font-bold text-on-surface text-sm">
              Examination Guidelines &amp; Instructions
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-on-surface-variant">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-container-low">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-on-surface">Independent Attempt Recording: </strong>
                This attempt is recorded independently with its own Result Summary and Answer Key.
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-container-low">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-on-surface">Bilingual Toggle: </strong>
                You can switch between English, Hindi, or Bilingual view anytime during the test.
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 p-4 rounded-xl bg-primary-fixed/40 border border-primary/20 cursor-pointer select-none transition-all">
            <input
              type="checkbox"
              checked={hasAgreed}
              onChange={(e) => setHasAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-primary rounded cursor-pointer"
            />
            <div className="space-y-0.5">
              <span className="font-headline text-xs sm:text-sm font-bold text-on-surface block">
                I have read and understood all test rules, time duration, and negative marking.
              </span>
              <span className="text-[11px] text-on-surface-variant block">
                I confirm that I am ready to start my examination under timed conditions.
              </span>
            </div>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 pb-8">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-headline font-bold text-xs sm:text-sm cursor-pointer transition-colors"
          >
            Cancel &amp; Return
          </button>

          <button
            type="button"
            onClick={() => onStartExam(test)}
            disabled={!hasAgreed}
            className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-headline font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer ${
              hasAgreed
                ? 'bg-linear-to-r from-primary to-primary-container text-on-primary active:scale-98'
                : 'bg-surface-container-highest text-outline cursor-not-allowed'
            }`}
          >
            <span>Start Test Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
};
