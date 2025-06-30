
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RefreshCw, Search, CheckCircle, AlertCircle } from 'lucide-react';

interface DeviceSearchControlsProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  loading: boolean;
  isAuthenticated: boolean;
  lastSync: Date | null;
}

export const DeviceSearchControls: React.FC<DeviceSearchControlsProps> = ({
  searchTerm,
  onSearchChange,
  onRefresh,
  loading,
  isAuthenticated,
  lastSync
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search devices..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 w-64"
          />
        </div>
        <Button
          onClick={onRefresh}
          disabled={loading || !isAuthenticated}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      <div className="flex items-center space-x-2">
        {lastSync && (
          <span className="text-sm text-muted-foreground">
            Last updated: {lastSync.toLocaleTimeString()}
          </span>
        )}
        {isAuthenticated ? (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        ) : (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Not Connected
          </Badge>
        )}
      </div>
    </div>
  );
};
