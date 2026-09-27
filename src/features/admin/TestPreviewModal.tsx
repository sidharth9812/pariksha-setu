import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertCircle, Clock, Award, Shield, Eye } from 'lucide-react';
import { TestItem, QuestionItem } from '../../types/exam';
import { getQuestionsForTest } from '../../services/examService';

interface TestPreviewModalProps {
  test: TestItem;
  onClose: () => void;
}

export const TestPreviewModal: React.FC<TestPreviewModalProps> = ({ test, onClose }) => {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const qList = await getQuestionsForTest(test.id, 'admin');
        setQuestions(qList);
      } catch (err) {
        console.error('Failed to load preview:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [test.id]);

  const currentQ = questions[currentIndex];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                Admin Preview Mode (No attempt recorded)
              </span>
            </div>
            <h2 className="text-base font-bold text-white mt-1">{test.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper Info Ribbon */}
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>Duration: {test.durationMinutes} Minutes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Award className="w-4 h-4 text-emerald-600" />
            <span>Marking: +{test.marksPerQuestion} / -{test.negativeMarks}</span>
          </div>
          <div className="font-semibold text-slate-800">
            Question {currentIndex + 1} of {questions.length}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-slate-400">Loading questions...</div>
          ) : currentQ ? (
            <div className="space-y-4">
              {currentQ.questionTextHindi && (
                <div className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  {currentQ.questionTextHindi}
                </div>
              )}
              <div className="text-sm sm:text-base text-slate-700 leading-snug">
                {currentQ.questionText}
              </div>

              {/* Options with Admin Correct Answer Glow */}
              <div className="space-y-2.5 pt-2">
                {(['A', 'B', 'C', 'D'] as const).map((key) => {
                  const isCorrect = currentQ.correctAnswer === key;
                  return (
                    <div
                      key={key}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs sm:text-sm ${
                        isCorrect
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold ring-2 ring-emerald-400/30'
                          : 'border-slate-200 bg-slate-50/60 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                            isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {key}
                        </span>
                        <span>{currentQ.optionsHindi?.[key] || currentQ.options[key]}</span>
                      </div>

                      {isCorrect && (
                        <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-200/80 px-2 py-0.5 rounded-full">
                          Correct Answer
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {(currentQ.explanationHindi || currentQ.explanation) && (
                <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-200 text-xs space-y-1">
                  <span className="font-bold text-slate-800 block">Explanation:</span>
                  {currentQ.explanation && <p className="text-slate-800">{currentQ.explanation}</p>}
                  {currentQ.explanationHindi && !currentQ.explanation && <p className="text-slate-800">{currentQ.explanationHindi}</p>}
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500">No questions found in this paper.</div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-40 cursor-pointer"
          >
            Previous
          </button>

          <span className="text-xs text-slate-500 font-medium">
            Jump to question using index
          </span>

          <button
            onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
            disabled={currentIndex >= questions.length - 1}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold disabled:opacity-40 cursor-pointer"
          >
            Next Question
          </button>
        </div>
      </div>
    </div>
  );
};
