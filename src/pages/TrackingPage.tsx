import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, Users, Activity } from 'lucide-react';
import { useGPS51DirectVehicles } from '@/hooks/useGPS51DirectVehicles';
import { MapContainer } from '@/components/tracking/MapContainer';
import { VehicleListSidebar } from '@/components/tracking/VehicleListSidebar';
import { VehicleDetailsPanel } from '@/components/tracking/VehicleDetailsPanel';
import type { GPS51Device } from '@/services/gps51/direct';

const TrackingPage = () => {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const { state, actions, hasVehicles, isReady } = useGPS51DirectVehicles({
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
    onError: (error) => console.error('Vehicle data error:', error)
  });

  const selectedVehicle = selectedVehicleId 
    ? actions.getVehicleById(selectedVehicleId) 
    : null;

  const filteredVehicles = state.vehicles.filter(vehicle =>
    vehicle.devicename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vehicle.deviceid.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleVehicleSelect = (vehicle: GPS51Device) => {
    setSelectedVehicleId(vehicle.deviceid);
  };

  const handleShowAllVehicles = () => {
    setSelectedVehicleId(null);
  };

  const getStatusCounts = () => {
    const now = Date.now();
    const fourHoursAgo = now - (4 * 60 * 60 * 1000);
    const thirtyMinutesAgo = now - (30 * 60 * 1000);

    return {
      total: state.vehicles.length,
      online: state.vehicles.filter(v => v.lastactivetime && v.lastactivetime > fourHoursAgo).length,
      moving: state.vehicles.filter(v => {
        const lastActiveTime = v.lastactivetime || 0;
        return lastActiveTime > thirtyMinutesAgo && (v.speed || 0) > 5;
      }).length,
      parked: state.vehicles.filter(v => {
        const lastActiveTime = v.lastactivetime || 0;
        return lastActiveTime > thirtyMinutesAgo && (v.speed || 0) <= 5;
      }).length
    };
  };

  const statusCounts = getStatusCounts();

  if (!isReady && state.isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading vehicle tracking...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Vehicle List Sidebar */}
      <div className={`${isSidebarCollapsed ? 'w-0' : 'w-80'} transition-all duration-300 border-r border-border bg-card`}>
        <VehicleListSidebar
          vehicles={filteredVehicles}
          selectedVehicleId={selectedVehicleId}
          onVehicleSelect={handleVehicleSelect}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusCounts={statusCounts}
          isLoading={state.isLoading}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-16 px-4 border-b border-border bg-card flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Vehicle Tracking</h1>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {statusCounts.online}/{statusCounts.total} Online
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                {statusCounts.moving} Moving
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => actions.refresh(true)}
              disabled={state.isRefreshing}
            >
              {state.isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShowAllVehicles}
            >
              Show All
            </Button>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          <MapContainer
            vehicles={state.vehicles}
            selectedVehicle={selectedVehicle}
            onVehicleSelect={handleVehicleSelect}
          />
        </div>

        {/* Vehicle Details Panel */}
        {selectedVehicle && (
          <div className="h-64 border-t border-border bg-card">
            <VehicleDetailsPanel
              vehicle={selectedVehicle}
              onClose={() => setSelectedVehicleId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackingPage;