Dynamic Expense Tracker - MVP Implementation Plan
Core Files to Create/Modify
1. Data Management & Types
src/types/index.ts - TypeScript interfaces for all entities
src/lib/storage.ts - LocalStorage management with future MySQL migration support
src/lib/dummyData.ts - Pre-populated test data
2. Core Components
src/pages/Index.tsx - Main dashboard with financial summaries and charts
src/components/TransactionManager.tsx - Transaction CRUD operations
src/components/VoucherGenerator.tsx - PDF voucher generation
src/components/ReportsPage.tsx - Financial reports and analytics
src/components/LoansManager.tsx - Loans tracking module
src/components/SettingsPage.tsx - App settings and configuration
3. UI Components
src/components/Sidebar.tsx - Navigation sidebar
src/components/TransactionForm.tsx - Add/Edit transaction form
Key Features Implementation
Dashboard
Total Balance, Monthly Income/Expenses, Active Goals, Net Loans
Charts: Income vs Expenses (6 months), Category breakdown
Recent transactions, Goal progress, Loan summary
Transactions
CRUD operations with voucher ID format: YYYYMMDD-0001
Search & filters (Voucher ID, Date Range, Category, User, Type)
PDF voucher generation (cheque-size)
Voucher System
Auto-generated unique IDs
PDF download with jsPDF
Complete transaction details
Reports
Monthly income/expenses in ৳ with English digits
Charts: Monthly trends, Category breakdown, Daily spending
Savings rate calculation
Loans Module
Separate tracking for given/taken loans
User linking and repayment status
Settings
Currency: ৳ (Taka), English digits
Theme switcher (Light/Dark)
Backup/Restore (JSON/CSV export/import)
Reset functionality
Dependencies to Add
recharts (charts)
jspdf (PDF generation)
date-fns (date formatting)
lucide-react (icons)
File Limit: 8 core files (excluding types and utilities)