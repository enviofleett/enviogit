// GPS51 Historical Data Service - Phase 2: Historical Data & Trip Analysis
// Provides historical position data, trip reports, and analytics

import { gps51Client } from './GPS51Client';
import { GPS51_STATUS } from './GPS51Constants';

export interface HistoricalPosition {
  deviceId: string;
  timestamp: Date;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  altitude: number;
  totalDistance: number;
  status: number;
  moving: boolean;
  address?: string;
}

export interface TripReport {
  deviceId: string;
  tripId: string;
  startTime: Date;
  endTime: Date;
  startLocation: {
    lat: number;
    lng: number;
    address?: string;
  };
  endLocation: {
    lat: number;
    lng: number;
    address?: string;
  };
  distance: number; // in meters
  duration: number; // in seconds
  maxSpeed: number;
  avgSpeed: number;
  idleTime: number; // in seconds
  fuelConsumption?: number;
  route: HistoricalPosition[];
}

export interface TripAnalytics {
  totalTrips: number;
  totalDistance: number;
  totalDuration: number;
  avgTripDistance: number;
  avgTripDuration: number;
  maxSpeed: number;
  avgSpeed: number;
  totalIdleTime: number;
  fuelEfficiency?: number;
  mostActiveHours: number[];
  commonRoutes: Array<{
    startArea: string;
    endArea: string;
    frequency: number;
  }>;
}

export class GPS51HistoricalDataService {
  private readonly DEFAULT_TIMEZONE = 8; // GMT+8 for GPS51 API

  /**
   * Get historical tracking data for a device
   */
  async getHistoricalTracks(
    deviceId: string,
    startTime: Date,
    endTime: Date,
    timezone: number = this.DEFAULT_TIMEZONE
  ): Promise<HistoricalPosition[]> {
    try {
      console.log('GPS51HistoricalDataService: Fetching historical tracks:', {
        deviceId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        timezone
      });

      // Ensure client is authenticated
      if (!gps51Client.isAuthenticated()) {
        throw new Error('GPS51 client not authenticated');
      }

      const response = await gps51Client['apiClient'].makeRequest('querytracks', gps51Client.getToken()!, {
        deviceid: deviceId,
        begintime: this.formatDateTime(startTime),
        endtime: this.formatDateTime(endTime),
        timezone: timezone
      });

      console.log('GPS51HistoricalDataService: Tracks response:', {
        status: response.status,
        hasData: !!response.data,
        hasRecords: !!response.records,
        dataLength: Array.isArray(response.data) ? response.data.length : 0,
        recordsLength: Array.isArray(response.records) ? response.records.length : 0
      });

      if (response.status === GPS51_STATUS.SUCCESS) {
        const rawData = response.data || response.records || [];
        
        if (!Array.isArray(rawData)) {
          console.warn('GPS51HistoricalDataService: No valid tracks data received');
          return [];
        }

        // Convert raw data to HistoricalPosition format
        const positions = rawData.map(this.convertToHistoricalPosition);
        
        console.log('GPS51HistoricalDataService: Successfully processed', positions.length, 'historical positions');
        return positions;

      } else {
        const errorMessage = response.cause || response.message || `Failed to fetch historical tracks - Status: ${response.status}`;
        console.error('GPS51HistoricalDataService: Tracks error:', errorMessage);
        throw new Error(errorMessage);
      }

    } catch (error) {
      console.error('GPS51HistoricalDataService: Error fetching historical tracks:', error);
      throw error;
    }
  }

  /**
   * Get trip reports for a device
   */
  async getTripReports(
    deviceId: string,
    startTime: Date,
    endTime: Date,
    timezone: number = this.DEFAULT_TIMEZONE
  ): Promise<TripReport[]> {
    try {
      console.log('GPS51HistoricalDataService: Fetching trip reports:', {
        deviceId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        timezone
      });

      // Ensure client is authenticated
      if (!gps51Client.isAuthenticated()) {
        throw new Error('GPS51 client not authenticated');
      }

      const response = await gps51Client['apiClient'].makeRequest('querytrips', gps51Client.getToken()!, {
        deviceid: deviceId,
        begintime: this.formatDateTime(startTime),
        endtime: this.formatDateTime(endTime),
        timezone: timezone
      });

      console.log('GPS51HistoricalDataService: Trips response:', {
        status: response.status,
        hasData: !!response.data,
        hasTrips: !!response.trips,
        dataLength: Array.isArray(response.data) ? response.data.length : 0
      });

      if (response.status === GPS51_STATUS.SUCCESS) {
        const rawData = response.data || response.trips || [];
        
        if (!Array.isArray(rawData)) {
          console.warn('GPS51HistoricalDataService: No valid trips data received');
          return [];
        }

        // Convert raw data to TripReport format
        const trips = await Promise.all(rawData.map(trip => this.convertToTripReport(trip, deviceId)));
        
        console.log('GPS51HistoricalDataService: Successfully processed', trips.length, 'trip reports');
        return trips;

      } else {
        const errorMessage = response.cause || response.message || `Failed to fetch trip reports - Status: ${response.status}`;
        console.error('GPS51HistoricalDataService: Trips error:', errorMessage);
        throw new Error(errorMessage);
      }

    } catch (error) {
      console.error('GPS51HistoricalDataService: Error fetching trip reports:', error);
      throw error;
    }
  }

  /**
   * Generate trip analytics for a device over a period
   */
  async generateTripAnalytics(
    deviceId: string,
    startTime: Date,
    endTime: Date,
    timezone: number = this.DEFAULT_TIMEZONE
  ): Promise<TripAnalytics> {
    try {
      console.log('GPS51HistoricalDataService: Generating trip analytics:', {
        deviceId,
        period: `${startTime.toISOString()} to ${endTime.toISOString()}`
      });

      // Get trip reports for the period
      const trips = await this.getTripReports(deviceId, startTime, endTime, timezone);

      if (trips.length === 0) {
        return this.getEmptyAnalytics();
      }

      // Calculate analytics
      const totalDistance = trips.reduce((sum, trip) => sum + trip.distance, 0);
      const totalDuration = trips.reduce((sum, trip) => sum + trip.duration, 0);
      const totalIdleTime = trips.reduce((sum, trip) => sum + trip.idleTime, 0);
      const maxSpeed = Math.max(...trips.map(trip => trip.maxSpeed));
      const avgSpeed = totalDistance > 0 ? (totalDistance / totalDuration) * 3.6 : 0; // Convert m/s to km/h

      // Calculate most active hours
      const hourCounts = new Array(24).fill(0);
      trips.forEach(trip => {
        const hour = trip.startTime.getHours();
        hourCounts[hour]++;
      });
      const mostActiveHours = hourCounts
        .map((count, hour) => ({ hour, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(item => item.hour);

      // Calculate common routes (simplified)
      const routeMap = new Map<string, number>();
      trips.forEach(trip => {
        const routeKey = `${trip.startLocation.address || 'Unknown'} → ${trip.endLocation.address || 'Unknown'}`;
        routeMap.set(routeKey, (routeMap.get(routeKey) || 0) + 1);
      });

      const commonRoutes = Array.from(routeMap.entries())
        .map(([route, frequency]) => {
          const [startArea, endArea] = route.split(' → ');
          return { startArea, endArea, frequency };
        })
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10);

      const analytics: TripAnalytics = {
        totalTrips: trips.length,
        totalDistance,
        totalDuration,
        avgTripDistance: totalDistance / trips.length,
        avgTripDuration: totalDuration / trips.length,
        maxSpeed,
        avgSpeed,
        totalIdleTime,
        mostActiveHours,
        commonRoutes
      };

      console.log('GPS51HistoricalDataService: Analytics generated:', {
        totalTrips: analytics.totalTrips,
        totalDistance: Math.round(analytics.totalDistance / 1000), // km
        avgSpeed: Math.round(analytics.avgSpeed)
      });

      return analytics;

    } catch (error) {
      console.error('GPS51HistoricalDataService: Error generating analytics:', error);
      throw error;
    }
  }

  /**
   * Get daily trip summary
   */
  async getDailyTripSummary(deviceId: string, date: Date, timezone: number = this.DEFAULT_TIMEZONE): Promise<{
    date: Date;
    totalTrips: number;
    totalDistance: number;
    totalDuration: number;
    totalIdleTime: number;
    firstTripStart?: Date;
    lastTripEnd?: Date;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const trips = await this.getTripReports(deviceId, startOfDay, endOfDay, timezone);

    return {
      date,
      totalTrips: trips.length,
      totalDistance: trips.reduce((sum, trip) => sum + trip.distance, 0),
      totalDuration: trips.reduce((sum, trip) => sum + trip.duration, 0),
      totalIdleTime: trips.reduce((sum, trip) => sum + trip.idleTime, 0),
      firstTripStart: trips.length > 0 ? trips[0].startTime : undefined,
      lastTripEnd: trips.length > 0 ? trips[trips.length - 1].endTime : undefined
    };
  }

  private convertToHistoricalPosition(rawData: any): HistoricalPosition {
    return {
      deviceId: rawData.deviceid || '',
      timestamp: new Date(rawData.devicetime || rawData.updatetime || Date.now()),
      latitude: rawData.callat || rawData.lat || 0,
      longitude: rawData.callon || rawData.lon || 0,
      speed: rawData.speed || 0,
      course: rawData.course || 0,
      altitude: rawData.altitude || 0,
      totalDistance: rawData.totaldistance || 0,
      status: rawData.status || 0,
      moving: rawData.moving === 1 || rawData.moving === true,
      address: rawData.address
    };
  }

  private async convertToTripReport(rawTrip: any, deviceId: string): Promise<TripReport> {
    const tripId = rawTrip.tripid || `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get detailed route if available
    let route: HistoricalPosition[] = [];
    if (rawTrip.route && Array.isArray(rawTrip.route)) {
      route = rawTrip.route.map(this.convertToHistoricalPosition);
    }

    return {
      deviceId,
      tripId,
      startTime: new Date(rawTrip.starttime || rawTrip.begintime || Date.now()),
      endTime: new Date(rawTrip.endtime || Date.now()),
      startLocation: {
        lat: rawTrip.startlat || rawTrip.beginlat || 0,
        lng: rawTrip.startlon || rawTrip.beginlon || 0,
        address: rawTrip.startaddress || rawTrip.beginaddress
      },
      endLocation: {
        lat: rawTrip.endlat || 0,
        lng: rawTrip.endlon || 0,
        address: rawTrip.endaddress
      },
      distance: rawTrip.distance || rawTrip.totaldistance || 0,
      duration: rawTrip.duration || rawTrip.totaltime || 0,
      maxSpeed: rawTrip.maxspeed || rawTrip.topspeed || 0,
      avgSpeed: rawTrip.avgspeed || rawTrip.averagespeed || 0,
      idleTime: rawTrip.idletime || rawTrip.stoptime || 0,
      fuelConsumption: rawTrip.fuelconsumption,
      route
    };
  }

  private formatDateTime(date: Date): string {
    // Format as "YYYY-MM-DD HH:MM:SS" for GPS51 API
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  private getEmptyAnalytics(): TripAnalytics {
    return {
      totalTrips: 0,
      totalDistance: 0,
      totalDuration: 0,
      avgTripDistance: 0,
      avgTripDuration: 0,
      maxSpeed: 0,
      avgSpeed: 0,
      totalIdleTime: 0,
      mostActiveHours: [],
      commonRoutes: []
    };
  }
}

export const gps51HistoricalDataService = new GPS51HistoricalDataService();