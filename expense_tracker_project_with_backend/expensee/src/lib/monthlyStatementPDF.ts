import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, User, Category } from '@/types';
import { getSettings } from './storage';

// Augment jsPDF type to include lastAutoTable from jspdf-autotable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable?: {
      finalY: number;
    };
  }
}

interface ExtendedSettings {
  currency: string;
  dateFormat: string;
  theme: string;
  notifications: boolean;
  autoBackup: boolean;
  softwareName?: string;
}

// Get currency code from settings
function getCurrencyCode(): string {
  try {
    const settings = getSettings();
    return settings.currency || 'BDT';
  } catch (e) {
    return 'BDT';
  }
}

// Get software name from settings
function getSoftwareName(): string {
  try {
    const settings = getSettings() as ExtendedSettings;
    return settings.softwareName || 'Expense Tracker';
  } catch (e) {
    return 'Expense Tracker';
  }
}

// Format amount with currency
function formatAmount(n: number): string {
  const currency = getCurrencyCode();
  return `${currency} ${n.toFixed(2)}`;
}

// Format date in Asia/Dhaka timezone
function formatDateDhaka(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  
  const formatter = new Intl.DateTimeFormat('en-GB', options);
  return formatter.format(date);
}

// Get current year for copyright
function getCurrentYear(): number {
  const now = new Date();
  const dhakaYear = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric'
  }).format(now);
  return parseInt(dhakaYear);
}

export const generateMonthlyStatementPDF = (
  transactions: Transaction[],
  users: User[],
  categories: Category[],
  month: number,
  year: number
) => {
  // A4 size portrait
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const softwareName = getSoftwareName();
  const currentYear = getCurrentYear();

  // Bank statement colors - professional blue and white
  const darkBlue = [0, 51, 102];
  const lightBlue = [230, 240, 250];
  const borderGray = [200, 200, 200];
  const textDark = [40, 40, 40];

  // Header Section - Company Info
  pdf.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]);
  pdf.rect(0, 0, pageWidth, 40, 'F');

  // Company Name
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(255, 255, 255);
  pdf.text(softwareName, pageWidth / 2, 15, { align: 'center' });

  // Company Address/Info
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('Financial Management System', pageWidth / 2, 22, { align: 'center' });
  pdf.text('Email: info@company.com | Phone: +880-XXX-XXXXXX', pageWidth / 2, 28, { align: 'center' });
  pdf.text('Address: Dhaka, Bangladesh', pageWidth / 2, 34, { align: 'center' });

  // Document Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  pdf.text(`TRANSACTION STATEMENT`, pageWidth / 2, 52, { align: 'center' });
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  pdf.text(`${monthNames[month]} ${year}`, pageWidth / 2, 60, { align: 'center' });

  // Statement Period Box
  const boxY = 68;
  pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  pdf.setLineWidth(0.5);
  pdf.rect(15, boxY, pageWidth - 30, 20);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('Statement Period:', 20, boxY + 8);
  
  pdf.setFont('helvetica', 'normal');
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  pdf.text(`From: ${formatDateDhaka(firstDay)}`, 20, boxY + 14);
  pdf.text(`To: ${formatDateDhaka(lastDay)}`, 80, boxY + 14);
  
  pdf.setFont('helvetica', 'bold');
  pdf.text('Statement Date:', 140, boxY + 8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(formatDateDhaka(new Date()), 140, boxY + 14);

  // Calculate totals
  const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netBalance = income - expenses;

  // Summary Section
  const summaryY = boxY + 28;
  pdf.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  pdf.rect(15, summaryY, pageWidth - 30, 25, 'F');
  pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  pdf.rect(15, summaryY, pageWidth - 30, 25);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
  
  // Summary columns
  const col1X = 25;
  const col2X = 80;
  const col3X = 135;
  
  pdf.text('Total Income:', col1X, summaryY + 8);
  pdf.setTextColor(0, 128, 0);
  pdf.text(formatAmount(income), col1X, summaryY + 16);
  
  pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
  pdf.text('Total Expenses:', col2X, summaryY + 8);
  pdf.setTextColor(255, 0, 0);
  pdf.text(formatAmount(expenses), col2X, summaryY + 16);
  
  pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
  pdf.text('Net Balance:', col3X, summaryY + 8);
  pdf.setTextColor(netBalance >= 0 ? 0 : 255, netBalance >= 0 ? 128 : 0, 0);
  pdf.text(formatAmount(Math.abs(netBalance)), col3X, summaryY + 16);

  // Transaction Table
  const tableStartY = summaryY + 32;
  
  // Prepare table data
  const tableData = transactions
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(t => {
      const user = users.find(u => u.id === t.userId);
      const category = categories.find(c => c.id === t.categoryId);
      const transDate = new Date(t.date);
      
      return [
        formatDateDhaka(transDate),
        t.voucherId,
        t.title,
        category?.name || 'N/A',
        user?.name || 'N/A',
        t.type === 'income' ? formatAmount(t.amount) : '-',
        t.type === 'expense' ? formatAmount(t.amount) : '-',
        t.type === 'income' ? 'INCOME' : 'EXPENSE'
      ];
    });

  // Add table with proper page break handling
  autoTable(pdf, {
    startY: tableStartY,
    head: [['Date', 'Voucher ID', 'Description', 'Category', 'User', 'Income', 'Expense', 'Type']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: borderGray,
      lineWidth: 0.1,
      font: 'helvetica',
      textColor: textDark,
      overflow: 'linebreak',
      cellWidth: 'wrap'
    },
    headStyles: {
      fillColor: darkBlue,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      minCellHeight: 8
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center', valign: 'middle' },
      1: { cellWidth: 24, halign: 'center', fontSize: 7, valign: 'middle' },
      2: { cellWidth: 38, halign: 'left', valign: 'middle' },
      3: { cellWidth: 24, halign: 'left', valign: 'middle' },
      4: { cellWidth: 22, halign: 'left', valign: 'middle' },
      5: { cellWidth: 22, halign: 'right', textColor: [0, 128, 0], valign: 'middle' },
      6: { cellWidth: 22, halign: 'right', textColor: [255, 0, 0], valign: 'middle' },
      7: { cellWidth: 18, halign: 'center', fontSize: 7, valign: 'middle' }
    },
    margin: { left: 15, right: 15, top: 10, bottom: 30 },
    showHead: 'everyPage',
    didDrawPage: function(data) {
      // Add header on every page except first
      if (data.pageNumber > 1) {
        pdf.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]);
        pdf.rect(0, 0, pageWidth, 25, 'F');
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(255, 255, 255);
        pdf.text(softwareName, pageWidth / 2, 10, { align: 'center' });
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.text(`${monthNames[month]} ${year} Statement (Continued)`, pageWidth / 2, 18, { align: 'center' });
      }
      
      // Footer on each page
      const footerY = pageHeight - 18;
      
      pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      pdf.setLineWidth(0.3);
      pdf.line(15, footerY - 3, pageWidth - 15, footerY - 3);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(
        `© ${currentYear} ${softwareName}. All rights reserved.`,
        pageWidth / 2,
        footerY + 2,
        { align: 'center' }
      );
      
      pdf.setFontSize(7);
      pdf.text(
        'This is a computer-generated statement and does not require a signature.',
        pageWidth / 2,
        footerY + 7,
        { align: 'center' }
      );
      
      // Page number
      pdf.setFontSize(8);
      pdf.text(
        `Page ${data.pageNumber}`,
        pageWidth - 20,
        footerY + 2,
        { align: 'right' }
      );
    }
  });

  // Summary totals at the end
  const finalY = (pdf.lastAutoTable?.finalY ?? tableStartY) + 10;
  
  // Check if there's enough space for summary, otherwise add new page
  if (finalY > pageHeight - 50) {
    pdf.addPage();
    const newPageY = 40;
    
    pdf.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
    pdf.rect(15, newPageY, pageWidth - 30, 20, 'F');
    pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    pdf.setLineWidth(0.5);
    pdf.rect(15, newPageY, pageWidth - 30, 20);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
    
    pdf.text('TOTAL INCOME:', pageWidth - 100, newPageY + 8);
    pdf.setTextColor(0, 128, 0);
    pdf.text(formatAmount(income), pageWidth - 30, newPageY + 8, { align: 'right' });
    
    pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
    pdf.text('TOTAL EXPENSES:', pageWidth - 100, newPageY + 15);
    pdf.setTextColor(255, 0, 0);
    pdf.text(formatAmount(expenses), pageWidth - 30, newPageY + 15, { align: 'right' });

    // Important Notice
    const noticeY = newPageY + 28;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
    pdf.text('Important Notice:', 15, noticeY);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const noticeText = 'Please verify all transactions and report any discrepancies within 30 days. This statement is generated from the system records and reflects all transactions for the specified period.';
    const noticeLines = pdf.splitTextToSize(noticeText, pageWidth - 30);
    pdf.text(noticeLines, 15, noticeY + 5);
  } else {
    pdf.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
    pdf.rect(15, finalY, pageWidth - 30, 20, 'F');
    pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    pdf.setLineWidth(0.5);
    pdf.rect(15, finalY, pageWidth - 30, 20);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
    
    pdf.text('TOTAL INCOME:', pageWidth - 100, finalY + 8);
    pdf.setTextColor(0, 128, 0);
    pdf.text(formatAmount(income), pageWidth - 30, finalY + 8, { align: 'right' });
    
    pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
    pdf.text('TOTAL EXPENSES:', pageWidth - 100, finalY + 15);
    pdf.setTextColor(255, 0, 0);
    pdf.text(formatAmount(expenses), pageWidth - 30, finalY + 15, { align: 'right' });

    // Important Notice
    const noticeY = finalY + 28;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
    pdf.text('Important Notice:', 15, noticeY);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const noticeText = 'Please verify all transactions and report any discrepancies within 30 days. This statement is generated from the system records and reflects all transactions for the specified period.';
    const noticeLines = pdf.splitTextToSize(noticeText, pageWidth - 30);
    pdf.text(noticeLines, 15, noticeY + 5);
  }

  return pdf;
};

export const downloadMonthlyStatement = (
  transactions: Transaction[],
  users: User[],
  categories: Category[],
  month: number,
  year: number
) => {
  const pdf = generateMonthlyStatementPDF(transactions, users, categories, month, year);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  pdf.save(`statement-${monthNames[month]}-${year}.pdf`);
};