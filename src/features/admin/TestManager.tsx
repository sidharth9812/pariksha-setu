import React, { useEffect, useState } from 'react';
import {
  FileCheck2,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Check,
  Lock,
  Radio,
  Clock,
  Eye,
  ListOrdered,
  Share2,
  AlertCircle,
  Play,
  Award,
} from 'lucide-react';
import { TestItem, TestSeries, TestStatus } from '../../types/exam';
import {
  getTests,
  getSeriesList,
  createTest,
  updateTest,
  deleteTest,
  duplicateTest,
  subscribeToTestsList,
} from '../../services/examService';

interface TestManagerProps {
  initialSeriesId?: string;
  onManageQuestions: (test: TestItem) => void;
  onPreviewTest: (test: TestItem) => void;
  onLaunchLive: (test: TestItem) => void;
}

export const TestManager: React.FC<TestManagerProps> = ({
  initialSeriesId,
  onManageQuestions,
  onPreviewTest,
  onLaunchLive,
}) => {
  const [tests, setTests] = useState<TestItem[]>([]);
  const [seriesList, setSeriesList] = useState<TestSeries[]>([]);
  const [selectedSeriesFilter, setSelectedSeriesFilter] = useState<string>(initialSeriesId || 'all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [activeTestForLink, setActiveTestForLink] = useState<TestItem | null>(null);
  const [editingTest, setEditingTest] = useState<TestItem | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form fields
  const [title, setTitle] = useState('');
  const [seriesId, setSeriesId] = useState('');
  const [description, setDescription] = useState('');
  const [examCategory, setExamCategory] = useState('MP Police');
  const [subject, setSubject] = useState('General');
  const [syllabus, setSyllabus] = useState('');
  const [instructions, setInstructions] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [marksPerQuestion, setMarksPerQuestion] = useState(1);
  const [negativeMarks, setNegativeMarks] = useState(0.25);
  const [passingMarks, setPassingMarks] = useState(40);
  const [instantResult, setInstantResult] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('10:00 AM');
  const [status, setStatus] = useState<TestStatus>('published');
  const [accessCode, setAccessCode] = useState('');
  const [accessPassword, setAccessPassword] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [tList, sList] = await Promise.all([getTests(), getSeriesList()]);
      setTests(tList);
      setSeriesList(sList);
      if (sList.length > 0 && !seriesId) {
        setSeriesId(sList[0].id);
      }
    } catch (err) {
      console.error('Failed to load tests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToTestsList((updated) => {
      setTests(updated);
    });
    return () => unsub();
  }, []);

  const handleOpenCreate = () => {
    setEditingTest(null);
    setTitle('');
    setDescription('');
    setExamCategory('MP Police');
    setSubject('Complete Mock Paper');
    setSyllabus('General Knowledge, Reasoning, Science, Mathematics');
    setInstructions('1. Each question carries +1 mark. 2. Negative marking: -0.25 for incorrect answers.');
    setDurationMinutes(60);
    setMarksPerQuestion(1);
    setNegativeMarks(0.25);
    setPassingMarks(35);
    setInstantResult(false);
    setStatus('published');
    setAccessCode(`MPP${Math.floor(1000 + Math.random() * 9000)}`);
    setAccessPassword(`EXAM@${Math.floor(100 + Math.random() * 900)}`);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (t: TestItem) => {
    setEditingTest(t);
    setTitle(t.title);
    setSeriesId(t.seriesId);
    setDescription(t.description || '');
    setExamCategory(t.examCategory || 'MP Police');
    setSubject(t.subject || '');
    setSyllabus(t.syllabus || '');
    setInstructions(t.instructions || '');
    setDurationMinutes(t.durationMinutes);
    setMarksPerQuestion(t.marksPerQuestion);
    setNegativeMarks(t.negativeMarks);
    setPassingMarks(t.passingMarks || 40);
    setInstantResult(t.instantResult);
    setStartDate(t.startDate || new Date().toISOString().slice(0, 10));
    setStartTime(t.startTime || '10:00 AM');
    setStatus(t.status);
    setAccessCode(t.accessCode);
    setAccessPassword(t.accessPassword);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const matchedSeries = seriesList.find((s) => s.id === seriesId);
    const seriesTitle = matchedSeries?.title || 'General Series';

    if (editingTest) {
      await updateTest(editingTest.id, {
        title,
        seriesId,
        seriesTitle,
        description,
        examCategory,
        subject,
        syllabus,
        instructions,
        durationMinutes: Number(durationMinutes),
        marksPerQuestion: Number(marksPerQuestion),
        negativeMarks: Number(negativeMarks),
        passingMarks: Number(passingMarks),
        instantResult,
        startDate,
        startTime,
        status,
        accessCode: accessCode.trim().toUpperCase(),
        accessPassword: accessPassword.trim(),
      });
    } else {
      await createTest({
        title,
        seriesId,
        seriesTitle,
        description,
        examCategory,
        subject,
        syllabus,
        instructions,
        durationMinutes: Number(durationMinutes),
        marksPerQuestion: Number(marksPerQuestion),
        negativeMarks: Number(negativeMarks),
        passingMarks: Number(passingMarks),
        instantResult,
        startDate,
        startTime,
        status,
        accessCode: accessCode.trim().toUpperCase(),
        accessPassword: accessPassword.trim(),
      });
    }

    setIsModalOpen(false);
    await loadData();
  };

  const handleDuplicate = async (testId: string) => {
    const dup = await duplicateTest(testId);
    if (dup) {
      await loadData();
      alert(`Test duplicated successfully as "${dup.title}". New access code: ${dup.accessCode}`);
    }
  };

  const handleDelete = async (t: TestItem) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete examination "${t.title}"?\n\nThis will completely delete the test document, its questions, all student attempts, and live sessions from Firebase. This cannot be undone.`
      )
    )
      return;
    await deleteTest(t.id);
    await loadData();
  };

  const handleOpenLinkModal = (t: TestItem) => {
    setActiveTestForLink(t);
    setCopiedLink(false);
    setCopiedPassword(false);
    setIsLinkModalOpen(true);
  };

  const copyTestLink = () => {
    if (!activeTestForLink) return;
    const origin = window.location.origin;
    const link = `${origin}/?exam=${activeTestForLink.accessCode}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyTestPassword = () => {
    if (!activeTestForLink) return;
    navigator.clipboard.writeText(activeTestForLink.accessPassword);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  // Filtered
  const filteredTests = tests.filter((t) => {
    if (selectedSeriesFilter === 'all') return true;
    return t.seriesId === selectedSeriesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Examination Papers Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Configure test settings, syllabus, marking scheme, protected links and access passwords.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Test</span>
        </button>
      </div>

      {/* Filter by Series */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedSeriesFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
            selectedSeriesFilter === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Test Series ({tests.length})
        </button>
        {seriesList.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedSeriesFilter(s.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
              selectedSeriesFilter === s.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {s.title} ({tests.filter((t) => t.seriesId === s.id).length})
          </button>
        ))}
      </div>

      {/* Tests Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Test Title & Series</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Duration & Qs</th>
                <th className="py-3 px-4">Marking</th>
                <th className="py-3 px-4">Instant Result</th>
                <th className="py-3 px-4">Protected Access</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-700">
              {filteredTests.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{t.title}</div>
                    <div className="text-xs text-slate-500 truncate max-w-xs">{t.seriesTitle}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {t.examCategory}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800">{t.durationMinutes} mins</div>
                    <div className="text-xs text-slate-500">{t.totalQuestions} Questions</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-emerald-700 font-bold">+{t.marksPerQuestion}</span>
                    <span className="text-slate-400 mx-1">/</span>
                    <span className="text-red-600 font-bold">-{t.negativeMarks}</span>
                  </td>
                  <td className="py-3 px-4">
                    {t.instantResult ? (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        ON
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        OFF
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleOpenLinkModal(t)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>{t.accessCode}</span>
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide ${
                        t.status === 'live'
                          ? 'bg-rose-100 text-rose-800 animate-pulse uppercase'
                          : t.status === 'waiting'
                          ? 'bg-amber-100 text-amber-800 uppercase'
                          : t.status === 'published'
                          ? 'bg-blue-100 text-blue-800 uppercase'
                          : t.status === 'released'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : t.status === 'scheduled'
                          ? 'bg-purple-100 text-purple-800 border border-purple-300'
                          : t.status === 'result_published'
                          ? 'bg-purple-100 text-purple-800 uppercase'
                          : 'bg-slate-100 text-slate-600 uppercase'
                      }`}
                    >
                      {t.status === 'released'
                        ? 'Released (Reattempt)'
                        : t.status === 'scheduled'
                        ? `Scheduled: ${t.startDate || ''}`
                        : t.status}
                    </span>
                    {t.startDate && t.status !== 'scheduled' && (
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {t.startDate} {t.startTime}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Live monitor trigger */}
                      <button
                        onClick={() => onLaunchLive(t)}
                        title="Live Exam Controller"
                        className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 cursor-pointer"
                      >
                        <Radio className="w-4 h-4" />
                      </button>

                      {/* Manage questions */}
                      <button
                        onClick={() => onManageQuestions(t)}
                        title="Manage Questions & Bulk Import"
                        className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                      >
                        <ListOrdered className="w-4 h-4" />
                      </button>

                      {/* Preview test */}
                      <button
                        onClick={() => onPreviewTest(t)}
                        title="Preview Examination Paper"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Duplicate test */}
                      <button
                        onClick={() => handleDuplicate(t.id)}
                        title="Duplicate Test"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      {/* Edit test */}
                      <button
                        onClick={() => handleOpenEdit(t)}
                        title="Edit Settings"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Delete test */}
                      <button
                        onClick={() => handleDelete(t)}
                        title="Delete/Archive Test"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Protected Test Link Modal */}
      {isLinkModalOpen && activeTestForLink && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base">Protected Examination Access</h3>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs sm:text-sm">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-500">Test Title</div>
                <div className="font-bold text-slate-900 text-sm">{activeTestForLink.title}</div>
              </div>

              {/* Direct Examination Share Link */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Direct Candidate Examination Link (No Login Required)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}/?exam=${activeTestForLink.accessCode}` : `/?exam=${activeTestForLink.accessCode}`}
                    className="flex-1 font-mono text-xs text-indigo-700 bg-slate-100 px-3 py-2 rounded-xl border border-slate-300 outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={copyTestLink}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                    <span>{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

              {/* Protected Access Code & Password Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Exam Access Code
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={activeTestForLink.accessCode}
                    className="w-full font-mono font-bold text-indigo-700 bg-slate-100 px-3 py-2 rounded-xl border border-slate-300 outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Test Password
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={activeTestForLink.accessPassword}
                      className="flex-1 font-mono font-bold text-slate-900 bg-slate-100 px-3 py-2 rounded-xl border border-slate-300 outline-none text-xs"
                    />
                    <button
                      type="button"
                      onClick={copyTestPassword}
                      className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      title="Copy Password"
                    >
                      {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `*${activeTestForLink.title}*\nExam Link:\n${window.location.origin}/?exam=${activeTestForLink.accessCode}\n\nExam Access Code: *${activeTestForLink.accessCode}*\nExam Password: *${activeTestForLink.accessPassword}*\n\n(Click link, enter your Name & Password to start)`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share on WhatsApp</span>
                </a>
              </div>

              <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 text-indigo-900 text-xs leading-relaxed">
                <strong>Direct Student Access:</strong> Candidates clicking this link do not need an account or login. They only need to enter their Name and this Test Password to start taking the test.
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setIsLinkModalOpen(false)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Test Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-6 py-4 text-white">
              <h3 className="font-bold text-base">
                {editingTest ? 'Edit Examination Settings' : 'Create New Examination Paper'}
              </h3>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Test Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MP Police Constable Mock Test 02"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Test Series Category *
                  </label>
                  <select
                    value={seriesId}
                    onChange={(e) => setSeriesId(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {seriesList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Examination Category *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MP Police"
                    value={examCategory}
                    onChange={(e) => setExamCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Duration (Minutes) *
                  </label>
                  <input
                    type="number"
                    required
                    min={5}
                    max={360}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Exam Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TestStatus)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="waiting">Waiting Room Open</option>
                    <option value="live">Live Exam</option>
                    <option value="completed">Completed</option>
                    <option value="result_published">Result Published</option>
                    <option value="released">Release Test (Open Reattempt - No Password or Code Required)</option>
                  </select>
                </div>

                {/* Schedule Date & Time */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Schedule Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Schedule Start Time
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10:00 AM or 14:30"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  />
                </div>

                {status === 'released' && (
                  <div className="sm:col-span-2 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                      <span>✓ Release Test (Open Reattempt - No Password or Code Required)</span>
                    </div>
                    <p className="leading-relaxed">
                      Students can reattempt or practice this test with zero password or access code barriers. Clicking reattempt directly displays the Test Details & Syllabus page, followed by the Start button to commence the test.
                    </p>
                  </div>
                )}

                {status === 'scheduled' && (
                  <div className="sm:col-span-2 p-3.5 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-800 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-purple-900">
                      <span>📅 Scheduled Examination</span>
                    </div>
                    <p className="leading-relaxed">
                      This test is scheduled for {startDate || 'upcoming date'} at {startTime || 'specified time'}. Candidates will see the schedule countdown on the student portal.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Marks per Question (+Marks)
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    required
                    value={marksPerQuestion}
                    onChange={(e) => setMarksPerQuestion(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Negative Marking Value (-Marks)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    value={negativeMarks}
                    onChange={(e) => setNegativeMarks(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Unique Access Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Access Password *
                  </label>
                  <input
                    type="text"
                    required
                    value={accessPassword}
                    onChange={(e) => setAccessPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Instant Result Release</span>
                    <span className="text-[11px] text-slate-500">
                      If ON, candidate sees marks and score immediately upon submitting.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={instantResult}
                    onChange={(e) => setInstantResult(e.target.checked)}
                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Syllabus Overview
                  </label>
                  <textarea
                    rows={2}
                    value={syllabus}
                    onChange={(e) => setSyllabus(e.target.value)}
                    placeholder="Topics covered..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Instructions for Candidates
                  </label>
                  <textarea
                    rows={2}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Instructions displayed in waiting room..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
                >
                  {editingTest ? 'Save Changes' : 'Create Examination'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
