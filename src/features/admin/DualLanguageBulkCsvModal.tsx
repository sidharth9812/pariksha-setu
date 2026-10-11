import React, { useState, useEffect, useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Languages,
  Sparkles,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Eye,
  Check,
  HelpCircle,
} from 'lucide-react';
import { TestItem, QuestionItem } from '../../types/exam';
import { bulkImportQuestions } from '../../services/examService';
import {
  autoSettleDualLanguageCsv,
  downloadSampleCsvTemplate,
  AutoSettleResult,
  SettledQuestion,
  SAMPLE_ENGLISH_CSV,
  SAMPLE_HINDI_CSV,
} from '../../utils/csvQuestionParser';

interface DualLanguageBulkCsvModalProps {
  test: TestItem;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  currentQuestionCount: number;
}

export const DualLanguageBulkCsvModal: React.FC<DualLanguageBulkCsvModalProps> = ({
  test,
  isOpen,
  onClose,
  onSuccess,
  currentQuestionCount,
}) => {
  // Input states: Raw text
  const [englishText, setEnglishText] = useState('');
  const [hindiText, setHindiText] = useState('');

  // File metadata states
  const [englishFileName, setEnglishFileName] = useState<string | null>(null);
  const [hindiFileName, setHindiFileName] = useState<string | null>(null);

  // Active view tab for inputs: 'files' | 'paste_en' | 'paste_hi' | 'preview'
  const [activeTab, setActiveTab] = useState<'files' | 'preview'>('files');
  const [inputMode, setInputMode] = useState<'upload' | 'paste'>('upload');

  // Preview pagination & expansion
  const [previewFilter, setPreviewFilter] = useState<'all' | 'bilingual' | 'english_only' | 'hindi_only' | 'error'>('all');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Settlement & validation result
  const [settleResult, setSettleResult] = useState<AutoSettleResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Import execution states
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; percent: number }>({
    current: 0,
    total: 0,
    percent: 0,
  });
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // File Input Refs
  const englishFileInputRef = useRef<HTMLInputElement>(null);
  const hindiFileInputRef = useRef<HTMLInputElement>(null);

  // Re-run auto settlement whenever englishText or hindiText changes
  useEffect(() => {
    if (!englishText.trim() && !hindiText.trim()) {
      setSettleResult(null);
      return;
    }

    setIsValidating(true);
    const timer = setTimeout(() => {
      try {
        const result = autoSettleDualLanguageCsv(
          englishText,
          hindiText,
          currentQuestionCount + 1
        );
        setSettleResult(result);
      } catch (err) {
        console.error('Auto settlement error:', err);
      } finally {
        setIsValidating(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [englishText, hindiText, currentQuestionCount]);

  if (!isOpen) return null;

  // File reader helper for UTF-8 files
  const readFileAsUtf8 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
      reader.readAsText(file, 'UTF-8');
    });
  };

  // English file handler
  const handleEnglishFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await readFileAsUtf8(file);
      setEnglishText(text);
      setEnglishFileName(file.name);
    } catch (err: any) {
      alert(err.message || 'Error reading English CSV file');
    }
  };

  // Hindi file handler
  const handleHindiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await readFileAsUtf8(file);
      setHindiText(text);
      setHindiFileName(file.name);
    } catch (err: any) {
      alert(err.message || 'Error reading Hindi CSV file');
    }
  };

  // Quick Sample Loader
  const handleLoadSampleData = () => {
    setEnglishText(SAMPLE_ENGLISH_CSV);
    setHindiText(SAMPLE_HINDI_CSV);
    setEnglishFileName('sample_english_questions.csv');
    setHindiFileName('sample_hindi_questions.csv');
  };

  // Clear all inputs
  const handleClearAll = () => {
    setEnglishText('');
    setHindiText('');
    setEnglishFileName(null);
    setHindiFileName(null);
    setSettleResult(null);
    setImportSuccessCount(null);
    setImportError(null);
    if (englishFileInputRef.current) englishFileInputRef.current.value = '';
    if (hindiFileInputRef.current) hindiFileInputRef.current.value = '';
  };

  // Execute Database Import
  const handleImportSubmit = async () => {
    if (!settleResult || !settleResult.isReadyForImport) {
      return;
    }

    setIsImporting(true);
    setImportError(null);
    setImportProgress({ current: 0, total: settleResult.settledQuestions.length, percent: 0 });

    try {
      const payload: Partial<QuestionItem>[] = settleResult.settledQuestions.map((sq) => ({
        questionNumber: sq.questionNumber,
        questionText: sq.questionText,
        questionTextHindi: sq.questionTextHindi || undefined,
        options: sq.options,
        optionsHindi: sq.optionsHindi || undefined,
        correctAnswer: sq.correctAnswer,
        explanation: sq.explanation || undefined,
        explanationHindi: sq.explanationHindi || undefined,
        subject: sq.subject || test.subject || 'General',
      }));

      const count = await bulkImportQuestions(test.id, payload, (prog) => {
        setImportProgress(prog);
      });

      setImportSuccessCount(count);
      await onSuccess();

      setTimeout(() => {
        onClose();
        handleClearAll();
      }, 2000);
    } catch (err: any) {
      console.error('Bulk import error:', err);
      setImportError(err.message || 'Failed to import questions to database.');
    } finally {
      setIsImporting(false);
    }
  };

  // Filtered settled questions for preview
  const filteredQuestions = settleResult?.settledQuestions.filter((q) => {
    if (previewFilter === 'all') return true;
    if (previewFilter === 'bilingual') return q.status === 'complete_bilingual';
    if (previewFilter === 'english_only') return q.status === 'english_only';
    if (previewFilter === 'hindi_only') return q.status === 'hindi_only';
    if (previewFilter === 'error') return q.status === 'error';
    return true;
  }) || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 my-6 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 px-5 sm:px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">Dual-Language Bulk Question Importer</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  English + Hindi Auto-Settle
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Target Test: <strong className="text-slate-200">{test.title}</strong> • Current Questions: {currentQuestionCount}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isImporting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Sub-Header / Quick Action Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          {/* Tabs */}
          <div className="flex items-center bg-slate-200/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'files'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload CSV Files</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              disabled={!settleResult || settleResult.totalSettled === 0}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                activeTab === 'preview'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Auto-Settled Preview</span>
              {settleResult && settleResult.totalSettled > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-700">
                  {settleResult.totalSettled}
                </span>
              )}
            </button>
          </div>

          {/* Template Download & Sample Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => downloadSampleCsvTemplate('english')}
              className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              title="Download standard English CSV question template"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>English CSV Template</span>
            </button>

            <button
              type="button"
              onClick={() => downloadSampleCsvTemplate('hindi')}
              className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              title="Download standard Hindi CSV question template (UTF-8 Devanagari)"
            >
              <Download className="w-3.5 h-3.5 text-rose-600" />
              <span>Hindi CSV Template</span>
            </button>

            <button
              type="button"
              onClick={handleLoadSampleData}
              className="px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Quickly test with sample bilingual questions"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Try Sample Data</span>
            </button>

            {(englishText || hindiText) && (
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2 py-1.5 text-slate-500 hover:text-red-600 font-medium cursor-pointer transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: CSV FILE UPLOAD & DUAL DROPZONES */}
          {activeTab === 'files' && (
            <div className="space-y-5">
              {/* Informative Guidance */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-start gap-2.5">
                <Languages className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-indigo-950">
                    Separate Dual-Language Upload with Automatic Settlement:
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    Upload your <strong>English CSV</strong> and <strong>Hindi CSV</strong> files separately below.
                    The system will automatically align row-by-row, match options (A, B, C, D), synchronize correct answers,
                    and settle them into bilingual exam questions instantly.
                  </p>
                </div>
              </div>

              {/* Mode Toggle: File Upload vs Text Paste */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Input Channel
                </span>
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setInputMode('upload')}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                      inputMode === 'upload' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600'
                    }`}
                  >
                    Upload Files (.csv)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('paste')}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                      inputMode === 'paste' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600'
                    }`}
                  >
                    Paste / View Text
                  </button>
                </div>
              </div>

              {/* Dual Upload Columns (English & Hindi) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. ENGLISH CSV CHANNEL */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                        EN
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">English Questions CSV</h4>
                        <p className="text-[11px] text-slate-500">Row 1: Question | A | B | C | D | Key</p>
                      </div>
                    </div>
                    {englishText && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Loaded</span>
                      </span>
                    )}
                  </div>

                  {inputMode === 'upload' ? (
                    <div>
                      <input
                        type="file"
                        ref={englishFileInputRef}
                        accept=".csv,.txt"
                        onChange={handleEnglishFileUpload}
                        className="hidden"
                        id="english-csv-file"
                      />
                      <label
                        htmlFor="english-csv-file"
                        className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-white group"
                      >
                        <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 mb-2 transition-colors" />
                        <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">
                          {englishFileName ? englishFileName : 'Click to Upload English CSV'}
                        </span>
                        <span className="text-[11px] text-slate-400 mt-0.5">
                          Accepts .csv or .txt (Pipe | or Comma separated)
                        </span>
                      </label>
                    </div>
                  ) : (
                    <textarea
                      rows={6}
                      value={englishText}
                      onChange={(e) => {
                        setEnglishText(e.target.value);
                        setEnglishFileName('Pasted_English.csv');
                      }}
                      placeholder="Paste English CSV lines here... (Question | Opt A | Opt B | Opt C | Opt D | Key | Explanation)"
                      className="w-full font-mono text-[11px] p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  )}

                  {/* English Summary Details */}
                  {settleResult && (
                    <div className="flex items-center justify-between text-[11px] px-1 text-slate-600">
                      <span>Detected Rows:</span>
                      <strong className="text-slate-900 font-mono">
                        {settleResult.englishCount} Questions
                      </strong>
                    </div>
                  )}
                </div>

                {/* 2. HINDI CSV CHANNEL */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-rose-600 text-white font-black text-xs flex items-center justify-center">
                        HI
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Hindi Questions CSV (हिन्दी)</h4>
                        <p className="text-[11px] text-slate-500">Row 1: प्रश्न | विकल्प A | B | C | D | उत्तर</p>
                      </div>
                    </div>
                    {hindiText && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Loaded</span>
                      </span>
                    )}
                  </div>

                  {inputMode === 'upload' ? (
                    <div>
                      <input
                        type="file"
                        ref={hindiFileInputRef}
                        accept=".csv,.txt"
                        onChange={handleHindiFileUpload}
                        className="hidden"
                        id="hindi-csv-file"
                      />
                      <label
                        htmlFor="hindi-csv-file"
                        className="border-2 border-dashed border-slate-300 hover:border-rose-500 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-white group"
                      >
                        <Upload className="w-6 h-6 text-slate-400 group-hover:text-rose-600 mb-2 transition-colors" />
                        <span className="text-xs font-bold text-slate-800 group-hover:text-rose-600">
                          {hindiFileName ? hindiFileName : 'Click to Upload Hindi CSV'}
                        </span>
                        <span className="text-[11px] text-slate-400 mt-0.5">
                          UTF-8 Devanagari Hindi (.csv or .txt)
                        </span>
                      </label>
                    </div>
                  ) : (
                    <textarea
                      rows={6}
                      value={hindiText}
                      onChange={(e) => {
                        setHindiText(e.target.value);
                        setHindiFileName('Pasted_Hindi.csv');
                      }}
                      placeholder="यहाँ हिन्दी CSV पंक्तियाँ पेस्ट करें... (प्रश्न | विकल्प A | विकल्प B | विकल्प C | विकल्प D | उत्तर | व्याख्या)"
                      className="w-full font-mono text-[11px] p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-rose-500 outline-none"
                    />
                  )}

                  {/* Hindi Summary Details */}
                  {settleResult && (
                    <div className="flex items-center justify-between text-[11px] px-1 text-slate-600">
                      <span>Detected Rows:</span>
                      <strong className="text-slate-900 font-mono">
                        {settleResult.hindiCount} Questions
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE PREVIEW OF AUTO-SETTLED QUESTIONS */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Settled Questions Preview ({filteredQuestions.length})
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Preview how English and Hindi questions will appear to candidates
                  </p>
                </div>

                {/* Filter pills */}
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      previewFilter === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All ({settleResult?.totalSettled || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('bilingual')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      previewFilter === 'bilingual'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    }`}
                  >
                    Bilingual ({settleResult?.bilingualCount || 0})
                  </button>
                  {settleResult && settleResult.englishOnlyCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('english_only')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                        previewFilter === 'english_only'
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      English Only ({settleResult.englishOnlyCount})
                    </button>
                  )}
                  {settleResult && settleResult.hindiOnlyCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('hindi_only')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                        previewFilter === 'hindi_only'
                          ? 'bg-rose-600 text-white'
                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                      }`}
                    >
                      Hindi Only ({settleResult.hindiOnlyCount})
                    </button>
                  )}
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {filteredQuestions.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    No questions match the selected filter.
                  </div>
                ) : (
                  filteredQuestions.map((q) => {
                    const isExpanded = expandedRow === q.index;
                    return (
                      <div
                        key={q.index}
                        className={`border rounded-xl p-3.5 transition-all ${
                          q.status === 'error'
                            ? 'border-red-300 bg-red-50/40'
                            : q.status === 'complete_bilingual'
                            ? 'border-slate-200 bg-white hover:border-indigo-300'
                            : 'border-amber-200 bg-amber-50/20'
                        }`}
                      >
                        {/* Row header */}
                        <div
                          className="flex items-start justify-between gap-3 cursor-pointer"
                          onClick={() => setExpandedRow(isExpanded ? null : q.index)}
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md">
                                #{q.questionNumber}
                              </span>

                              {q.status === 'complete_bilingual' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>Bilingual (EN + HI)</span>
                                </span>
                              )}
                              {q.status === 'english_only' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                                  English Only
                                </span>
                              )}
                              {q.status === 'hindi_only' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                                  Hindi Only
                                </span>
                              )}
                              {q.status === 'error' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3 text-red-600" />
                                  <span>Issues Found</span>
                                </span>
                              )}

                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono">
                                Correct: {q.correctAnswer}
                              </span>

                              {q.subject && (
                                <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                  {q.subject}
                                </span>
                              )}
                            </div>

                            {/* Question Texts */}
                            <p className="text-xs font-semibold text-slate-900 pt-1">
                              {q.questionText}
                            </p>
                            {q.questionTextHindi && (
                              <p className="text-xs text-slate-700 font-medium font-sans">
                                {q.questionTextHindi}
                              </p>
                            )}
                          </div>

                          <div className="shrink-0 text-slate-400 p-1">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>

                        {/* Expanded details (Options & Explanation) */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2.5 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                                const isCorrect = q.correctAnswer === optKey;
                                return (
                                  <div
                                    key={optKey}
                                    className={`p-2 rounded-lg border text-xs flex flex-col gap-0.5 ${
                                      isCorrect
                                        ? 'bg-emerald-50 border-emerald-300 font-semibold text-emerald-950'
                                        : 'bg-slate-50 border-slate-200 text-slate-800'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-[11px] uppercase tracking-wide">
                                        Option {optKey}:
                                      </span>
                                      {isCorrect && (
                                        <span className="text-[10px] font-bold text-emerald-700">
                                          ✓ Correct Key
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs">
                                      {q.options[optKey] && q.optionsHindi?.[optKey] && q.options[optKey].trim() !== q.optionsHindi[optKey].trim() ? (
                                        <div className="inline-flex items-center gap-1.5 flex-wrap">
                                          <span className="font-semibold text-slate-900">{q.options[optKey]}</span>
                                          <span className="text-slate-400 font-bold">/</span>
                                          <span className="text-slate-700">{q.optionsHindi[optKey]}</span>
                                        </div>
                                      ) : (
                                        <span className="font-medium text-slate-800">{q.options[optKey] || q.optionsHindi?.[optKey] || ''}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {(q.explanation || q.explanationHindi) && (
                              <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100 text-[11px] text-slate-700 space-y-0.5">
                                <span className="font-bold text-indigo-900 block">Explanation:</span>
                                {q.explanation && <p>{q.explanation}</p>}
                                {q.explanationHindi && <p className="text-slate-600">{q.explanationHindi}</p>}
                              </div>
                            )}

                            {q.warnings.length > 0 && (
                              <div className="p-2 bg-amber-50 rounded-lg text-[11px] text-amber-800 space-y-0.5">
                                {q.warnings.map((w, i) => (
                                  <div key={i} className="flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                    <span>{w}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* PROGRESS BAR & CSV HEALTH METER (Requested by User) */}
          {settleResult && (
            <div className="space-y-3 border-t border-slate-200 pt-4">
              {/* Header with Health Percent */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full animate-pulse ${
                      settleResult.overallHealthPercent === 100
                        ? 'bg-emerald-500'
                        : settleResult.overallHealthPercent >= 70
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                  />
                  <span className="text-xs font-bold text-slate-800">
                    CSV Auto-Settlement Health & Verification
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-mono font-extrabold px-2 py-0.5 rounded-full ${
                      settleResult.overallHealthPercent === 100
                        ? 'bg-emerald-100 text-emerald-800'
                        : settleResult.overallHealthPercent >= 70
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {settleResult.overallHealthPercent}% Valid
                  </span>
                </div>
              </div>

              {/* Graphical Progress Bar */}
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    settleResult.overallHealthPercent === 100
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                      : settleResult.overallHealthPercent >= 70
                      ? 'bg-gradient-to-r from-amber-500 to-emerald-500'
                      : 'bg-gradient-to-r from-red-500 to-amber-500'
                  }`}
                  style={{ width: `${settleResult.overallHealthPercent}%` }}
                />
              </div>

              {/* Status Breakdown Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">English Rows</span>
                  <span className="font-bold font-mono text-slate-900">{settleResult.englishCount}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Hindi Rows</span>
                  <span className="font-bold font-mono text-slate-900">{settleResult.hindiCount}</span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
                  <span className="text-[11px]">Bilingual Settled</span>
                  <span className="font-bold font-mono">{settleResult.bilingualCount}</span>
                </div>
                <div
                  className={`p-2 rounded-xl border flex items-center justify-between ${
                    settleResult.errorCount === 0
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  <span className="text-[11px]">Error Rows</span>
                  <span className="font-bold font-mono">{settleResult.errorCount}</span>
                </div>
              </div>

              {/* Settlement Notice Banner */}
              {settleResult.englishCount > 0 && settleResult.hindiCount > 0 && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    settleResult.englishCount === settleResult.hindiCount
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  {settleResult.englishCount === settleResult.hindiCount ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <div>
                    {settleResult.englishCount === settleResult.hindiCount ? (
                      <span>
                        <strong>Perfect Match!</strong> All {settleResult.bilingualCount} questions have successfully settled with both English and Hindi translations.
                      </span>
                    ) : (
                      <span>
                        <strong>Row Count Discrepancy:</strong> English has {settleResult.englishCount} rows, whereas Hindi has {settleResult.hindiCount} rows.
                        {settleResult.englishCount > settleResult.hindiCount
                          ? ` Questions ${settleResult.hindiCount + 1}-${settleResult.englishCount} will be English-only.`
                          : ` Questions ${settleResult.englishCount + 1}-${settleResult.hindiCount} will be Hindi-only.`}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Error messages if any */}
              {settleResult.allErrors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span>Please Fix Following Issues ({settleResult.allErrors.length}):</span>
                  </div>
                  <ul className="list-disc list-inside max-h-32 overflow-y-auto space-y-1 text-[11px]">
                    {settleResult.allErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ACTIVE DATABASE IMPORT PROGRESS BAR */}
          {isImporting && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
                  <span>Importing Settled Questions to Database...</span>
                </span>
                <span className="font-mono text-indigo-700">
                  {importProgress.current} / {importProgress.total} ({importProgress.percent}%)
                </span>
              </div>

              {/* Animated Progress Bar */}
              <div className="w-full bg-indigo-200/60 rounded-full h-3.5 overflow-hidden p-0.5">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300 shadow-xs"
                  style={{ width: `${importProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* SUCCESS MESSAGE */}
          {importSuccessCount !== null && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs sm:text-sm font-semibold">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-emerald-950">
                  Successfully imported {importSuccessCount} questions!
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  English and Hindi versions have been settled automatically. Refreshing test management...
                </p>
              </div>
            </div>
          )}

          {/* IMPORT ERROR MESSAGE */}
          {importError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{importError}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            {settleResult && settleResult.totalSettled > 0 ? (
              <span>
                Ready to import <strong className="text-slate-900 font-mono">{settleResult.validCount}</strong> settled questions.
              </span>
            ) : (
              <span>Upload CSV files or click "Try Sample Data" to proceed.</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="flex-1 sm:flex-initial py-2.5 px-4 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleImportSubmit}
              disabled={
                isImporting ||
                !settleResult ||
                !settleResult.isReadyForImport ||
                settleResult.validCount === 0
              }
              className="flex-1 sm:flex-initial py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Importing Questions...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    Import Auto-Settled Questions ({settleResult?.validCount || 0})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
