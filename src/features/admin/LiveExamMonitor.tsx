import React, { useEffect, useState } from 'react';
import {
  Radio,
  Play,
  StopCircle,
  Users,
  Award,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Eye,
  FileCheck2,
  ArrowRight,
  ShieldAlert,
  Link2,
  Copy,
  Check,
  ExternalLink,
  Share2,
} from 'lucide-react';
import { TestItem, ExamSession } from '../../types/exam';
import {
  getTests,
  startExam,
  endExam,
  publishTestResults,
  subscribeToLiveSessions,
  subscribeToTest,
} from '../../services/examService';

interface LiveExamMonitorProps {
  initialTestId?: string;
  onViewResults: (testId: string) => void;
  onTestAsCandidate?: (test: TestItem) => void;
}

export const LiveExamMonitor: React.FC<LiveExamMonitorProps> = ({
  initialTestId,
  onViewResults,
  onTestAsCandidate,
}) => {
  const [tests, setTests] = useState<TestItem[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>(initialTestId || '');
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [copiedInvitation, setCopiedInvitation] = useState(false);

  // Load tests
  const loadTests = async () => {
    setLoading(true);
    try {
      const allTests = await getTests();
      setTests(allTests);
      if (!selectedTestId && allTests.length > 0) {
        // Prefer live or waiting exam
        const liveOrWaiting = allTests.find((t) => t.status === 'live' || t.status === 'waiting');
        setSelectedTestId(liveOrWaiting ? liveOrWaiting.id : allTests[0].id);
      }
    } catch (err) {
      console.error('Failed to load tests for live monitor:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTests();
  }, []);

  // Subscribe to live participant sessions for the selected test
  useEffect(() => {
    if (!selectedTestId) return;
    const unsubSessions = subscribeToLiveSessions(selectedTestId, (updatedSessions) => {
      setSessions(updatedSessions);
    });

    const unsubTest = subscribeToTest(selectedTestId, (updatedTest) => {
      setTests((prev) => prev.map((t) => (t.id === selectedTestId ? updatedTest : t)));
    });

    return () => {
      unsubSessions();
      unsubTest();
    };
  }, [selectedTestId]);

  const currentTest = tests.find((t) => t.id === selectedTestId);

  const examLink = typeof window !== 'undefined' && currentTest
    ? `${window.location.origin}/?exam=${encodeURIComponent(currentTest.accessCode || '')}`
    : `/?exam=${currentTest?.accessCode || ''}`;

  const fullInvitationText = currentTest
    ? `*${currentTest.title}*\nOnline Examination Link:\n${examLink}\n\nExam Access Code: *${currentTest.accessCode}*\nExam Password: *${currentTest.accessPassword}*\n\n(No registration or login needed — click link, enter Candidate Name & Password to start)`
    : '';

  const whatsAppUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullInvitationText)}`;

  const copyInvitation = () => {
    if (!fullInvitationText) return;
    try {
      navigator.clipboard.writeText(fullInvitationText);
      setCopiedInvitation(true);
      setTimeout(() => setCopiedInvitation(false), 2500);
    } catch {
      // fallback
    }
  };

  const copyToClipboard = (text: string, type: 'link' | 'code' | 'pass') => {
    try {
      navigator.clipboard.writeText(text);
      if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      } else if (type === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2500);
      } else {
        setCopiedPass(true);
        setTimeout(() => setCopiedPass(false), 2500);
      }
    } catch {
      // fallback
    }
  };

  // Participant counts
  const waitingCount = sessions.filter((s) => s.status === 'waiting').length;
  const inProgressCount = sessions.filter((s) => s.status === 'in_progress').length;
  const submittedCount = sessions.filter(
    (s) => s.status === 'submitted' || s.status === 'auto_submitted'
  ).length;

  const handleStartExam = async () => {
    if (!currentTest) return;
    if (
      !confirm(
        `Start examination "${currentTest.title}" now? Connected candidates in the waiting room will transition immediately to the live exam paper.`
      )
    ) {
      return;
    }

    setActionInProgress(true);
    try {
      await startExam(currentTest.id);
      await loadTests();
    } catch (err) {
      console.error('Error starting exam:', err);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleEndExam = async () => {
    if (!currentTest) return;
    if (
      !confirm(
        `Are you sure you want to end "${currentTest.title}"? Candidates will have their saved answers preserved safely.`
      )
    ) {
      return;
    }

    setActionInProgress(true);
    try {
      await endExam(currentTest.id);
      await loadTests();
    } catch (err) {
      console.error('Error ending exam:', err);
    } finally {
      setActionInProgress(false);
    }
  };

  const handlePublishResults = async () => {
    if (!currentTest) return;
    if (
      !confirm(
        `Publish results for "${currentTest.title}"? Candidates who submitted will now be able to view their official scores and solutions.`
      )
    ) {
      return;
    }

    setActionInProgress(true);
    try {
      await publishTestResults(currentTest.id);
      await loadTests();
      alert('Results published successfully! Candidates can now view their scores.');
    } catch (err) {
      console.error('Error publishing results:', err);
    } finally {
      setActionInProgress(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Live Examination Control & Monitoring
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time participant presence, synchronized exam start/end triggers and proctoring activity.
          </p>
        </div>

        {/* Test Selector Dropdown */}
        <div className="flex items-center gap-2">
          <select
            value={selectedTestId}
            onChange={(e) => setSelectedTestId(e.target.value)}
            className="px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none shadow-xs"
          >
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.status.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentTest ? (
        <>
          {/* Test Status & Control Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                  {currentTest.examCategory}
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    currentTest.status === 'live'
                      ? 'bg-rose-100 text-rose-800 animate-pulse'
                      : currentTest.status === 'waiting'
                      ? 'bg-amber-100 text-amber-800'
                      : currentTest.status === 'result_published'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {currentTest.status}
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900">{currentTest.title}</h2>
              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                <span>Duration: {currentTest.durationMinutes} Mins</span>
                <span>&bull;</span>
                <span>Total Qs: {currentTest.totalQuestions}</span>
                <span>&bull;</span>
                <span>
                  Access Code: <code className="font-bold text-indigo-600">{currentTest.accessCode}</code>
                </span>
                <span>&bull;</span>
                <span>
                  Password: <code className="font-bold text-slate-700">{currentTest.accessPassword}</code>
                </span>
              </div>
            </div>

            {/* Live Controller Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              {currentTest.status !== 'live' && currentTest.status !== 'completed' && currentTest.status !== 'result_published' && (
                <button
                  onClick={handleStartExam}
                  disabled={actionInProgress}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-md cursor-pointer transition-transform active:scale-95 disabled:opacity-50"
                >
                  <Play className="w-5 h-5 fill-white" />
                  <span>START EXAMINATION</span>
                </button>
              )}

              {currentTest.status === 'live' && (
                <button
                  onClick={handleEndExam}
                  disabled={actionInProgress}
                  className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-md cursor-pointer transition-transform active:scale-95 disabled:opacity-50"
                >
                  <StopCircle className="w-5 h-5" />
                  <span>END EXAMINATION</span>
                </button>
              )}

              {currentTest.status !== 'result_published' && (
                <button
                  onClick={handlePublishResults}
                  disabled={actionInProgress}
                  className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <Award className="w-4 h-4" />
                  <span>Publish Results</span>
                </button>
              )}

              <button
                onClick={() => onViewResults(currentTest.id)}
                className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <span>View Results Table</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Student Direct Access Share Link Card */}
          <div className="bg-linear-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-700/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 shrink-0">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <span>Direct Student Examination Share Link</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      No Login Required
                    </span>
                  </h3>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    Share this direct link with your candidates. Students can join instantly by simply entering their <strong className="text-white">Name</strong> and the <strong className="text-white">Test Password</strong>.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share on WhatsApp</span>
                </a>
                <button
                  type="button"
                  onClick={copyInvitation}
                  className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedInvitation ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedInvitation ? 'Copied Invitation!' : 'Copy Full Details'}</span>
                </button>
                {onTestAsCandidate && (
                  <button
                    type="button"
                    onClick={() => onTestAsCandidate(currentTest)}
                    className="px-3.5 py-2 bg-indigo-500/30 hover:bg-indigo-500/50 border border-indigo-400/40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Test entering this exam without login as a student candidate"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-indigo-300" />
                    <span>Test Student View</span>
                  </button>
                )}
              </div>
            </div>

            {/* Link & Quick Credentials Box */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
              <div className="lg:col-span-8 flex items-center bg-black/30 rounded-xl border border-indigo-500/40 p-1.5">
                <Link2 className="w-4 h-4 text-indigo-300 ml-2.5 shrink-0" />
                <input
                  type="text"
                  readOnly
                  value={examLink}
                  className="w-full bg-transparent px-2.5 py-1 text-xs sm:text-sm font-mono text-indigo-100 outline-none select-all"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(examLink, 'link')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                    copiedLink
                      ? 'bg-emerald-500 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
                </button>
              </div>

              <div className="lg:col-span-4 flex items-center gap-2">
                <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 flex items-center justify-between">
                  <span className="text-[11px] text-indigo-200">Password:</span>
                  <code className="text-xs font-bold text-amber-300 font-mono">{currentTest.accessPassword}</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(currentTest.accessPassword, 'pass')}
                    className="text-indigo-300 hover:text-white p-1 cursor-pointer"
                    title="Copy Password"
                  >
                    {copiedPass ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 flex items-center justify-between">
                  <span className="text-[11px] text-indigo-200">Code:</span>
                  <code className="text-xs font-bold text-emerald-300 font-mono">{currentTest.accessCode}</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(currentTest.accessCode, 'code')}
                    className="text-indigo-300 hover:text-white p-1 cursor-pointer"
                    title="Copy Access Code"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Participant Counts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-center">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Total Joined
              </span>
              <span className="text-3xl font-black text-slate-900 mt-1 block">{sessions.length}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-xs text-center">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider block">
                In Waiting Room
              </span>
              <span className="text-3xl font-black text-amber-700 mt-1 block">{waitingCount}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-xs text-center">
              <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider block">
                Active in Test
              </span>
              <span className="text-3xl font-black text-rose-700 mt-1 block">{inProgressCount}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-xs text-center">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block">
                Submitted Papers
              </span>
              <span className="text-3xl font-black text-emerald-700 mt-1 block">{submittedCount}</span>
            </div>
          </div>

          {/* Participant Presence Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-3">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-base text-slate-900">Connected Candidates</h3>
              </div>
              <span className="text-xs text-slate-500">Auto-updating in real-time</span>
            </div>

            {sessions.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs sm:text-sm">
                No candidates have joined this examination yet. Candidates who enter the protected link & password
                will appear here live.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Candidate</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Joined At</th>
                      <th className="py-3 px-4">Submitted At</th>
                      <th className="py-3 px-4">Tab Switch Alerts</th>
                      <th className="py-3 px-4">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{s.studentName}</div>
                          <div className="text-[11px] text-slate-400">{s.studentEmail}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                              s.status === 'in_progress'
                                ? 'bg-rose-100 text-rose-800 animate-pulse'
                                : s.status === 'waiting'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {s.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-xs">
                          {new Date(s.joinedAt).toLocaleTimeString()}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-xs">
                          {s.submittedAt ? new Date(s.submittedAt).toLocaleTimeString() : '-'}
                        </td>
                        <td className="py-3 px-4">
                          {s.tabSwitchCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>{s.tabSwitchCount} switches</span>
                            </span>
                          ) : (
                            <span className="text-emerald-700 text-xs font-semibold">Clean (0)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-xs truncate max-w-xs">
                          {s.activityLogs && s.activityLogs.length > 0
                            ? s.activityLogs[s.activityLogs.length - 1].details ||
                              s.activityLogs[s.activityLogs.length - 1].event
                            : 'Active'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
          <p className="text-sm font-semibold text-slate-600">Please select an examination to monitor.</p>
        </div>
      )}
    </div>
  );
};
