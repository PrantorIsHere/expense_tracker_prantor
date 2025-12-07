import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode';
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

// Generate barcode as data URL
function generateBarcode(text: string): string {
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, text, {
    format: 'CODE128',
    width: 2,
    height: 50,
    displayValue: false,
    margin: 0
  });
  return canvas.toDataURL('image/png');
}

export const generateVoucherPDF = (
  transaction: Transaction,
  user: User,
  category: Category
) => {
  // A5 size landscape: 210mm x 148mm
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a5'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const softwareName = getSoftwareName();

  // Colors - professional dark green/navy
  const darkGreen = [0, 77, 64];
  const lightGrey = [245, 245, 245];
  const borderGrey = [200, 200, 200];

  // Top Section - Title centered
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
  pdf.text('CASH VOUCHER', pageWidth / 2, 15, { align: 'center' });

  // Top-right corner - Company name
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(50, 50, 50);
  pdf.text(softwareName, pageWidth - 15, 12, { align: 'right' });

  // Left-top corner - Barcode
  try {
    const barcodeDataUrl = generateBarcode(transaction.voucherId);
    pdf.addImage(barcodeDataUrl, 'PNG', 15, 20, 40, 12);
  } catch (e) {
    console.error('Barcode generation failed:', e);
  }

  // Voucher ID text under barcode
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(80, 80, 80);
  pdf.text(`Voucher ID: ${transaction.voucherId}`, 15, 35);

  // Date on right side
  pdf.text(`Date: ${new Date(transaction.date).toLocaleDateString()}`, pageWidth - 15, 35, { align: 'right' });

  // Main Body Table
  const startY = 45;
  
  // Table data with proper structure
  const tableData = [
    ['Transaction Type', transaction.type.replace('_', ' ').toUpperCase()],
    ['Amount', formatAmount(transaction.amount)],
    ['To', user.name],
    ['Description / Details', transaction.title]
  ];

  autoTable(pdf, {
    startY: startY,
    head: [],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 3.5,
      lineColor: borderGrey,
      lineWidth: 0.2,
      font: 'helvetica',
      textColor: [40, 40, 40]
    },
    columnStyles: {
      0: { 
        halign: 'left', 
        fontStyle: 'bold',
        cellWidth: 50,
        fillColor: lightGrey
      },
      1: { 
        halign: 'left',
        cellWidth: 'auto'
      }
    },
    margin: { left: 15, right: 15 },
    didParseCell: function(data) {
      // Make Description row taller
      if (data.row.index === 3) {
        data.cell.styles.minCellHeight = 20;
        data.cell.styles.valign = 'top';
      }
    }
  });

  // Bottom Section - Signature lines
  const finalY = (pdf.lastAutoTable?.finalY ?? startY) + 15;
  const signatureY = pageHeight - 25;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(40, 40, 40);

  // Left side - Approved By
  pdf.line(20, signatureY, 70, signatureY);
  pdf.text('Approved By:', 20, signatureY + 6);

  // Right side - Signature
  pdf.line(pageWidth - 70, signatureY, pageWidth - 20, signatureY);
  pdf.text('Signature:', pageWidth - 70, signatureY + 6);

  // Border around entire voucher
  pdf.setDrawColor(darkGreen[0], darkGreen[1], darkGreen[2]);
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