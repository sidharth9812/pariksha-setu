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
  Image as ImageIcon,
} from 'lucide-react';
import { TestItem, QuestionItem, OptionImageData } from '../../types/exam';
import {
  getQuestionsForTest,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  bulkImportQuestions,
} from '../../services/examService';
import {
  uploadQuestionImageToCloudinary,
  uploadOptionImageToCloudinary,
} from '../../services/cloudinaryService';
import { DualLanguageBulkCsvModal } from './DualLanguageBulkCsvModal';
import { FormattedQuestionText, preserveQuestionFormatting } from '../../utils/questionTextFormatter';
import { parseLanguageCsv } from '../../utils/csvQuestionParser';
import { Sparkles } from 'lucide-react';

interface QuestionManagerProps {
  test: TestItem;
  onBack: () => void;
}

export const QuestionManager: React.FC<QuestionManagerProps> = ({ test, onBack }) => {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkInitialEnglish, setBulkInitialEnglish] = useState<string | undefined>(undefined);
  const [bulkInitialHindi, setBulkInitialHindi] = useState<string | undefined>(undefined);
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
  const [optionImages, setOptionImages] = useState<{
    A?: OptionImageData;
    B?: OptionImageData;
    C?: OptionImageData;
    D?: OptionImageData;
  }>({});
  const [uploadingOptionKey, setUploadingOptionKey] = useState<string | null>(null);
  const [optionUploadProgress, setOptionUploadProgress] = useState<Record<string, number>>({});
  const [formValidationError, setFormValidationError] = useState<string | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [explanation, setExplanation] = useState('');
  const [explanationHindi, setExplanationHindi] = useState('');
  const [subject, setSubject] = useState('General');
  const [imageUrl, setImageUrl] = useState('');
  const [questionImageUrl, setQuestionImageUrl] = useState('');
  const [questionImagePublicId, setQuestionImagePublicId] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);

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
    setOptionImages({});
    setUploadingOptionKey(null);
    setOptionUploadProgress({});
    setFormValidationError(null);
    setCorrectAnswer('A');
    setExplanation('');
    setExplanationHindi('');
    setSubject('General');
    setImageUrl('');
    setQuestionImageUrl('');
    setQuestionImagePublicId('');
    setMediaError(null);
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
    setOptionImages(
      q.optionImages
        ? {
            A: q.optionImages.A,
            B: q.optionImages.B,
            C: q.optionImages.C,
            D: q.optionImages.D,
          }
        : {}
    );
    setUploadingOptionKey(null);
    setOptionUploadProgress({});
    setFormValidationError(null);
    setCorrectAnswer(q.correctAnswer);
    setExplanation(q.explanation || '');
    setExplanationHindi(q.explanationHindi || '');
    setSubject(q.subject || 'General');
    const existingImg = q.questionImageUrl || q.imageUrl || '';
    setImageUrl(existingImg);
    setQuestionImageUrl(existingImg);
    setQuestionImagePublicId(q.questionImagePublicId || '');
    setMediaError(null);
    setIsAddModalOpen(true);
  };

  const handleQuestionImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    setImageUploadProgress(0);
    setMediaError(null);
    try {
      const res = await uploadQuestionImageToCloudinary(file, (progress) => {
        setImageUploadProgress(progress);
      });
      setQuestionImageUrl(res.secure_url);
      setQuestionImagePublicId(res.public_id);
      setImageUrl(res.secure_url); // For backwards compatibility
    } catch (err: any) {
      console.error('Question image upload error:', err);
      setMediaError('Media upload failed. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl('');
    setQuestionImageUrl('');
    setQuestionImagePublicId('');
    setMediaError(null);
  };

  const handleOptionImageUpload = async (key: 'A' | 'B' | 'C' | 'D', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingOptionKey(key);
    setOptionUploadProgress((prev) => ({ ...prev, [key]: 0 }));
    setFormValidationError(null);
    try {
      const res = await uploadOptionImageToCloudinary(file, (progress) => {
        setOptionUploadProgress((prev) => ({ ...prev, [key]: progress }));
      });
      setOptionImages((prev) => ({
        ...prev,
        [key]: {
          imageUrl: res.secure_url,
          imagePublicId: res.public_id,
        },
      }));
    } catch (err: any) {
      console.error(`Option ${key} image upload error:`, err);
      setFormValidationError(`Failed to upload image for Option ${key}. Please try again.`);
    } finally {
      setUploadingOptionKey(null);
    }
  };

  const handleRemoveOptionImage = (key: 'A' | 'B' | 'C' | 'D') => {
    setOptionImages((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    setFormValidationError(null);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationError(null);

    if (!questionText.trim()) {
      setFormValidationError('Question text is required.');
      return;
    }

    // Validation: Each option (A, B, C, D) must have text OR an image (cannot be completely empty)
    const optionValues = {
      A: { text: optA.trim() || optAHindi.trim(), hasImg: Boolean(optionImages.A?.imageUrl) },
      B: { text: optB.trim() || optBHindi.trim(), hasImg: Boolean(optionImages.B?.imageUrl) },
      C: { text: optC.trim() || optCHindi.trim(), hasImg: Boolean(optionImages.C?.imageUrl) },
      D: { text: optD.trim() || optDHindi.trim(), hasImg: Boolean(optionImages.D?.imageUrl) },
    };

    for (const key of ['A', 'B', 'C', 'D'] as const) {
      if (!optionValues[key].text && !optionValues[key].hasImg) {
        setFormValidationError(
          `Option ${key} cannot be empty. Please provide text, upload an image, or both.`
        );
        return;
      }
    }

    const finalImageUrl = questionImageUrl || imageUrl || undefined;
    const cleanedOptionImages: { [key: string]: OptionImageData } = {};
    (['A', 'B', 'C', 'D'] as const).forEach((key) => {
      if (optionImages[key]?.imageUrl) {
        cleanedOptionImages[key] = optionImages[key]!;
      }
    });

    const payload: Partial<QuestionItem> = {
      testId: test.id,
      questionNumber: editingQuestion ? editingQuestion.questionNumber : questions.length + 1,
      questionText: preserveQuestionFormatting(questionText),
      questionTextHindi: preserveQuestionFormatting(questionTextHindi) || undefined,
      options: {
        A: preserveQuestionFormatting(optA),
        B: preserveQuestionFormatting(optB),
        C: preserveQuestionFormatting(optC),
        D: preserveQuestionFormatting(optD),
      },
      optionsHindi:
        optAHindi || optBHindi || optCHindi || optDHindi
          ? {
              A: preserveQuestionFormatting(optAHindi),
              B: preserveQuestionFormatting(optBHindi),
              C: preserveQuestionFormatting(optCHindi),
              D: preserveQuestionFormatting(optDHindi),
            }
          : undefined,
      optionImages: Object.keys(cleanedOptionImages).length > 0 ? cleanedOptionImages : undefined,
      correctAnswer,
      explanation: preserveQuestionFormatting(explanation) || undefined,
      explanationHindi: preserveQuestionFormatting(explanationHindi) || undefined,
      subject: subject.trim() || 'General',
      questionImageUrl: questionImageUrl || undefined,
      questionImagePublicId: questionImagePublicId || undefined,
      imageUrl: finalImageUrl,
    };

    try {
      if (editingQuestion) {
        await updateQuestion(test.id, editingQuestion.id, payload);
      } else {
        await createQuestion(payload);
      }

      setIsAddModalOpen(false);
      await loadQuestions();
    } catch (err: any) {
      console.error('Save question error:', err);
      if (questionImageUrl || Object.keys(cleanedOptionImages).length > 0) {
        alert('Media uploaded, but saving the data failed. Please try again.');
      } else {
        alert(err.message || 'Failed to save question.');
      }
    }
  };

  const handleDeleteQuestion = async (q: QuestionItem) => {
    if (!confirm(`Delete question #${q.questionNumber}?`)) return;
    await deleteQuestion(test.id, q.id);
    await loadQuestions();
  };

  // Detect if pasted text in the Single Question Modal contains embedded options (A-D) or multiple questions
  const detectedEnglishParsed = React.useMemo(() => {
    if (!questionText.trim()) return [];
    return parseLanguageCsv(questionText, 'en').filter(
      (r) => r.questionText && r.optionA && r.optionB && r.optionC && r.optionD
    );
  }, [questionText]);

  const detectedHindiParsed = React.useMemo(() => {
    if (!questionTextHindi.trim()) return [];
    return parseLanguageCsv(questionTextHindi, 'hi').filter(
      (r) => r.questionText && r.optionA && r.optionB && r.optionC && r.optionD
    );
  }, [questionTextHindi]);

  const handleExtractSingleEnglishQuestion = () => {
    if (detectedEnglishParsed.length !== 1) return;
    const item = detectedEnglishParsed[0];
    setQuestionText(item.questionText);
    setOptA(item.optionA);
    setOptB(item.optionB);
    setOptC(item.optionC);
    setOptD(item.optionD);
    if (item.correctAnswer) setCorrectAnswer(item.correctAnswer);
    if (item.explanation && !explanation.trim()) setExplanation(item.explanation);
    if (item.subject && (!subject.trim() || subject === 'General')) setSubject(item.subject);
  };

  const handleExtractSingleHindiQuestion = () => {
    if (detectedHindiParsed.length !== 1) return;
    const item = detectedHindiParsed[0];
    setQuestionTextHindi(item.questionText);
    setOptAHindi(item.optionA);
    setOptBHindi(item.optionB);
    setOptCHindi(item.optionC);
    setOptDHindi(item.optionD);
    if (item.correctAnswer) setCorrectAnswer(item.correctAnswer);
    if (item.explanation && !explanationHindi.trim()) setExplanationHindi(item.explanation);
  };

  const handleMoveToBulkImporter = () => {
    setBulkInitialEnglish(questionText.trim() || undefined);
    setBulkInitialHindi(questionTextHindi.trim() || undefined);
    setIsAddModalOpen(false);
    setIsBulkModalOpen(true);
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
                    <FormattedQuestionText
                      text={q.questionTextHindi}
                      className="font-bold text-sm sm:text-base text-slate-900 leading-relaxed"
                    />
                  )}
                  <FormattedQuestionText
                    text={q.questionText}
                    className="text-xs sm:text-sm text-slate-700 leading-relaxed"
                  />

                  {(q.questionImageUrl || q.imageUrl) && (
                    <div className="mt-2 max-w-sm rounded-xl overflow-hidden border border-slate-200">
                      <img
                        src={q.questionImageUrl || q.imageUrl}
                        alt="Question diagram"
                        className="w-full h-auto max-h-48 object-contain bg-white"
                      />
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
                  const optImg = q.optionImages?.[key];
                  const optEng = q.options?.[key];
                  const optHi = q.optionsHindi?.[key];
                  return (
                    <div
                      key={key}
                      className={`p-2.5 rounded-xl border flex flex-col justify-between gap-1.5 ${
                        isCorrect
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-wrap">
                          <span className="font-bold shrink-0">{key}.</span>
                          {optEng && optHi && optEng.trim() !== optHi.trim() ? (
                            <span className="inline-flex items-start gap-1.5 flex-wrap">
                              <FormattedQuestionText
                                text={optEng}
                                className="font-semibold text-slate-900"
                              />
                              <span className="text-slate-400 font-bold">/</span>
                              <FormattedQuestionText
                                text={optHi}
                                className="text-slate-700"
                              />
                            </span>
                          ) : optEng || optHi ? (
                            <FormattedQuestionText text={optEng || optHi} />
                          ) : (
                            <span className="italic text-slate-400">[Image Option]</span>
                          )}
                        </div>
                        {isCorrect && (
                          <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                            Answer
                          </span>
                        )}
                      </div>

                      {optImg?.imageUrl && (
                        <div className="mt-1 max-w-[160px] rounded-lg overflow-hidden border border-slate-200 bg-white p-1">
                          <img
                            src={optImg.imageUrl}
                            alt={`Option ${key}`}
                            className="max-h-20 w-auto object-contain rounded"
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {(q.explanation || q.explanationHindi) && (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1">
                  <span className="font-semibold text-slate-800 block">Explanation: </span>
                  {q.explanation && (
                    <FormattedQuestionText text={q.explanation} className="leading-relaxed" />
                  )}
                  {q.explanationHindi && (
                    <FormattedQuestionText
                      text={q.explanationHindi}
                      className="text-slate-700 leading-relaxed"
                    />
                  )}
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
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Question Text (English) *
                </label>
                <textarea
                  required
                  rows={4}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Enter or paste the question in English (line breaks and paragraphs are preserved)..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm leading-relaxed whitespace-pre-wrap focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                {detectedEnglishParsed.length > 1 && (
                  <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-indigo-950">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>{detectedEnglishParsed.length} questions with options detected!</strong> Open in Bulk Importer to separate and import all {detectedEnglishParsed.length} questions properly.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleMoveToBulkImporter}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer"
                    >
                      Separate All {detectedEnglishParsed.length} Questions
                    </button>
                  </div>
                )}
                {detectedEnglishParsed.length === 1 && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-950">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Options (A, B, C, D) detected inside Question Text. Click to auto-fill the option boxes below!
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleExtractSingleEnglishQuestion}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer"
                    >
                      Extract Options (A–D)
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Question Text (Alternative / Secondary / Optional)
                </label>
                <textarea
                  rows={4}
                  value={questionTextHindi}
                  onChange={(e) => setQuestionTextHindi(e.target.value)}
                  placeholder="Enter or paste secondary/Hindi question text (line breaks and paragraphs are preserved)..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm leading-relaxed whitespace-pre-wrap focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                {detectedHindiParsed.length > 1 && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-rose-950">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>{detectedHindiParsed.length} Hindi questions detected!</strong> Open in Bulk Importer to separate and import all {detectedHindiParsed.length} questions properly.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleMoveToBulkImporter}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer"
                    >
                      Separate All {detectedHindiParsed.length} Questions
                    </button>
                  </div>
                )}
                {detectedHindiParsed.length === 1 && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-950">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Hindi Options (A, B, C, D) detected inside text. Click to auto-fill Hindi option boxes!
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleExtractSingleHindiQuestion}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer"
                    >
                      Extract Hindi Options (A–D)
                    </button>
                  </div>
                )}
              </div>

              {/* Options */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Options (A, B, C, D) *
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Each option requires text, image, or both
                  </span>
                </div>

                <div className="space-y-3">
                  {[
                    { key: 'A' as const, val: optA, setVal: setOptA, valHi: optAHindi, setValHi: setOptAHindi },
                    { key: 'B' as const, val: optB, setVal: setOptB, valHi: optBHindi, setValHi: setOptBHindi },
                    { key: 'C' as const, val: optC, setVal: setOptC, valHi: optCHindi, setValHi: setOptCHindi },
                    { key: 'D' as const, val: optD, setVal: setOptD, valHi: optDHindi, setValHi: setOptDHindi },
                  ].map(({ key, val, setVal, valHi, setValHi }) => {
                    const optImg = optionImages[key];
                    const isUploadingThis = uploadingOptionKey === key;
                    const progress = optionUploadProgress[key] || 0;

                    return (
                      <div
                        key={key}
                        className="p-3 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2.5 transition-colors hover:border-slate-300"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                              {key}
                            </span>
                            <span className="text-xs font-bold text-slate-800">Option {key}</span>
                          </div>
                          {optImg?.imageUrl && (
                            <span className="text-[10px] bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" /> Image Added
                            </span>
                          )}
                        </div>

                        {/* Text inputs for Option */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                              Text (Primary)
                            </label>
                            <input
                              type="text"
                              value={val}
                              onChange={(e) => setVal(e.target.value)}
                              placeholder={`Option ${key} text (optional if image added)`}
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none bg-white focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                              Text (Secondary / Hindi)
                            </label>
                            <input
                              type="text"
                              value={valHi}
                              onChange={(e) => setValHi(e.target.value)}
                              placeholder={`Option ${key} Hindi (optional)`}
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none bg-white focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        </div>

                        {/* Option Image Upload & Preview Section */}
                        <div className="pt-1.5 border-t border-slate-200/70">
                          {optImg?.imageUrl ? (
                            <div className="flex items-center justify-between gap-3 bg-white p-2 rounded-lg border border-slate-200">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="h-12 w-16 shrink-0 rounded border border-slate-200 bg-slate-50 p-0.5 flex items-center justify-center overflow-hidden">
                                  <img
                                    src={optImg.imageUrl}
                                    alt={`Option ${key} preview`}
                                    className="max-h-full max-w-full object-contain"
                                  />
                                </div>
                                <div className="text-[11px] truncate">
                                  <span className="font-semibold text-slate-800 block truncate">
                                    Option {key} Image
                                  </span>
                                  <span className="text-emerald-600 text-[10px] font-medium">Uploaded to Cloudinary</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <label className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer">
                                  <Upload className="w-3 h-3" />
                                  <span>{isUploadingThis ? `Uploading (${progress}%)...` : 'Change'}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    disabled={isUploadingThis}
                                    onChange={(e) => handleOptionImageUpload(key, e)}
                                    className="hidden"
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOptionImage(key)}
                                  className="px-2 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded text-[11px] font-semibold cursor-pointer"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer shadow-2xs">
                                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                                <span>{isUploadingThis ? `Uploading (${progress}%)...` : `Upload Option ${key} Image`}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={isUploadingThis}
                                  onChange={(e) => handleOptionImageUpload(key, e)}
                                  className="hidden"
                                />
                              </label>
                              <span className="text-[11px] text-slate-400">Optional image/formula for Option {key}</span>
                            </div>
                          )}

                          {isUploadingThis && (
                            <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden mt-1.5">
                              <div
                                className="h-full bg-indigo-600 transition-all duration-150"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
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

              {/* Diagram / Image Upload via Cloudinary */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Question Diagram / Image (Cloudinary)
                  </span>
                  {(questionImageUrl || imageUrl) && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="text-xs text-red-600 font-semibold cursor-pointer hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {mediaError && (
                  <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                    {mediaError}
                  </div>
                )}

                {(questionImageUrl || imageUrl) && (
                  <div className="max-w-xs rounded-lg overflow-hidden border border-slate-200 bg-white p-1">
                    <img
                      src={questionImageUrl || imageUrl}
                      alt="Uploaded diagram"
                      className="w-full h-auto max-h-36 object-contain bg-white"
                    />
                  </div>
                )}

                {isUploadingImage && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-500 font-semibold">
                      <span>Uploading to Cloudinary...</span>
                      <span>{imageUploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-150"
                        style={{ width: `${imageUploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {isUploadingImage
                        ? `Uploading (${imageUploadProgress}%)...`
                        : (questionImageUrl || imageUrl)
                        ? 'Replace Diagram'
                        : 'Upload Diagram / Image'}
                    </span>
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

              {formValidationError && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{formValidationError}</span>
                </div>
              )}

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
        onClose={() => {
          setIsBulkModalOpen(false);
          setBulkInitialEnglish(undefined);
          setBulkInitialHindi(undefined);
        }}
        onSuccess={loadQuestions}
        currentQuestionCount={questions.length}
        initialEnglishText={bulkInitialEnglish}
        initialHindiText={bulkInitialHindi}
      />
    </div>
  );
};
