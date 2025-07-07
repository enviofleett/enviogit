import React from 'react';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { QuickFix } from './types';

interface QuickFixPanelProps {
  quickFixes: QuickFix[];
  onQuickFix: (action: string) => void;
}

export const QuickFixPanel: React.FC<QuickFixPanelProps> = ({ quickFixes, onQuickFix }) => {
  if (quickFixes.length === 0) return null;

  return (
    <div className="space-y-2">
      <h5 className="font-medium text-sm flex items-center gap-2">
        <Settings className="h-4 w-4" />
        Quick Fixes
      </h5>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {quickFixes.map((fix, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => onQuickFix(fix.action)}
            className="justify-start text-left h-auto p-2"
          >
            <div className="flex items-start gap-2">
              <Settings className="h-3 w-3 mt-0.5 text-muted-foreground" />
              <div>
                <div className="text-xs font-medium">{fix.label}</div>
                <div className="text-xs text-muted-foreground">{fix.description}</div>
              </div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
};