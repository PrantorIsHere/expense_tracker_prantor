import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  getTransactionHistory,
  saveTransactionHistory,
  getRentHistory,
  saveRentHistory,
  getGadgetWarranties,
  saveGadgetWarranties,
  type TransactionHistoryItem,
  type RentHistoryItem,
  type GadgetWarrantyItem,
} from '@/lib/additionalInfoStorage';
import { formatCurrency } from '@/lib/storage';
import { generateTransactionReport, generateRentReport } from '@/lib/additionalReports';

export default function AdditionalInfoTab() {
  const [txItems, setTxItems] = useState<TransactionHistoryItem[]>([]);
  const [rentItems, setRentItems] = useState<RentHistoryItem[]>([]);
  const [gadgetItems, setGadgetItems] = useState<GadgetWarrantyItem[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; type: 'transaction' | 'rent' | 'gadget' } | null>(null);

  // New row state for quick add
  const [newTxName, setNewTxName] = useState('');
  const [newTxAmount, setNewTxAmount] = useState('');

  const [newRentMonth, setNewRentMonth] = useState('');
  const [newRentAmount, setNewRentAmount] = useState('');
  const [newRentDate, setNewRentDate] = useState('');
  const [newRentNote, setNewRentNote] = useState('');
  const [newGadgetName, setNewGadgetName] = useState('');
  const [newGadgetProductId, setNewGadgetProductId] = useState('');
  const [newGadgetSerial, setNewGadgetSerial] = useState('');
  const [newGadgetPurchaseDate, setNewGadgetPurchaseDate] = useState('');
  const [newGadgetWarrantyMonths, setNewGadgetWarrantyMonths] = useState('');
  const [newGadgetNote, setNewGadgetNote] = useState('');
  const [gadgetSearchTerm, setGadgetSearchTerm] = useState('');

  useEffect(() => {
    setTxItems(getTransactionHistory());
    setRentItems(getRentHistory());
    setGadgetItems(getGadgetWarranties());
  }, []);

  // Helpers
  const addTxItem = () => {
    if (!newTxName || !newTxAmount) return;
    const item: TransactionHistoryItem = {
      id: `tx-${Date.now()}`,
      name: newTxName,
      amount: parseFloat(newTxAmount || '0'),
    };
    const next = [...txItems, item];
    setTxItems(next);
    saveTransactionHistory(next);
    setNewTxName('');
    setNewTxAmount('');
  };

  const updateTxItem = (id: string, patch: Partial<TransactionHistoryItem>) => {
    const next = txItems.map((t) => (t.id === id ? { ...t, ...patch } : t));
    setTxItems(next);
    saveTransactionHistory(next);
  };

  const removeTxItem = (id: string) => {
    const next = txItems.filter((t) => t.id !== id);
    setTxItems(next);
    saveTransactionHistory(next);
  };

  const addRentItem = () => {
    if (!newRentMonth || !newRentAmount || !newRentDate) return;
    const item: RentHistoryItem = {
      id: `rent-${Date.now()}`,
      month: newRentMonth,
      amount: parseFloat(newRentAmount || '0'),
      date: newRentDate,
      deedNote: newRentNote || '',
    };
    const next = [...rentItems, item];
    setRentItems(next);
    saveRentHistory(next);
    setNewRentMonth('');
    setNewRentAmount('');
    setNewRentDate('');
    setNewRentNote('');
  };

  const updateRentItem = (id: string, patch: Partial<RentHistoryItem>) => {
    const next = rentItems.map((r) => (r.id === id ? { ...r, ...patch } : r));
    setRentItems(next);
    saveRentHistory(next);
  };

  const removeRentItem = (id: string) => {
    const next = rentItems.filter((r) => r.id !== id);
    setRentItems(next);
    saveRentHistory(next);
  };

  const addGadgetItem = () => {
    if (!newGadgetName || !newGadgetProductId || !newGadgetSerial || !newGadgetPurchaseDate || !newGadgetWarrantyMonths) return;
    const item: GadgetWarrantyItem = {
      id: `gadget-${Date.now()}`,
      productId: newGadgetProductId,
      serialNumber: newGadgetSerial,
      name: newGadgetName,
      purchaseDate: newGadgetPurchaseDate,
      warrantyMonths: parseInt(newGadgetWarrantyMonths || '0', 10),
      note: newGadgetNote || '',
    };
    const next = [...gadgetItems, item];
    setGadgetItems(next);
    saveGadgetWarranties(next);
    setNewGadgetName('');
    setNewGadgetProductId('');
    setNewGadgetSerial('');
    setNewGadgetPurchaseDate('');
    setNewGadgetWarrantyMonths('');
    setNewGadgetNote('');
  };

  const updateGadgetItem = (id: string, patch: Partial<GadgetWarrantyItem>) => {
    const next = gadgetItems.map((g) => (g.id === id ? { ...g, ...patch } : g));
    setGadgetItems(next);
    saveGadgetWarranties(next);
  };

  const removeGadgetItem = (id: string) => {
    const next = gadgetItems.filter((g) => g.id !== id);
    setGadgetItems(next);
    saveGadgetWarranties(next);
  };

  const getWarrantyEndDate = (item: GadgetWarrantyItem) => {
    const date = new Date(item.purchaseDate);
    if (Number.isNaN(date.getTime())) return null;
    date.setMonth(date.getMonth() + (item.warrantyMonths || 0));
    return date;
  };

  const getWarrantyStatus = (item: GadgetWarrantyItem) => {
    const endDate = getWarrantyEndDate(item);
    if (!endDate) {
      return {
        label: 'Invalid Date',
        detail: 'Check purchase date',
        variant: 'secondary' as const,
        className: '',
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      return {
        label: 'Expired',
        detail: `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago`,
        variant: 'destructive' as const,
        className: '',
      };
    }

    if (daysLeft <= 30) {
      return {
        label: 'Expiring Soon',
        detail: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`,
        variant: 'outline' as const,
        className: 'border-amber-500 bg-amber-50 text-amber-700',
      };
    }

    return {
      label: 'Active',
      detail: `${daysLeft} days left`,
      variant: 'outline' as const,
      className: 'border-green-600 bg-green-50 text-green-700',
    };
  };

  const filteredGadgets = gadgetItems.filter((item) => {
    const term = gadgetSearchTerm.trim().toLowerCase();
    if (!term) return true;

    return (
      item.productId.toLowerCase().includes(term) ||
      item.serialNumber.toLowerCase().includes(term) ||
      item.name.toLowerCase().includes(term)
    );
  });

  const totalAll = txItems.reduce((s, i) => s + i.amount, 0) + rentItems.reduce((s, i) => s + i.amount, 0);

  const downloadTxPDF = () => {
    generateTransactionReport(txItems);
  };

  const downloadRentPDF = () => {
    generateRentReport(rentItems);
  };

  const downloadCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
    const csvRows = [
      headers.join(','),
      ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadTxCSV = () => {
    downloadCsv(
      'transaction-history.csv',
      ['Serial No', 'Transaction Name', 'Amount'],
      txItems.map((item, index) => [index + 1, item.name, item.amount])
    );
  };

  const downloadRentCSV = () => {
    downloadCsv(
      'rent-history.csv',
      ['Month', 'Amount', 'Date', 'Deed With Homeowner'],
      rentItems.map((item) => [item.month, item.amount, item.date, item.deedNote])
    );
  };

  const downloadGadgetCSV = () => {
    downloadCsv(
      'gadget-warranties.csv',
      ['Product ID', 'Serial Number', 'Gadget Name', 'Purchase Date', 'Warranty Months', 'Warranty Ends', 'Status', 'Note'],
      gadgetItems.map((item) => {
        const endDate = getWarrantyEndDate(item);
        const status = getWarrantyStatus(item);
        return [
          item.productId,
          item.serialNumber,
          item.name,
          item.purchaseDate,
          item.warrantyMonths,
          endDate ? endDate.toLocaleDateString() : '',
          `${status.label} - ${status.detail}`,
          item.note,
        ];
      })
    );
  };

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;

    if (pendingDelete.type === 'transaction') {
      removeTxItem(pendingDelete.id);
    } else if (pendingDelete.type === 'rent') {
      removeRentItem(pendingDelete.id);
    } else {
      removeGadgetItem(pendingDelete.id);
    }

    setPendingDelete(null);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Additional Info</h1>

      {/* SECTION 1: History of Transaction */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>History of Transaction</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Total: {formatCurrency(txItems.reduce((s, i) => s + i.amount, 0))}</Badge>
              <Button variant="outline" onClick={downloadTxCSV}>CSV</Button>
              <Button onClick={downloadTxPDF}>PDF</Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Add row inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <Input
              placeholder="Name of Transaction"
              value={newTxName}
              onChange={(e) => setNewTxName(e.target.value)}
            />
            <Input
              placeholder="Amount"
              type="number"
              step="0.01"
              value={newTxAmount}
              onChange={(e) => setNewTxAmount(e.target.value)}
            />
            <Button onClick={addTxItem}>Add Row</Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial No</TableHead>
                  <TableHead>Name of Transaction</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No records. Add your first transaction above.
                    </TableCell>
                  </TableRow>
                ) : (
                  txItems.map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>
                        <Input
                          value={item.name}
                          onChange={(e) => updateTxItem(item.id, { name: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.amount.toString()}
                          onChange={(e) => updateTxItem(item.id, { amount: parseFloat(e.target.value || '0') })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="destructive" onClick={() => setPendingDelete({ id: item.id, type: 'transaction' })}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* SECTION 2: History of House Rent */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>History of House Rent</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Total: {formatCurrency(rentItems.reduce((s, i) => s + i.amount, 0))}</Badge>
              <Button variant="outline" onClick={downloadRentCSV}>CSV</Button>
              <Button onClick={downloadRentPDF}>PDF</Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Add row inputs */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
            <Input
              placeholder="Month"
              value={newRentMonth}
              onChange={(e) => setNewRentMonth(e.target.value)}
            />
            <Input
              placeholder="Amount"
              type="number"
              step="0.01"
              value={newRentAmount}
              onChange={(e) => setNewRentAmount(e.target.value)}
            />
            <Input
              type="date"
              value={newRentDate}
              onChange={(e) => setNewRentDate(e.target.value)}
            />
            <Input
              placeholder="Deed With Homeowner (note)"
              value={newRentNote}
              onChange={(e) => setNewRentNote(e.target.value)}
            />
            <Button onClick={addRentItem}>Add Row</Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Deed With Homeowner</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No records. Add your first rent entry above.
                    </TableCell>
                  </TableRow>
                ) : (
                  rentItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Input
                          value={item.month}
                          onChange={(e) => updateRentItem(item.id, { month: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.amount.toString()}
                          onChange={(e) => updateRentItem(item.id, { amount: parseFloat(e.target.value || '0') })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={item.date.split('T')[0] || item.date}
                          onChange={(e) => updateRentItem(item.id, { date: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.deedNote}
                          onChange={(e) => updateRentItem(item.id, { deedNote: e.target.value })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="destructive" onClick={() => setPendingDelete({ id: item.id, type: 'rent' })}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* SECTION 3: Gadget Warranty */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Gadget Warranty</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{gadgetItems.length} Items</Badge>
              <Button variant="outline" onClick={downloadGadgetCSV}>CSV</Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
            <Input
              placeholder="Gadget Name"
              value={newGadgetName}
              onChange={(e) => setNewGadgetName(e.target.value)}
            />
            <Input
              placeholder="Product ID"
              value={newGadgetProductId}
              onChange={(e) => setNewGadgetProductId(e.target.value)}
            />
            <Input
              placeholder="Serial Number"
              value={newGadgetSerial}
              onChange={(e) => setNewGadgetSerial(e.target.value)}
            />
            <Input
              type="date"
              value={newGadgetPurchaseDate}
              onChange={(e) => setNewGadgetPurchaseDate(e.target.value)}
            />
            <Input
              placeholder="Warranty Months"
              type="number"
              min="1"
              step="1"
              value={newGadgetWarrantyMonths}
              onChange={(e) => setNewGadgetWarrantyMonths(e.target.value)}
            />
            <Input
              placeholder="Note"
              value={newGadgetNote}
              onChange={(e) => setNewGadgetNote(e.target.value)}
            />
            <Button onClick={addGadgetItem}>Add Gadget</Button>
          </div>

          <div className="mb-4 max-w-md">
            <Input
              placeholder="Search by product ID, serial number, or gadget name"
              value={gadgetSearchTerm}
              onChange={(e) => setGadgetSearchTerm(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product ID</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Gadget Name</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead>Warranty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGadgets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">
                      {gadgetItems.length === 0
                        ? 'No gadget records. Add a gadget with product ID, serial number, and warranty period.'
                        : 'No gadget matches your search.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGadgets.map((item) => {
                    const warrantyEndDate = getWarrantyEndDate(item);
                    const warrantyStatus = getWarrantyStatus(item);

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Input
                            value={item.productId}
                            onChange={(e) => updateGadgetItem(item.id, { productId: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.serialNumber}
                            onChange={(e) => updateGadgetItem(item.id, { serialNumber: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.name}
                            onChange={(e) => updateGadgetItem(item.id, { name: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={item.purchaseDate.split('T')[0] || item.purchaseDate}
                            onChange={(e) => updateGadgetItem(item.id, { purchaseDate: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={item.warrantyMonths.toString()}
                              onChange={(e) => updateGadgetItem(item.id, { warrantyMonths: parseInt(e.target.value || '0', 10) })}
                            />
                            <p className="text-xs text-muted-foreground">
                              Ends: {warrantyEndDate ? warrantyEndDate.toLocaleDateString() : 'Invalid date'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={warrantyStatus.variant} className={warrantyStatus.className}>
                            {warrantyStatus.label}
                          </Badge>
                          <p className="mt-1 text-xs text-muted-foreground">{warrantyStatus.detail}</p>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.note}
                            onChange={(e) => updateGadgetItem(item.id, { note: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="destructive" onClick={() => setPendingDelete({ id: item.id, type: 'gadget' })}>
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Grand Total (UI-only helper; PDFs are independent) */}
      <div className="flex justify-end">
        <Badge variant="outline" className="text-base px-3 py-2">
          Grand Total: {formatCurrency(totalAll)}
        </Badge>
      </div>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              This action permanently removes the selected entry from the additional information section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
