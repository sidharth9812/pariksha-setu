import { QuestionItem } from '../types/exam';
import { preserveQuestionFormatting } from './questionTextFormatter';

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
 * Splits raw CSV text into logical records while respecting double-quoted
 * multi-line fields (RFC 4180) so paragraph breaks and line breaks inside
 * quoted cells are never broken across separate rows.
 */
export function splitCsvRecords(rawText: string): string[] {
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const records: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (char === '"') {
      current += char;
      if (inQuotes && nextChar === '"') {
        current += nextChar;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === '\n' && !inQuotes) {
      records.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current.length > 0) {
    records.push(current);
  }

  return records;
}

/**
 * Robust CSV Line Splitter supporting:
 * - Pipe delimiter (|)
 * - Comma delimiter (,) with quoted multi-line strings ("a\nb", "c")
 * - Tab delimiter (\t)
 * - Semicolon delimiter (;)
 * Preserves internal line breaks (\n) and paragraph breaks (\n\n) within each cell.
 */
export function splitCsvLine(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  // 1. If pipe separated, prioritize pipe (|) delimiter
  if (trimmed.includes('|')) {
    return trimmed.split('|').map((p) => preserveQuestionFormatting(p));
  }

  // 2. If tab separated, prioritize tab (\t) delimiter
  if (trimmed.includes('\t')) {
    return trimmed.split('\t').map((p) => preserveQuestionFormatting(p));
  }

  // 3. Comma or semicolon CSV parser with quote escaping and multi-line support
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
      result.push(preserveQuestionFormatting(current));
      current = '';
    } else {
      current += char;
    }
  }

  result.push(preserveQuestionFormatting(current));
  return result;
}

/**
 * Normalizes answer key from various formats:
 * 'A', 'B', 'C', 'D', '(A)', '[B]', '1', '2', '3', '4', 'क', 'ख', 'ग', 'घ', 'अ', 'ब', 'स', 'द', 'Option A', etc.
 */
export function normalizeAnswerKey(raw?: string): 'A' | 'B' | 'C' | 'D' | null {
  if (!raw) return null;
  const clean = raw
    .trim()
    .replace(/^[\(\[\{]+|[\)\]\}\.:-]+$/g, '')
    .trim()
    .toUpperCase();

  if (
    clean === 'A' ||
    clean === '1' ||
    clean === 'OPTION A' ||
    clean === 'OPT A' ||
    clean === 'OPTION (A)' ||
    clean === 'विकल्प A' ||
    clean === 'क' ||
    clean === 'अ'
  )
    return 'A';
  if (
    clean === 'B' ||
    clean === '2' ||
    clean === 'OPTION B' ||
    clean === 'OPT B' ||
    clean === 'OPTION (B)' ||
    clean === 'विकल्प B' ||
    clean === 'ख' ||
    clean === 'ब'
  )
    return 'B';
  if (
    clean === 'C' ||
    clean === '3' ||
    clean === 'OPTION C' ||
    clean === 'OPT C' ||
    clean === 'OPTION (C)' ||
    clean === 'विकल्प C' ||
    clean === 'ग' ||
    clean === 'स'
  )
    return 'C';
  if (
    clean === 'D' ||
    clean === '4' ||
    clean === 'OPTION D' ||
    clean === 'OPT D' ||
    clean === 'OPTION (D)' ||
    clean === 'विकल्प D' ||
    clean === 'घ' ||
    clean === 'द'
  )
    return 'D';

  // Match leading option token like "(B) Bhopal" or "B) Bhopal" or "क) इंदौर"
  const tokenMatch = raw
    .trim()
    .match(/^(?:option|opt|विकल्प)?\s*[\(\[\{]?\s*([A-Da-d1-4कखगघअबसद])\s*[\)\]\}\.:\s-]/i);
  if (tokenMatch) {
    return mapSingleOptionToken(tokenMatch[1]);
  }

  const firstChar = clean[0];
  return mapSingleOptionToken(firstChar);
}

function mapSingleOptionToken(token?: string): 'A' | 'B' | 'C' | 'D' | null {
  if (!token) return null;
  const t = token.trim().toUpperCase();
  if (t === 'A' || t === '1' || t === 'क' || t === 'अ') return 'A';
  if (t === 'B' || t === '2' || t === 'ख' || t === 'ब') return 'B';
  if (t === 'C' || t === '3' || t === 'ग' || t === 'स') return 'C';
  if (t === 'D' || t === '4' || t === 'घ' || t === 'द') return 'D';
  return null;
}

/**
 * Checks if a line is a header row
 */
export function isHeaderRow(cells: string[]): boolean {
  if (cells.length === 0) return false;
  const first = (cells[0] || '').trim().toLowerCase();
  const joined = cells.join(' ').toLowerCase();

  // If first cell contains a question mark, newline, or sentence end, it's a question, not a header
  if (first.includes('?') || first.includes('।') || first.includes('\n') || first.length > 50) {
    return false;
  }

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

  let matches = 0;
  if (joined.includes('option') || joined.includes('विकल्प')) matches++;
  if (joined.includes('answer') || joined.includes('उत्तर') || joined.includes('correct')) matches++;
  if (joined.includes('explanation') || joined.includes('व्याख्या')) matches++;
  if (joined.includes('subject') || joined.includes('विषय')) matches++;

  return matches >= 2;
}

/**
 * Strips leading question numbering like "Q1.", "Q. 12:", "1.", "(1)", "प्रश्न 1."
 * from the first line of a question while keeping the rest of the multi-line text intact.
 */
function stripLeadingQuestionNumber(text: string): string {
  const cleaned = preserveQuestionFormatting(text);
  return cleaned.replace(
    /^(?:(?:Q(?:uestion)?|प्र(?:श्न)?|सवाल)\s*[\.\-:]?\s*\d+\s*[\.\)\-:]|\(\d+\)|\d+\s*[\.\)\-:])\s+/i,
    ''
  );
}

/**
 * Extracts inline options if a line contains multiple options on the same line,
 * e.g. "(A) Indore  (B) Bhopal  (C) Jabalpur  (D) Gwalior"
 * or "Question stem? (A) Opt1 (B) Opt2 (C) Opt3 (D) Opt4"
 */
function extractOptionsFromLine(line: string): {
  stemPrefix?: string;
  extractedOptions: Partial<Record<'A' | 'B' | 'C' | 'D', string>>;
  detectedAnswer?: 'A' | 'B' | 'C' | 'D';
} | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Match option markers like (A), [A], A), A., (क), क), (अ), Option A:
  const optionRegex =
    /(?:^|\s+)(?:(?:Option|Opt|विकल्प)\s*)?(?:\(([A-Da-dकखगघअबसद])\)|\[([A-Da-dकखगघअबसद])\]|([A-Da-dकखगघअबसद])[\)\.]|(?:Option|Opt|विकल्प)\s+([A-Da-d1-4कखगघअबसद])\s*[:\.\)\-])\s+/gi;

  const matches: { key: 'A' | 'B' | 'C' | 'D'; startIndex: number; contentStart: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = optionRegex.exec(trimmed)) !== null) {
    const rawToken = match[1] || match[2] || match[3] || match[4];
    const mapped = mapSingleOptionToken(rawToken);
    if (!mapped) continue;

    // Calculate where the marker itself begins (skipping leading whitespace)
    const fullMatch = match[0];
    const leadingSpaces = fullMatch.length - fullMatch.trimStart().length;
    const markerStart = match.index + leadingSpaces;
    const contentStart = match.index + fullMatch.length;

    matches.push({
      key: mapped,
      startIndex: markerStart,
      contentStart,
    });
  }

  if (matches.length === 0) return null;

  // If the marker does not start at index 0, only treat as inline options if we have at least 2 sequential options (e.g. A and B)
  if (matches[0].startIndex > 0 && matches.length < 2) {
    return null;
  }

  // Verify sequential order (e.g. starts with A or continues B, C, D)
  const stemPrefix = matches[0].startIndex > 0 ? trimmed.slice(0, matches[0].startIndex).trim() : undefined;
  const extractedOptions: Partial<Record<'A' | 'B' | 'C' | 'D', string>> = {};
  let detectedAnswer: 'A' | 'B' | 'C' | 'D' | undefined;

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    let val = trimmed.slice(current.contentStart, next ? next.startIndex : trimmed.length).trim();

    // Check if trailing Answer: X is attached at the end of the last option
    if (!next) {
      const trailingAnsMatch = val.match(
        /\s+(?:Answer|Ans|Correct\s*Answer|उत्तर|सही\s*उत्तर)\s*[:\-–=]\s*([\(\[]?[A-Da-d1-4कखगघअबसद][\)\]]?)\s*$/i
      );
      if (trailingAnsMatch) {
        const parsedAns = normalizeAnswerKey(trailingAnsMatch[1]);
        if (parsedAns) detectedAnswer = parsedAns;
        val = val.slice(0, trailingAnsMatch.index).trim();
      }
    }

    // Check if option is marked with * or ✓ as correct answer
    if (val.endsWith('*') || val.endsWith('✓') || val.endsWith('✔') || /\((?:correct|ans|सही)\)$/i.test(val)) {
      detectedAnswer = current.key;
      val = val
        .replace(/(?:\*|✓|✔|\((?:correct|ans|सही)\))+$/i, '')
        .trim();
    }

    extractedOptions[current.key] = val;
  }

  return {
    stemPrefix,
    extractedOptions,
    detectedAnswer,
  };
}

/**
 * Parses multi-line / paragraph-formatted MCQ blocks (copied from Word, PDF, Docs, or text files)
 * while preserving all paragraph breaks (\n\n) and line breaks (\n) inside question stems,
 * options, and explanations.
 */
export function parseBlockFormattedQuestions(rawText: string): ParsedLanguageRow[] {
  if (!rawText || !rawText.trim()) return [];

  const normalized = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n');

  const lines = normalized.split('\n');
  const results: ParsedLanguageRow[] = [];

  let questionLines: string[] = [];
  let options: Partial<Record<'A' | 'B' | 'C' | 'D', string>> = {};
  let lastOptionKey: 'A' | 'B' | 'C' | 'D' | null = null;
  let correctAnswer: 'A' | 'B' | 'C' | 'D' | undefined = undefined;
  let explanationLines: string[] = [];
  let inExplanation = false;
  let subject: string | undefined = undefined;
  let sawBlankLineAfterOptions = false;

  const hasAllFourOptions = () =>
    Boolean(options.A !== undefined && options.B !== undefined && options.C !== undefined && options.D !== undefined);

  const flushCurrentQuestion = () => {
    const qTextRaw = stripLeadingQuestionNumber(questionLines.join('\n'));
    const hasAnyOption = Boolean(options.A || options.B || options.C || options.D);
    if (!qTextRaw && !hasAnyOption) {
      return;
    }

    const rowNum = results.length + 1;
    const errors: string[] = [];
    const optA = preserveQuestionFormatting(options.A || '');
    const optB = preserveQuestionFormatting(options.B || '');
    const optC = preserveQuestionFormatting(options.C || '');
    const optD = preserveQuestionFormatting(options.D || '');

    if (!qTextRaw) {
      errors.push(`Question ${rowNum}: Question text is empty.`);
    }
    if (!optA || !optB || !optC || !optD) {
      errors.push(`Question ${rowNum}: All 4 options (A, B, C, D) are required.`);
    }

    results.push({
      rowNumber: rowNum,
      questionText: qTextRaw,
      optionA: optA,
      optionB: optB,
      optionC: optC,
      optionD: optD,
      correctAnswer,
      explanation: preserveQuestionFormatting(explanationLines.join('\n')) || undefined,
      subject: subject ? preserveQuestionFormatting(subject) : undefined,
      errors,
    });

    questionLines = [];
    options = {};
    lastOptionKey = null;
    correctAnswer = undefined;
    explanationLines = [];
    inExplanation = false;
    subject = undefined;
    sawBlankLineAfterOptions = false;
  };

  const questionStartPattern =
    /^(?:(?:Q(?:uestion)?|प्र(?:श्न)?|सवाल)\s*[\.\-:]?\s*\d+\s*[\.\)\-:]|\(\d+\)|\d+\s*[\.\)\-:])\s+\S/i;
  const answerLinePattern =
    /^(?:Answer|Ans|Correct\s*Answer|Correct\s*Option|Key|उत्तर|सही\s*उत्तर|सही\s*विकल्प)\s*[:\-–=\.]\s*(.+)$/i;
  const explanationLinePattern =
    /^(?:Explanation|Solution|Sol|Hint|Note|व्याख्या|हल|स्पष्टीकरण)\s*[:\-–=\.]\s*(.*)$/i;
  const subjectLinePattern = /^(?:Subject|Topic|Category|विषय)\s*[:\-–=\.]\s*(.+)$/i;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Ignore pure comment lines
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
      continue;
    }

    // Handle blank lines (paragraph breaks)
    if (!trimmed) {
      if (hasAllFourOptions()) {
        sawBlankLineAfterOptions = true;
        if (inExplanation && explanationLines.length > 0 && explanationLines[explanationLines.length - 1] !== '') {
          explanationLines.push('');
        }
      } else if (lastOptionKey) {
        // Blank line between options — ignore
      } else if (questionLines.length > 0 && questionLines[questionLines.length - 1] !== '') {
        // Blank line inside multi-paragraph question stem! Preserve paragraph break!
        questionLines.push('');
      }
      continue;
    }

    // 1. Check if this line is an Answer key line
    const ansMatch = trimmed.match(answerLinePattern);
    if (ansMatch && (lastOptionKey !== null || hasAllFourOptions())) {
      const parsedKey = normalizeAnswerKey(ansMatch[1]);
      if (parsedKey) {
        correctAnswer = parsedKey;
      }
      inExplanation = false;
      continue;
    }

    // 2. Check if this line is an Explanation start line
    const expMatch = trimmed.match(explanationLinePattern);
    if (expMatch && (lastOptionKey !== null || hasAllFourOptions())) {
      inExplanation = true;
      if (expMatch[1]?.trim()) {
        explanationLines.push(expMatch[1].trim());
      }
      continue;
    }

    // 3. Check if this line is a Subject line
    const subjMatch = trimmed.match(subjectLinePattern);
    if (subjMatch && (lastOptionKey !== null || hasAllFourOptions())) {
      subject = subjMatch[1].trim();
      continue;
    }

    // 4. If we already have all 4 options (A, B, C, D), check if a NEW question is starting
    if (hasAllFourOptions()) {
      const isExplicitNewQuestion = questionStartPattern.test(trimmed);
      const nextLineOptionCheck = extractOptionsFromLine(trimmed);
      const isNewQuestionAfterBlank =
        sawBlankLineAfterOptions && !inExplanation && !nextLineOptionCheck;
      const isNewQuestionAfterAnswer =
        correctAnswer !== undefined && !inExplanation && !nextLineOptionCheck;

      if (isExplicitNewQuestion || isNewQuestionAfterBlank || isNewQuestionAfterAnswer) {
        flushCurrentQuestion();
      } else if (inExplanation) {
        explanationLines.push(rawLine.replace(/[ \t]+$/g, ''));
        continue;
      }
    }

    // 5. Check if the line contains Option(s) A, B, C, D
    const optionExtraction = extractOptionsFromLine(rawLine);
    if (optionExtraction) {
      const { stemPrefix, extractedOptions, detectedAnswer } = optionExtraction;
      const extractedKeys = Object.keys(extractedOptions) as ('A' | 'B' | 'C' | 'D')[];

      // Determine if these options logically fit the current question
      const firstKey = extractedKeys[0];
      const isStartingOptionsWithA = firstKey === 'A' && options.A === undefined && questionLines.length > 0;
      const isContinuingOptions =
        (firstKey === 'B' && options.A !== undefined && options.B === undefined) ||
        (firstKey === 'C' && options.B !== undefined && options.C === undefined) ||
        (firstKey === 'D' && options.C !== undefined && options.D === undefined);

      if (isStartingOptionsWithA || isContinuingOptions) {
        if (stemPrefix) {
          questionLines.push(stemPrefix);
        }
        for (const k of extractedKeys) {
          options[k] = extractedOptions[k];
          lastOptionKey = k;
        }
        if (detectedAnswer && !correctAnswer) {
          correctAnswer = detectedAnswer;
        }
        continue;
      }
    }

    // 6. If we are currently inside an option (e.g. multi-line option text before the next option)
    if (lastOptionKey && !hasAllFourOptions() && !inExplanation) {
      options[lastOptionKey] = `${options[lastOptionKey]}\n${trimmed}`;
      continue;
    }

    // 7. Otherwise, this line is part of the current question's multi-line / multi-paragraph stem!
    questionLines.push(rawLine.replace(/[ \t]+$/g, ''));
  }

  flushCurrentQuestion();
  return results;
}

/**
 * Parses raw CSV or Multi-line Block text for one language (English or Hindi)
 */
export function parseLanguageCsv(rawText: string, language: 'en' | 'hi'): ParsedLanguageRow[] {
  if (!rawText || !rawText.trim()) return [];

  // 1. Split into quote-aware records so multi-line quoted CSV cells keep their paragraph breaks
  const rawRecords = splitCsvRecords(rawText);
  const nonEmptyRecords = rawRecords.filter((r) => {
    const t = r.trim();
    return t.length > 0 && !t.startsWith('#') && !t.startsWith('//');
  });

  if (nonEmptyRecords.length === 0) return [];

  // Check if input uses pipe (|) or tab (\t) delimiters where multi-line question paragraphs precede the delimited line
  const hasPipeRows = nonEmptyRecords.some((r) => r.split('|').length >= 5);
  const hasTabRows = !hasPipeRows && nonEmptyRecords.some((r) => r.split('\t').length >= 5);

  let consolidatedRecords: string[] = [];

  if (hasPipeRows || hasTabRows) {
    const delim = hasPipeRows ? '|' : '\t';
    let pendingParagraphLines: string[] = [];

    for (const rawLine of rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')) {
      const trimmed = rawLine.trim();
      if (trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

      if (rawLine.includes(delim)) {
        const cells = rawLine.split(delim);
        // Check if this is a header row
        if (consolidatedRecords.length === 0 && pendingParagraphLines.length === 0 && isHeaderRow(cells)) {
          consolidatedRecords.push(rawLine);
          continue;
        }
        if (pendingParagraphLines.length > 0) {
          const prefix = pendingParagraphLines.join('\n').trim();
          cells[0] = prefix ? `${prefix}\n${cells[0].trimStart()}` : cells[0];
          pendingParagraphLines = [];
        }
        consolidatedRecords.push(cells.join(delim));
      } else {
        // Line without pipe/tab: part of a multi-line / multi-paragraph question stem!
        if (trimmed.length > 0 || pendingParagraphLines.length > 0) {
          pendingParagraphLines.push(rawLine.replace(/[ \t]+$/g, ''));
        }
      }
    }

    // If trailing lines remained without delimiters
    if (pendingParagraphLines.length > 0 && consolidatedRecords.length === 0) {
      consolidatedRecords = nonEmptyRecords;
    }
  } else {
    consolidatedRecords = nonEmptyRecords;
  }

  // Try parsing as structured CSV rows first
  const startIndex =
    consolidatedRecords.length > 0 && isHeaderRow(splitCsvLine(consolidatedRecords[0])) ? 1 : 0;
  const csvParsedRows: ParsedLanguageRow[] = [];

  for (let i = startIndex; i < consolidatedRecords.length; i++) {
    const rowNum = csvParsedRows.length + 1;
    const parts = splitCsvLine(consolidatedRecords[i]);

    const errors: string[] = [];

    if (parts.length < 5) {
      errors.push(
        `Row ${rowNum}: Insufficient columns. Minimum 5 columns required (Question, Option A, Option B, Option C, Option D).`
      );
    }

    const qText = preserveQuestionFormatting(parts[0] || '');
    const optA = preserveQuestionFormatting(parts[1] || '');
    const optB = preserveQuestionFormatting(parts[2] || '');
    const optC = preserveQuestionFormatting(parts[3] || '');
    const optD = preserveQuestionFormatting(parts[4] || '');
    const rawKey = (parts[5] || '').trim();
    const explanation = preserveQuestionFormatting(parts[6] || '');
    const subject = preserveQuestionFormatting(parts[7] || '');

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

    csvParsedRows.push({
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

  // Check if the input was actually pasted/uploaded in Multi-Line MCQ Block format
  // (e.g., Q1... (A)... (B)... (C)... (D)... Answer: B) rather than CSV columns
  const validCsvRowCount = csvParsedRows.filter((r) => r.errors.length === 0).length;
  if (validCsvRowCount === 0 && !hasPipeRows && !hasTabRows) {
    const blockParsed = parseBlockFormattedQuestions(rawText);
    const validBlockCount = blockParsed.filter((r) => r.optionA && r.optionB && r.optionC && r.optionD).length;
    if (validBlockCount > 0) {
      return blockParsed;
    }
  }

  return csvParsedRows;
}

/**
 * AUTOMATIC SETTLEMENT ENGINE
 * Takes separate English and Hindi CSV/block texts, parses both,
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
      qWarnings.push(
        `Question #${qNum}: Correct answer mismatch between English (${enKey}) and Hindi (${hiKey}). Using English answer '${enKey}'.`
      );
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
        qWarnings.push(`Question #${qNum}: Hindi translation missing (Hindi input has only ${hindiCount} questions).`);
      }
    } else if (hasHindi) {
      status = 'hindi_only';
      hindiOnlyCount++;
      if (englishCount > 0) {
        qWarnings.push(
          `Question #${qNum}: English translation missing (English input has only ${englishCount} questions).`
        );
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

    // Prepare settled question data with preserved paragraph and line breaks
    const questionText = preserveQuestionFormatting(en?.questionText || hi?.questionText || '');
    const questionTextHindi = hi?.questionText
      ? preserveQuestionFormatting(hi.questionText)
      : hasHindi
      ? preserveQuestionFormatting(hi?.questionText)
      : undefined;

    const options = {
      A: preserveQuestionFormatting(en?.optionA || hi?.optionA || ''),
      B: preserveQuestionFormatting(en?.optionB || hi?.optionB || ''),
      C: preserveQuestionFormatting(en?.optionC || hi?.optionC || ''),
      D: preserveQuestionFormatting(en?.optionD || hi?.optionD || ''),
    };

    const optionsHindi = hasHindi
      ? {
          A: preserveQuestionFormatting(hi?.optionA || ''),
          B: preserveQuestionFormatting(hi?.optionB || ''),
          C: preserveQuestionFormatting(hi?.optionC || ''),
          D: preserveQuestionFormatting(hi?.optionD || ''),
        }
      : undefined;

    const explanation = en?.explanation ? preserveQuestionFormatting(en.explanation) : undefined;
    const explanationHindi = hi?.explanation ? preserveQuestionFormatting(hi.explanation) : undefined;
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
      overallHealthPercent = Math.max(0, Math.round((validCount / maxRows) * 100));
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
  const en = preserveQuestionFormatting(englishOpt);
  const hi = preserveQuestionFormatting(hindiOpt);
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
