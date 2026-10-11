import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface MeritCandidate {
  rank?: number;
  studentName: string;
  finalScore: number;
  submittedAt?: string;
}

export interface GenerateMeritPdfParams {
  testName: string;
  examinationDate?: string;
  examinationTime?: string;
  instituteName?: string;
  candidates: MeritCandidate[];
  fileName?: string;
}

/**
 * Generates and downloads the Official Merit & Result List PDF.
 * Requirements:
 * - Top: Examination Date, Examination Time, Test Name
 * - Table: ONLY Student Name (rank wise) and Total Score
 * - Bottom: Developer Name - Sidharth Malviya, Contact No - 7441197419
 */
export function downloadMeritResultPdf(params: GenerateMeritPdfParams): void {
  const {
    testName,
    examinationDate,
    examinationTime,
    instituteName = 'ParikshaSetu Examination Portal',
    candidates,
    fileName,
  } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Sort candidates rank wise by score descending (if scores equal, sort by earlier submission)
  const sortedCandidates = [...candidates].sort((a, b) => {
    if (b.finalScore !== a.finalScore) {
      return b.finalScore - a.finalScore;
    }
    const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return timeA - timeB;
  });

  // Format examination date and time
  const now = new Date();
  const formattedDate =
    examinationDate ||
    now.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

  const formattedTime =
    examinationTime ||
    now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

  // Prepare table data: ONLY Rank, Student Name, Total Score
  const tableRows = sortedCandidates.map((c, index) => {
    const rank = c.rank !== undefined ? c.rank : index + 1;
    // Format score nicely (round to 2 decimals if decimal, otherwise integer)
    const scoreText = Number.isInteger(c.finalScore)
      ? `${c.finalScore}`
      : `${c.finalScore.toFixed(2)}`;

    return [rank, c.studentName || 'Anonymous Candidate', scoreText];
  });

  // If no candidates yet, display a placeholder row
  if (tableRows.length === 0) {
    tableRows.push(['-', 'No candidate records available', '-']);
  }

  // Draw Header on first page (and subsequent pages via didDrawPage if needed)
  const drawHeader = () => {
    // Header Banner Background
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 28, 'F');

    // Accent line
    doc.setFillColor(79, 70, 229); // indigo-600
    doc.rect(0, 28, pageWidth, 1.5, 'F');

    // Institute / Portal Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(instituteName.toUpperCase(), pageWidth / 2, 11, { align: 'center' });

    // Document Title
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(226, 232, 240); // slate-200
    doc.text('OFFICIAL EXAMINATION MERIT & RESULT LIST', pageWidth / 2, 18, {
      align: 'center',
    });

    // Sub-header details box (Top: Test Name, Examination Date, Time)
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.3);
    doc.roundedRect(14, 32, pageWidth - 28, 22, 2, 2, 'FD');

    // Test Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42); // slate-900
    const cleanTestTitle = testName.length > 60 ? `${testName.slice(0, 57)}...` : testName;
    doc.text(`Test Name: ${cleanTestTitle}`, 18, 39);

    // Examination Date & Time
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85); // slate-700
    doc.text(`Examination Date: ${formattedDate}`, 18, 48);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(79, 70, 229); // indigo-600
    doc.text(`Examination Time: ${formattedTime}`, pageWidth - 18, 48, { align: 'right' });
  };

  // Initial draw of top header
  drawHeader();

  // Generate table with AutoTable
  autoTable(doc, {
    startY: 58,
    head: [['Rank', 'Student Name', 'Total Score']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center',
      valign: 'middle',
      cellPadding: 4,
    },
    columnStyles: {
      0: {
        cellWidth: 26,
        halign: 'center',
        fontStyle: 'bold',
        textColor: [15, 23, 42],
      },
      1: {
        cellWidth: 'auto',
        halign: 'left',
        fontStyle: 'bold',
        textColor: [30, 41, 59],
      },
      2: {
        cellWidth: 38,
        halign: 'center',
        fontStyle: 'bold',
        textColor: [16, 185, 129], // emerald-600
      },
    },
    styles: {
      fontSize: 9.5,
      cellPadding: 3.5,
      lineColor: [226, 232, 240], // slate-200
      lineWidth: 0.2,
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    margin: {
      top: 58,
      left: 14,
      right: 14,
      bottom: 22,
    },
    didDrawPage: (data) => {
      const currentPage = data.pageNumber;
      const totalPages = doc.getNumberOfPages();

      // If page > 1, draw compact top banner
      if (currentPage > 1) {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, 12, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text(`${testName} - Merit & Result List (Page ${currentPage})`, pageWidth / 2, 8, {
          align: 'center',
        });
      }

      // BOTTOM FOOTER (Mandatory exact requirement):
      // "bottam side devloper name - Sidharth Malviya , contact no- 7441197419"
      const footerY = pageHeight - 10;

      // Divider line
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.4);
      doc.line(14, footerY - 4, pageWidth - 14, footerY - 4);

      // Developer Name on Left
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text('Developer Name: Sidharth Malviya', 14, footerY);

      // Contact No on Right
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(79, 70, 229); // indigo-600
      doc.text('Contact No: 7441197419', pageWidth - 14, footerY, { align: 'right' });

      // Page numbering centered
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth / 2, footerY, {
        align: 'center',
      });
    },
  });

  // Sanitize filename for download
  const cleanName = (fileName || `Merit_Result_${testName}`)
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 50);
  const finalFileName = `${cleanName}.pdf`;

  // Trigger browser download
  doc.save(finalFileName);
}
