import { useState } from 'react';
import { FileText, Download, Eye, Printer } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

export default function MyContracts() {
  const [viewingContract, setViewingContract] = useState<any>(null);

  const contracts = [
    {
      id: 'CNT-001',
      reservationId: 'RES-001',
      vehicle: 'Tesla Model 3',
      startDate: '2025-11-08',
      endDate: '2025-11-12',
      status: 'active',
      totalAmount: '$320',
      terms: 'Standard rental agreement with full insurance coverage.',
    },
    {
      id: 'CNT-002',
      reservationId: 'RES-002',
      vehicle: 'BMW X5',
      startDate: '2025-11-15',
      endDate: '2025-11-20',
      status: 'pending',
      totalAmount: '$550',
      terms: 'Premium rental agreement with comprehensive insurance.',
    },
    {
      id: 'CNT-003',
      reservationId: 'RES-003',
      vehicle: 'Toyota Camry',
      startDate: '2025-11-22',
      endDate: '2025-11-25',
      status: 'pending',
      totalAmount: '$180',
      terms: 'Standard rental agreement with basic insurance.',
    },
    {
      id: 'CNT-004',
      reservationId: 'RES-004',
      vehicle: 'Mercedes-Benz C-Class',
      startDate: '2025-10-20',
      endDate: '2025-10-25',
      status: 'completed',
      totalAmount: '$450',
      terms: 'Premium rental agreement with full insurance coverage.',
    },
    {
      id: 'CNT-005',
      reservationId: 'RES-005',
      vehicle: 'Honda Accord',
      startDate: '2025-11-05',
      endDate: '2025-11-07',
      status: 'cancelled',
      totalAmount: '$150',
      terms: 'Standard rental agreement - Cancelled by customer.',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'completed':
        return 'bg-gray-100 text-gray-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleDownload = (contractId: string) => {
    console.log('Downloading contract:', contractId);
  };

  const handlePrint = (contractId: string) => {
    console.log('Printing contract:', contractId);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="mb-2">My Contracts</h1>
        <p className="text-gray-600">View and manage your rental contracts</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rental Contracts</CardTitle>
          <CardDescription>All your rental agreements and contract documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract ID</TableHead>
                  <TableHead>Reservation</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span>{contract.id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{contract.reservationId}</TableCell>
                    <TableCell>{contract.vehicle}</TableCell>
                    <TableCell className="text-gray-600">{contract.startDate}</TableCell>
                    <TableCell className="text-gray-600">{contract.endDate}</TableCell>
                    <TableCell className="text-blue-600">{contract.totalAmount}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(contract.status)}>
                        {contract.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingContract(contract)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(contract.id)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePrint(contract.id)}
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Contract Details Dialog */}
      <Dialog open={!!viewingContract} onOpenChange={() => setViewingContract(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contract Details</DialogTitle>
            <DialogDescription>
              View complete contract information and terms
            </DialogDescription>
          </DialogHeader>
          {viewingContract && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 mb-1">Contract ID</p>
                  <p className="text-gray-900">{viewingContract.id}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Reservation ID</p>
                  <p className="text-gray-900">{viewingContract.reservationId}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Vehicle</p>
                  <p className="text-gray-900">{viewingContract.vehicle}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Status</p>
                  <Badge className={getStatusColor(viewingContract.status)}>
                    {viewingContract.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Start Date</p>
                  <p className="text-gray-900">{viewingContract.startDate}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">End Date</p>
                  <p className="text-gray-900">{viewingContract.endDate}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Total Amount</p>
                  <p className="text-blue-600">{viewingContract.totalAmount}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-gray-900 mb-3">Contract Terms</h3>
                <div className="bg-gray-50 p-4 rounded-lg space-y-3 text-gray-700">
                  <p>{viewingContract.terms}</p>
                  <ul className="list-disc list-inside space-y-2">
                    <li>The renter agrees to return the vehicle in the same condition as received.</li>
                    <li>Any damage to the vehicle will be assessed and charged to the renter.</li>
                    <li>Late returns will incur additional charges at the daily rental rate.</li>
                    <li>Insurance coverage is included as per the selected plan.</li>
                    <li>The renter must possess a valid driver's license at all times.</li>
                    <li>Fuel must be returned at the same level as at pickup.</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => handleDownload(viewingContract.id)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handlePrint(viewingContract.id)}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print Contract
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
