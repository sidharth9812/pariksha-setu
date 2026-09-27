import React, { useEffect, useState } from 'react';
import {
  FolderKanban,
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  XCircle,
  FileCheck2,
  Calendar,
} from 'lucide-react';
import { TestSeries, TestItem } from '../../types/exam';
import {
  getSeriesList,
  createSeries,
  updateSeries,
  deleteSeries,
  getTests,
} from '../../services/examService';

interface TestSeriesManagerProps {
  onOpenTestManagerForSeries?: (seriesId: string) => void;
}

export const TestSeriesManager: React.FC<TestSeriesManagerProps> = ({
  onOpenTestManagerForSeries,
}) => {
  const [seriesList, setSeriesList] = useState<TestSeries[]>([]);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<TestSeries | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('MP Police');
  const [status, setStatus] = useState<'active' | 'inactive' | 'scheduled'>('active');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('10:00 AM');
  const [loading, setLoading] = useState(true);

  const categories = ['MP Police', 'MP SI', 'SSC', 'General Knowledge', 'State PSC', 'Other'];

  const loadData = async () => {
    setLoading(true);
    try {
      const [sList, tList] = await Promise.all([getSeriesList(), getTests()]);
      setSeriesList(sList);
      setTests(tList);
    } catch (err) {
      console.error('Failed to load series:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingSeries(null);
    setTitle('');
    setDescription('');
    setCategory('MP Police');
    setStatus('active');
    setStartDate(new Date().toISOString().slice(0, 10));
    setStartTime('10:00 AM');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: TestSeries) => {
    setEditingSeries(s);
    setTitle(s.title);
    setDescription(s.description);
    setCategory(s.category);
    setStatus(s.status);
    setStartDate(s.startDate || new Date().toISOString().slice(0, 10));
    setStartTime(s.startTime || '10:00 AM');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingSeries) {
      await updateSeries(editingSeries.id, {
        title,
        description,
        category,
        status,
        startDate,
        startTime,
      });
    } else {
      await createSeries({
        title,
        description,
        category,
        status,
        startDate,
        startTime,
      });
    }

    setIsModalOpen(false);
    await loadData();
  };

  const handleDelete = async (s: TestSeries) => {
    const associatedTests = tests.filter((t) => t.seriesId === s.id);
    if (associatedTests.length > 0) {
      if (
        !confirm(
          `This series contains ${associatedTests.length} tests. Are you sure you want to delete this test series?`
        )
      ) {
        return;
      }
    } else {
      if (!confirm(`Delete test series "${s.title}"?`)) return;
    }

    await deleteSeries(s.id);
    await loadData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Test Series Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Organize examinations under specialized coaching batches and exam categories.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Create Test Series</span>
        </button>
      </div>

      {/* Series Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {seriesList.map((s) => {
          const associated = tests.filter((t) => t.seriesId === s.id);
          const publishedCount = associated.filter((t) => t.status === 'published' || t.status === 'live').length;
          const draftCount = associated.filter((t) => t.status === 'draft').length;
          const completedCount = associated.filter((t) => t.status === 'completed' || t.status === 'result_published').length;

          return (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {s.category}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      s.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : s.status === 'scheduled'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {s.status === 'active' ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    ) : s.status === 'scheduled' ? (
                      <Calendar className="w-3 h-3 text-purple-600" />
                    ) : (
                      <XCircle className="w-3 h-3 text-slate-400" />
                    )}
                    <span className="capitalize">{s.status}</span>
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-base text-slate-900 leading-snug">{s.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1">{s.description}</p>
                  {s.startDate && (
                    <div className="text-[11px] text-purple-700 font-semibold flex items-center gap-1 mt-1.5">
                      <Calendar className="w-3 h-3 text-purple-600" />
                      <span>Scheduled: {s.startDate} {s.startTime ? `at ${s.startTime}` : ''}</span>
                    </div>
                  )}
                </div>

                {/* Sub-counts */}
                <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-50 rounded-xl border border-slate-100 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Total</span>
                    <span className="font-bold text-slate-800">{associated.length}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-600 block uppercase">Active</span>
                    <span className="font-bold text-emerald-700">{publishedCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Drafts</span>
                    <span className="font-bold text-slate-600">{draftCount}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 mt-3">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(s)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 cursor-pointer"
                    title="Edit Series"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    title="Delete Series"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => onOpenTestManagerForSeries?.(s.id)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>View Tests</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Series Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 text-white">
              <h3 className="font-bold text-base">
                {editingSeries ? 'Edit Test Series' : 'Create Test Series'}
              </h3>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Series Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MP Police Constable Mock Series 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Examination Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Overview of this test series..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Status
                </label>
                <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="active"
                      checked={status === 'active'}
                      onChange={() => setStatus('active')}
                    />
                    <span>Active</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="scheduled"
                      checked={status === 'scheduled'}
                      onChange={() => setStatus('scheduled')}
                    />
                    <span>Scheduled</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="inactive"
                      checked={status === 'inactive'}
                      onChange={() => setStatus('inactive')}
                    />
                    <span>Inactive</span>
                  </label>
                </div>
              </div>

              {/* Schedule Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Schedule Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Schedule Time
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10:00 AM or 14:00"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
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
                  {editingSeries ? 'Update Series' : 'Create Series'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
