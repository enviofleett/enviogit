import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Database, 
  Search, 
  Activity,
  Plus,
  Edit,
  Trash2,
  MapPin,
  Users,
  Building2,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface DatabaseEvent {
  id: string;
  timestamp: string;
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  record: any;
  old_record?: any;
}

const MONITORED_TABLES = [
  { name: 'vehicle_positions', display: 'Vehicle Positions', icon: MapPin },
  { name: 'profiles', display: 'User Profiles', icon: Users },
  { name: 'organizations', display: 'Organizations', icon: Building2 },
];

export const DatabaseActivityMirror = () => {
  const [events, setEvents] = useState<DatabaseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [operationFilter, setOperationFilter] = useState<string>('all');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    setupRealtimeSubscriptions();
    setLoading(false);

    return () => {
      // Cleanup subscriptions
      supabase.removeAllChannels();
    };
  }, []);

  const setupRealtimeSubscriptions = () => {
    MONITORED_TABLES.forEach(table => {
      const channel = supabase
        .channel(`${table.name}_changes`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: table.name
          },
          (payload) => {
            const newEvent: DatabaseEvent = {
              id: `${table.name}_${Date.now()}_${Math.random()}`,
              timestamp: new Date().toISOString(),
              table: table.name,
              operation: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
              record: payload.new || payload.old,
              old_record: payload.old,
            };

            setEvents(prev => [newEvent, ...prev.slice(0, 99)]);
            
            // Show toast notification for significant events
            if (table.name === 'vehicle_positions' && payload.eventType === 'INSERT') {
              toast.info(`New vehicle position recorded`, {
                description: `Device: ${payload.new?.vehicle_id || 'Unknown'}`,
              });
            }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          console.log(`Subscribed to ${table.name} changes`);
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          console.error(`Error subscribing to ${table.name} changes`);
        }
      });
    });
  };

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case 'INSERT':
        return <Plus className="w-4 h-4 text-success" />;
      case 'UPDATE':
        return <Edit className="w-4 h-4 text-warning" />;
      case 'DELETE':
        return <Trash2 className="w-4 h-4 text-destructive" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getOperationBadgeVariant = (operation: string) => {
    switch (operation) {
      case 'INSERT':
        return 'default';
      case 'UPDATE':
        return 'secondary';
      case 'DELETE':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getTableIcon = (tableName: string) => {
    const table = MONITORED_TABLES.find(t => t.name === tableName);
    if (table) {
      const Icon = table.icon;
      return <Icon className="w-4 h-4" />;
    }
    return <Database className="w-4 h-4" />;
  };

  const getTableDisplayName = (tableName: string) => {
    const table = MONITORED_TABLES.find(t => t.name === tableName);
    return table?.display || tableName;
  };

  const formatRecordData = (record: any, operation: string) => {
    if (!record) return 'No data';

    // Show only key fields to avoid clutter
    const keyFields = [];
    
    if (record.id) keyFields.push(`ID: ${record.id}`);
    if (record.latitude && record.longitude) {
      keyFields.push(`Location: ${record.latitude.toFixed(4)}, ${record.longitude.toFixed(4)}`);
    }
    if (record.name) keyFields.push(`Name: ${record.name}`);
    if (record.email) keyFields.push(`Email: ${record.email}`);
    if (record.role) keyFields.push(`Role: ${record.role}`);
    if (record.status) keyFields.push(`Status: ${record.status}`);
    
    return keyFields.length > 0 ? keyFields.join(' • ') : 'Record updated';
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = 
      event.table.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(event.record).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTable = tableFilter === 'all' || event.table === tableFilter;
    const matchesOperation = operationFilter === 'all' || event.operation === operationFilter;
    
    return matchesSearch && matchesTable && matchesOperation;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Setting up real-time monitoring...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
              <span className="text-sm font-medium">
                Real-time Connection {isConnected ? 'Active' : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Activity className="w-4 h-4" />
              <span>{events.length} events recorded</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monitoring Tables */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MONITORED_TABLES.map(table => {
          const tableEvents = events.filter(e => e.table === table.name);
          const recentEvents = tableEvents.slice(0, 5);
          const Icon = table.icon;
          
          return (
            <Card key={table.name}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center space-x-2">
                  <Icon className="w-4 h-4" />
                  <span>{table.display}</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  {tableEvents.length} recent changes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {recentEvents.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    No recent activity
                  </div>
                ) : (
                  recentEvents.map(event => (
                    <div key={event.id} className="flex items-center space-x-2 text-xs">
                      {getOperationIcon(event.operation)}
                      <Badge variant={getOperationBadgeVariant(event.operation)} className="text-xs">
                        {event.operation}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="w-5 h-5" />
            <span>Real-time Database Activity</span>
          </CardTitle>
          <CardDescription>
            Live feed of database changes across monitored tables
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search activity..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by table" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tables</SelectItem>
                {MONITORED_TABLES.map(table => (
                  <SelectItem key={table.name} value={table.name}>
                    {table.display}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={operationFilter} onValueChange={setOperationFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by operation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Operations</SelectItem>
                <SelectItem value="INSERT">Inserts</SelectItem>
                <SelectItem value="UPDATE">Updates</SelectItem>
                <SelectItem value="DELETE">Deletes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {events.length === 0 ? 'Waiting for database activity...' : 'No events match your filters'}
              </div>
            ) : (
              filteredEvents.map(event => (
                <div key={event.id} className="flex items-start space-x-3 p-3 border rounded hover:bg-muted/50 transition-colors">
                  <div className="flex items-center space-x-2 min-w-0">
                    {getTableIcon(event.table)}
                    {getOperationIcon(event.operation)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <Badge variant={getOperationBadgeVariant(event.operation)} className="text-xs">
                        {event.operation}
                      </Badge>
                      <span className="text-sm font-medium">{getTableDisplayName(event.table)}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      {formatRecordData(event.record, event.operation)}
                    </div>
                    
                    {event.operation === 'UPDATE' && event.old_record && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Previous: {formatRecordData(event.old_record, 'previous')}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};