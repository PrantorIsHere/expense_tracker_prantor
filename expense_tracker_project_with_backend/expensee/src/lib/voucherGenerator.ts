import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode';
import { Transaction, User, Category } from '@/components/types';
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

// Format amount without commas for display
function formatAmount(n: number): string {
  return n.toFixed(2);
}

// Convert number to words (Bangladeshi style)
function numberToWords(num: number): string {
  if (num === 0) return 'Zero Taka Only';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  function convertLessThanThousand(n: number): string {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
  }
  
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const remainder = Math.floor(num % 1000);
  
  let result = '';
  
  if (crore > 0) result += convertLessThanThousand(crore) + ' Crore ';
  if (lakh > 0) result += convertLessThanThousand(lakh) + ' Lakh ';
  if (thousand > 0) result += convertLessThanThousand(thousand) + ' Thousand ';
  if (remainder > 0) result += convertLessThanThousand(remainder);
  
  return result.trim() + ' Taka Only';
}

// Format date and time in Asia/Dhaka timezone
function formatDateTimeDhaka(date: Date): { date: string; time: string; day: string; month: string; year: string } {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  };
  
  const formatter = new Intl.DateTimeFormat('en-GB', options);
  const parts = formatter.formatToParts(date);
  
  const day = parts.find(p => p.type === 'day')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const year = parts.find(p => p.type === 'year')?.value || '';
  const hour = parts.find(p => p.type === 'hour')?.value || '';
  const minute = parts.find(p => p.type === 'minute')?.value || '';
  const second = parts.find(p => p.type === 'second')?.value || '';
  const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value || '';
  
  return {
    date: `${day}/${month}/${year}`,
    time: `${hour}:${minute}:${second} ${dayPeriod}`,
    day,
    month,
    year
  };
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

// Generate barcode as data URL
function generateBarcode(text: string): string {
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, text, {
    format: 'CODE128',
    width: 1.5,
    height: 40,
    displayValue: true,
    margin: 3,
    fontSize: 11,
    textMargin: 2
  });
  return canvas.toDataURL('image/png');
}

export const generateVoucherPDF = (
  transaction: Transaction,
  user: User,
  category: Category
) => {
  // A4 size landscape for bank cheque style: 297mm x 210mm
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const softwareName = getSoftwareName();
  const currentYear = getCurrentYear();
  const { date: dhakaDate, day, month, year } = formatDateTimeDhaka(new Date(transaction.date));
  const amountInWords = numberToWords(transaction.amount);

  // Bank cheque style colors - cream/beige background with subtle patterns
  const creamBg = [252, 248, 240];
  const lightBrown = [210, 180, 140];
  const darkBrown = [101, 67, 33];
  const securityLineColor = [230, 220, 200];
  const borderColor = [180, 150, 120];

  // Background - Cream color
  pdf.setFillColor(creamBg[0], creamBg[1], creamBg[2]);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  // Security pattern - subtle diagonal lines
  pdf.setDrawColor(securityLineColor[0], securityLineColor[1], securityLineColor[2]);
  pdf.setLineWidth(0.1);
  for (let i = 0; i < pageWidth + pageHeight; i += 5) {
    pdf.line(i, 0, i - pageHeight, pageHeight);
  }

  // Watermark text - "PAID" in center
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(80);
  pdf.setTextColor(240, 235, 225);
  pdf.text('PAID', pageWidth / 2, pageHeight / 2, { 
    align: 'center',
    angle: 45
  });

  // Main border
  pdf.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  pdf.setLineWidth(0.8);
  pdf.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // Inner decorative border
  pdf.setLineWidth(0.3);
  pdf.rect(12, 12, pageWidth - 24, pageHeight - 24);

  // Top section - Software name and document title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(darkBrown[0], darkBrown[1], darkBrown[2]);
  pdf.text(softwareName, 20, 25);

  // Document type
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(darkBrown[0], darkBrown[1], darkBrown[2]);
  pdf.text('EXPENSE PAYMENT VOUCHER', pageWidth / 2, 25, { align: 'center' });

  // Voucher number on top right
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(`Voucher No: ${transaction.voucherId}`, pageWidth - 20, 25, { align: 'right' });

  // Date boxes (similar to cheque date format)
  const dateBoxY = 35;
  const dateBoxX = pageWidth - 80;
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(darkBrown[0], darkBrown[1], darkBrown[2]);
  pdf.text('DATE', dateBoxX - 15, dateBoxY + 4);

  // Date boxes
  const boxSize = 8;
  const boxSpacing = 1;
  const dateDigits = [day[0], day[1], month[0], month[1], year[0], year[1], year[2], year[3]];
  const labels = ['D', '', 'M', '', 'Y', '', '', ''];
  
  for (let i = 0; i < dateDigits.length; i++) {
    const x = dateBoxX + i * (boxSize + boxSpacing);
    
    // Draw box
    pdf.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    pdf.setLineWidth(0.3);
    pdf.rect(x, dateBoxY, boxSize, boxSize);
    
    // Draw digit
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    pdf.text(dateDigits[i], x + boxSize / 2, dateBoxY + 6, { align: 'center' });
    
    // Draw label below
    if (labels[i]) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(100, 100, 100);
      pdf.text(labels[i], x + boxSize / 2, dateBoxY + boxSize + 3, { align: 'center' });
    }
  }

  // Barcode on left side
  const barcodeY = 35;
  try {
    const barcodeDataUrl = generateBarcode(transaction.voucherId);
    pdf.addImage(barcodeDataUrl, 'PNG', 20, barcodeY, 45, 15);
  } catch (e) {
    console.error('Barcode generation failed:', e);
  }

  // Main content area starts
  const contentStartY = 60;

  // "Pay To" section
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(darkBrown[0], darkBrown[1], darkBrown[2]);
  pdf.text('Pay To', 20, contentStartY);

  // Recipient name with double asterisks (bank style)
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(0, 0, 0);
  pdf.text(`**${user.name}**`, 50, contentStartY);

  // Underline for Pay To
  pdf.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  pdf.setLineWidth(0.3);
  pdf.line(50, contentStartY + 1, pageWidth - 20, contentStartY + 1);

  // "The Sum of Taka" section
  const amountWordsY = contentStartY + 15;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(darkBrown[0], darkBrown[1], darkBrown[2]);
  pdf.text('The Sum of Taka', 20, amountWordsY);

  // Amount in words with double asterisks
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(0, 0, 0);
  
  // Split amount in words into multiple lines if needed
  const maxWidth = pageWidth - 180;
  const amountWordsLines = pdf.splitTextToSize(`**${amountInWords}**`, maxWidth);
  let currentY = amountWordsY;
  
  amountWordsLines.forEach((line: string, index: number) => {
    pdf.text(line, 60, currentY);
    if (index < amountWordsLines.length - 1) {
      currentY += 8;
    }
  });

  // Amount box on the right (bank cheque style)
  const amountBoxX = pageWidth - 90;
  const amountBoxY = amountWordsY - 8;
  const amountBoxWidth = 70;
  const amountBoxHeight = 20;

  // Amount box background
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  pdf.setLineWidth(0.5);
  pdf.rect(amountBoxX, amountBoxY, amountBoxWidth, amountBoxHeight, 'FD');

  // "Tk" label
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(darkBrown[0], darkBrown[1], darkBrown[2]);
  pdf.text('Tk', amountBoxX + 5, amountBoxY + 13);

  // Amount value
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(0, 0, 0);
  pdf.text(`**${formatAmount(transaction.amount)}**`, amountBoxX + amountBoxWidth - 5, amountBoxY + 13, { align: 'right' });

  // Vertical line in amount box
  pdf.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  pdf.setLineWidth(0.3);
  pdf.line(amountBoxX + 18, amountBoxY, amountBoxX + 18, amountBoxY + amountBoxHeight);

  // Underline below amount in words
  const underlineY = currentY + 2;
  pdf.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  pdf.setLineWidth(0.3);
  pdf.line(60, underlineY, pageWidth - 100, underlineY);

  // "A/C No." section
  const acY = underlineY + 12;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(darkBrown[0], darkBrown[1], darkBrown[2]);
  pdf.text('A/C No. :', 20, acY);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Common', 50, acY);

  // Underline for A/C
  pdf.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  pdf.setLineWidth(0.3);
  pdf.line(50, acY + 1, 150, acY + 1);

  // Category/Purpose section
  const categoryY = acY + 12;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(darkBrown[0], darkBrown[1], darkBrown[2]);
  pdf.text('Purpose :', 20, categoryY);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(0, 0, 0);
  pdf.text(category.name, 50, categoryY);

  // Underline for Purpose
  pdf.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  pdf.setLineWidth(0.3);
  pdf.line(50, categoryY + 1, 150, categoryY + 1);

  // Description section
  const descY = categoryY + 12;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(darkBrown[0], darkBrown[1], darkBrown[2]);
  pdf.text('Details :', 20, descY);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  const description = transaction.title || transaction.description || 'N/A';
  const descLines = pdf.splitTextToSize(description, pageWidth - 100);
  let descCurrentY = descY;
  descLines.forEach((line: string) => {
    pdf.text(line, 50, descCurrentY);
    descCurrentY += 6;
  });

  // Bottom signature section
  const signatureY = pageHeight - 40;

  // Prepared By section (left) - WITH SIGNATURE
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(darkBrown[0], darkBrown[1], darkBrown[2]);
  pdf.text('Prepared By:', 30, signatureY);

  // Signature line for Prepared By
  pdf.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  pdf.setLineWidth(0.3);
  pdf.line(30, signatureY + 10, 90, signatureY + 10);

  // Signature: "Prantor" in elegant cursive italic (SAME AS AUTHORIZED)
  pdf.setFont('times', 'italic');
  pdf.setFontSize(18);
  pdf.setTextColor(0, 0, 139); // Dark blue for signature
  pdf.text('Prantor', 60, signatureY + 8);

  // Name: Sharif R Prantor (below signature)
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Sharif R Prantor', 30, signatureY + 15);

  // Authorized Signature section (right)
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(darkBrown[0], darkBrown[1], darkBrown[2]);
  pdf.text('Authorized Signature:', pageWidth - 100, signatureY);

  // Signature line for Authorized
  pdf.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  pdf.setLineWidth(0.3);
  pdf.line(pageWidth - 100, signatureY + 10, pageWidth - 30, signatureY + 10);

  // Signature: "Prantor" in elegant cursive italic
  pdf.setFont('times', 'italic');
  pdf.setFontSize(18);
  pdf.setTextColor(0, 0, 139); // Dark blue for signature
  pdf.text('Prantor', pageWidth - 70, signatureY + 8);

  // Footer - Copyright with dynamic year
  const footerY = pageHeight - 15;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    `© ${currentYear} ${softwareName}. All rights reserved. | Generated on ${dhakaDate} (Asia/Dhaka)`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  // Security note at bottom
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(7);
  pdf.setTextColor(120, 120, 120);
  pdf.text(
    'This is a computer-generated voucher and does not require a physical signature.',
    pageWidth / 2,
    footerY + 4,
    { align: 'center' }
  );

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