import React, { useEffect, useState } from 'react';
import {
  Award,
  Download,
  Search,
  ArrowUpDown,
  Filter,
  Eye,
  FileCheck2,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  User,
  X,
} from 'lucide-react';
import { TestItem, StudentAttempt, TestSeries, QuestionItem } from '../../types/exam';
import {
  getTests,
  getSeriesList,
  getAllAttempts,
  getQuestionsForTest,
  subscribeToTestAttempts,
} from '../../services/examService';

interface ResultsDashboardProps {
  initialTestId?: string;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({ initialTestId }) => {
  const [tests, setTests] = useState<TestItem[]>([]);
  const [seriesList, setSeriesList] = useState<TestSeries[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>(initialTestId || 'all');
  const [attempts, setAttempts] = useState<StudentAttempt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'percentage' | 'name' | 'time'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [inspectingAttempt, setInspectingAttempt] = useState<StudentAttempt | null>(null);
  const [inspectQuestions, setInspectQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [tList, sList, aList] = await Promise.all([
          getTests(),
          getSeriesList(),
          getAllAttempts(),
        ]);
        setTests(tList);
        setSeriesList(sList);
        setAttempts(aList);
        if (initialTestId) setSelectedTestId(initialTestId);
      } catch (err) {
        console.error('Failed to load results:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [initialTestId]);

  // Real-time synchronization of submissions for selected test
  useEffect(() => {
    if (!selectedTestId || selectedTestId === 'all') return;
    const unsub = subscribeToTestAttempts(selectedTestId, (updatedAttempts) => {
      setAttempts((prev) => {
        const otherTestAttempts = prev.filter((a) => a.testId !== selectedTestId);
        return [...otherTestAttempts, ...updatedAttempts];
      });
    });
    return () => unsub();
  }, [selectedTestId]);

  // When inspecting an attempt, load questions for answer review
  useEffect(() => {
    if (!inspectingAttempt) {
      setInspectQuestions([]);
      return;
    }
    async function fetchPaper() {
      if (inspectingAttempt) {
        const qList = await getQuestionsForTest(inspectingAttempt.testId, 'admin');
        setInspectQuestions(qList);
      }
    }
    fetchPaper();
  }, [inspectingAttempt]);

  // Filter attempts
  let filtered = attempts.filter((att) => {
    const matchTest = selectedTestId === 'all' || att.testId === selectedTestId;
    const matchSearch =
      att.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      att.studentEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      att.testTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchTest && matchSearch;
  });

  // Sort attempts
  filtered.sort((a, b) => {
    let diff = 0;
    if (sortBy === 'score') diff = b.finalScore - a.finalScore;
    if (sortBy === 'percentage') diff = b.percentage - a.percentage;
    if (sortBy === 'name') diff = a.studentName.localeCompare(b.studentName);
    if (sortBy === 'time')
      diff = new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();

    return sortOrder === 'desc' ? diff : -diff;
  });

  const toggleSort = (col: 'score' | 'percentage' | 'name' | 'time') => {
    if (sortBy === col) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortOrder('desc');
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (filtered.length === 0) {
      alert('No results available to export.');
      return;
    }

    const headers = [
      'Rank',
      'Student Name',
      'Email',
      'Test Title',
      'Attempted',
      'Correct',
      'Incorrect',
      'Unattempted',
      'Score',
      'Percentage',
      'Accuracy',
      'Tab Switches',
      'Submitted At',
    ];

    const rows = filtered.map((att, idx) => [
      idx + 1,
      `"${att.studentName.replace(/"/g, '""')}"`,
      `"${att.studentEmail.replace(/"/g, '""')}"`,
      `"${att.testTitle.replace(/"/g, '""')}"`,
      att.attemptedCount,
      att.correctCount,
      att.incorrectCount,
      att.unattemptedCount,
      att.finalScore,
      `${att.percentage}%`,
      `${att.accuracy}%`,
      att.tabSwitchCount || 0,
      `"${new Date(att.submittedAt).toLocaleString()}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Exam_Results_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Results & Merit Leaderboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Automated scoring, negative marking deduction and performance ranking.
          </p>
        </div>

        <button
          onClick={exportToCSV}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors self-start"
        >
          <Download className="w-4 h-4" />
          <span>Export Results (CSV)</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedTestId}
            onChange={(e) => setSelectedTestId(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="all">All Examinations ({attempts.length} attempts)</option>
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search candidate name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Rank</th>
                <th
                  onClick={() => toggleSort('name')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Candidate</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="py-3 px-4">Test Title</th>
                <th className="py-3 px-4">Attempted</th>
                <th className="py-3 px-4">Correct</th>
                <th className="py-3 px-4">Wrong</th>
                <th className="py-3 px-4">Unattempted</th>
                <th
                  onClick={() => toggleSort('score')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 select-none text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Score</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('percentage')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 select-none text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Percentage</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No results recorded for this selection yet.
                  </td>
                </tr>
              ) : (
                filtered.map((att, idx) => (
                  <tr key={att.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <span
                        className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-bold text-xs ${
                          idx === 0
                            ? 'bg-amber-400 text-amber-950 shadow-xs'
                            : idx === 1
                            ? 'bg-slate-300 text-slate-800'
                            : idx === 2
                            ? 'bg-amber-700/20 text-amber-900'
                            : 'text-slate-600 font-semibold'
                        }`}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{att.studentName}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">{att.studentEmail}</div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-800 truncate max-w-[160px]">
                      {att.testTitle}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {att.attemptedCount}/{att.totalQuestions}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-600">{att.correctCount}</td>
                    <td className="py-3 px-4 font-bold text-rose-600">{att.incorrectCount}</td>
                    <td className="py-3 px-4 text-slate-400">{att.unattemptedCount}</td>
                    <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                      {att.finalScore}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-indigo-700">{att.percentage}%</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setInspectingAttempt(att)}
                        className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                        title="Inspect Candidate Paper"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Candidate Detailed Attempt Modal */}
      {inspectingAttempt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Candidate Examination Paper</h3>
                <p className="text-xs text-slate-400">
                  {inspectingAttempt.studentName} &bull; {inspectingAttempt.testTitle}
                </p>
              </div>
              <button
                onClick={() => setInspectingAttempt(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs sm:text-sm">
              {/* Score metrics */}
              <div className="grid grid-cols-4 gap-2 text-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Score</span>
                  <span className="text-lg font-black text-slate-900">{inspectingAttempt.finalScore}</span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-600 uppercase block">Correct</span>
                  <span className="text-lg font-black text-emerald-700">{inspectingAttempt.correctCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-rose-600 uppercase block">Wrong</span>
                  <span className="text-lg font-black text-rose-700">{inspectingAttempt.incorrectCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-indigo-600 uppercase block">Percentage</span>
                  <span className="text-lg font-black text-indigo-700">{inspectingAttempt.percentage}%</span>
                </div>
              </div>

              {/* Anti-cheat audit */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">Proctoring Activity</span>
                  <span className="text-xs text-slate-500">
                    Recorded Tab Switches: {inspectingAttempt.tabSwitchCount || 0}
                  </span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    (inspectingAttempt.tabSwitchCount || 0) > 0
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {(inspectingAttempt.tabSwitchCount || 0) > 0 ? 'Suspicious Switches' : 'Normal'}
                </span>
              </div>

              {/* Question list review */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-slate-900 text-sm">Response Evaluation:</h4>
                {inspectQuestions.map((q, idx) => {
                  const studentPick = inspectingAttempt.answers[q.id];
                  const isCorrect = studentPick === q.correctAnswer;
                  const isAttempted = Boolean(studentPick);

                  return (
                    <div
                      key={q.id}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                        !isAttempted
                          ? 'border-slate-200 bg-slate-50'
                          : isCorrect
                          ? 'border-emerald-200 bg-emerald-50/30'
                          : 'border-rose-200 bg-rose-50/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">Question {idx + 1}</span>
                        <span
                          className={`font-bold ${
                            !isAttempted
                              ? 'text-slate-500'
                              : isCorrect
                              ? 'text-emerald-700'
                              : 'text-rose-600'
                          }`}
                        >
                          {!isAttempted ? 'Unattempted' : isCorrect ? 'Correct (+1)' : 'Wrong (-0.25)'}
                        </span>
                      </div>
                      <p className="text-slate-800">{q.questionText || q.questionTextHindi}</p>
                      <div className="text-[11px] text-slate-600 flex items-center gap-3 pt-1">
                        <span>
                          Candidate Answer: <strong className="font-mono">{studentPick || 'None'}</strong>
                        </span>
                        <span>&bull;</span>
                        <span>
                          Official Answer: <strong className="font-mono text-emerald-700">{q.correctAnswer}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setInspectingAttempt(null)}
                  className="w-full py-2.5 bg-slate-900 text-white font-semibold rounded-xl cursor-pointer"
                >
                  Close Paper
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
