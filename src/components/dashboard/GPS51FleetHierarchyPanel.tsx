import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TreePine, Search, Users, Car, Building, MapPin } from 'lucide-react';
import { gps51ProductionService } from '@/services/gps51/GPS51ProductionService';
import { gps51GroupManager, GPS51Group } from '@/services/gps51/GPS51GroupManager';
import { EnvioUserRole } from '@/services/gps51/GPS51UserTypeManager';

export const GPS51FleetHierarchyPanel: React.FC = () => {
  const [fleetHierarchy, setFleetHierarchy] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const updateHierarchy = () => {
      const serviceStatus = gps51ProductionService.getServiceStatus();
      const hierarchy = gps51ProductionService.getFleetHierarchy();
      
      setFleetHierarchy(hierarchy);
    };

    updateHierarchy();
    const interval = setInterval(updateHierarchy, 10000);

    return () => clearInterval(interval);
  }, []);

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const renderGroup = (group: GPS51Group, level = 0) => {
    const isExpanded = expandedGroups.has(group.groupid);
    const hasSubGroups = group.subGroups && group.subGroups.length > 0;
    const indent = level * 20;

    return (
      <div key={group.groupid} className="space-y-1">
        <div 
          className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50 ${
            selectedGroup === group.groupid ? 'bg-muted' : ''
          }`}
          style={{ marginLeft: `${indent}px` }}
          onClick={() => {
            setSelectedGroup(group.groupid);
            if (hasSubGroups) toggleGroup(group.groupid);
          }}
        >
          <div className="flex items-center gap-2 flex-1">
            {hasSubGroups && (
              <span className="text-xs">
                {isExpanded ? '▼' : '▶'}
              </span>
            )}
            <Building className="h-4 w-4 text-blue-600" />
            <span className="font-medium">{group.groupname}</span>
            <Badge variant="outline" className="text-xs">
              {group.devices.length} devices
            </Badge>
          </div>
        </div>

        {/* Show devices in this group */}
        {isExpanded && group.devices.map(device => (
          <div 
            key={device.deviceid}
            className="flex items-center gap-2 p-2 rounded hover:bg-muted/30"
            style={{ marginLeft: `${indent + 20}px` }}
          >
            <Car className="h-3 w-3 text-green-600" />
            <span className="text-sm">{device.devicename}</span>
            <Badge variant="secondary" className="text-xs">
              {device.deviceid}
            </Badge>
          </div>
        ))}

        {/* Render sub-groups */}
        {isExpanded && hasSubGroups && group.subGroups!.map(subGroup => 
          renderGroup(subGroup, level + 1)
        )}
      </div>
    );
  };

  const filteredGroups = fleetHierarchy?.userAccessibleGroups?.filter((group: GPS51Group) =>
    group.groupname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.devices.some(device => 
      device.devicename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.deviceid.toLowerCase().includes(searchQuery.toLowerCase())
    )
  ) || [];

  const stats = fleetHierarchy ? gps51GroupManager.getFleetStatistics() : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TreePine className="h-5 w-5" />
          Fleet Hierarchy
          <Badge variant="outline" className="ml-auto">
            Phase 5
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search groups and devices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Fleet Statistics */}
        {stats && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 border rounded">
              <div className="text-lg font-semibold">{stats.totalGroups}</div>
              <div className="text-xs text-muted-foreground">Groups</div>
            </div>
            <div className="p-2 border rounded">
              <div className="text-lg font-semibold">{stats.totalDevices}</div>
              <div className="text-xs text-muted-foreground">Devices</div>
            </div>
            <div className="p-2 border rounded">
              <div className="text-lg font-semibold">{stats.groupHierarchyDepth}</div>
              <div className="text-xs text-muted-foreground">Max Depth</div>
            </div>
          </div>
        )}

        {/* Hierarchy Tree */}
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {!fleetHierarchy ? (
            <div className="text-center py-8 text-muted-foreground">
              <TreePine className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No fleet hierarchy available</p>
              <p className="text-xs">Authenticate with GPS51 to load fleet data</p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No groups found</p>
              {searchQuery && <p className="text-xs">Try a different search term</p>}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredGroups.map((group: GPS51Group) => renderGroup(group))}
            </div>
          )}
        </div>

        {/* Selected Group Details */}
        {selectedGroup && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Group Details</h4>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Group ID: {selectedGroup}</div>
              <div>
                Devices: {filteredGroups.find((g: GPS51Group) => g.groupid === selectedGroup)?.devices.length || 0}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedGroups(new Set(filteredGroups.map((g: GPS51Group) => g.groupid)))}
            className="flex items-center gap-1"
          >
            <TreePine className="h-3 w-3" />
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedGroups(new Set())}
            className="flex items-center gap-1"
          >
            <TreePine className="h-3 w-3" />
            Collapse All
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};