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

  // Bulk Import State
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkSuccessCount, setBulkSuccessCount] = useState<number | null>(null);

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

  // CSV Validation & Bulk Import
  const handleBulkImport = async () => {
    setBulkErrors([]);
    setBulkSuccessCount(null);

    const lines = bulkCsvText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) {
      setBulkErrors(['Please paste CSV formatted text.']);
      return;
    }

    const parsedQuestions: Partial<QuestionItem>[] = [];
    const errors: string[] = [];

    // Check if line 0 is header
    const startIndex = lines[0].toLowerCase().includes('question') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const rowNum = i + 1;
      const parts = lines[i].split('|').map((p) => p.trim());

      // Format expected: Question | Option A | Option B | Option C | Option D | Correct Answer | Explanation | Question Hindi
      if (parts.length < 6) {
        errors.push(`Row ${rowNum}: Insufficient columns. Minimum 6 pipe-separated columns required (Question | A | B | C | D | CorrectKey).`);
        continue;
      }

      const qText = parts[0];
      const a = parts[1];
      const b = parts[2];
      const c = parts[3];
      const d = parts[4];
      const rawKey = parts[5].toUpperCase();
      const expl = parts[6] || '';
      const qHindi = parts[7] || '';

      if (!qText) {
        errors.push(`Row ${rowNum}: Question text cannot be empty.`);
      }
      if (!a || !b || !c || !d) {
        errors.push(`Row ${rowNum}: All 4 options (A, B, C, D) are required.`);
      }
      if (!['A', 'B', 'C', 'D'].includes(rawKey)) {
        errors.push(`Row ${rowNum}: Invalid correct answer key "${parts[5]}". Must be A, B, C, or D.`);
      }

      if (errors.length === 0) {
        parsedQuestions.push({
          questionText: qText,
          questionTextHindi: qHindi || undefined,
          options: { A: a, B: b, C: c, D: d },
          correctAnswer: rawKey as any,
          explanation: expl,
        });
      }
    }

    if (errors.length > 0) {
      setBulkErrors(errors);
      return;
    }

    const count = await bulkImportQuestions(test.id, parsedQuestions);
    setBulkSuccessCount(count);
    await loadQuestions();
    setTimeout(() => {
      setIsBulkModalOpen(false);
      setBulkCsvText('');
    }, 1500);
  };

  const sampleCsvTemplate = `Question | Option A | Option B | Option C | Option D | Correct Answer | Explanation | Question Alternative
What is the capital of Madhya Pradesh? | Indore | Bhopal | Jabalpur | Gwalior | B | Bhopal is the capital city | What is MP state capital?
Who wrote the national song Vande Mataram? | Rabindranath Tagore | Bankim Chandra Chattopadhyay | Sarojini Naidu | Bhagat Singh | B | Written by Bankim Chandra Chattopadhyay | Who composed Vande Mataram?`;

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
          >
            <Upload className="w-4 h-4" />
            <span>Bulk CSV Import</span>
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
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{key}.</span>
                        <span>{q.optionsHindi?.[key] || q.options[key]}</span>
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

              {(q.explanationHindi || q.explanation) && (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Explanation: </span>
                  {q.explanationHindi || q.explanation}
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

      {/* Bulk CSV Import Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 my-8 overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base">Bulk Question CSV Importer</h3>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs sm:text-sm">
              <p className="text-slate-600">
                Paste pipe-separated (<code>|</code>) formatted lines. Minimum 6 columns required:
              </p>
              <div className="p-2.5 bg-slate-100 rounded-xl font-mono text-[11px] text-slate-700 overflow-x-auto">
                Question | Option A | Option B | Option C | Option D | Correct Answer (A/B/C/D) | Explanation | Hindi Text
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setBulkCsvText(sampleCsvTemplate)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline cursor-pointer"
                >
                  Load Sample Template
                </button>
              </div>

              <textarea
                rows={8}
                value={bulkCsvText}
                onChange={(e) => setBulkCsvText(e.target.value)}
                placeholder="Paste CSV rows here..."
                className="w-full font-mono text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />

              {bulkErrors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span>Validation Errors Found ({bulkErrors.length})</span>
                  </div>
                  <ul className="list-disc list-inside max-h-32 overflow-y-auto space-y-0.5">
                    {bulkErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {bulkSuccessCount !== null && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Successfully imported {bulkSuccessCount} questions!</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkImport}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Validate & Import Questions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
