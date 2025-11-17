import jsPDF from 'jspdf';
import { Transaction, User, Category } from '@/types';
import { formatCurrency } from './storage';

export const generateVoucherPDF = (
  transaction: Transaction,
  user: User,
  category: Category
) => {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [180, 80] // Cheque size format
  });

  // Set font
  pdf.setFont('helvetica');
  
  // Header
  pdf.setFontSize(16);
  pdf.setTextColor(0, 0, 0);
  pdf.text('PAYMENT VOUCHER', 90, 15, { align: 'center' });
  
  // Voucher ID
  pdf.setFontSize(10);
  pdf.text(`Voucher ID: ${transaction.voucherId}`, 10, 25);
  pdf.text(`Date: ${new Date(transaction.date).toLocaleDateString()}`, 130, 25);
  
  // Main content
  pdf.setFontSize(12);
  pdf.text('Pay to:', 10, 35);
  pdf.text(user.name, 30, 35);
  
  pdf.text('Amount:', 10, 45);
  pdf.text(formatCurrency(transaction.amount), 30, 45);
  
  pdf.text('For:', 10, 55);
  pdf.text(transaction.title, 30, 55);
  
  pdf.text('Category:', 10, 65);
  pdf.text(category.name, 30, 65);
  
  pdf.text('Type:', 100, 65);
  pdf.text(transaction.type.replace('_', ' ').toUpperCase(), 120, 65);
  
  // Border
  pdf.setDrawColor(0, 0, 0);
  pdf.rect(5, 5, 170, 70);
  
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