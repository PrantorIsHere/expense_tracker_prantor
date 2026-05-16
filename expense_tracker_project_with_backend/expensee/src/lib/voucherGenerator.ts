import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import { Transaction, User, Category } from '@/components/types';
import { getSettings } from './storage';
import { getCurrentSession } from './auth';

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
  {
    // Compact money receipt size, closer to a cash voucher than a certificate.
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [210, 99]
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const softwareName = getSoftwareName();
    const currentYear = getCurrentYear();
    const { date: dhakaDate, time: dhakaTime, day, month, year } = formatDateTimeDhaka(new Date(transaction.date));
    const amountInWords = numberToWords(transaction.amount);
    const currencyCode = getCurrencyCode();
    const session = getCurrentSession();
    const payFrom = session?.username || softwareName;
    const typeLabel = transaction.type.replace('_', ' ').toUpperCase();
    const description = transaction.description || transaction.title || 'N/A';

    const ink = [32, 37, 42];
    const muted = [92, 100, 112];
    const accent = [17, 120, 82];
    const darkAccent = [43, 43, 43];
    const lineColor = [164, 174, 185];
    const paleGreen = [235, 248, 241];
    const softGray = [246, 248, 250];

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');

    pdf.setDrawColor(235, 239, 242);
    pdf.setLineWidth(0.1);
    for (let i = -pageHeight; i < pageWidth; i += 6) {
      pdf.line(i, pageHeight, i + pageHeight, 0);
    }

    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(6, 6, pageWidth - 12, pageHeight - 12, 2, 2, 'F');

    pdf.setFillColor(accent[0], accent[1], accent[2]);
    pdf.rect(6, pageHeight - 9, pageWidth * 0.43, 3, 'F');
    pdf.setFillColor(darkAccent[0], darkAccent[1], darkAccent[2]);
    pdf.rect(6 + pageWidth * 0.43, pageHeight - 9, pageWidth - 12 - pageWidth * 0.43, 3, 'F');

    pdf.setDrawColor(accent[0], accent[1], accent[2]);
    pdf.setLineWidth(0.6);
    pdf.roundedRect(6, 6, pageWidth - 12, pageHeight - 12, 2, 2, 'S');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(42);
    pdf.setTextColor(239, 245, 242);
    pdf.text('PAID', pageWidth / 2, 59, { align: 'center', angle: -12 });

    pdf.setFillColor(accent[0], accent[1], accent[2]);
    pdf.circle(19, 18, 8, 'F');
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(1.2);
    pdf.circle(19, 18, 5, 'S');
    pdf.circle(19, 18, 2.5, 'S');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(ink[0], ink[1], ink[2]);
    pdf.text(softwareName.toUpperCase(), 31, 16);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.5);
    pdf.setTextColor(muted[0], muted[1], muted[2]);
    pdf.text('EXPENSE MANAGEMENT SYSTEM', 31, 21);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.setTextColor(255, 255, 255);
    pdf.setFillColor(darkAccent[0], darkAccent[1], darkAccent[2]);
    pdf.roundedRect(78, 16, 55, 10, 1, 1, 'F');
    pdf.text('MONEY RECEIPT', pageWidth / 2, 23, { align: 'center' });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(muted[0], muted[1], muted[2]);
    pdf.text('Voucher ID', 145, 13);
    pdf.text('Date', 145, 21);
    pdf.setTextColor(ink[0], ink[1], ink[2]);
    pdf.text(transaction.voucherId, pageWidth - 10, 13, { align: 'right' });
    pdf.text(dhakaDate, pageWidth - 10, 21, { align: 'right' });

    const dateBoxX = pageWidth - 59;
    const dateBoxY = 25;
    const boxW = 5.7;
    const digits = [day[0], day[1], month[0], month[1], year[0], year[1], year[2], year[3]];
    pdf.setFontSize(7);
    pdf.setTextColor(muted[0], muted[1], muted[2]);
    pdf.text('Date', dateBoxX - 12, dateBoxY + 4);
    digits.forEach((digit, index) => {
      const x = dateBoxX + index * (boxW + 0.6);
      pdf.setDrawColor(218, 224, 229);
      pdf.setFillColor(250, 251, 252);
      pdf.rect(x, dateBoxY, boxW, 6.2, 'FD');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(ink[0], ink[1], ink[2]);
      pdf.text(digit, x + boxW / 2, dateBoxY + 4.3, { align: 'center' });
    });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(5.5);
    pdf.setTextColor(155, 162, 170);
    pdf.text('DD', dateBoxX + 5.8, dateBoxY + 9.2, { align: 'center' });
    pdf.text('MM', dateBoxX + 18.4, dateBoxY + 9.2, { align: 'center' });
    pdf.text('YYYY', dateBoxX + 35.5, dateBoxY + 9.2, { align: 'center' });

    const dottedLine = (x1: number, y: number, x2: number) => {
      pdf.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
      pdf.setLineWidth(0.35);
      pdf.setLineDashPattern([0.9, 1.3], 0);
      pdf.line(x1, y, x2, y);
      pdf.setLineDashPattern([], 0);
    };

    const labelValueLine = (label: string, value: string, x: number, y: number, width: number) => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(ink[0], ink[1], ink[2]);
      pdf.text(label, x, y);
      const labelWidth = pdf.getTextWidth(label) + 2;
      dottedLine(x + labelWidth, y + 1, x + width, y + 1);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(ink[0], ink[1], ink[2]);
      const clippedValue = pdf.splitTextToSize(value, width - labelWidth - 2)[0] || '';
      pdf.text(clippedValue, x + labelWidth + 1, y);
    };

    try {
      const barcodeDataUrl = generateBarcode(transaction.voucherId);
      pdf.addImage(barcodeDataUrl, 'PNG', 14, 25, 37, 10);
    } catch (e) {
      console.error('Barcode generation failed:', e);
    }

    labelValueLine('Received with thanks from', payFrom, 12, 42, 186);
    labelValueLine('Paid to', user.name, 12, 51, 91);
    labelValueLine('Title', transaction.title, 108, 51, 90);
    labelValueLine('Type', typeLabel, 12, 60, 56);
    labelValueLine('Category', category.name, 73, 60, 62);
    labelValueLine('Purpose', description, 140, 60, 58);
    labelValueLine('The Sum of Taka', amountInWords, 12, 69, 186);

    pdf.setFillColor(paleGreen[0], paleGreen[1], paleGreen[2]);
    pdf.roundedRect(12, 74, 58, 13, 1, 1, 'F');
    pdf.setFillColor(darkAccent[0], darkAccent[1], darkAccent[2]);
    pdf.rect(12, 74, 15, 13, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(255, 255, 255);
    pdf.text(currencyCode === 'BDT' ? 'TK.' : currencyCode, 19.5, 82.5, { align: 'center' });
    pdf.setTextColor(ink[0], ink[1], ink[2]);
    pdf.setFontSize(14);
    pdf.text(formatAmount(transaction.amount), 67, 82.5, { align: 'right' });

    pdf.setFillColor(softGray[0], softGray[1], softGray[2]);
    pdf.roundedRect(78, 74, 120, 13, 1, 1, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(muted[0], muted[1], muted[2]);
    pdf.text('System generated', 83, 79);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.2);
    pdf.setTextColor(ink[0], ink[1], ink[2]);
    pdf.text('This is a system-generated voucher. No signature required.', 83, 84);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(5.8);
    pdf.setTextColor(muted[0], muted[1], muted[2]);
    pdf.text(`Generated ${dhakaDate} ${dhakaTime} | ${currentYear} ${softwareName}`, pageWidth / 2, 88.8, { align: 'center' });

    return pdf;
  }
};

export const downloadVoucher = (
  transaction: Transaction,
  user: User,
  category: Category
) => {
  const pdf = generateVoucherPDF(transaction, user, category);
  pdf.save(`voucher-${transaction.voucherId}.pdf`);
};
