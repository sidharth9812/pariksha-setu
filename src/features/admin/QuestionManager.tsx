import React, { useEffect, useState } from 'react';
import {
  ListOrdered,
  Plus,
  Upload,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowLeft,
  Download,
  Copy,
  Languages,
} from 'lucide-react';
import { TestItem, QuestionItem } from '../../types/exam';
import {
  getQuestionsForTest,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  bulkImportQuestions,
} from '../../services/examService';
import { uploadQuestionImage } from '../../services/storageService';
import { DualLanguageBulkCsvModal } from './DualLanguageBulkCsvModal';

interface QuestionManagerProps {
  test: TestItem;
  onBack: () => void;
}

export const QuestionManager: React.FC<QuestionManagerProps> = ({ test, onBack }) => {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Single Question Form State
  const [questionText, setQuestionText] = useState('');
  const [questionTextHindi, setQuestionTextHindi] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [optAHindi, setOptAHindi] = useState('');
  const [optBHindi, setOptBHindi] = useState('');
  const [optCHindi, setOptCHindi] = useState('');
  const [optDHindi, setOptDHindi] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [explanation, setExplanation] = useState('');
  const [explanationHindi, setExplanationHindi] = useState('');
  const [subject, setSubject] = useState('General');
  const [imageUrl, setImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const list = await getQuestionsForTest(test.id, 'admin');
      setQuestions(list);
    } catch (err) {
      console.error('Failed to load questions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, [test.id]);

  const handleOpenAdd = () => {
    setEditingQuestion(null);
    setQuestionText('');
    setQuestionTextHindi('');
    setOptA('');
    setOptB('');
    setOptC('');
    setOptD('');
    setOptAHindi('');
    setOptBHindi('');
    setOptCHindi('');
    setOptDHindi('');
    setCorrectAnswer('A');
    setExplanation('');
    setExplanationHindi('');
    setSubject('General');
    setImageUrl('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (q: QuestionItem) => {
    setEditingQuestion(q);
    setQuestionText(q.questionText);
    setQuestionTextHindi(q.questionTextHindi || '');
    setOptA(q.options.A || '');
    setOptB(q.options.B || '');
    setOptC(q.options.C || '');
    setOptD(q.options.D || '');
    setOptAHindi(q.optionsHindi?.A || '');
    setOptBHindi(q.optionsHindi?.B || '');
    setOptCHindi(q.optionsHindi?.C || '');
    setOptDHindi(q.optionsHindi?.D || '');
    setCorrectAnswer(q.correctAnswer);
    setExplanation(q.explanation || '');
    setExplanationHindi(q.explanationHindi || '');
    setSubject(q.subject || 'General');
    setImageUrl(q.imageUrl || '');
    setIsAddModalOpen(true);
  };

  const handleQuestionImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    setImageUploadProgress(0);
    try {
      const url = await uploadQuestionImage(test.id, file, (progress) => {
        setImageUploadProgress(progress);
      });
      setImageUrl(url);
    } catch (err: any) {
      alert(err.message || 'Failed to upload question image to Firebase Storage.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;

    const payload: Partial<QuestionItem> = {
      testId: test.id,
      questionNumber: editingQuestion ? editingQuestion.questionNumber : questions.length + 1,
      questionText: questionText.trim(),
      questionTextHindi: questionTextHindi.trim() || undefined,
      options: {
        A: optA.trim(),
        B: optB.trim(),
        C: optC.trim(),
        D: optD.trim(),
      },
      optionsHindi:
        optAHindi || optBHindi || optCHindi || optDHindi
          ? {
              A: optAHindi.trim(),
              B: optBHindi.trim(),
              C: optCHindi.trim(),
              D: optDHindi.trim(),
            }
          : undefined,
      correctAnswer,
      explanation: explanation.trim() || undefined,
      explanationHindi: explanationHindi.trim() || undefined,
      subject: subject.trim() || 'General',
      imageUrl: imageUrl || undefined,
    };

    if (editingQuestion) {
      await updateQuestion(test.id, editingQuestion.id, payload);
    } else {
      await createQuestion(payload);
    }

    setIsAddModalOpen(false);
    await loadQuestions();
  };

  const handleDeleteQuestion = async (q: QuestionItem) => {
    if (!confirm(`Delete question #${q.questionNumber}?`)) return;
    await deleteQuestion(test.id, q.id);
    await loadQuestions();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Tests</span>
          </button>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Question Paper: {test.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Total {questions.length} questions configured &bull; {test.examCategory}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            title="Upload questions in bulk via separate English and Hindi CSV files with automatic settlement"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Bulk CSV Import (EN & HI)</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Question</span>
          </button>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-3">
        {questions.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3">
            <ListOrdered className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="font-bold text-slate-700 text-base">No Questions Added Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add questions individually or use the bulk importer to upload questions via CSV.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Add First Question
              </button>
            </div>
          </div>
        ) : (
          questions.map((q, idx) => (
            <div
              key={q.id}
              className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    {q.subject && (
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {q.subject}
                      </span>
                    )}
                  </div>
                  {q.questionTextHindi && (
                    <div className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                      {q.questionTextHindi}
                    </div>
                  )}
                  <div className="text-xs sm:text-sm text-slate-700 leading-snug">{q.questionText}</div>

                  {q.imageUrl && (
                    <div className="mt-2 max-w-sm rounded-xl overflow-hidden border border-slate-200">
                      <img src={q.imageUrl} alt="Question diagram" className="w-full h-auto max-h-48 object-contain bg-white" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleOpenEdit(q)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteQuestion(q)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                {(['A', 'B', 'C', 'D'] as const).map((key) => {
                  const isCorrect = q.correctAnswer === key;
                  return (
                    <div
                      key={key}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                        isCorrect
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold">{key}.</span>
                        {q.options?.[key] && q.optionsHindi?.[key] && q.options[key].trim() !== q.optionsHindi[key].trim() ? (
                          <span className="inline-flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-900">{q.options[key]}</span>
                            <span className="text-slate-400 font-bold">/</span>
                            <span className="text-slate-700">{q.optionsHindi[key]}</span>
                          </span>
                        ) : (
                          <span>{q.options?.[key] || q.optionsHindi?.[key] || ''}</span>
                        )}
                      </div>
                      {isCorrect && (
                        <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          Answer
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {(q.explanation || q.explanationHindi) && (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Explanation: </span>
                  {q.explanation && <span>{q.explanation}</span>}
                  {q.explanation && q.explanationHindi && <span className="text-slate-400 mx-1.5 font-bold">/</span>}
                  {q.explanationHindi && <span>{q.explanationHindi}</span>}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Question Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-6 py-4 text-white">
              <h3 className="font-bold text-base">
                {editingQuestion ? 'Edit Question' : 'Add Examination Question'}
              </h3>
            </div>

            <form onSubmit={handleSaveQuestion} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Question Text (English) *
                </label>
                <textarea
                  required
                  rows={2}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Enter the question in English..."
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Question Text (Alternative / Secondary / Optional)
                </label>
                <textarea
                  rows={2}
                  value={questionTextHindi}
                  onChange={(e) => setQuestionTextHindi(e.target.value)}
                  placeholder="Enter secondary or translated question text..."
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Options */}
              <div className="space-y-3 pt-2">
                <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Options (A, B, C, D) *
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-0.5">Option A (Primary)</label>
                    <input
                      type="text"
                      required
                      value={optA}
                      onChange={(e) => setOptA(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-0.5">Option A (Secondary)</label>
                    <input
                      type="text"
                      value={optAHindi}
                      onChange={(e) => setOptAHindi(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-0.5">Option B (Primary)</label>
                    <input
                      type="text"
                      required
                      value={optB}
                      onChange={(e) => setOptB(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-0.5">Option B (Secondary)</label>
                    <input
                      type="text"
                      value={optBHindi}
                      onChange={(e) => setOptBHindi(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-0.5">Option C (Primary)</label>
                    <input
                      type="text"
                      required
                      value={optC}
                      onChange={(e) => setOptC(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-0.5">Option C (Secondary)</label>
                    <input
                      type="text"
                      value={optCHindi}
                      onChange={(e) => setOptCHindi(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-0.5">Option D (Primary)</label>
                    <input
                      type="text"
                      required
                      value={optD}
                      onChange={(e) => setOptD(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-0.5">Option D (Secondary)</label>
                    <input
                      type="text"
                      value={optDHindi}
                      onChange={(e) => setOptDHindi(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Correct Answer Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Official Correct Answer Key *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['A', 'B', 'C', 'D'] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCorrectAnswer(key)}
                      className={`py-2 rounded-xl text-xs font-bold cursor-pointer border ${
                        correctAnswer === key
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      Option {key}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Subject / Category
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. MP General Knowledge, Reasoning, Math"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Explanation / Solution (Optional)
                </label>
                <textarea
                  rows={2}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Explanation shown in result scorecard..."
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm outline-none"
                />
              </div>

              {/* Diagram / Image Upload via Firebase Storage */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Question Diagram / Image (Firebase Storage)
                  </span>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-xs text-red-600 font-semibold cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {imageUrl && (
                  <div className="max-w-xs rounded-lg overflow-hidden border border-slate-200">
                    <img src={imageUrl} alt="Uploaded diagram" className="w-full h-auto max-h-36 object-contain bg-white" />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingImage ? `Uploading (${imageUploadProgress}%)...` : 'Upload Diagram / Image'}</span>
                    <input
                      type="file"
                      disabled={isUploadingImage}
                      onChange={handleQuestionImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </label>
                  <span className="text-[11px] text-slate-400">Optional diagram for reasoning / geometry / maps</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
                >
                  {editingQuestion ? 'Update Question' : 'Save Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dual-Language Bulk CSV Import Modal */}
      <DualLanguageBulkCsvModal
        test={test}
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onSuccess={loadQuestions}
        currentQuestionCount={questions.length}
      />
    </div>
  );
};
