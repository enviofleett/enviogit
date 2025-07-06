import { supabase } from '@/integrations/supabase/client';

export interface ManufacturerDataEntry {
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

export interface VehicleLookupResult {
  id: string;
  brand: string;
  model: string;
  year: number;
  combinedConsumption: number;
  matchConfidence: number;
}

export class ManufacturerDataService {
  private static instance: ManufacturerDataService;

  static getInstance(): ManufacturerDataService {
    if (!ManufacturerDataService.instance) {
      ManufacturerDataService.instance = new ManufacturerDataService();
    }
    return ManufacturerDataService.instance;
  }

  async ingestManufacturerData(data: ManufacturerDataEntry[]): Promise<{ success: number; errors: number }> {
    let success = 0;
    let errors = 0;

    try {
      // Process data in batches to avoid overwhelming the database
      const batchSize = 100;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        const formattedBatch = batch.map(entry => ({
          brand: this.normalizeBrandName(entry.brand),
          model: this.normalizeModelName(entry.model),
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

        const { error } = await supabase
          .from('manufacturer_fuel_data')
          .upsert(formattedBatch, {
            onConflict: 'brand,model,year',
            ignoreDuplicates: false
          });

        if (error) {
          console.error('Batch insert error:', error);
          errors += batch.length;
        } else {
          success += batch.length;
        }
      }

      console.log(`Manufacturer data ingestion complete: ${success} success, ${errors} errors`);
      return { success, errors };
    } catch (error) {
      console.error('Failed to ingest manufacturer data:', error);
      return { success, errors: data.length };
    }
  }

  async searchVehicleData(
    brand?: string,
    model?: string,
    year?: number,
    limit = 10
  ): Promise<VehicleLookupResult[]> {
    try {
      let query = supabase
        .from('manufacturer_fuel_data')
        .select('id, brand, model, year, combined_consumption')
        .limit(limit);

      if (brand) {
        query = query.ilike('brand', `%${brand}%`);
      }
      if (model) {
        query = query.ilike('model', `%${model}%`);
      }
      if (year) {
        // Allow some flexibility in year matching
        query = query.gte('year', year - 2).lte('year', year + 2);
      }

      const { data, error } = await query.order('year', { ascending: false });

      if (error) {
        console.error('Search error:', error);
        return [];
      }

      return (data || []).map(item => ({
        id: item.id,
        brand: item.brand,
        model: item.model,
        year: item.year,
        combinedConsumption: item.combined_consumption || 0,
        matchConfidence: this.calculateMatchConfidence(item, brand, model, year)
      })).sort((a, b) => b.matchConfidence - a.matchConfidence);
    } catch (error) {
      console.error('Failed to search vehicle data:', error);
      return [];
    }
  }

  async getExactVehicleMatch(
    brand: string,
    model: string,
    year: number
  ): Promise<VehicleLookupResult | null> {
    try {
      const { data, error } = await supabase
        .from('manufacturer_fuel_data')
        .select('id, brand, model, year, combined_consumption')
        .ilike('brand', brand)
        .ilike('model', model)
        .eq('year', year)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        brand: data.brand,
        model: data.model,
        year: data.year,
        combinedConsumption: data.combined_consumption || 0,
        matchConfidence: 1.0
      };
    } catch (error) {
      console.error('Failed to get exact vehicle match:', error);
      return null;
    }
  }

  async getAllBrands(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('manufacturer_fuel_data')
        .select('brand')
        .order('brand');

      if (error) {
        console.error('Failed to fetch brands:', error);
        return [];
      }

      // Remove duplicates and return sorted list
      const brands = [...new Set(data.map(item => item.brand))];
      return brands.sort();
    } catch (error) {
      console.error('Failed to get all brands:', error);
      return [];
    }
  }

  async getModelsForBrand(brand: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('manufacturer_fuel_data')
        .select('model')
        .ilike('brand', brand)
        .order('model');

      if (error) {
        console.error('Failed to fetch models:', error);
        return [];
      }

      // Remove duplicates and return sorted list
      const models = [...new Set(data.map(item => item.model))];
      return models.sort();
    } catch (error) {
      console.error('Failed to get models for brand:', error);
      return [];
    }
  }

  async getYearsForModel(brand: string, model: string): Promise<number[]> {
    try {
      const { data, error } = await supabase
        .from('manufacturer_fuel_data')
        .select('year')
        .ilike('brand', brand)
        .ilike('model', model)
        .order('year', { ascending: false });

      if (error) {
        console.error('Failed to fetch years:', error);
        return [];
      }

      // Remove duplicates and return sorted list
      const years = [...new Set(data.map(item => item.year))];
      return years.sort((a, b) => b - a);
    } catch (error) {
      console.error('Failed to get years for model:', error);
      return [];
    }
  }

  async getDataStatistics(): Promise<{
    totalEntries: number;
    brandCount: number;
    yearRange: { min: number; max: number };
    avgCombinedConsumption: number;
  }> {
    try {
      const { data: countData } = await supabase
        .from('manufacturer_fuel_data')
        .select('*', { count: 'exact', head: true });

      const { data: statsData } = await supabase
        .from('manufacturer_fuel_data')
        .select('brand, year, combined_consumption');

      if (!statsData) {
        return {
          totalEntries: 0,
          brandCount: 0,
          yearRange: { min: 0, max: 0 },
          avgCombinedConsumption: 0
        };
      }

      const brands = new Set(statsData.map(item => item.brand));
      const years = statsData.map(item => item.year).filter(year => year);
      const consumptions = statsData
        .map(item => item.combined_consumption)
        .filter(consumption => consumption && consumption > 0);

      return {
        totalEntries: countData?.length || 0,
        brandCount: brands.size,
        yearRange: {
          min: Math.min(...years),
          max: Math.max(...years)
        },
        avgCombinedConsumption: consumptions.length > 0 
          ? consumptions.reduce((sum, val) => sum + val, 0) / consumptions.length 
          : 0
      };
    } catch (error) {
      console.error('Failed to get data statistics:', error);
      return {
        totalEntries: 0,
        brandCount: 0,
        yearRange: { min: 0, max: 0 },
        avgCombinedConsumption: 0
      };
    }
  }

  private normalizeBrandName(brand: string): string {
    return brand.trim().toLowerCase().replace(/[\s\-_]+/g, ' ');
  }

  private normalizeModelName(model: string): string {
    return model.trim().toLowerCase().replace(/[\s\-_]+/g, ' ');
  }

  private calculateMatchConfidence(
    item: any,
    searchBrand?: string,
    searchModel?: string,
    searchYear?: number
  ): number {
    let confidence = 0;

    if (searchBrand) {
      const brandMatch = item.brand.toLowerCase().includes(searchBrand.toLowerCase()) ||
                        searchBrand.toLowerCase().includes(item.brand.toLowerCase());
      confidence += brandMatch ? 0.4 : 0;
    }

    if (searchModel) {
      const modelMatch = item.model.toLowerCase().includes(searchModel.toLowerCase()) ||
                        searchModel.toLowerCase().includes(item.model.toLowerCase());
      confidence += modelMatch ? 0.4 : 0;
    }

    if (searchYear) {
      const yearDiff = Math.abs(item.year - searchYear);
      if (yearDiff === 0) confidence += 0.2;
      else if (yearDiff <= 2) confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  // Sample data ingestion method for testing
  async ingestSampleData(): Promise<void> {
    const sampleData: ManufacturerDataEntry[] = [
      {
        brand: 'Toyota',
        model: 'Corolla',
        year: 2023,
        fuelType: 'petrol',
        combinedConsumption: 6.1,
        cityConsumption: 7.1,
        highwayConsumption: 5.4
      },
      {
        brand: 'Honda',
        model: 'Civic',
        year: 2023,
        fuelType: 'petrol',
        combinedConsumption: 6.7,
        cityConsumption: 7.8,
        highwayConsumption: 5.9
      },
      {
        brand: 'Ford',
        model: 'Escape',
        year: 2023,
        fuelType: 'petrol',
        combinedConsumption: 7.5,
        cityConsumption: 8.4,
        highwayConsumption: 6.9
      }
    ];

    await this.ingestManufacturerData(sampleData);
  }
}

export const manufacturerDataService = ManufacturerDataService.getInstance();