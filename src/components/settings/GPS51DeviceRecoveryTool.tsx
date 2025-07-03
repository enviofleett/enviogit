import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Wrench, 
  Send, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Zap
} from 'lucide-react';

interface RecoveryAction {
  deviceId: string;
  action: 'sim_check' | 'power_cycle' | 'config_reset' | 'field_service';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  notes?: string;
  scheduledFor?: Date;
}

export const GPS51DeviceRecoveryTool = () => {
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [recoveryActions, setRecoveryActions] = useState<RecoveryAction[]>([]);
  const [bulkAction, setBulkAction] = useState<RecoveryAction['action']>('sim_check');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const actionLabels = {
    sim_check: 'SIM Card Check',
    power_cycle: 'Power Cycle',
    config_reset: 'Configuration Reset',
    field_service: 'Field Service Required'
  };

  const actionDescriptions = {
    sim_check: 'Verify SIM card status, data plan, and connectivity',
    power_cycle: 'Remote or manual power cycle of the device',
    config_reset: 'Reset device configuration to default settings',
    field_service: 'Schedule physical inspection and maintenance'
  };

  const addDeviceForRecovery = () => {
    const deviceId = prompt('Enter GPS51 Device ID:');
    if (deviceId && deviceId.trim()) {
      setSelectedDevices(prev => [...prev, deviceId.trim()]);
    }
  };

  const removeDevice = (deviceId: string) => {
    setSelectedDevices(prev => prev.filter(id => id !== deviceId));
  };

  const executeBulkAction = async () => {
    if (selectedDevices.length === 0) {
      toast({
        title: "No Devices Selected",
        description: "Please add device IDs first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Create recovery actions for each device
      const newActions = selectedDevices.map(deviceId => ({
        deviceId,
        action: bulkAction,
        status: 'pending' as RecoveryAction['status'],
        notes,
        scheduledFor: new Date()
      }));

      // Simulate API call to GPS51 or field service system
      console.log('🔧 Executing recovery actions:', newActions);

      // For SIM check, we can actually test connectivity
      if (bulkAction === 'sim_check') {
        for (const action of newActions) {
          // Try to ping the device through GPS51 API
          try {
            const { data, error } = await supabase.functions.invoke('gps51-sync', {
              body: {
                deviceIds: [action.deviceId],
                action: 'connectivity_test'
              }
            });

            action.status = (error ? 'failed' : 'completed') as RecoveryAction['status'];
            if (error) {
              action.notes = `${action.notes} | Connectivity test failed: ${error.message}`;
            }
          } catch (err) {
            action.status = 'failed' as RecoveryAction['status'];
            action.notes = `${action.notes} | Error: ${err}`;
          }
        }
      } else {
        // For other actions, mark as in_progress
        newActions.forEach(action => {
          action.status = 'in_progress' as RecoveryAction['status'];
        });
      }

      setRecoveryActions(prev => [...prev, ...newActions]);
      setSelectedDevices([]);
      setNotes('');

      toast({
        title: "Recovery Actions Initiated",
        description: `${actionLabels[bulkAction]} scheduled for ${selectedDevices.length} devices`,
      });

    } catch (error) {
      console.error('Recovery action error:', error);
      toast({
        title: "Recovery Action Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: RecoveryAction['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'in_progress':
        return <Zap className="h-4 w-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: RecoveryAction['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'in_progress':
        return <Badge variant="default">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Device Recovery Tool
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Device Selection */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">Selected Devices ({selectedDevices.length})</h4>
            <Button size="sm" variant="outline" onClick={addDeviceForRecovery}>
              Add Device ID
            </Button>
          </div>
          
          {selectedDevices.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedDevices.map(deviceId => (
                <Badge key={deviceId} variant="secondary" className="cursor-pointer" onClick={() => removeDevice(deviceId)}>
                  {deviceId} ×
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Action Selection */}
        <div className="space-y-4">
          <h4 className="font-medium">Recovery Action</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(actionLabels).map(([action, label]) => (
              <div 
                key={action}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  bulkAction === action ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
                onClick={() => setBulkAction(action as RecoveryAction['action'])}
              >
                <div className="font-medium">{label}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {actionDescriptions[action as keyof typeof actionDescriptions]}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <h4 className="font-medium">Notes (Optional)</h4>
          <Textarea
            placeholder="Add any specific instructions or observations..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        {/* Execute Action */}
        <Button 
          onClick={executeBulkAction}
          disabled={loading || selectedDevices.length === 0}
          className="w-full"
        >
          <Send className="h-4 w-4 mr-2" />
          {loading ? 'Executing...' : `Execute ${actionLabels[bulkAction]} for ${selectedDevices.length} device(s)`}
        </Button>

        {/* Recovery Actions History */}
        {recoveryActions.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium">Recovery Actions History</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recoveryActions.map((action, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(action.status)}
                      <span className="font-medium">{action.deviceId}</span>
                      <span className="text-sm text-muted-foreground">
                        {actionLabels[action.action]}
                      </span>
                    </div>
                    {getStatusBadge(action.status)}
                  </div>
                  {action.notes && (
                    <div className="text-sm text-muted-foreground mt-2">
                      {action.notes}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    Scheduled: {action.scheduledFor?.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions Guide */}
        <div className="p-4 bg-muted rounded-lg">
          <h5 className="font-medium mb-2">Quick Recovery Guide</h5>
          <div className="text-sm space-y-1">
            <div><strong>Recently Offline (&lt;24h):</strong> Try SIM Check first, then Power Cycle</div>
            <div><strong>Medium Term (1-7d):</strong> Configuration Reset, check for firmware updates</div>
            <div><strong>Long Term (7-30d):</strong> Field Service required, physical inspection</div>
            <div><strong>Critical (&gt;30d):</strong> Consider device replacement or removal from fleet</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};