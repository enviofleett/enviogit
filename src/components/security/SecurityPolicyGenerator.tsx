import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Copy, Code, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  category: 'organization' | 'role-based' | 'service' | 'custom';
  template: string;
  variables: string[];
}

const POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    id: 'org_isolation',
    name: 'Organization Isolation',
    description: 'Restrict access to data within the same organization',
    category: 'organization',
    template: `CREATE POLICY "org_isolation_{{table_name}}" 
ON public.{{table_name}} 
FOR ALL 
TO authenticated
USING (organization_id = public.get_user_organization_id());`,
    variables: ['table_name']
  },
  {
    id: 'admin_full_access',
    name: 'Admin Full Access',
    description: 'Grant full access to admin and owner roles',
    category: 'role-based',
    template: `CREATE POLICY "admin_full_access_{{table_name}}" 
ON public.{{table_name}} 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND organization_id = {{table_name}}.organization_id
    AND role IN ('admin', 'owner')
  )
);`,
    variables: ['table_name']
  },
  {
    id: 'manager_read_write',
    name: 'Manager Read/Write Access',
    description: 'Allow managers to read and update records',
    category: 'role-based',
    template: `CREATE POLICY "manager_read_write_{{table_name}}" 
ON public.{{table_name}} 
FOR SELECT, UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND organization_id = {{table_name}}.organization_id
    AND role IN ('admin', 'owner', 'manager')
  )
);`,
    variables: ['table_name']
  },
  {
    id: 'driver_own_data',
    name: 'Driver Own Data Access',
    description: 'Allow drivers to access only their own vehicle data',
    category: 'role-based',
    template: `CREATE POLICY "driver_own_data_{{table_name}}" 
ON public.{{table_name}} 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vehicles v
    JOIN public.profiles p ON v.driver_id = p.id
    WHERE v.id = {{table_name}}.vehicle_id
    AND p.id = auth.uid()
    AND v.organization_id = {{table_name}}.organization_id
  )
);`,
    variables: ['table_name']
  },
  {
    id: 'service_role_insert',
    name: 'Service Role Insert',
    description: 'Allow service role to insert data (for API integrations)',
    category: 'service',
    template: `CREATE POLICY "service_insert_{{table_name}}" 
ON public.{{table_name}} 
FOR INSERT 
TO service_role
WITH CHECK (
  -- Add validation logic here
  {{table_name}}.organization_id IS NOT NULL
);`,
    variables: ['table_name']
  },
  {
    id: 'viewer_readonly',
    name: 'Viewer Read-Only Access',
    description: 'Grant read-only access to viewer role',
    category: 'role-based',
    template: `CREATE POLICY "viewer_readonly_{{table_name}}" 
ON public.{{table_name}} 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND organization_id = {{table_name}}.organization_id
  )
);`,
    variables: ['table_name']
  }
];

const TABLES = [
  'profiles',
  'organizations',
  'vehicles', 
  'vehicle_positions',
  'geofences',
  'alerts',
  'geofence_events',
  'vehicle_assignments',
  'devices',
  'video_records'
];

export const SecurityPolicyGenerator = () => {
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [generatedSQL, setGeneratedSQL] = useState<string>('');
  const [customVariables, setCustomVariables] = useState<Record<string, string>>({});
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const { toast } = useToast();

  const handleTemplateSelect = (templateId: string) => {
    const template = POLICY_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    setSelectedTemplate(templateId);
    
    // Initialize variables
    const variables: Record<string, string> = {};
    template.variables.forEach(variable => {
      if (variable === 'table_name') {
        variables[variable] = selectedTable || '';
      } else {
        variables[variable] = '';
      }
    });
    setCustomVariables(variables);
  };

  const generateSQL = () => {
    if (!selectedTemplate || !selectedTable) {
      toast({
        title: "Missing Selection",
        description: "Please select both a table and template",
        variant: "destructive"
      });
      return;
    }

    const template = POLICY_TEMPLATES.find(t => t.id === selectedTemplate);
    if (!template) return;

    let sql = template.template;
    
    // Replace variables
    Object.entries(customVariables).forEach(([variable, value]) => {
      const placeholder = `{{${variable}}}`;
      sql = sql.replace(new RegExp(placeholder, 'g'), value || selectedTable);
    });

    setGeneratedSQL(sql);
  };

  const generateMultiplePolicies = () => {
    if (!selectedTable || selectedTemplates.length === 0) {
      toast({
        title: "Missing Selection", 
        description: "Please select a table and at least one template",
        variant: "destructive"
      });
      return;
    }

    let combinedSQL = `-- RLS Policies for table: ${selectedTable}\n`;
    combinedSQL += `-- Generated: ${new Date().toISOString()}\n\n`;
    
    // Enable RLS first
    combinedSQL += `-- Enable Row Level Security\n`;
    combinedSQL += `ALTER TABLE public.${selectedTable} ENABLE ROW LEVEL SECURITY;\n\n`;

    selectedTemplates.forEach(templateId => {
      const template = POLICY_TEMPLATES.find(t => t.id === templateId);
      if (!template) return;

      let sql = template.template;
      
      // Replace table_name variable
      sql = sql.replace(/{{table_name}}/g, selectedTable);
      
      combinedSQL += `-- ${template.name}\n`;
      combinedSQL += `-- ${template.description}\n`;
      combinedSQL += sql + '\n\n';
    });

    setGeneratedSQL(combinedSQL);
  };

  const copyToClipboard = async () => {
    if (!generatedSQL) return;
    
    try {
      await navigator.clipboard.writeText(generatedSQL);
      toast({
        title: "Copied to Clipboard",
        description: "SQL policy has been copied to clipboard"
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const handleTemplateToggle = (templateId: string, checked: boolean) => {
    if (checked) {
      setSelectedTemplates([...selectedTemplates, templateId]);
    } else {
      setSelectedTemplates(selectedTemplates.filter(id => id !== templateId));
    }
  };

  const getTemplatesByCategory = (category: PolicyTemplate['category']) => {
    return POLICY_TEMPLATES.filter(t => t.category === category);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Wand2 className="h-6 w-6" />
          Security Policy Generator
        </h2>
        <p className="text-muted-foreground mt-1">
          Generate RLS policies for your database tables with predefined templates
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="table-select">Target Table</Label>
                <Select value={selectedTable} onValueChange={setSelectedTable}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a table" />
                  </SelectTrigger>
                  <SelectContent>
                    {TABLES.map(table => (
                      <SelectItem key={table} value={table}>
                        {table}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Policy Templates</Label>
                <div className="space-y-4 mt-2">
                  {['organization', 'role-based', 'service'].map(category => (
                    <div key={category}>
                      <h4 className="font-medium capitalize mb-2">{category} Policies</h4>
                      <div className="space-y-2">
                        {getTemplatesByCategory(category as PolicyTemplate['category']).map(template => (
                          <div key={template.id} className="flex items-start space-x-2">
                            <Checkbox
                              id={template.id}
                              checked={selectedTemplates.includes(template.id)}
                              onCheckedChange={(checked) => handleTemplateToggle(template.id, checked as boolean)}
                            />
                            <div className="grid gap-1.5 leading-none">
                              <label
                                htmlFor={template.id}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {template.name}
                              </label>
                              <p className="text-xs text-muted-foreground">
                                {template.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={generateMultiplePolicies} className="flex-1">
                  <Code className="h-4 w-4 mr-2" />
                  Generate Policies
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Single Template Generator */}
          <Card>
            <CardHeader>
              <CardTitle>Single Policy Generator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Policy Template</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {POLICY_TEMPLATES.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center gap-2">
                          <span>{template.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {template.category}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate && Object.keys(customVariables).length > 0 && (
                <div className="space-y-2">
                  <Label>Template Variables</Label>
                  {Object.entries(customVariables).map(([variable, value]) => (
                    <div key={variable}>
                      <Label htmlFor={variable} className="text-xs">
                        {variable}
                      </Label>
                      <Input
                        id={variable}
                        value={value}
                        onChange={(e) => setCustomVariables({
                          ...customVariables,
                          [variable]: e.target.value
                        })}
                        placeholder={`Enter ${variable}`}
                      />
                    </div>
                  ))}
                </div>
              )}

              <Button onClick={generateSQL} variant="outline" className="w-full">
                Generate Single Policy
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Generated SQL Panel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Generated SQL</CardTitle>
              <Button 
                onClick={copyToClipboard} 
                disabled={!generatedSQL}
                variant="outline" 
                size="sm"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {generatedSQL ? (
              <Textarea
                value={generatedSQL}
                readOnly
                className="min-h-[400px] font-mono text-sm"
                placeholder="Generated SQL will appear here..."
              />
            ) : (
              <div className="min-h-[400px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a table and template to generate SQL</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};