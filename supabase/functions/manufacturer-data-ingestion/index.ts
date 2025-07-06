import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ManufacturerDataEntry {
  brand: string;
  model: string;
  year: number;
  engineSize?: string;
  engineType?: string;
  fuelType: string;
  transmissionType?: string;
  vehicleCategory?: string;
  cityConsumption?: number;
  highwayConsumption?: number;
  combinedConsumption?: number;
  speedImpactData?: Record<string, any>;
  historicalTrends?: Record<string, any>;
}

interface DataIngestionRequest {
  data: ManufacturerDataEntry[];
  source: string;
  validateOnly?: boolean;
  batchSize?: number;
}

interface DataIngestionResponse {
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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { data, source, validateOnly = false, batchSize = 100 }: DataIngestionRequest = await req.json();

    // Validate request
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error("Invalid data: Expected non-empty array of manufacturer data entries");
    }

    if (!source) {
      throw new Error("Data source must be specified");
    }

    console.log(`Manufacturer Data Ingestion: Processing ${data.length} records from source: ${source}`);

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Data validation and normalization
    const validationResults = await validateAndNormalizeData(data);
    const warnings: string[] = [];

    if (validationResults.invalidRecords > 0) {
      warnings.push(`${validationResults.invalidRecords} records have validation issues`);
    }

    if (validationResults.duplicates > 0) {
      warnings.push(`${validationResults.duplicates} potential duplicate records detected`);
    }

    if (validateOnly) {
      return new Response(JSON.stringify({
        success: true,
        totalRecords: data.length,
        processedRecords: 0,
        errors: 0,
        warnings,
        validationResults,
        executionTime: Date.now() - startTime
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Process data in batches for production performance
    let processedRecords = 0;
    let errorCount = 0;
    const validData = data.filter(entry => isValidEntry(entry));

    for (let i = 0; i < validData.length; i += batchSize) {
      const batch = validData.slice(i, i + batchSize);
      
      try {
        const formattedBatch = batch.map(entry => ({
          brand: normalizeBrandName(entry.brand),
          model: normalizeModelName(entry.model),
          year: entry.year,
          engine_size: entry.engineSize,
          engine_type: entry.engineType,
          fuel_type: entry.fuelType || 'petrol',
          transmission_type: entry.transmissionType,
          vehicle_category: entry.vehicleCategory,
          city_consumption: entry.cityConsumption,
          highway_consumption: entry.highwayConsumption,
          combined_consumption: entry.combinedConsumption,
          speed_impact_data: entry.speedImpactData || {},
          historical_trends: entry.historicalTrends || {}
        }));

        const { error: batchError } = await supabaseClient
          .from('manufacturer_fuel_data')
          .upsert(formattedBatch, {
            onConflict: 'brand,model,year',
            ignoreDuplicates: false
          });

        if (batchError) {
          console.error(`Batch ${Math.floor(i / batchSize) + 1} error:`, batchError);
          errorCount += batch.length;
        } else {
          processedRecords += batch.length;
          console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(validData.length / batchSize)}: ${processedRecords}/${validData.length} records`);
        }
      } catch (batchError) {
        console.error(`Batch processing error:`, batchError);
        errorCount += batch.length;
      }
    }

    // Log ingestion results
    await supabaseClient.from('api_calls_monitor').insert({
      endpoint: 'manufacturer-data-ingestion',
      method: 'POST',
      request_payload: {
        source,
        totalRecords: data.length,
        batchSize
      },
      response_status: 200,
      response_body: {
        processedRecords,
        errorCount,
        validationResults
      },
      duration_ms: Date.now() - startTime
    });

    const response: DataIngestionResponse = {
      success: errorCount === 0,
      totalRecords: data.length,
      processedRecords,
      errors: errorCount,
      warnings,
      validationResults,
      executionTime: Date.now() - startTime
    };

    console.log('Manufacturer data ingestion completed:', response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Manufacturer data ingestion error:", error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      totalRecords: 0,
      processedRecords: 0,
      errors: 1,
      warnings: [],
      executionTime: Date.now() - startTime
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

// Data validation and normalization functions
async function validateAndNormalizeData(data: ManufacturerDataEntry[]) {
  let duplicates = 0;
  let invalidRecords = 0;
  const missingFields: string[] = [];
  const seenRecords = new Set<string>();

  for (const entry of data) {
    // Check for duplicates
    const recordKey = `${entry.brand}-${entry.model}-${entry.year}`;
    if (seenRecords.has(recordKey.toLowerCase())) {
      duplicates++;
    } else {
      seenRecords.add(recordKey.toLowerCase());
    }

    // Validate required fields
    if (!isValidEntry(entry)) {
      invalidRecords++;
    }

    // Check for missing optional but important fields
    if (!entry.combinedConsumption && !entry.cityConsumption && !entry.highwayConsumption) {
      if (!missingFields.includes('consumption_data')) {
        missingFields.push('consumption_data');
      }
    }
  }

  return {
    duplicates,
    invalidRecords,
    missingFields
  };
}

function isValidEntry(entry: ManufacturerDataEntry): boolean {
  return !!(
    entry.brand && 
    entry.model && 
    entry.year &&
    entry.year >= 1990 && 
    entry.year <= new Date().getFullYear() + 2 &&
    entry.fuelType
  );
}

function normalizeBrandName(brand: string): string {
  return brand.trim().toLowerCase().replace(/[\s\-_]+/g, ' ');
}

function normalizeModelName(model: string): string {
  return model.trim().toLowerCase().replace(/[\s\-_]+/g, ' ');
}

serve(handler);