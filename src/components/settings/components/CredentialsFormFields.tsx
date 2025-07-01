
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff } from 'lucide-react';

interface FormData {
  apiUrl: string;
  username: string;
  password: string;
  from: string;
  type: string;
}

interface CredentialsFormFieldsProps {
  formData: FormData;
  showPassword: boolean;
  onInputChange: (field: keyof FormData, value: string) => void;
  onTogglePassword: () => void;
}

export const CredentialsFormFields: React.FC<CredentialsFormFieldsProps> = ({
  formData,
  showPassword,
  onInputChange,
  onTogglePassword
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="apiUrl">GPS51 API URL</Label>
        <Input
          id="apiUrl"
          type="url"
          value={formData.apiUrl}
          onChange={(e) => onInputChange('apiUrl', e.target.value)}
          placeholder="https://api.gps51.com/openapi"
        />
        <p className="text-xs text-gray-500">
          The GPS51 API endpoint URL (use /openapi endpoint)
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          type="text"
          value={formData.username}
          onChange={(e) => onInputChange('username', e.target.value)}
          placeholder="Your GPS51 username"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(e) => onInputChange('password', e.target.value)}
            placeholder="Your GPS51 password"
            className="pr-10"
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
          Password will be hashed with MD5 before storage
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="from">Login From</Label>
          <Select value={formData.from} onValueChange={(value) => onInputChange('from', value)}>
            <SelectTrigger>
              <SelectValue />
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
          <Label htmlFor="type">Login Type</Label>
          <Select value={formData.type} onValueChange={(value) => onInputChange('type', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USER">USER</SelectItem>
              <SelectItem value="DEVICE">DEVICE</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
