import { useState } from 'react';
import { CreditCard, Calendar, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const initialBillingSummary = [
  {
    id: 'BILL-001',
    reservationId: 'RES-002',
    description: 'BMW X5 Rental',
    amount: '$550',
    dueDate: '2025-11-14',
    status: 'pending',
  },
  {
    id: 'BILL-002',
    reservationId: 'RES-001',
    description: 'Tesla Model 3 Rental',
    amount: '$320',
    dueDate: '2025-11-11',
    status: 'overdue',
  },
];

const initialPaymentHistory = [
  {
    id: 'PAY-001',
    billId: 'BILL-004',
    amount: '$450',
    date: '2025-10-25',
    method: 'Credit Card',
    status: 'completed',
    last4: '4242',
  },
  {
    id: 'PAY-002',
    billId: 'BILL-003',
    amount: '$280',
    date: '2025-10-10',
    method: 'PayPal',
    status: 'completed',
    last4: null,
  },
  {
    id: 'PAY-003',
    billId: 'BILL-002',
    amount: '$180',
    date: '2025-09-22',
    method: 'Credit Card',
    status: 'completed',
    last4: '4242',
  },
  {
    id: 'PAY-004',
    billId: 'BILL-001',
    amount: '$390',
    date: '2025-09-05',
    method: 'Debit Card',
    status: 'completed',
    last4: '1234',
  },
];

export default function PaymentsBilling() {
  const [billingList, setBillingList] = useState(initialBillingSummary);
  const [paymentList, setPaymentList] = useState(initialPaymentHistory);

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'overdue':
        return 'bg-red-100 text-red-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'overdue':
        return <AlertCircle className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const handlePayNow = (bill: any) => {
    setSelectedBill(bill);
    setShowPaymentDialog(true);
  };

  const processPayment = () => {
    if (!selectedBill) return;

    setBillingList(prev => prev.filter(b => b.id !== selectedBill.id));

    const newId = `PAY-00${paymentList.length + 1}`;
    setPaymentList([
      {
        id: newId,
        billId: selectedBill.id,
        amount: selectedBill.amount,
        date: new Date().toISOString().split('T')[0],
        method: 'Card',
        status: 'completed',
        last4: 'XXXX',
      },
      ...paymentList
    ]);

    setShowPaymentDialog(false);
    setSelectedBill(null);
  };

  const totalDue = billingList.reduce((sum, bill) => {
    return sum + parseFloat(bill.amount.replace('$', ''));
  }, 0);

  const paidThisMonth = paymentList.reduce((sum, pay) => {
    return sum + parseFloat(pay.amount.replace('$', ''));
  }, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="mb-2">Payments & Billing</h1>
        <p className="text-gray-600">Manage your payments and view billing history</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-gray-600">Total Outstanding</CardTitle>
            <div className="w-12 h-12 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-red-600 mb-1">${totalDue.toFixed(2)}</div>
            <p className="text-gray-500">{billingList.length} pending payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-gray-600">Paid History Total</CardTitle>
            <div className="w-12 h-12 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-green-600 mb-1">${paidThisMonth.toFixed(2)}</div>
            <p className="text-gray-500">{paymentList.length} completed payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-gray-600">Next Payment Due</CardTitle>
            <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-blue-600 mb-1">{billingList.length > 0 ? billingList[0].dueDate : 'None'}</div>
            <p className="text-gray-500">{billingList.length > 0 ? `${billingList[0].amount} due` : 'All caught up'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Outstanding Bills</CardTitle>
          <CardDescription>Payments that require your attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {billingList.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No outstanding bills.</p>
            ) : (
              billingList.map((bill) => (
                <div
                  key={bill.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-start gap-4 mb-3 md:mb-0">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      bill.status === 'overdue' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'
                    }`}>
                      {getStatusIcon(bill.status)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-900">{bill.description}</span>
                        <Badge className={getStatusColor(bill.status)}>
                          {bill.status}
                        </Badge>
                      </div>
                      <p className="text-gray-500">Bill ID: {bill.id}</p>
                      <p className="text-gray-500">Reservation: {bill.reservationId}</p>
                      <div className="flex items-center gap-2 mt-2 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>Due: {bill.dueDate}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-blue-600">{bill.amount}</div>
                    <Button
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={() => handlePayNow(bill)}
                    >
                      Pay Now
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>Your completed transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment ID</TableHead>
                  <TableHead>Bill ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentList.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.id}</TableCell>
                    <TableCell className="text-gray-600">{payment.billId}</TableCell>
                    <TableCell className="text-blue-600">{payment.amount}</TableCell>
                    <TableCell className="text-gray-600">{payment.date}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-gray-500" />
                        <span>
                          {payment.method}
                          {payment.last4 && ` •••• ${payment.last4}`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(payment.status)}>
                        {payment.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Make Payment</DialogTitle>
            <DialogDescription>
              Complete your payment securely
            </DialogDescription>
          </DialogHeader>
          {selectedBill && (
            <div className="space-y-4 pt-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Bill ID:</span>
                  <span className="text-gray-900">{selectedBill.id}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Description:</span>
                  <span className="text-gray-900">{selectedBill.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount Due:</span>
                  <span className="text-blue-600">{selectedBill.amount}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select defaultValue="card">
                    <SelectTrigger id="paymentMethod">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="card">Credit/Debit Card</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <Input id="cardNumber" placeholder="1234 5678 9012 3456" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiry">Expiry Date</Label>
                    <Input id="expiry" placeholder="MM/YY" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cvv">CVV</Label>
                    <Input id="cvv" placeholder="123" />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={processPayment}
                  >
                    Pay {selectedBill.amount}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowPaymentDialog(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
