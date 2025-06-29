
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff } from 'lucide-react';
import type { GPS51FormData } from './types';

interface CredentialsFormFieldsProps {
  formData: GPS51FormData;
  showPassword: boolean;
  onTogglePassword: () => void;
  onInputChange: (field: string, value: string) => void;
}

export const CredentialsFormFields: React.FC<CredentialsFormFieldsProps> = ({
  formData,
  showPassword,
  onTogglePassword,
  onInputChange
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="apiUrl">API URL *</Label>
        <Input
          id="apiUrl"
          type="url"
          placeholder="https://api.gps51.com/openapi"
          value={formData.apiUrl}
          onChange={(e) => onInputChange('apiUrl', e.target.value)}
        />
        <p className="text-xs text-gray-500">
          ⚠️ Must use <strong>api.gps51.com/openapi</strong> endpoint (NEW endpoint - /webapi is deprecated)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="from">Platform *</Label>
          <Select value={formData.from} onValueChange={(value: 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN') => onInputChange('from', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WEB">WEB</SelectItem>
              <SelectItem value="ANDROID">ANDROID</SelectItem>
              <SelectItem value="IPHONE">IPHONE</SelectItem>
              <SelectItem value="WEIXIN">WEIXIN</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Login Type *</Label>
          <Select value={formData.type} onValueChange={(value: 'USER' | 'DEVICE') => onInputChange('type', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USER">USER</SelectItem>
              <SelectItem value="DEVICE">DEVICE</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username *</Label>
        <Input
          id="username"
          type="text"
          placeholder="Your GPS51 username"
          value={formData.username}
          onChange={(e) => onInputChange('username', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password *</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Your GPS51 password"
            value={formData.password}
            onChange={(e) => onInputChange('password', e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={onTogglePassword}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          Will be automatically encrypted using MD5 if not already hashed
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="apiKey">API Key (Optional)</Label>
        <Input
          id="apiKey"
          type="text"
          placeholder="Your GPS51 API key (if required)"
          value={formData.apiKey}
          onChange={(e) => onInputChange('apiKey', e.target.value)}
        />
      </div>
    </div>
  );
};
