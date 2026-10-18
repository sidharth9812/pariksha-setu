# Implementation Plan: Option Image Support for Admin Question Management & CBT Exam

Support image-based and text-plus-image answer options (Options A, B, C, D) in ParikshaSetu, allowing questions with diagrammatic choices, mathematical symbols, map-based answers, or pure visual options alongside existing text options.

---

## 1. Schema & Data Architecture (Zero Breaking Changes)

### Extended `QuestionItem` Schema (`src/types/exam.ts`)
Maintain complete backward compatibility by keeping existing `options: { A: string; B: string; C: string; D: string }` and introducing an optional `optionImages` map:

```typescript
export interface OptionImageData {
  imageUrl?: string;
  imagePublicId?: string;
}

export interface QuestionItem {
  id: string;
  testId: string;
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
  // NEW: Optional image metadata per option
  optionImages?: {
    A?: OptionImageData;
    B?: OptionImageData;
    C?: OptionImageData;
    D?: OptionImageData;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  explanationHindi?: string;
  subject?: string;
  imageUrl?: string;
  questionImageUrl?: string;
  questionImagePublicId?: string;
  createdAt?: string;
}
```

### Compatibility Guarantees:
- **Existing questions**: Continue to load cleanly without changes; `optionImages` is simply omitted or undefined.
- **Pure text options**: Continue to store text in `options` with no `optionImages`.
- **Pure image options**: `options[key]` stores an empty string `""` or optional label, while `optionImages[key]` holds the Cloudinary URL.
- **Combined text + image options**: Both fields are populated.
- **Evaluation & scoring**: Answers remain keyed by `'A' | 'B' | 'C' | 'D'`, so scoring, results calculation, negative marking, and student attempt saves remain 100% untouched and functioning.

---

## 2. Cloudinary Upload Integration (`src/services/cloudinaryService.ts`)

- Provide helper `uploadOptionImageToCloudinary` reusing `uploadToCloudinary` with `CLOUDINARY_FOLDERS.QUESTION_IMAGES` (`parikshasetu/questions/images/`).
- Enforce strict unsigned preset upload via `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET`.
- Return `secure_url` and `public_id` for Firestore persistence.
- Zero API Secret exposure.

---

## 3. Admin Question Management (`src/features/admin/QuestionManager.tsx`)

### Creation & Edit State:
- Add state for option images:
  ```typescript
  const [optionImages, setOptionImages] = useState<Record<'A' | 'B' | 'C' | 'D', OptionImageData | null>>({
    A: null,
    B: null,
    C: null,
    D: null,
  });
  const [uploadingOption, setUploadingOption] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  ```

### Modal UI for Each Option (A, B, C, D):
1. **Primary Text Input** (e.g. English text)
2. **Secondary Text Input** (Hindi / translation, optional)
3. **Image Action Bar**:
   - Upload Image button (with file input accepting JPG, PNG, WebP)
   - Inline progress spinner when uploading to Cloudinary
4. **Inline Image Preview** (when image exists):
   - Crisp, contained thumbnail preview
   - "Replace" button to select a new file
   - "Remove" button to clear the image
5. **Form Validation**:
   - For every option (A, B, C, D), verify that the option has **either** non-empty text **OR** an uploaded image.
   - If both are empty for any option, display a clear inline error: `"Option [A/B/C/D] must have either text or an uploaded image."`
6. **Populating on Edit**:
   - `handleOpenEdit(q)` extracts existing `q.optionImages` and initializes state so the admin can review, replace, or delete existing option images.

### Question List Preview:
- Render option image thumbnails alongside option text in the admin's question list and card previews.

---

## 4. Student CBT Test Screen (`src/features/student/LiveExamScreen.tsx`)

Update the option container renderer for each key (`A`, `B`, `C`, `D`):
- **Display Mode**: Follow user clarification ("Stacked with text above and image below"):
  - Render option text (with bilingual/Hindi/English toggle support)
  - If `optionImages?.[key]?.imageUrl` is present, render a responsive image card directly below the text:
    - Max height: 180px–220px (`max-h-48 sm:max-h-56`)
    - Object containment: `object-contain` with clean border and white background
    - Cursor pointer and click-to-select behavior attached to the parent option card
- **Selection**: Maintains current radio / highlight UX (`border-indigo-600 bg-indigo-50/60`).

---

## 5. Review & Preview Screens (`StudentResultView.tsx` & `TestPreviewModal.tsx`)

- Update `TestPreviewModal.tsx` so the admin can review the complete question with option images and the correct answer badge.
- Update `StudentResultView.tsx` so students reviewing their test results can inspect option images alongside their chosen answer and the official answer.

---

## 6. Service Update (`src/services/examService.ts`)

- In `createQuestion`, ensure `optionImages: question.optionImages || undefined` is preserved when constructing the question object and writing to Firestore/LocalStorage.

---

## 7. Verification & Testing Plan

1. **Text-only option creation**: Verify standard text-only questions save, edit, and evaluate as before.
2. **Image-only option creation**: Verify an option with only an uploaded image (and empty text) passes validation and saves correctly.
3. **Text + Image option creation**: Verify options with both text and diagrams display both elements cleanly.
4. **Validation enforcement**: Submit with an empty option; verify blocking alert/message appears.
5. **Edit flow**: Open an existing question, add an option image, replace an image, delete an image, and save.
6. **Student CBT test**: Verify options with images render stacked, can be clicked and selected, persist in student answers, and submit cleanly.
7. **Score & Negative Marking**: Verify correct option matching and score calculations remain accurate.
8. **Build & Lint verification**: Run `compile_applet` and `lint_applet` to ensure zero compilation or type errors.
