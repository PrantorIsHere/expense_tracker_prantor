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

// Format amount without commas
function formatAmount(n: number): string {
  const currency = getCurrencyCode();
  return `${currency} ${n.toFixed(2)}`;
}

export const generateVoucherPDF = (
  transaction: Transaction,
  user: User,
  category: Category
) => {
  // A5 size: 148mm x 210mm
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const softwareName = getSoftwareName();

  // Colors
  const primaryBlue = [41, 128, 185];
  const darkGrey = [52, 73, 94];
  const lightGrey = [236, 240, 241];

  // Header background
  pdf.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  pdf.rect(0, 0, pageWidth, 35, 'F');

  // Software name in header
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text(softwareName, pageWidth / 2, 15, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  pdf.text('PAYMENT VOUCHER', pageWidth / 2, 25, { align: 'center' });

  // Voucher info section
  pdf.setTextColor(darkGrey[0], darkGrey[1], darkGrey[2]);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(`Voucher ID: ${transaction.voucherId}`, 15, 50);
  pdf.text(`Date: ${new Date(transaction.date).toLocaleDateString()}`, pageWidth - 15, 50, { align: 'right' });

  // Transaction details table
  const tableData = [
    ['Pay To', user.name],
    ['Amount', formatAmount(transaction.amount)],
    ['Purpose', transaction.title],
    ['Category', category.name],
    ['Type', transaction.type.replace('_', ' ').toUpperCase()]
  ];

  autoTable(pdf, {
    startY: 60,
    head: [],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 11,
      cellPadding: 4,
      lineColor: [200, 200, 200],
      lineWidth: 0.3,
      font: 'helvetica',
    },
    columnStyles: {
      0: { 
        halign: 'left', 
        fontStyle: 'bold',
        cellWidth: 45,
        fillColor: [245, 245, 245]
      },
      1: { 
        halign: 'left',
        cellWidth: 'auto'
      }
    },
    margin: { left: 15, right: 15 },
  });

  // Footer note
  const finalY = (pdf.lastAutoTable?.finalY ?? 60) + 15;
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(9);
  pdf.setTextColor(120, 120, 120);
  pdf.text('This is a system-generated voucher. No signature required.', pageWidth / 2, finalY, { align: 'center' });

  // Authorized signature section
  const signatureY = pageHeight - 40;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(darkGrey[0], darkGrey[1], darkGrey[2]);
  
  // Signature lines
  pdf.line(20, signatureY, 60, signatureY);
  pdf.line(pageWidth - 60, signatureY, pageWidth - 20, signatureY);
  
  pdf.setFontSize(9);
  pdf.text('Prepared By', 40, signatureY + 6, { align: 'center' });
  pdf.text('Authorized By', pageWidth - 40, signatureY + 6, { align: 'center' });

  // Border
  pdf.setDrawColor(darkGrey[0], darkGrey[1], darkGrey[2]);
  pdf.setLineWidth(0.5);
  pdf.rect(5, 5, pageWidth - 10, pageHeight - 10);

  return pdf;
};

export const downloadVoucher = (
  transaction: Transaction,
  user: User,
  category: Category
) => {
  const pdf = generateVoucherPDF(transaction, user, category);
  pdf.save(`voucher-${transaction.voucherId}.pdf`);
};