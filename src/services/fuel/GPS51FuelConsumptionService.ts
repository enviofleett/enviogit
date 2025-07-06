import { GPS51ApiClient } from '@/services/gps51/GPS51ApiClient';
import { GPS51Client } from '@/services/gps51/GPS51Client';

export interface GPS51FuelData {
  deviceId: string;
  deviceName: string;
  oilPer100km: number; // L/100km
  runOilPer100km: number; // Running fuel consumption
  totalDistance: number; // km
  totalFuel: number; // liters
  averageSpeed: number; // km/h
  reportDate: string;
  tripData?: {
    startTime: string;
    endTime: string;
    distance: number;
    fuelUsed: number;
  }[];
}

export interface FuelConsumptionPeriod {
  start: Date;
  end: Date;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
}

export class GPS51FuelConsumptionService {
  private static instance: GPS51FuelConsumptionService;
  private gps51Client: GPS51Client;

  constructor() {
    this.gps51Client = new GPS51Client();
  }

  static getInstance(): GPS51FuelConsumptionService {
    if (!GPS51FuelConsumptionService.instance) {
      GPS51FuelConsumptionService.instance = new GPS51FuelConsumptionService();
    }
    return GPS51FuelConsumptionService.instance;
  }

  async getFuelConsumptionData(
    deviceId: string,
    period: FuelConsumptionPeriod,
    token: string
  ): Promise<GPS51FuelData | null> {
    try {
      const startDate = this.formatDateForAPI(period.start);
      const endDate = this.formatDateForAPI(period.end);

      const response = await this.gps51Client['apiClient'].makeRequest('reportmileagedetail', token, {
        deviceid: deviceId,
        begintime: startDate,
        endtime: endDate
      });

      if (response.status === 0 && response.data) {
        return this.parseGPS51FuelResponse(deviceId, response.data);
      }

      console.warn('GPS51 fuel data request failed:', response);
      return null;
    } catch (error) {
      console.error('Failed to fetch GPS51 fuel consumption data:', error);
      return null;
    }
  }

  async getBatchFuelConsumptionData(
    deviceIds: string[],
    period: FuelConsumptionPeriod,
    token: string
  ): Promise<GPS51FuelData[]> {
    const promises = deviceIds.map(deviceId => 
      this.getFuelConsumptionData(deviceId, period, token)
    );

    const results = await Promise.allSettled(promises);
    
    return results
      .filter((result): result is PromiseFulfilledResult<GPS51FuelData> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);
  }

  async getDetailedTripFuelData(
    deviceId: string,
    period: FuelConsumptionPeriod,
    token: string
  ): Promise<GPS51FuelData | null> {
    try {
      // Get detailed trip data with fuel consumption
      const trackData = await this.gps51Client['apiClient'].makeRequest('querytracks', token, {
        deviceid: deviceId,
        begintime: this.formatDateForAPI(period.start),
        endtime: this.formatDateForAPI(period.end),
        detail: 1
      });

      const fuelData = await this.getFuelConsumptionData(deviceId, period, token);
      
      if (trackData.status === 0 && fuelData) {
        // Enhance fuel data with detailed trip information
        fuelData.tripData = this.extractTripFuelData(trackData.data);
        return fuelData;
      }

      return fuelData;
    } catch (error) {
      console.error('Failed to fetch detailed trip fuel data:', error);
      return null;
    }
  }

  private parseGPS51FuelResponse(deviceId: string, data: any): GPS51FuelData {
    // Parse the GPS51 response format for fuel consumption data
    const fuelInfo = data.mileageinfo || data.fuelinfo || {};
    
    return {
      deviceId,
      deviceName: data.devicename || deviceId,
      oilPer100km: parseFloat(fuelInfo.oilper100km || '0'),
      runOilPer100km: parseFloat(fuelInfo.runoilper100km || '0'),
      totalDistance: parseFloat(fuelInfo.totalmileage || fuelInfo.distance || '0'),
      totalFuel: parseFloat(fuelInfo.totalfuel || fuelInfo.fuel || '0'),
      averageSpeed: parseFloat(fuelInfo.avgspeed || '0'),
      reportDate: data.reportdate || new Date().toISOString()
    };
  }

  private extractTripFuelData(trackData: any[]): GPS51FuelData['tripData'] {
    if (!Array.isArray(trackData)) return [];

    return trackData
      .filter(track => track.fuel !== undefined)
      .map(track => ({
        startTime: track.begintime,
        endTime: track.endtime,
        distance: parseFloat(track.distance || '0'),
        fuelUsed: parseFloat(track.fuel || '0')
      }));
  }

  private formatDateForAPI(date: Date): string {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  }

  // Helper methods for creating common period types
  createDailyPeriod(date: Date = new Date()): FuelConsumptionPeriod {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return { start, end, type: 'daily' };
  }

  createWeeklyPeriod(date: Date = new Date()): FuelConsumptionPeriod {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end, type: 'weekly' };
  }

  createMonthlyPeriod(date: Date = new Date()): FuelConsumptionPeriod {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

    return { start, end, type: 'monthly' };
  }

  createCustomPeriod(start: Date, end: Date): FuelConsumptionPeriod {
    return { start, end, type: 'custom' };
  }
}

export const gps51FuelConsumptionService = GPS51FuelConsumptionService.getInstance();