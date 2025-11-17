import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  getTransactionHistory,
  saveTransactionHistory,
  getRentHistory,
  saveRentHistory,
  type TransactionHistoryItem,
  type RentHistoryItem,
} from '@/lib/lib/additionalInfoStorage';
import { formatCurrency } from '@/lib/storage';
import { generateTransactionReport, generateRentReport } from '../lib/additionalReports';

export default function AdditionalInfoTab() {
  const [txItems, setTxItems] = useState<TransactionHistoryItem[]>([]);
  const [rentItems, setRentItems] = useState<RentHistoryItem[]>([]);

  // New row state for quick add
  const [newTxName, setNewTxName] = useState('');
  const [newTxAmount, setNewTxAmount] = useState('');

  const [newRentMonth, setNewRentMonth] = useState('');
  const [newRentAmount, setNewRentAmount] = useState('');
  const [newRentDate, setNewRentDate] = useState('');
  const [newRentNote, setNewRentNote] = useState('');

  useEffect(() => {
    setTxItems(getTransactionHistory());
    setRentItems(getRentHistory());
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

  const totalAll = txItems.reduce((s, i) => s + i.amount, 0) + rentItems.reduce((s, i) => s + i.amount, 0);

  const downloadTxPDF = () => {
    generateTransactionReport(txItems);
  };

  const downloadRentPDF = () => {
    generateRentReport(rentItems);
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
                        <Button variant="destructive" onClick={() => removeTxItem(item.id)}>
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
                        <Button variant="destructive" onClick={() => removeRentItem(item.id)}>
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

      {/* Grand Total (UI-only helper; PDFs are independent) */}
      <div className="flex justify-end">
        <Badge variant="outline" className="text-base px-3 py-2">
          Grand Total: {formatCurrency(totalAll)}
        </Badge>
      </div>
    </div>
  );
}