import { useState } from 'react';
import { Car, Calendar, FileText, X, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const initialReservations = [
  {
    id: 'RES-001',
    vehicle: 'Tesla Model 3',
    image: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=400&h=300&fit=crop',
    startDate: '2025-11-08',
    endDate: '2025-11-12',
    status: 'active',
    contractId: 'CNT-001',
    price: '$320',
  },
  {
    id: 'RES-002',
    vehicle: 'BMW X5',
    image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=400&h=300&fit=crop',
    startDate: '2025-11-15',
    endDate: '2025-11-20',
    status: 'upcoming',
    contractId: 'CNT-002',
    price: '$550',
  },
  {
    id: 'RES-003',
    vehicle: 'Toyota Camry',
    image: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400&h=300&fit=crop',
    startDate: '2025-11-22',
    endDate: '2025-11-25',
    status: 'upcoming',
    contractId: 'CNT-003',
    price: '$180',
  },
  {
    id: 'RES-004',
    vehicle: 'Mercedes-Benz C-Class',
    image: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=400&h=300&fit=crop',
    startDate: '2025-10-20',
    endDate: '2025-10-25',
    status: 'completed',
    contractId: 'CNT-004',
    price: '$450',
  },
  {
    id: 'RES-005',
    vehicle: 'Honda Accord',
    image: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=400&h=300&fit=crop',
    startDate: '2025-11-05',
    endDate: '2025-11-07',
    status: 'cancelled',
    contractId: 'CNT-005',
    price: '$150',
  },
];

const availableVehicles = [
  { id: 'VEH-001', name: 'Tesla Model 3', price: '$80/day', image: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=400&h=300&fit=crop' },
  { id: 'VEH-002', name: 'BMW X5', price: '$110/day', image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=400&h=300&fit=crop' },
  { id: 'VEH-003', name: 'Toyota Camry', price: '$60/day', image: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400&h=300&fit=crop' },
  { id: 'VEH-004', name: 'Mercedes-Benz C-Class', price: '$90/day', image: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=400&h=300&fit=crop' },
  { id: 'VEH-005', name: 'Honda Accord', price: '$50/day', image: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=400&h=300&fit=crop' },
];

export default function MyReservations() {
  const [reservationsList, setReservationsList] = useState(initialReservations);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<string | null>(null);
  const [showNewReservation, setShowNewReservation] = useState(false);

  const [newRes, setNewRes] = useState({ vehicleId: '', startDate: '', endDate: '' });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'upcoming':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-gray-100 text-gray-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleCancelReservation = (id: string) => {
    setSelectedReservation(id);
    setShowCancelDialog(true);
  };

  const confirmCancel = () => {
    if (selectedReservation) {
      setReservationsList(prev => prev.map(res => 
        res.id === selectedReservation ? { ...res, status: 'cancelled' } : res
      ));
    }
    setShowCancelDialog(false);
    setSelectedReservation(null);
  };

  const createReservation = () => {
    if (!newRes.vehicleId || !newRes.startDate || !newRes.endDate) return;

    const vh = availableVehicles.find(v => v.id === newRes.vehicleId);
    if (!vh) return;

    const newId = `RES-00${reservationsList.length + 1}`;
    setReservationsList([
      {
        id: newId,
        vehicle: vh.name,
        image: vh.image,
        startDate: newRes.startDate,
        endDate: newRes.endDate,
        status: 'upcoming',
        contractId: `CNT-00${reservationsList.length + 1}`,
        price: '₹TBD', // In a real app calculate days * daily price
      },
      ...reservationsList
    ]);

    setShowNewReservation(false);
    setNewRes({ vehicleId: '', startDate: '', endDate: '' });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="mb-2">My Reservations</h1>
          <p className="text-gray-600">Manage your current and upcoming vehicle reservations</p>
        </div>
        <Dialog open={showNewReservation} onOpenChange={setShowNewReservation}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              New Reservation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Reservation</DialogTitle>
              <DialogDescription>
                Select a vehicle and choose your rental dates
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle">Select Vehicle</Label>
                <Select value={newRes.vehicleId} onValueChange={v => setNewRes({...newRes, vehicleId: v})}>
                  <SelectTrigger id="vehicle">
                    <SelectValue placeholder="Choose a vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.name} - {vehicle.price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input id="startDate" type="date" value={newRes.startDate} onChange={e => setNewRes({...newRes, startDate: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input id="endDate" type="date" value={newRes.endDate} onChange={e => setNewRes({...newRes, endDate: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-4">
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={createReservation} disabled={!newRes.vehicleId || !newRes.startDate || !newRes.endDate}>
                  Create Reservation
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setShowNewReservation(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {reservationsList.map((reservation) => (
          <Card key={reservation.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-48 h-32 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={reservation.image}
                    alt={reservation.vehicle}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-gray-900">{reservation.vehicle}</h3>
                        <Badge className={getStatusColor(reservation.status)}>
                          {reservation.status}
                        </Badge>
                      </div>
                      <p className="text-gray-500">Reservation ID: {reservation.id}</p>
                    </div>
                    <div className="text-blue-600">{reservation.price}</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>Start: {reservation.startDate}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>End: {reservation.endDate}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    {reservation.status !== 'cancelled' && reservation.status !== 'completed' && (
                      <>
                        <Button variant="outline" size="sm">
                          <FileText className="w-4 h-4 mr-2" />
                          View Contract
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleCancelReservation(reservation.id)}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel Reservation
                        </Button>
                      </>
                    )}
                    {reservation.status === 'completed' && (
                      <Button variant="outline" size="sm">
                        <FileText className="w-4 h-4 mr-2" />
                        View Receipt
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Reservation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this reservation? This action cannot be undone. 
              Please review our cancellation policy for any applicable fees.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Reservation</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              className="bg-red-600 hover:bg-red-700"
            >
              Cancel Reservation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
