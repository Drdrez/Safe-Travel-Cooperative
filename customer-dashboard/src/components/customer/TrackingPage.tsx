import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, RefreshCw, Phone, Shield, Activity, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const vehicleIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `
    <div style="background: var(--slate-900); padding: 8px 12px; border-radius: 20px; display: flex; align-items: center; gap: 8px; box-shadow: var(--shadow-lg); white-space: nowrap; transform: translate(-50%, -100%); margin-top: -10px;">
       <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
       <span style="color: white; font-size: 10px; font-weight: 800;">PH-ST 1092</span>
    </div>
  `,
  iconSize: [0, 0],
  iconAnchor: [0, 0]
});

const destinationIcon = L.divIcon({
    className: 'custom-destination-icon',
    html: `
      <div style="color: var(--brand-gold); transform: translate(-50%, -100%);">
         <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
});

export default function TrackingPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(72);
  const [currentPos, setCurrentPos] = useState<[number, number]>([14.5583, 121.0314]);
  const simulationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
        simulationRef.current = null;
      }
    };
  }, []);
  const pickup: [number, number] = [14.6560, 121.0437];
  const destination: [number, number] = [14.5083, 121.0194];

  const trackingData = {
    reservationId: 'RES-XJ928',
    vehicleNumber: 'PH-ST 1092',
    driverName: 'Ricardo Santos',
    driverPhone: '+63 917 888 2026',
    currentLocation: progress < 90 ? 'Skyway Stage 3, QC' : 'Near NAIA Terminal 3',
    destinationName: 'NAIA Terminal 3, Pasay City',
    status: progress < 100 ? 'In Transit' : 'Arrived',
    estimatedArrival: progress < 100 ? `${Math.round((100 - progress) / 2)} mins` : 'Arrived',
    lastUpdate: 'Just now',
    eta: '11:45 AM'
  };

  const clearSimulation = () => {
    if (simulationRef.current) {
      clearInterval(simulationRef.current);
      simulationRef.current = null;
    }
  };

  const startSimulation = () => {
    if (isSimulating) return;
    clearSimulation();
    setIsSimulating(true);
    setProgress(0);
    setCurrentPos(pickup);
    toast.success('Simulation Started: Driver Ricardo is heading to Destination');

    let currentProgress = 0;
    simulationRef.current = setInterval(() => {
        currentProgress += 1;
        setProgress(currentProgress);

        const lat = pickup[0] + (destination[0] - pickup[0]) * (currentProgress / 100);
        const lng = pickup[1] + (destination[1] - pickup[1]) * (currentProgress / 100);
        setCurrentPos([lat, lng]);

        if (currentProgress >= 100) {
            clearSimulation();
            setIsSimulating(false);
            toast.success('Simulation Complete: Unit has reached destination');
        }
    }, 150);
  };

  const startArrivalSimulation = () => {
    if (isSimulating) return;
    clearSimulation();
    setIsSimulating(true);
    setProgress(0);

    const stagingCoords: [number, number] = [pickup[0] + 0.015, pickup[1] + 0.015];
    setCurrentPos(stagingCoords);
    toast.info('Driver Update: Ricardo is heading to your pickup location');

    let currentProgress = 0;
    simulationRef.current = setInterval(() => {
        currentProgress += 1;
        setProgress(currentProgress);

        const lat = stagingCoords[0] + (pickup[0] - stagingCoords[0]) * (currentProgress / 100);
        const lng = stagingCoords[1] + (pickup[1] - stagingCoords[1]) * (currentProgress / 100);
        setCurrentPos([lat, lng]);

        if (currentProgress === 80) {
            toast.success('Your driver is just 2 minutes away!');
        }

        if (currentProgress >= 100) {
            clearSimulation();
            setIsSimulating(false);
            toast.success('Your driver has arrived at the pickup location!');
        }
    }, 150);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    toast.info('Synchronizing GPS coordinates...');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsRefreshing(false);
    toast.success('Live position updated');
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="page-header">
        <div>
          <h1>Track My Trip</h1>
          <p>Real-time vehicle location and trip status for your safety.</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
           <button onClick={startArrivalSimulation} disabled={isSimulating} className="btn btn-outline btn-sm" style={{ border: '1px solid var(--emerald-200)', color: 'var(--emerald-600)' }}>
             <Navigation size={14} className={isSimulating ? 'animate-pulse' : ''} /> Simulate Arrival
           </button>
           <button onClick={startSimulation} disabled={isSimulating} className="btn btn-brand btn-sm">
             <Activity size={14} className={isSimulating ? 'animate-pulse' : ''} /> Live Trip Simulation
           </button>
           <button onClick={handleRefresh} disabled={isRefreshing} className="btn btn-outline btn-sm">
             <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> Refresh Map
           </button>
        </div>
      </div>

      <div className="customer-tracking-layout">
        {/* Left Column: Status & Driver */}
        <div className="space-y-6">
           {/* Progress Card */}
           <div className="card" style={{ padding: 24 }}>
              <div className="tracking-progress-header" style={{ marginBottom: 20 }}>
                 <div>
                    <span className="status-badge" style={{ marginBottom: 4, background: 'var(--brand-gold-light)', color: 'var(--brand-gold-dark)' }}>{trackingData.status}</span>
                    <h3 style={{ fontSize: 20, fontWeight: 800 }}>{isSimulating ? 'Simulating Trip...' : 'Track My Journey'}</h3>
                 </div>
                 <div>
                    <p style={{ fontSize: 11, color: 'var(--slate-400)', textTransform: 'uppercase' }}>Trip ID</p>
                    <p style={{ fontWeight: 800 }}>{trackingData.reservationId}</p>
                 </div>
              </div>

              <div className="space-y-4">
                 <div style={{ width: '100%', height: 8, background: 'var(--slate-100)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: 'var(--brand-gold)', borderRadius: 4, transition: 'width 0.15s linear' }} />
                 </div>
                 <div className="flex-between">
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-500)' }}>Current Progress</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand-gold-dark)' }}>{progress}% Complete</span>
                 </div>
              </div>

              <div className="customer-modal-grid-2" style={{ marginTop: 24 }}>
                 <div style={{ padding: 16, background: 'var(--slate-50)', borderRadius: 12 }}>
                    <p style={{ fontSize: 11, color: 'var(--slate-400)', marginBottom: 4 }}>ETA</p>
                    <p style={{ fontSize: 16, fontWeight: 800 }}>{trackingData.eta}</p>
                 </div>
                 <div style={{ padding: 16, background: 'var(--slate-50)', borderRadius: 12 }}>
                    <p style={{ fontSize: 11, color: 'var(--slate-400)', marginBottom: 4 }}>Remaining</p>
                    <p style={{ fontSize: 16, fontWeight: 800 }}>{trackingData.estimatedArrival}</p>
                 </div>
              </div>
           </div>

           {/* Driver Card */}
           <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
                 <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--slate-100)', overflow: 'hidden', border: '2px solid var(--brand-gold)' }}>
                    <img src={`https://ui-avatars.com/api/?name=${trackingData.driverName}&background=EAB308&color=fff`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                 </div>
                 <div>
                    <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>{trackingData.driverName}</h4>
                    <p style={{ fontSize: 12, color: 'var(--slate-500)' }}>Safe Travel Cooperative Driver</p>
                    <div className="flex-start" style={{ gap: 4, marginTop: 4 }}>
                       <Shield size={12} className="text-brand-gold" />
                       <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-gold-dark)' }}>Verified Driver</span>
                    </div>
                 </div>
              </div>
              <div className="customer-driver-actions">
                 <button className="btn btn-outline w-full" style={{ gap: 8 }}>
                    <MessageSquare size={16} /> Chat
                 </button>
                 <button 
                  className="btn btn-brand w-full" 
                  style={{ gap: 8 }}
                  onClick={() => window.location.href = `tel:${trackingData.driverPhone}`}
                 >
                    <Phone size={16} /> Contact
                 </button>
              </div>
           </div>
        </div>

        {/* Right Column: Live Map & Location Details */}
        <div className="space-y-6">
           <div className="card customer-tracking-map-card" style={{ padding: 0, position: 'relative', overflow: 'hidden', border: '1px solid var(--slate-200)', zIndex: 0 }}>
              <MapContainer 
                center={currentPos} 
                zoom={12} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                
                {/* Destination Marker */}
                <Marker position={destination} icon={destinationIcon}>
                    <Popup>Destination: {trackingData.destinationName}</Popup>
                </Marker>

                {/* Vehicle Marker */}
                <Marker position={currentPos} icon={vehicleIcon}>
                    <Popup>Current Location: {trackingData.currentLocation}</Popup>
                </Marker>

                <ZoomControl position="bottomright" />
              </MapContainer>
              
              <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 1000 }}>
                 <div className="flex-start" style={{ background: 'white', padding: '8px 12px', borderRadius: 20, boxShadow: 'var(--shadow-md)', border: '1px solid var(--slate-100)' }}>
                    <Activity size={14} className={isSimulating ? "text-emerald-500 animate-pulse" : "text-slate-300"} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {isSimulating ? 'GPS Live Feed' : 'GPS Standby'}
                    </span>
                 </div>
              </div>
           </div>

           <div className="card" style={{ padding: 24 }}>
              <h4 style={{ fontSize: 14, fontWeight: 800, marginBottom: 20, color: 'var(--slate-900)' }}>Location Details</h4>
              <div className="space-y-6">
                 <div className="flex-start" style={{ alignItems: 'flex-start' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--slate-300)', marginTop: 4 }} />
                    <div style={{ paddingLeft: 16 }}>
                       <p style={{ fontSize: 11, color: 'var(--slate-400)', textTransform: 'uppercase' }}>Starting Point</p>
                       <p style={{ fontSize: 14, fontWeight: 700 }}>{trackingData.currentLocation}</p>
                    </div>
                 </div>
                 <div className="flex-start" style={{ alignItems: 'flex-start' }}>
                    <MapPin className="text-brand-gold" size={16} style={{ marginTop: 2 }} />
                    <div style={{ paddingLeft: 12 }}>
                       <p style={{ fontSize: 11, color: 'var(--slate-400)', textTransform: 'uppercase' }}>Final Destination</p>
                       <p style={{ fontSize: 14, fontWeight: 700 }}>{trackingData.destinationName}</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function ZoomControl({ position }: { position: L.ControlPosition }) {
    const map = useMap();
    useEffect(() => {
        const control = L.control.zoom({ position });
        control.addTo(map);
        return () => { control.remove(); };
    }, [map, position]);
    return null;
}