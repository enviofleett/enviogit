
import React from 'react';

interface GPS51CredentialsValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface GPS51FormValidationProps {
  validationResult: GPS51CredentialsValidationResult | null;
}

export const GPS51FormValidation: React.FC<GPS51FormValidationProps> = ({
  validationResult
}) => {
  if (!validationResult) return null;

  return (
    <div className="space-y-2">
      {validationResult.errors?.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm font-medium text-red-800">Validation Errors:</p>
          <ul className="text-sm text-red-700 list-disc list-inside">
            {validationResult.errors.map((error: string, index: number) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      
      {validationResult.warnings?.length > 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm font-medium text-yellow-800">Warnings:</p>
          <ul className="text-sm text-yellow-700 list-disc list-inside">
            {validationResult.warnings.map((warning: string, index: number) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
