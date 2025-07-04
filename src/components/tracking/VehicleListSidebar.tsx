import { Search, Users, Activity, Car, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GPS51Device } from '@/services/gps51/direct';

interface VehicleListSidebarProps {
  vehicles: GPS51Device[];
  selectedVehicleId: string | null;
  onVehicleSelect: (vehicle: GPS51Device) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusCounts: {
    total: number;
    online: number;
    moving: number;
    parked: number;
  };
  isLoading: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const VehicleListSidebar = ({
  vehicles,
  selectedVehicleId,
  onVehicleSelect,
  searchQuery,
  onSearchChange,
  statusCounts,
  isLoading,
  isCollapsed,
  onToggleCollapse
}: VehicleListSidebarProps) => {
  const getVehicleStatus = (vehicle: GPS51Device): 'online' | 'idle' | 'offline' => {
    const now = Date.now();
    const lastActiveTime = vehicle.lastactivetime || 0;
    const minutesSinceUpdate = (now - lastActiveTime) / (1000 * 60);
    
    if (minutesSinceUpdate > 240) return 'offline'; // 4 hours
    if ((vehicle.speed || 0) > 5) return 'online';
    return 'idle';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return '🟢';
      case 'idle': return '🟡';
      case 'offline': return '🔴';
      default: return '⚪';
    }
  };

  const formatLastUpdate = (timestamp: number | undefined) => {
    if (!timestamp) return 'No data';
    
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  };

  if (isCollapsed) {
    return (
      <div className="w-12 flex flex-col items-center py-4 border-r border-border bg-card">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="mb-4"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="writing-vertical-rl transform rotate-180 text-sm text-muted-foreground">
          Vehicles
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Vehicles</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vehicles..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 border-b border-border">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
            <Users className="h-4 w-4 text-blue-600" />
            <div>
              <div className="text-xs text-muted-foreground">Online</div>
              <div className="font-semibold">{statusCounts.online}/{statusCounts.total}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
            <Activity className="h-4 w-4 text-green-600" />
            <div>
              <div className="text-xs text-muted-foreground">Moving</div>
              <div className="font-semibold">{statusCounts.moving}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-muted rounded-md"></div>
                </div>
              ))}
            </div>
          ) : vehicles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No vehicles found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {vehicles.map((vehicle) => {
                const status = getVehicleStatus(vehicle);
                const isSelected = selectedVehicleId === vehicle.deviceid;
                
                return (
                  <Card
                    key={vehicle.deviceid}
                    className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                      isSelected 
                        ? 'ring-2 ring-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => onVehicleSelect(vehicle)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">{getStatusIcon(status)}</span>
                            <h3 className="font-medium text-sm truncate">
                              {vehicle.devicename || `Device ${vehicle.deviceid}`}
                            </h3>
                          </div>
                          
                          <p className="text-xs text-muted-foreground truncate mb-1">
                            ID: {vehicle.deviceid}
                          </p>
                          
                          <div className="flex items-center gap-2 text-xs">
                            <Badge 
                              variant={status === 'online' ? 'default' : status === 'idle' ? 'secondary' : 'destructive'}
                              className="text-xs px-1 py-0"
                            >
                              {status}
                            </Badge>
                            
                            {vehicle.speed !== undefined && (
                              <span className="text-muted-foreground">
                                {Math.round(vehicle.speed)} mph
                              </span>
                            )}
                          </div>
                          
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatLastUpdate(vehicle.lastactivetime)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};