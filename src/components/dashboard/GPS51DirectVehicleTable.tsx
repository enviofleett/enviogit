import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, MapPin, Activity, Car, Clock, Signal, Navigation } from 'lucide-react';
import type { GPS51Device, GPS51Position } from '@/services/gps51/direct';

interface GPS51DirectVehicleTableProps {
  vehicles: GPS51Device[];
  positions: GPS51Position[];
  isLoading?: boolean;
  onVehicleSelect?: (vehicleId: string) => void;
  className?: string;
}

export const GPS51DirectVehicleTable: React.FC<GPS51DirectVehicleTableProps> = ({
  vehicles,
  positions,
  isLoading = false,
  onVehicleSelect,
  className
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'lastActive' | 'status'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Create position lookup map
  const positionMap = useMemo(() => {
    const map = new Map<string, GPS51Position>();
    positions.forEach(position => {
      const existing = map.get(position.deviceid);
      if (!existing || position.updatetime > existing.updatetime) {
        map.set(position.deviceid, position);
      }
    });
    return map;
  }, [positions]);

  // Enhanced vehicle data with positions
  const enhancedVehicles = useMemo(() => {
    return vehicles.map(vehicle => ({
      ...vehicle,
      position: positionMap.get(vehicle.deviceid)
    }));
  }, [vehicles, positionMap]);

  // Filter vehicles based on search
  const filteredVehicles = useMemo(() => {
    if (!searchTerm) return enhancedVehicles;
    
    const searchLower = searchTerm.toLowerCase();
    return enhancedVehicles.filter(vehicle =>
      vehicle.devicename.toLowerCase().includes(searchLower) ||
      vehicle.deviceid.toLowerCase().includes(searchLower) ||
      vehicle.devicetype.toLowerCase().includes(searchLower) ||
      (vehicle.simnum && vehicle.simnum.toLowerCase().includes(searchLower))
    );
  }, [enhancedVehicles, searchTerm]);

  // Sort vehicles
  const sortedVehicles = useMemo(() => {
    const sorted = [...filteredVehicles];
    
    sorted.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'name':
          aValue = a.devicename.toLowerCase();
          bValue = b.devicename.toLowerCase();
          break;
        case 'lastActive':
          aValue = a.lastactivetime || 0;
          bValue = b.lastactivetime || 0;
          break;
        case 'status':
          aValue = a.position?.moving || 0;
          bValue = b.position?.moving || 0;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [filteredVehicles, sortBy, sortOrder]);

  // Helper functions
  const formatLastActive = (timestamp: number) => {
    if (!timestamp) return 'Never';
    
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (60 * 1000));
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  const getVehicleStatus = (vehicle: typeof enhancedVehicles[0]) => {
    const now = Date.now();
    const thirtyMinutesAgo = now - (30 * 60 * 1000);
    const fourHoursAgo = now - (4 * 60 * 60 * 1000);
    
    if (!vehicle.lastactivetime) {
      return { status: 'Unknown', color: 'bg-gray-500', text: 'text-gray-100' };
    }
    
    if (vehicle.lastactivetime > thirtyMinutesAgo) {
      if (vehicle.position?.moving) {
        return { status: 'Moving', color: 'bg-green-500', text: 'text-green-100' };
      }
      return { status: 'Online', color: 'bg-blue-500', text: 'text-blue-100' };
    }
    
    if (vehicle.lastactivetime > fourHoursAgo) {
      return { status: 'Recently Active', color: 'bg-yellow-500', text: 'text-yellow-100' };
    }
    
    return { status: 'Offline', color: 'bg-red-500', text: 'text-red-100' };
  };

  const formatLocation = (position?: GPS51Position) => {
    if (!position || !position.callat || !position.callon) {
      return 'No location';
    }
    
    return `${position.callat.toFixed(4)}, ${position.callon.toFixed(4)}`;
  };

  const formatSpeed = (position?: GPS51Position) => {
    if (!position || position.speed === undefined) {
      return '-';
    }
    
    return `${Math.round(position.speed)} km/h`;
  };

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (column: typeof sortBy) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Car className="w-5 h-5" />
              <span>Vehicle Fleet</span>
            </CardTitle>
            <CardDescription>
              {sortedVehicles.length} of {vehicles.length} vehicles
              {searchTerm && ` matching "${searchTerm}"`}
            </CardDescription>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vehicles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="max-h-[500px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Vehicle</span>
                    <span className="text-xs">{getSortIcon('name')}</span>
                  </div>
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    <span className="text-xs">{getSortIcon('status')}</span>
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort('lastActive')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Last Active</span>
                    <span className="text-xs">{getSortIcon('lastActive')}</span>
                  </div>
                </TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Speed</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-muted-foreground">Loading vehicles...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedVehicles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchTerm ? 'No vehicles match your search' : 'No vehicles found'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedVehicles.map((vehicle) => {
                  const status = getVehicleStatus(vehicle);
                  const position = vehicle.position;
                  
                  return (
                    <TableRow key={vehicle.deviceid} className="hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <div>
                          <div className="font-medium">{vehicle.devicename}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {vehicle.deviceid}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {vehicle.devicetype}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <Badge className={`${status.color} ${status.text} text-xs`}>
                          {status.status}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center space-x-1 text-sm">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span>{formatLastActive(vehicle.lastactivetime)}</span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">
                          {position ? (
                            <div className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              <span className="font-mono text-xs">
                                {formatLocation(position)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No location</span>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">
                          {position?.moving ? (
                            <div className="flex items-center space-x-1">
                              <Navigation className="w-3 h-3 text-green-600" />
                              <span className="font-medium">{formatSpeed(position)}</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1">
                              <Activity className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Stationary</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onVehicleSelect?.(vehicle.deviceid)}
                          className="h-8 px-2"
                        >
                          <MapPin className="w-3 h-3 mr-1" />
                          Locate
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
  );
};