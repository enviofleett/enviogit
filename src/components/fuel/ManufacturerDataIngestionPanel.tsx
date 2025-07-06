import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Upload,
  Database,
  CheckCircle,
  AlertTriangle,
  Loader2,
  FileText,
  BarChart3,
  Info
} from 'lucide-react';
import { manufacturerDataService } from '@/services/fuel/ManufacturerDataService';

interface IngestionResult {
  success: boolean;
  totalRecords: number;
  processedRecords: number;
  errors: number;
  warnings: string[];
  validationResults?: {
    duplicates: number;
    invalidRecords: number;
    missingFields: string[];
  };
  executionTime: number;
}

export function ManufacturerDataIngestionPanel() {
  const [csvData, setCsvData] = useState('');
  const [jsonData, setJsonData] = useState('');
  const [dataSource, setDataSource] = useState('');
  const [ingestionMode, setIngestionMode] = useState<'csv' | 'json' | 'sample'>('csv');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<IngestionResult | null>(null);
  const [validationResult, setValidationResult] = useState<IngestionResult | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (file.name.endsWith('.csv')) {
        setCsvData(content);
        setIngestionMode('csv');
      } else if (file.name.endsWith('.json')) {
        setJsonData(content);
        setIngestionMode('json');
      }
      setDataSource(file.name);
    };
    reader.readAsText(file);
  };

  const parseCsvData = (csvContent: string) => {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const entry: any = {};

      headers.forEach((header, index) => {
        const value = values[index]?.trim();
        switch (header) {
          case 'brand':
          case 'make':
            entry.brand = value;
            break;
          case 'model':
            entry.model = value;
            break;
          case 'year':
            entry.year = parseInt(value) || 0;
            break;
          case 'engine_size':
          case 'enginesize':
            entry.engineSize = value;
            break;
          case 'fuel_type':
          case 'fueltype':
            entry.fuelType = value || 'petrol';
            break;
          case 'city_consumption':
          case 'cityconsumption':
            entry.cityConsumption = parseFloat(value) || undefined;
            break;
          case 'highway_consumption':
          case 'highwayconsumption':
            entry.highwayConsumption = parseFloat(value) || undefined;
            break;
          case 'combined_consumption':
          case 'combinedconsumption':
            entry.combinedConsumption = parseFloat(value) || undefined;
            break;
          default:
            if (value) entry[header] = value;
        }
      });

      if (entry.brand && entry.model && entry.year) {
        data.push(entry);
      }
    }

    return data;
  };

  const validateData = async () => {
    if (!csvData && !jsonData && ingestionMode !== 'sample') {
      toast({
        title: "No Data",
        description: "Please upload a file or paste data to validate",
        variant: "destructive"
      });
      return;
    }

    setValidating(true);
    try {
      let data: any[] = [];

      if (ingestionMode === 'csv' && csvData) {
        data = parseCsvData(csvData);
      } else if (ingestionMode === 'json' && jsonData) {
        data = JSON.parse(jsonData);
      } else if (ingestionMode === 'sample') {
        data = [
          { brand: 'Toyota', model: 'Corolla', year: 2023, fuelType: 'petrol', combinedConsumption: 6.1 },
          { brand: 'Honda', model: 'Civic', year: 2023, fuelType: 'petrol', combinedConsumption: 6.7 },
          { brand: 'Ford', model: 'Escape', year: 2023, fuelType: 'petrol', combinedConsumption: 7.5 }
        ];
      }

      const response = await supabase.functions.invoke('manufacturer-data-ingestion', {
        body: {
          data,
          source: dataSource || 'validation',
          validateOnly: true
        }
      });

      if (response.error) throw response.error;

      setValidationResult(response.data);
      toast({
        title: "Validation Complete",
        description: `${response.data.totalRecords} records validated`,
      });
    } catch (error) {
      console.error('Validation failed:', error);
      toast({
        title: "Validation Failed",
        description: "Failed to validate data format",
        variant: "destructive"
      });
    } finally {
      setValidating(false);
    }
  };

  const ingestData = async () => {
    if (!csvData && !jsonData && ingestionMode !== 'sample') {
      toast({
        title: "No Data",
        description: "Please upload a file or paste data to ingest",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setProgress(0);
    
    try {
      let data: any[] = [];

      if (ingestionMode === 'csv' && csvData) {
        data = parseCsvData(csvData);
      } else if (ingestionMode === 'json' && jsonData) {
        data = JSON.parse(jsonData);
      } else if (ingestionMode === 'sample') {
        // Use the sample data from the service
        await manufacturerDataService.ingestSampleData();
        toast({
          title: "Sample Data Ingested",
          description: "Sample manufacturer data has been added to the database",
        });
        setLoading(false);
        return;
      }

      // Simulate progress for large datasets
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await supabase.functions.invoke('manufacturer-data-ingestion', {
        body: {
          data,
          source: dataSource || 'manual_upload',
          batchSize: 100
        }
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (response.error) throw response.error;

      setResult(response.data);
      
      if (response.data.success) {
        toast({
          title: "Ingestion Complete",
          description: `Successfully processed ${response.data.processedRecords} of ${response.data.totalRecords} records`,
        });
      } else {
        toast({
          title: "Ingestion Issues",
          description: `Processed ${response.data.processedRecords} records with ${response.data.errors} errors`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Ingestion failed:', error);
      toast({
        title: "Ingestion Failed",
        description: "Failed to process manufacturer data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Manufacturer Data Ingestion System
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Import your comprehensive vehicle fuel consumption database (2000-2025) to enable advanced fuel analytics
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Data Input Section */}
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button 
                variant={ingestionMode === 'csv' ? 'default' : 'outline'}
                onClick={() => setIngestionMode('csv')}
                size="sm"
              >
                CSV Data
              </Button>
              <Button 
                variant={ingestionMode === 'json' ? 'default' : 'outline'}
                onClick={() => setIngestionMode('json')}
                size="sm"
              >
                JSON Data
              </Button>
              <Button 
                variant={ingestionMode === 'sample' ? 'default' : 'outline'}
                onClick={() => setIngestionMode('sample')}
                size="sm"
              >
                Sample Data
              </Button>
            </div>

            {ingestionMode === 'csv' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="csvFile">Upload CSV File</Label>
                  <Input
                    id="csvFile"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="csvData">Or Paste CSV Data</Label>
                  <Textarea
                    id="csvData"
                    value={csvData}
                    onChange={(e) => setCsvData(e.target.value)}
                    placeholder="brand,model,year,fuel_type,combined_consumption&#10;Toyota,Corolla,2023,petrol,6.1&#10;Honda,Civic,2023,petrol,6.7"
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            )}

            {ingestionMode === 'json' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="jsonFile">Upload JSON File</Label>
                  <Input
                    id="jsonFile"
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="jsonData">Or Paste JSON Data</Label>
                  <Textarea
                    id="jsonData"
                    value={jsonData}
                    onChange={(e) => setJsonData(e.target.value)}
                    placeholder='[{"brand":"Toyota","model":"Corolla","year":2023,"fuelType":"petrol","combinedConsumption":6.1}]'
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            )}

            {ingestionMode === 'sample' && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Sample data includes Toyota Corolla, Honda Civic, and Ford Escape (2023 models) 
                  with baseline fuel consumption data for testing the system.
                </AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="dataSource">Data Source Name</Label>
              <Input
                id="dataSource"
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
                placeholder="e.g., Comprehensive_Database_2000-2025"
                className="mt-1"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button 
              onClick={validateData} 
              disabled={validating || loading}
              variant="outline"
            >
              {validating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Validate Data
                </>
              )}
            </Button>
            <Button 
              onClick={ingestData} 
              disabled={loading || validating}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Ingest Data
                </>
              )}
            </Button>
          </div>

          {/* Progress Bar */}
          {loading && progress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing data...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {/* Validation Results */}
          {validationResult && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  Validation Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 md:grid-cols-4">
                  <div>
                    <div className="text-lg font-bold">{validationResult.totalRecords}</div>
                    <div className="text-xs text-muted-foreground">Total Records</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-red-600">{validationResult.validationResults?.invalidRecords || 0}</div>
                    <div className="text-xs text-muted-foreground">Invalid Records</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-yellow-600">{validationResult.validationResults?.duplicates || 0}</div>
                    <div className="text-xs text-muted-foreground">Duplicates</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-green-600">{validationResult.executionTime}ms</div>
                    <div className="text-xs text-muted-foreground">Validation Time</div>
                  </div>
                </div>
                
                {validationResult.warnings.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Warnings:</h4>
                    <ul className="text-sm space-y-1">
                      {validationResult.warnings.map((warning, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 text-yellow-600 mt-0.5 flex-shrink-0" />
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Ingestion Results */}
          {result && (
            <Card className={result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                  Ingestion Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 md:grid-cols-4">
                  <div>
                    <div className="text-lg font-bold">{result.totalRecords}</div>
                    <div className="text-xs text-muted-foreground">Total Records</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-green-600">{result.processedRecords}</div>
                    <div className="text-xs text-muted-foreground">Processed</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-red-600">{result.errors}</div>
                    <div className="text-xs text-muted-foreground">Errors</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">{result.executionTime}ms</div>
                    <div className="text-xs text-muted-foreground">Execution Time</div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <Badge variant={result.success ? "default" : "destructive"}>
                    {result.success ? "✓ Successfully Completed" : "⚠ Completed with Errors"}
                  </Badge>
                </div>

                {result.warnings.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Warnings:</h4>
                    <ul className="text-sm space-y-1">
                      {result.warnings.map((warning, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 text-yellow-600 mt-0.5 flex-shrink-0" />
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Usage Instructions */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>CSV Format:</strong> Include columns: brand, model, year, fuel_type, combined_consumption, city_consumption, highway_consumption<br/>
              <strong>JSON Format:</strong> Array of objects with properties: brand, model, year, fuelType, combinedConsumption, etc.<br/>
              <strong>Required Fields:</strong> brand, model, year, fuelType are mandatory for each record.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}