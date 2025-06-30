
import React from 'react';

export const CredentialsFormNotes: React.FC = () => {
  return (
    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
      <h4 className="text-sm font-semibold text-yellow-800 mb-2">⚠️ Critical Configuration Requirements</h4>
      <ul className="text-xs text-yellow-700 space-y-1">
        <li>• API URL must use <strong>api.gps51.com/openapi</strong> (NEW endpoint - /webapi is deprecated)</li>
        <li>• Platform and Login Type values are case-sensitive</li>
        <li>• Password will be MD5 encrypted automatically if needed</li>
        <li>• Authentication uses POST method with JSON body</li>
      </ul>
    </div>
  );
};
