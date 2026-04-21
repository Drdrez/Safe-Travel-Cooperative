import { Car, Calendar, AlertCircle, XCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface DashboardProps {
  onNavigate: (screen: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const stats = [
    {
      title: 'Active Reservations',
      value: '2',
      icon: Car,
      color: 'bg-blue-50 text-blue-600',
      description: 'Currently renting',
      action: 'View All',
      screen: 'reservations',
    },
    {
      title: 'Upcoming Trips',
      value: '3',
      icon: Calendar,
      color: 'bg-green-50 text-green-600',
      description: 'Scheduled rentals',
      action: 'View All',
      screen: 'reservations',
    },
    {
      title: 'Outstanding Payments',
      value: '$245',
      icon: AlertCircle,
      color: 'bg-orange-50 text-orange-600',
      description: 'Due within 7 days',
      action: 'Pay Now',
      screen: 'payments',
    },
    {
      title: 'Canceled Bookings',
      value: '1',
      icon: XCircle,
      color: 'bg-gray-50 text-gray-600',
      description: 'This month',
      action: 'View History',
      screen: 'reservations',
    },
  ];

  const recentActivity = [
    {
      id: 'RES-001',
      vehicle: 'Tesla Model 3',
      status: 'active',
      startDate: '2025-11-08',
      endDate: '2025-11-12',
      amount: '$320',
    },
    {
      id: 'RES-002',
      vehicle: 'BMW X5',
      status: 'upcoming',
      startDate: '2025-11-15',
      endDate: '2025-11-20',
      amount: '$550',
    },
    {
      id: 'RES-003',
      vehicle: 'Toyota Camry',
      status: 'upcoming',
      startDate: '2025-11-22',
      endDate: '2025-11-25',
      amount: '$180',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'upcoming':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-8 text-white">
        <h1 className="mb-2">Welcome back, Sarah!</h1>
        <p className="text-blue-100">
          Manage your reservations, view contracts, and track your rental history all in one place.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-gray-600">{stat.title}</CardTitle>
                <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                  <Icon className="w-6 h-6" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-1">{stat.value}</div>
                <p className="text-gray-500 mb-4">{stat.description}</p>
                <Button
                  variant="link"
                  className="p-0 h-auto text-blue-600"
                  onClick={() => onNavigate(stat.screen)}
                >
                  {stat.action} <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest reservations and bookings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-4 mb-3 md:mb-0">
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Car className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-gray-900">{activity.vehicle}</span>
                      <Badge className={getStatusColor(activity.status)}>
                        {activity.status}
                      </Badge>
                    </div>
                    <p className="text-gray-500">
                      {activity.startDate} to {activity.endDate}
                    </p>
                    <p className="text-gray-500">ID: {activity.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-blue-600">{activity.amount}</span>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">Ready to Book?</CardTitle>
            <CardDescription className="text-blue-700">
              Browse our fleet and reserve your next vehicle
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => onNavigate('reservations')}>
              New Reservation
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-green-900">Need Help?</CardTitle>
            <CardDescription className="text-green-700">
              Our support team is here to assist you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-100">
              Contact Support
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
