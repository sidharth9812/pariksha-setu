import React from 'react';

/**
 * Normalizes line breaks and cleans outer whitespace while preserving
 * internal paragraph breaks (\n\n), single line breaks (\n), and indentation spaces.
 */
export function preserveQuestionFormatting(raw?: string): string {
  if (!raw) return '';

  let text = String(raw);

  // 1. Normalize CRLF and CR to LF
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Convert literal escaped \n sequences (e.g. from CSV/JSON imports) into real newlines
  text = text.replace(/\\n/g, '\n');

  // 3. Convert HTML <br>, <br/>, <p>, </p> tags if present from rich-text/Word pastes
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/?(p|div)[^>]*>/gi, '\n');

  // 4. Trim trailing horizontal spaces on each line while preserving leading indentation
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');

  // 5. Collapse 3 or more consecutive newlines into a clean double newline (paragraph break)
  text = text.replace(/\n{3,}/g, '\n\n');

  // 6. Trim only leading/trailing outer whitespace
  return text.trim();
}

/**
 * Intelligently formats question/option/explanation text for display so that:
 * - All explicit paragraph breaks (\n\n) and line breaks (\n) are preserved.
 * - Inline-squashed statements (Statement I/II, Assertion/Reason, कथन/कारण),
 *   inline option sequences ((A)... (B)... (C)... (D)...), and inline multi-question
 *   blocks are cleanly separated onto their own lines/paragraphs.
 */
export function formatSmartQuestionDisplay(raw?: string): string {
  const base = preserveQuestionFormatting(raw);
  if (!base) return '';

  let text = base;

  // 1. Separate multiple numbered questions if they were squashed onto the same line
  // e.g. "... (D) Option4 Q.2 Next question" or "... Ans: B Q2. Next question"
  text = text.replace(
    /([^\n])\s+(?=(?:Q\.?\s*\d+[\.\):]|Question\s+\d+[\.\):]|प्रश्न\s*\d+[\.\):]|प्र\.\s*\d+[\.\):])\s)/gi,
    '$1\n\n'
  );

  // 2. Separate inline Statements / Assertion-Reason / Conclusions onto new lines
  text = text.replace(
    /([^\n])\s+(?=(?:Statement\s+(?:I{1,3}|IV|[1-4])[\s:—:-]|Assertion\s*\([A-Z]\)\s*[:—-]|Reason\s*\([A-Z]\)\s*[:—-]|Conclusion\s+(?:I{1,3}|IV|[1-4])[\s:—:-]|कथन\s*(?:I{1,3}|[1-4]|\([A-Zक-घ]\))\s*[:—-]|कारण\s*(?:\([A-Zक-घ]\))?\s*[:—-]|निष्कर्ष\s*(?:I{1,3}|[1-4])\s*[:—-]))/gi,
    '$1\n'
  );

  // 3. If a single line contains an inline sequence of options like "(A) ... (B) ... (C) ... (D) ..."
  // or "A) ... B) ... C) ... D) ...", place each option on its own line
  text = text
    .split('\n')
    .map((line) => {
      // Check if line has at least (A)/(B) or A)/B) or (क)/(ख) inline
      const hasParenOptions =
        /\([A-Da-d1-4कखगघअबसद]\)\s+\S/.test(line) &&
        /\([B-Db-d2-4खगघबसद]\)\s+\S/.test(line);
      const hasBracketOrParenCloseOptions =
        /(?:^|\s)[A-Da-d][\)\.]\s+\S/.test(line) &&
        /\s[B-Db-d][\)\.]\s+\S/.test(line) &&
        /\s[C-Dc-d][\)\.]\s+\S/.test(line);

      if (hasParenOptions) {
        return line.replace(/([^\n])\s+(\([A-Da-d1-4कखगघअबसद]\)\s+)/g, '$1\n$2');
      }
      if (hasBracketOrParenCloseOptions) {
        return line.replace(/([^\n])\s+([A-Da-d][\)\.]\s+)/g, '$1\n$2');
      }
      return line;
    })
    .join('\n');

  // 4. Separate inline Answer / Explanation labels onto new lines
  text = text.replace(
    /([^\n])\s+(?=(?:Answer|Ans|Correct\s+Answer|उत्तर|सही\s+उत्तर|Explanation|Solution|व्याख्या|हल)\s*[:—-])/gi,
    '$1\n'
  );

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

interface FormattedQuestionTextProps {
  text?: string;
  className?: string;
  paragraphClassName?: string;
}

/**
 * Renders question text, Hindi translation, options, or explanations with:
 * - Distinct paragraph spacing for double line breaks (\n\n)
 * - Exact line break & indentation preservation for single line breaks (\n)
 */
export const FormattedQuestionText: React.FC<FormattedQuestionTextProps> = ({
  text,
  className = '',
  paragraphClassName = '',
}) => {
  const formatted = formatSmartQuestionDisplay(text);
  if (!formatted) return null;

  const paragraphs = formatted.split(/\n{2,}/);

  if (paragraphs.length <= 1) {
    return (
      <div className={`whitespace-pre-wrap break-words ${className}`}>
        {formatted}
      </div>
    );
  }

  return (
    <div className={`space-y-2.5 ${className}`}>
      {paragraphs.map((para, idx) => (
        <p
          key={idx}
          className={`whitespace-pre-wrap break-words ${paragraphClassName}`}
        >
          {para}
        </p>
      ))}
    </div>
  );
};
