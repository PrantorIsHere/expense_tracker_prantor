import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getTransactions, getCategories } from './storage';

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable?: {
      finalY: number;
    };
  }
}

interface CategoryStat {
  id: string;
  name: string;
  color: string;
  income: number;
  expense: number;
  net: number;
  count: number;
  pctIncome: number;
  pctExpense: number;
}

function getCurrencyCode(): string {
  try {
    const settings = localStorage.getItem('expense-tracker-settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.currency || 'BDT';
    }
  } catch {
    // ignore malformed data and use fallback
  }
  return 'BDT';
}

function formatAmount(n: number): string {
  const currency = getCurrencyCode();
  return `${currency} ${n.toFixed(2)}`;
}

export function generateCategoryBreakdownPDF() {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  const primaryBlue = [41, 128, 185];
  const darkGrey = [52, 73, 94];
  const lightGrey = [236, 240, 241];
  const greenIncome = [39, 174, 96];
  const redExpense = [231, 76, 60];

  doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.rect(0, 0, pageWidth, 120, 'F');

  doc.setFillColor(255, 255, 255);
  doc.circle(margin + 20, 50, 20, 'F');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('ET', margin + 20, 55, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Expense Tracker Report', margin + 60, 45);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Category-wise Financial Breakdown', margin + 60, 65);

  const cardX = margin;
  const cardY = 140;
  const cardWidth = pageWidth - margin * 2;
  const cardHeight = 80;

  doc.setFillColor(250, 250, 250);
  doc.roundedRect(cardX + 2, cardY + 2, cardWidth, cardHeight, 3, 3, 'F');
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 3, 3, 'F');
  doc.setDrawColor(lightGrey[0], lightGrey[1], lightGrey[2]);
  doc.setLineWidth(1);
  doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 3, 3, 'S');

  doc.setTextColor(darkGrey[0], darkGrey[1], darkGrey[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Report Generated:', cardX + 20, cardY + 25);
  doc.text('Report Type:', cardX + 20, cardY + 50);
  doc.text('Period:', cardX + 20, cardY + 65);

  doc.setFont('helvetica', 'normal');
  doc.text(
    new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    cardX + 140,
    cardY + 25
  );
  doc.text('Category-wise Breakdown (All Time)', cardX + 140, cardY + 50);
  doc.text('All Transactions', cardX + 140, cardY + 65);

  const transactions = getTransactions();
  const categories = getCategories();

  const stats = categories.map((cat) => {
    const catTxs = transactions.filter((t) => t.categoryId === cat.id);
    const income = catTxs.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = catTxs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const count = catTxs.length;
    return {
      id: cat.id,
      name: cat.name,
      color: cat.color || '#94a3b8',
      income,
      expense,
      net: income - expense,
      count,
    };
  });

  const totalIncome = stats.reduce((sum, s) => sum + s.income, 0);
  const totalExpense = stats.reduce((sum, s) => sum + s.expense, 0);

  const categoryStats: CategoryStat[] = stats
    .map((s) => ({
      ...s,
      pctIncome: totalIncome > 0 ? (s.income / totalIncome) * 100 : 0,
      pctExpense: totalExpense > 0 ? (s.expense / totalExpense) * 100 : 0,
    }))
    .filter((s) => s.income > 0 || s.expense > 0)
    .sort((a, b) => b.expense - a.expense);

  const tableBody = categoryStats.map((s) => [
    s.name,
    formatAmount(s.income),
    formatAmount(s.expense),
    formatAmount(Math.abs(s.net)),
    s.net >= 0 ? 'Surplus' : 'Deficit',
    `${s.pctIncome.toFixed(1)}%`,
    `${s.pctExpense.toFixed(1)}%`,
    String(s.count),
  ]);

  tableBody.push(['TOTAL', formatAmount(totalIncome), formatAmount(totalExpense), '', '', '', '', '']);

  let startY = cardY + cardHeight + 30;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(darkGrey[0], darkGrey[1], darkGrey[2]);
  doc.text('Category Breakdown', margin, startY);

  startY += 20;

  autoTable(doc, {
    startY,
    head: [['Category', 'Income', 'Expense', 'Net', 'Status', '% Income', '% Expense', 'Txns']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: primaryBlue,
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 8,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: darkGrey,
      cellPadding: 7,
    },
    alternateRowStyles: {
      fillColor: [249, 249, 249],
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 100 },
      1: { halign: 'right', textColor: greenIncome },
      2: { halign: 'right', textColor: redExpense },
      3: { halign: 'right', fontStyle: 'bold' },
      4: { halign: 'center', fontSize: 8 },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'center' },
    },
    styles: {
      lineColor: [220, 220, 220],
      lineWidth: 0.5,
      font: 'helvetica',
    },
    didParseCell: (data) => {
      if (data.row.index === tableBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 240];
        data.cell.styles.textColor = darkGrey;
      }
    },
    pageBreak: 'auto',
    margin: { left: margin, right: margin },
  });

  const finalY = (doc.lastAutoTable?.finalY ?? startY) + 30;
  const summaryY = finalY < pageHeight - 180 ? finalY : pageHeight - 180;

  if (summaryY + 150 > pageHeight - margin) {
    doc.addPage();
    drawSummarySection(doc, margin, margin, totalIncome, totalExpense, greenIncome, redExpense, darkGrey, lightGrey);
  } else {
    drawSummarySection(doc, margin, summaryY, totalIncome, totalExpense, greenIncome, redExpense, darkGrey, lightGrey);
  }

  addPageNumbers(doc, margin, darkGrey);
  doc.save('Category_Breakdown_Report.pdf');
}

function drawSummarySection(
  doc: jsPDF,
  x: number,
  y: number,
  totalIncome: number,
  totalExpense: number,
  greenIncome: number[],
  redExpense: number[],
  darkGrey: number[],
  lightGrey: number[]
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const summaryWidth = pageWidth - x * 2;
  const summaryHeight = 140;

  doc.setFillColor(250, 250, 250);
  doc.roundedRect(x + 2, y + 2, summaryWidth, summaryHeight, 3, 3, 'F');
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, summaryWidth, summaryHeight, 3, 3, 'F');
  doc.setDrawColor(lightGrey[0], lightGrey[1], lightGrey[2]);
  doc.setLineWidth(1);
  doc.roundedRect(x, y, summaryWidth, summaryHeight, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(darkGrey[0], darkGrey[1], darkGrey[2]);
  doc.text('Financial Summary', x + 20, y + 25);

  doc.setDrawColor(lightGrey[0], lightGrey[1], lightGrey[2]);
  doc.line(x + 20, y + 35, pageWidth - x - 20, y + 35);

  const boxWidth = 140;
  const boxHeight = 24;
  const boxStartX = x + 20;
  const row1Y = y + 55;
  const row2Y = y + 85;

  const drawNumberBox = (boxX: number, boxY: number, label: string, value: string, color: number[]) => {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(boxX, boxY - 16, boxWidth, boxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(label, boxX + 5, boxY - 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(value, boxX + boxWidth - 5, boxY + 2, { align: 'right' });
  };

  drawNumberBox(boxStartX, row1Y, 'Total Income', formatAmount(totalIncome), greenIncome);
  drawNumberBox(boxStartX + boxWidth + 15, row1Y, 'Total Expense', formatAmount(totalExpense), redExpense);

  const netBalance = totalIncome - totalExpense;
  const netColor = netBalance >= 0 ? greenIncome : redExpense;
  const netLabel = netBalance >= 0 ? 'Net Balance (Surplus)' : 'Net Balance (Deficit)';
  drawNumberBox(boxStartX, row2Y, netLabel, formatAmount(Math.abs(netBalance)), netColor);

  const footerY = y + summaryHeight + 20;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('This is a system-generated report. No signature required.', x + 20, footerY);
  doc.text('For queries, contact support@expensetracker.com', x + 20, footerY + 15);
}

function addPageNumbers(doc: jsPDF, margin: number, darkGrey: number[]) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(darkGrey[0], darkGrey[1], darkGrey[2]);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 20, { align: 'center' });
    doc.text('Expense Tracker © 2025', margin, pageHeight - 20);
  }
}
