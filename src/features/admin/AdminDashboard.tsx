import React, { useEffect, useState } from 'react';
import {
  FolderKanban,
  FileCheck2,
  Radio,
  Award,
  Users,
  Clock,
  ArrowUpRight,
  PlayCircle,
  PlusCircle,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { TestSeries, TestItem, StudentAttempt } from '../../types/exam';
import { getSeriesList, getTests, getAllAttempts } from '../../services/examService';
import { getAllRegisteredUsers } from '../../services/authService';
import { useInstitute } from '../../context/InstituteContext';

interface AdminDashboardProps {
  onNavigate: (tab: string, contextId?: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const { settings } = useInstitute();
  const [series, setSeries] = useState<TestSeries[]>([]);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [attempts, setAttempts] = useState<StudentAttempt[]>([]);
  const [userCount, setUserCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      setLoading(true);
      try {
        const [sList, tList, aList, uList] = await Promise.all([
          getSeriesList(),
          getTests(),
          getAllAttempts(),
          getAllRegisteredUsers(),
        ]);
        setSeries(sList);
        setTests(tList);
        setAttempts(aList);
        setUserCount(uList.filter((u) => u.role !== 'admin').length);
      } catch (err) {
        console.error('Failed to load admin metrics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMetrics();
  }, []);

  const liveTests = tests.filter((t) => t.status === 'live');
  const waitingTests = tests.filter((t) => t.status === 'waiting');
  const completedTests = tests.filter((t) => t.status === 'completed' || t.status === 'result_published');
  const uniqueAttemptStudents = new Set(attempts.map((a) => a.studentId)).size;
  const totalCandidates = Math.max(userCount, uniqueAttemptStudents);

  const statCards = [
    {
      label: 'Total Test Series',
      value: series.length,
      icon: FolderKanban,
      color: 'from-blue-600 to-indigo-600',
      action: () => onNavigate('series'),
    },
    {
      label: 'Total Examinations',
      value: tests.length,
      icon: FileCheck2,
      color: 'from-indigo-600 to-violet-600',
      action: () => onNavigate('tests'),
    },
    {
      label: 'Live / In-Progress',
      value: liveTests.length,
      icon: Radio,
      color: 'from-rose-500 to-red-600',
      action: () => onNavigate('live'),
      badge: liveTests.length > 0 ? 'Live Now' : undefined,
    },
    {
      label: 'Waiting Room Open',
      value: waitingTests.length,
      icon: Clock,
      color: 'from-amber-500 to-orange-600',
      action: () => onNavigate('live'),
    },
    {
      label: 'Completed Tests',
      value: completedTests.length,
      icon: Award,
      color: 'from-emerald-600 to-teal-600',
      action: () => onNavigate('results'),
    },
    {
      label: 'Active Candidates',
      value: Math.max(totalCandidates, 1),
      icon: Users,
      color: 'from-cyan-600 to-blue-600',
      action: () => onNavigate('students'),
    },
    {
      label: 'Total Exam Submissions',
      value: attempts.length,
      icon: TrendingUp,
      color: 'from-purple-600 to-pink-600',
      action: () => onNavigate('results'),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Examination Controller Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time management for MP Police, MP SI, SSC and government competitive tests.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('tests')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Test</span>
          </button>

          <button
            onClick={() => onNavigate('live')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Radio className="w-4 h-4" />
            <span>Monitor Live Exams</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              onClick={card.action}
              className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-10 h-10 rounded-xl bg-linear-to-br ${card.color} text-white flex items-center justify-center shadow-xs`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                {card.badge && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 animate-pulse">
                    {card.badge}
                  </span>
                )}
              </div>

              <div className="mt-4">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {card.value}
                </span>
                <span className="text-xs text-slate-500 font-medium block mt-0.5">{card.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live & Upcoming Exams Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active & Waiting Exams Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">Active & Waiting Examinations</h2>
            </div>
            <button
              onClick={() => onNavigate('live')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
            >
              Open Live Monitor &rarr;
            </button>
          </div>

          <div className="space-y-3">
            {tests.filter((t) => t.status === 'live' || t.status === 'waiting' || t.status === 'published').length ===
            0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No active or waiting exams currently.</p>
            ) : (
              tests
                .filter((t) => t.status === 'live' || t.status === 'waiting' || t.status === 'published')
                .slice(0, 4)
                .map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{t.title}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            t.status === 'live'
                              ? 'bg-rose-100 text-rose-800 animate-pulse'
                              : t.status === 'waiting'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {t.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Code: <code className="font-mono font-bold text-indigo-600">{t.accessCode}</code> &bull; Pass:{' '}
                        <code className="font-mono text-slate-700">{t.accessPassword}</code> &bull; Duration:{' '}
                        {t.durationMinutes} mins
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigate('live')}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      Controls
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Quick Institute Actions & Reset */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Institute Administration</h2>
          <div className="space-y-2.5">
            <button
              onClick={() => onNavigate('series')}
              className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all flex items-center justify-between cursor-pointer"
            >
              <div>
                <div className="text-xs font-bold text-slate-800">Test Series Hierarchy</div>
                <div className="text-[11px] text-slate-500">MP Police, MP SI, SSC folders</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => onNavigate('results')}
              className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all flex items-center justify-between cursor-pointer"
            >
              <div>
                <div className="text-xs font-bold text-slate-800">Merit List & PDF/CSV Export</div>
                <div className="text-[11px] text-slate-500">Download merit list PDF and scores</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => onNavigate('settings')}
              className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all flex items-center justify-between cursor-pointer"
            >
              <div>
                <div className="text-xs font-bold text-slate-800">Institute Branding</div>
                <div className="text-[11px] text-slate-500">Logo, institute name, defaults</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
