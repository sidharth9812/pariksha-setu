import { QuestionItem } from '../types/exam';

export interface ParsedLanguageRow {
  rowNumber: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer?: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  subject?: string;
  errors: string[];
}

export interface SettledQuestion {
  index: number;
  questionNumber: number;
  questionText: string;
  questionTextHindi?: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  optionsHindi?: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  explanationHindi?: string;
  subject?: string;
  hasEnglish: boolean;
  hasHindi: boolean;
  status: 'complete_bilingual' | 'english_only' | 'hindi_only' | 'error';
  warnings: string[];
  errors: string[];
}

export interface AutoSettleResult {
  settledQuestions: SettledQuestion[];
  englishCount: number;
  hindiCount: number;
  totalSettled: number;
  bilingualCount: number;
  englishOnlyCount: number;
  hindiOnlyCount: number;
  validCount: number;
  errorCount: number;
  overallHealthPercent: number; // 0 to 100
  allErrors: string[];
  allWarnings: string[];
  isReadyForImport: boolean;
}

/**
 * Robust CSV Line Splitter supporting:
 * - Pipe delimiter (|)
 * - Comma delimiter (,) with quoted strings ("a, b", "c")
 * - Tab delimiter (\t)
 * - Semicolon delimiter (;)
 */
export function splitCsvLine(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  // 1. If pipe separated, prioritize pipe (|) delimiter
  if (trimmed.includes('|')) {
    return trimmed.split('|').map((p) => p.trim());
  }

  // 2. If tab separated, prioritize tab (\t) delimiter
  if (trimmed.includes('\t')) {
    return trimmed.split('\t').map((p) => p.trim());
  }

  // 3. Comma or semicolon CSV parser with quote escaping
  const delimiter = trimmed.includes(';') && !trimmed.includes(',') ? ';' : ',';
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    const nextChar = trimmed[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Normalizes answer key from various formats:
 * 'A', 'B', 'C', 'D', '1', '2', '3', '4', 'क', 'ख', 'ग', 'घ', 'optA', etc.
 */
export function normalizeAnswerKey(raw?: string): 'A' | 'B' | 'C' | 'D' | null {
  if (!raw) return null;
  const clean = raw.trim().toUpperCase();

  if (clean === 'A' || clean === '1' || clean === 'OPTION A' || clean === 'OPT A' || clean === 'क') return 'A';
  if (clean === 'B' || clean === '2' || clean === 'OPTION B' || clean === 'OPT B' || clean === 'ख') return 'B';
  if (clean === 'C' || clean === '3' || clean === 'OPTION C' || clean === 'OPT C' || clean === 'ग') return 'C';
  if (clean === 'D' || clean === '4' || clean === 'OPTION D' || clean === 'OPT D' || clean === 'घ') return 'D';

  // Check if first character is A/B/C/D
  const firstChar = clean[0];
  if (['A', 'B', 'C', 'D'].includes(firstChar)) {
    return firstChar as 'A' | 'B' | 'C' | 'D';
  }

  return null;
}

/**
 * Checks if a line is a header row
 */
export function isHeaderRow(cells: string[]): boolean {
  if (cells.length === 0) return false;
  const first = (cells[0] || '').trim().toLowerCase();
  const joined = cells.join(' ').toLowerCase();

  // If first cell contains a question mark or sentence end, it's definitely a question, not a header
  if (first.includes('?') || first.includes('।') || first.length > 50) {
    return false;
  }

  // Exact header labels for the first column
  const exactFirstHeaderLabels = [
    'question',
    'questions',
    'प्रश्न',
    'q',
    'q.',
    'q.no',
    'qno',
    'question text',
    'question_text',
    'sr',
    'sr.',
    'sr.no',
    'sl',
    'sl.',
    'sl.no',
    's.no',
  ];

  if (exactFirstHeaderLabels.includes(first)) {
    return true;
  }

  // Count header keywords across all cells
  let matches = 0;
  if (joined.includes('option') || joined.includes('विकल्प')) matches++;
  if (joined.includes('answer') || joined.includes('उत्तर') || joined.includes('correct')) matches++;
  if (joined.includes('explanation') || joined.includes('व्याख्या')) matches++;
  if (joined.includes('subject') || joined.includes('विषय')) matches++;

  return matches >= 2;
}

/**
 * Parses raw CSV text for one language (English or Hindi)
 */
export function parseLanguageCsv(rawText: string, language: 'en' | 'hi'): ParsedLanguageRow[] {
  if (!rawText || !rawText.trim()) return [];

  // Normalize newlines
  const rawLines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines = rawLines.map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

  if (lines.length === 0) return [];

  const startIndex = isHeaderRow(splitCsvLine(lines[0])) ? 1 : 0;
  const parsedRows: ParsedLanguageRow[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const rowNum = i + 1;
    const parts = splitCsvLine(lines[i]);

    // Format expected:
    // Col 0: Question Text
    // Col 1: Option A
    // Col 2: Option B
    // Col 3: Option C
    // Col 4: Option D
    // Col 5: Correct Answer (Optional/Recommended for Hindi, required for standalone)
    // Col 6: Explanation (Optional)
    // Col 7: Subject (Optional)
    const errors: string[] = [];

    if (parts.length < 5) {
      errors.push(`Row ${rowNum}: Insufficient columns. Minimum 5 columns required (Question, Option A, Option B, Option C, Option D).`);
    }

    const qText = parts[0] || '';
    const optA = parts[1] || '';
    const optB = parts[2] || '';
    const optC = parts[3] || '';
    const optD = parts[4] || '';
    const rawKey = parts[5] || '';
    const explanation = parts[6] || '';
    const subject = parts[7] || '';

    if (!qText) {
      errors.push(`Row ${rowNum}: Question text is empty.`);
    }
    if (!optA || !optB || !optC || !optD) {
      errors.push(`Row ${rowNum}: All 4 options (A, B, C, D) are required.`);
    }

    let normalizedKey: 'A' | 'B' | 'C' | 'D' | undefined = undefined;
    if (rawKey) {
      const key = normalizeAnswerKey(rawKey);
      if (!key) {
        errors.push(`Row ${rowNum}: Invalid correct answer key "${rawKey}". Must be A, B, C, D (or 1, 2, 3, 4).`);
      } else {
        normalizedKey = key;
      }
    }

    parsedRows.push({
      rowNumber: rowNum,
      questionText: qText,
      optionA: optA,
      optionB: optB,
      optionC: optC,
      optionD: optD,
      correctAnswer: normalizedKey,
      explanation,
      subject,
      errors,
    });
  }

  return parsedRows;
}

/**
 * AUTOMATIC SETTLEMENT ENGINE
 * Takes separate English and Hindi CSV texts, parses both,
 * aligns and merges them row-by-row into unified bilingual questions,
 * and calculates health percentages for progress display.
 */
export function autoSettleDualLanguageCsv(
  englishRawText: string,
  hindiRawText: string,
  startingQuestionNumber: number = 1
): AutoSettleResult {
  const englishRows = parseLanguageCsv(englishRawText, 'en');
  const hindiRows = parseLanguageCsv(hindiRawText, 'hi');

  const englishCount = englishRows.length;
  const hindiCount = hindiRows.length;
  const maxRows = Math.max(englishCount, hindiCount);

  const settledQuestions: SettledQuestion[] = [];
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  let bilingualCount = 0;
  let englishOnlyCount = 0;
  let hindiOnlyCount = 0;
  let validCount = 0;
  let errorCount = 0;

  for (let i = 0; i < maxRows; i++) {
    const qNum = startingQuestionNumber + i;
    const en = englishRows[i];
    const hi = hindiRows[i];

    const qErrors: string[] = [];
    const qWarnings: string[] = [];

    // Collect parse errors
    if (en && en.errors.length > 0) {
      en.errors.forEach((err) => qErrors.push(`[English] ${err}`));
    }
    if (hi && hi.errors.length > 0) {
      hi.errors.forEach((err) => qErrors.push(`[Hindi] ${err}`));
    }

    // Determine correct answer
    const enKey = en?.correctAnswer;
    const hiKey = hi?.correctAnswer;
    let finalKey: 'A' | 'B' | 'C' | 'D' = enKey || hiKey || 'A';

    if (enKey && hiKey && enKey !== hiKey) {
      qWarnings.push(`Question #${qNum}: Correct answer mismatch between English (${enKey}) and Hindi (${hiKey}). Using English answer '${enKey}'.`);
      finalKey = enKey;
    } else if (!enKey && !hiKey) {
      qErrors.push(`Question #${qNum}: Correct answer key (A, B, C, D) is missing.`);
    }

    let status: 'complete_bilingual' | 'english_only' | 'hindi_only' | 'error' = 'error';
    const hasEnglish = Boolean(en && en.questionText && en.optionA);
    const hasHindi = Boolean(hi && hi.questionText && hi.optionA);

    if (hasEnglish && hasHindi) {
      status = 'complete_bilingual';
      bilingualCount++;
    } else if (hasEnglish) {
      status = 'english_only';
      englishOnlyCount++;
      if (hindiCount > 0) {
        qWarnings.push(`Question #${qNum}: Hindi translation missing (Hindi CSV has only ${hindiCount} rows).`);
      }
    } else if (hasHindi) {
      status = 'hindi_only';
      hindiOnlyCount++;
      if (englishCount > 0) {
        qWarnings.push(`Question #${qNum}: English translation missing (English CSV has only ${englishCount} rows).`);
      }
    }

    if (qErrors.length > 0) {
      status = 'error';
      errorCount++;
      allErrors.push(...qErrors);
    } else {
      validCount++;
    }

    if (qWarnings.length > 0) {
      allWarnings.push(...qWarnings);
    }

    // Prepare settled question data
    const questionText = en?.questionText || hi?.questionText || '';
    const questionTextHindi = hi?.questionText || (hasHindi ? hi?.questionText : undefined);

    const options = {
      A: en?.optionA || hi?.optionA || '',
      B: en?.optionB || hi?.optionB || '',
      C: en?.optionC || hi?.optionC || '',
      D: en?.optionD || hi?.optionD || '',
    };

    const optionsHindi = hasHindi
      ? {
          A: hi?.optionA || '',
          B: hi?.optionB || '',
          C: hi?.optionC || '',
          D: hi?.optionD || '',
        }
      : undefined;

    const explanation = en?.explanation || undefined;
    const explanationHindi = hi?.explanation || undefined;
    const subject = en?.subject || hi?.subject || undefined;

    settledQuestions.push({
      index: i,
      questionNumber: qNum,
      questionText,
      questionTextHindi,
      options,
      optionsHindi,
      correctAnswer: finalKey,
      explanation,
      explanationHindi,
      subject,
      hasEnglish,
      hasHindi,
      status,
      warnings: qWarnings,
      errors: qErrors,
    });
  }

  // Calculate Overall Health Percentage
  let overallHealthPercent = 0;
  if (maxRows > 0) {
    if (errorCount === 0) {
      overallHealthPercent = 100;
    } else {
      overallHealthPercent = Math.max(0, Math.round(((validCount) / maxRows) * 100));
    }
  }

  const isReadyForImport = maxRows > 0 && errorCount === 0 && validCount > 0;

  return {
    settledQuestions,
    englishCount,
    hindiCount,
    totalSettled: maxRows,
    bilingualCount,
    englishOnlyCount,
    hindiOnlyCount,
    validCount,
    errorCount,
    overallHealthPercent,
    allErrors,
    allWarnings,
    isReadyForImport,
  };
}

/**
 * Sample CSV Templates generator for English and Hindi
 */
export const SAMPLE_ENGLISH_CSV = `Question | Option A | Option B | Option C | Option D | Correct Answer | Explanation | Subject
What is the capital of Madhya Pradesh? | Indore | Bhopal | Jabalpur | Gwalior | B | Bhopal is the state capital city of MP | General Knowledge
Who composed the Indian National Song "Vande Mataram"? | Rabindranath Tagore | Bankim Chandra Chattopadhyay | Sarojini Naidu | Bhagat Singh | B | Composed in 1870s by Bankim Chandra | History
Which planet is known as the Red Planet? | Venus | Mars | Jupiter | Saturn | B | Mars appears red due to iron oxide on surface | Science
What is the currency of Japan? | Yuan | Won | Yen | Ringgit | C | Yen is official currency of Japan | World Economics
In which year did India gain independence? | 1945 | 1947 | 1950 | 1952 | B | India gained independence on 15 August 1947 | Modern History`;

export const SAMPLE_HINDI_CSV = `प्रश्न | विकल्प A | विकल्प B | विकल्प C | विकल्प D | सही उत्तर | व्याख्या | विषय
मध्य प्रदेश की राजधानी कौन सी है? | इंदौर | भोपाल | जबलपुर | ग्वालियर | B | भोपाल मध्य प्रदेश की प्रशासनिक राजधानी है | सामान्य ज्ञान
भारतीय राष्ट्रीय गीत "वंदे मातरम्" की रचना किसने की थी? | रवींद्रनाथ टैगोर | बंकिम चंद्र चट्टोपाध्याय | सरोजिनी नायडू | भगत सिंह | B | बंकिम चंद्र चट्टोपाध्याय ने 1870 के दशक में रचा था | इतिहास
किस ग्रह को 'लाल ग्रह' (Red Planet) के नाम से जाना जाता है? | शुक्र | मंगल | बृहस्पति | शनि | B | मंगल ग्रह की सतह पर आयरन ऑक्साइड के कारण यह लाल दिखता है | विज्ञान
जापान की आधिकारिक मुद्रा कौन सी है? | युआन | वोन | येन | रिंगिट | C | येन जापान की आधिकारिक राष्ट्रीय मुद्रा है | विश्व अर्थशास्त्र
भारत को किस वर्ष स्वतंत्रता प्राप्त हुई थी? | 1945 | 1947 | 1950 | 1952 | B | 15 अगस्त 1947 को भारत स्वतंत्र हुआ था | आधुनिक इतिहास`;

/**
 * Formats an option to display both languages in the format: "English / Hindi"
 * If only one language is present or both are identical, returns that language.
 */
export function formatBilingualOption(englishOpt?: string, hindiOpt?: string): string {
  const en = (englishOpt || '').trim();
  const hi = (hindiOpt || '').trim();
  if (en && hi && en !== hi) {
    return `${en} / ${hi}`;
  }
  return en || hi || '';
}

/**
 * Triggers a browser download of a sample CSV template
 */
export function downloadSampleCsvTemplate(type: 'english' | 'hindi' | 'combined'): void {
  let content = '';
  let filename = '';

  if (type === 'english') {
    content = SAMPLE_ENGLISH_CSV;
    filename = 'ParikshaSetu_English_Questions_Template.csv';
  } else if (type === 'hindi') {
    content = '\ufeff' + SAMPLE_HINDI_CSV; // UTF-8 BOM for Devanagari in Excel
    filename = 'ParikshaSetu_Hindi_Questions_Template.csv';
  } else {
    content = SAMPLE_ENGLISH_CSV;
    filename = 'ParikshaSetu_Question_Template.csv';
  }

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
