import { supabase } from '@/integrations/supabase/client';
import { GPS51FuelData, FuelConsumptionPeriod } from './GPS51FuelConsumptionService';

export interface ManufacturerFuelData {
  id: string;
  brand: string;
  model: string;
  year: number;
  engineSize?: string;
  engineType?: string;
  fuelType: string;
  cityConsumption?: number;
  highwayConsumption?: number;
  combinedConsumption?: number;
  speedImpactData?: Record<string, any>;
  historicalTrends?: Record<string, any>;
}

export interface FuelConsumptionInsights {
  vehicleId: string;
  deviceId: string;
  period: FuelConsumptionPeriod;
  actualConsumption: {
    lPer100km: number;
    totalFuelUsed: number;
    totalDistance: number;
    costEstimate?: number;
    averageSpeed: number;
  };
  manufacturerBenchmark?: {
    statedConsumption: number;
    speedAdjustedConsumption?: number;
    source: 'combined' | 'city' | 'highway';
    confidence: number;
  };
  comparison?: {
    deviationPercentage: number;
    efficiencyRating: 'optimal' | 'above_expected' | 'high_consumption';
    explanation: string;
    factors: string[];
  };
  speedAnalysis?: {
    avgSpeed: number;
    speedDistribution: Record<string, number>;
    impactExplanation: string;
  };
  historicalTrends?: {
    previousPeriods: Array<{
      period: string;
      consumption: number;
      deviation: number;
    }>;
    trend: 'improving' | 'stable' | 'declining';
  };
  subscriptionTier: string;
  dataQuality: {
    completeness: number;
    reliability: 'high' | 'medium' | 'low';
    lastUpdated: string;
  };
}

export class FuelConsumptionAnalysisEngine {
  private static instance: FuelConsumptionAnalysisEngine;

  static getInstance(): FuelConsumptionAnalysisEngine {
    if (!FuelConsumptionAnalysisEngine.instance) {
      FuelConsumptionAnalysisEngine.instance = new FuelConsumptionAnalysisEngine();
    }
    return FuelConsumptionAnalysisEngine.instance;
  }

  async generateFuelInsights(
    vehicleId: string,
    gps51Data: GPS51FuelData,
    period: FuelConsumptionPeriod,
    subscriptionTier: string = 'basic'
  ): Promise<FuelConsumptionInsights> {
    try {
      // Get manufacturer data for the vehicle
      const manufacturerData = await this.getManufacturerDataForVehicle(vehicleId);
      
      // Calculate base insights
      const actualConsumption = {
        lPer100km: gps51Data.oilPer100km,
        totalFuelUsed: gps51Data.totalFuel,
        totalDistance: gps51Data.totalDistance,
        averageSpeed: gps51Data.averageSpeed,
        costEstimate: await this.calculateFuelCost(gps51Data.totalFuel, vehicleId)
      };

      const insights: FuelConsumptionInsights = {
        vehicleId,
        deviceId: gps51Data.deviceId,
        period,
        actualConsumption,
        subscriptionTier,
        dataQuality: this.assessDataQuality(gps51Data)
      };

      // Add manufacturer comparison if available
      if (manufacturerData) {
        insights.manufacturerBenchmark = this.calculateManufacturerBenchmark(
          manufacturerData,
          gps51Data.averageSpeed
        );
        
        insights.comparison = this.generateComparison(
          actualConsumption.lPer100km,
          insights.manufacturerBenchmark,
          gps51Data.averageSpeed
        );
      }

      // Add premium features based on subscription tier
      if (subscriptionTier !== 'basic') {
        if (subscriptionTier === 'premium' || subscriptionTier === 'enterprise') {
          insights.speedAnalysis = await this.analyzeSpeedImpact(gps51Data, manufacturerData);
          insights.historicalTrends = await this.getHistoricalTrends(vehicleId, period);
        }
      }

      // Store the report for historical tracking
      await this.storeFuelConsumptionReport(insights);

      return insights;
    } catch (error) {
      console.error('Failed to generate fuel insights:', error);
      throw new Error('Failed to analyze fuel consumption data');
    }
  }

  private async getManufacturerDataForVehicle(vehicleId: string): Promise<ManufacturerFuelData | null> {
    try {
      // First, get vehicle details to match with manufacturer data
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', vehicleId)
        .single();

      if (!vehicle || !vehicle.make || !vehicle.model || !vehicle.year) {
        console.warn('Vehicle missing manufacturer details for fuel analysis');
        return null;
      }

      // Look up manufacturer fuel data
      const { data: manufacturerData } = await supabase
        .from('manufacturer_fuel_data')
        .select('*')
        .ilike('brand', vehicle.make)
        .ilike('model', vehicle.model)
        .eq('year', vehicle.year)
        .limit(1)
        .single();

      if (!manufacturerData) {
        // Try broader search without exact year match
        const { data: alternativeData } = await supabase
          .from('manufacturer_fuel_data')
          .select('*')
          .ilike('brand', vehicle.make)
          .ilike('model', vehicle.model)
          .gte('year', vehicle.year - 2)
          .lte('year', vehicle.year + 2)
          .order('year', { ascending: false })
          .limit(1)
          .single();

        if (alternativeData) {
          return this.mapToManufacturerFuelData(alternativeData);
        }

        return null;
      }

      return this.mapToManufacturerFuelData(manufacturerData);
    } catch (error) {
      console.error('Failed to fetch manufacturer fuel data:', error);
      return null;
    }
  }

  private mapToManufacturerFuelData(data: any): ManufacturerFuelData {
    return {
      id: data.id,
      brand: data.brand,
      model: data.model,
      year: data.year,
      engineSize: data.engine_size,
      engineType: data.engine_type,
      fuelType: data.fuel_type,
      cityConsumption: data.city_consumption,
      highwayConsumption: data.highway_consumption,
      combinedConsumption: data.combined_consumption,
      speedImpactData: data.speed_impact_data,
      historicalTrends: data.historical_trends
    };
  }

  private calculateManufacturerBenchmark(
    manufacturerData: ManufacturerFuelData,
    averageSpeed: number
  ): FuelConsumptionInsights['manufacturerBenchmark'] {
    // Determine which consumption figure to use based on driving conditions
    let statedConsumption: number;
    let source: 'combined' | 'city' | 'highway';
    let confidence = 1.0;

    if (averageSpeed < 50 && manufacturerData.cityConsumption) {
      statedConsumption = manufacturerData.cityConsumption;
      source = 'city';
    } else if (averageSpeed > 80 && manufacturerData.highwayConsumption) {
      statedConsumption = manufacturerData.highwayConsumption;
      source = 'highway';
    } else if (manufacturerData.combinedConsumption) {
      statedConsumption = manufacturerData.combinedConsumption;
      source = 'combined';
    } else {
      // Fallback to available data
      statedConsumption = manufacturerData.combinedConsumption || 
                         manufacturerData.cityConsumption || 
                         manufacturerData.highwayConsumption || 8.0;
      source = 'combined';
      confidence = 0.6;
    }

    // Apply speed adjustment if we have speed impact data
    let speedAdjustedConsumption: number | undefined;
    if (manufacturerData.speedImpactData && typeof manufacturerData.speedImpactData === 'object') {
      speedAdjustedConsumption = this.applySpeedAdjustment(
        statedConsumption,
        averageSpeed,
        manufacturerData.speedImpactData
      );
    }

    return {
      statedConsumption,
      speedAdjustedConsumption,
      source,
      confidence
    };
  }

  private generateComparison(
    actualConsumption: number,
    benchmark: FuelConsumptionInsights['manufacturerBenchmark'],
    averageSpeed: number
  ): FuelConsumptionInsights['comparison'] {
    if (!benchmark) {
      return {
        deviationPercentage: 0,
        efficiencyRating: 'above_expected',
        explanation: 'No manufacturer data available for comparison',
        factors: ['No reference data']
      };
    }

    const referenceConsumption = benchmark.speedAdjustedConsumption || benchmark.statedConsumption;
    const deviationPercentage = ((actualConsumption - referenceConsumption) / referenceConsumption) * 100;

    let efficiencyRating: 'optimal' | 'above_expected' | 'high_consumption';
    let explanation: string;
    const factors: string[] = [];

    if (deviationPercentage <= 5) {
      efficiencyRating = 'optimal';
      explanation = `Excellent fuel efficiency! Your consumption is within 5% of manufacturer specifications.`;
    } else if (deviationPercentage <= 20) {
      efficiencyRating = 'above_expected';
      explanation = `Good fuel efficiency. Your consumption is ${Math.round(deviationPercentage)}% above manufacturer specifications.`;
    } else {
      efficiencyRating = 'high_consumption';
      explanation = `High fuel consumption detected. Your usage is ${Math.round(deviationPercentage)}% above manufacturer specifications.`;
    }

    // Add contextual factors
    if (averageSpeed > 100) {
      factors.push('High-speed driving increases aerodynamic drag');
    } else if (averageSpeed < 30) {
      factors.push('City driving with frequent stops affects efficiency');
    }

    if (benchmark.confidence < 0.8) {
      factors.push('Limited manufacturer data available');
    }

    return {
      deviationPercentage: Math.round(deviationPercentage * 100) / 100,
      efficiencyRating,
      explanation,
      factors
    };
  }

  private async analyzeSpeedImpact(
    gps51Data: GPS51FuelData,
    manufacturerData?: ManufacturerFuelData | null
  ): Promise<FuelConsumptionInsights['speedAnalysis']> {
    // Create speed distribution from trip data or average
    const speedDistribution: Record<string, number> = {
      'city_0_50': 0,
      'suburban_50_80': 0,
      'highway_80_120': 0,
      'high_speed_120_plus': 0
    };

    const avgSpeed = gps51Data.averageSpeed;
    
    // Simplified distribution based on average speed
    if (avgSpeed < 50) {
      speedDistribution['city_0_50'] = 100;
    } else if (avgSpeed < 80) {
      speedDistribution['suburban_50_80'] = 100;
    } else if (avgSpeed < 120) {
      speedDistribution['highway_80_120'] = 100;
    } else {
      speedDistribution['high_speed_120_plus'] = 100;
    }

    let impactExplanation = `Average speed: ${avgSpeed.toFixed(1)} km/h. `;
    
    if (avgSpeed > 100) {
      impactExplanation += 'High speeds significantly increase fuel consumption due to aerodynamic drag.';
    } else if (avgSpeed < 40) {
      impactExplanation += 'Low average speed suggests city driving with frequent stops, which can increase consumption.';
    } else {
      impactExplanation += 'Moderate speeds are generally optimal for fuel efficiency.';
    }

    return {
      avgSpeed,
      speedDistribution,
      impactExplanation
    };
  }

  private async getHistoricalTrends(
    vehicleId: string,
    currentPeriod: FuelConsumptionPeriod
  ): Promise<FuelConsumptionInsights['historicalTrends']> {
    try {
      const { data: historicalReports } = await supabase
        .from('fuel_consumption_reports')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .lt('report_period_end', currentPeriod.start.toISOString())
        .order('report_period_end', { ascending: false })
        .limit(6);

      if (!historicalReports || historicalReports.length === 0) {
        return {
          previousPeriods: [],
          trend: 'stable'
        };
      }

      const previousPeriods = historicalReports.map(report => ({
        period: report.report_period_start.slice(0, 10),
        consumption: report.actual_consumption,
        deviation: report.deviation_percentage
      }));

      // Determine trend
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (previousPeriods.length >= 3) {
        const recent = previousPeriods.slice(0, 3);
        const avgRecent = recent.reduce((sum, p) => sum + p.consumption, 0) / recent.length;
        const older = previousPeriods.slice(-3);
        const avgOlder = older.reduce((sum, p) => sum + p.consumption, 0) / older.length;
        
        if (avgRecent < avgOlder * 0.95) {
          trend = 'improving';
        } else if (avgRecent > avgOlder * 1.05) {
          trend = 'declining';
        }
      }

      return {
        previousPeriods,
        trend
      };
    } catch (error) {
      console.error('Failed to fetch historical trends:', error);
      return {
        previousPeriods: [],
        trend: 'stable'
      };
    }
  }

  private async calculateFuelCost(fuelUsed: number, vehicleId: string): Promise<number> {
    try {
      // Get user's preferred fuel price from vehicle fuel profile
      const { data: fuelProfile } = await supabase
        .from('vehicle_fuel_profiles')
        .select('preferred_fuel_price')
        .eq('vehicle_id', vehicleId)
        .single();

      const fuelPrice = fuelProfile?.preferred_fuel_price || 1.50; // Default price per liter
      return fuelUsed * fuelPrice;
    } catch (error) {
      // Use default fuel price if profile not found
      return fuelUsed * 1.50;
    }
  }

  private applySpeedAdjustment(
    baseConsumption: number,
    averageSpeed: number,
    speedImpactData: Record<string, any>
  ): number {
    // Apply speed-based adjustment factors from manufacturer data
    // This is a simplified implementation - real data would have detailed speed curves
    let adjustment = 1.0;

    if (averageSpeed > 120) {
      adjustment = 1.3; // +30% for very high speeds
    } else if (averageSpeed > 100) {
      adjustment = 1.15; // +15% for high speeds
    } else if (averageSpeed < 30) {
      adjustment = 1.2; // +20% for stop-and-go city driving
    }

    return baseConsumption * adjustment;
  }

  private assessDataQuality(gps51Data: GPS51FuelData): FuelConsumptionInsights['dataQuality'] {
    let completeness = 0;
    let reliability: 'high' | 'medium' | 'low' = 'low';

    // Check data completeness
    if (gps51Data.oilPer100km > 0) completeness += 0.4;
    if (gps51Data.totalDistance > 0) completeness += 0.3;
    if (gps51Data.averageSpeed > 0) completeness += 0.2;
    if (gps51Data.totalFuel > 0) completeness += 0.1;

    // Assess reliability
    if (completeness >= 0.9 && gps51Data.totalDistance > 10) {
      reliability = 'high';
    } else if (completeness >= 0.6) {
      reliability = 'medium';
    }

    return {
      completeness: Math.round(completeness * 100),
      reliability,
      lastUpdated: new Date().toISOString()
    };
  }

  private async storeFuelConsumptionReport(insights: FuelConsumptionInsights): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('fuel_consumption_reports').insert({
        vehicle_id: insights.vehicleId,
        user_id: user.id,
        device_id: insights.deviceId,
        report_period_start: insights.period.start.toISOString(),
        report_period_end: insights.period.end.toISOString(),
        actual_consumption: insights.actualConsumption.lPer100km,
        manufacturer_stated_consumption: insights.manufacturerBenchmark?.statedConsumption,
        speed_adjusted_consumption: insights.manufacturerBenchmark?.speedAdjustedConsumption,
        deviation_percentage: insights.comparison?.deviationPercentage,
        efficiency_rating: insights.comparison?.efficiencyRating,
        total_distance_km: insights.actualConsumption.totalDistance,
        total_fuel_used_liters: insights.actualConsumption.totalFuelUsed,
        average_speed: insights.actualConsumption.averageSpeed,
        speed_distribution: insights.speedAnalysis?.speedDistribution || {},
        cost_estimate: insights.actualConsumption.costEstimate,
        analysis_data: {
          dataQuality: insights.dataQuality,
          factors: insights.comparison?.factors || [],
          historicalTrend: insights.historicalTrends?.trend
        }
      });
    } catch (error) {
      console.error('Failed to store fuel consumption report:', error);
    }
  }
}

export const fuelConsumptionAnalysisEngine = FuelConsumptionAnalysisEngine.getInstance();