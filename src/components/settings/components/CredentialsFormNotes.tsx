
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Info } from 'lucide-react';

export const CredentialsFormNotes: React.FC = () => {
  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-2 text-sm">
            <h3 className="font-medium text-blue-800">Important Notes:</h3>
            <ul className="space-y-1 text-blue-700 list-disc list-inside">
              <li>Use the GPS51 API URL ending with <code>/openapi</code></li>
              <li>Passwords are automatically hashed with MD5 for security</li>
              <li>Test your connection before saving to ensure credentials are valid</li>
              <li>Credentials are stored securely in your browser's local storage</li>
              <li>Real-time data synchronization starts automatically after successful configuration</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
