// GPS51 Analytics Engine - Phase 3.2
// Real-time analytics processing and data insights

import { supabase } from '@/integrations/supabase/client';
import { gps51EventBus } from '../gps51/realtime';

export interface AnalyticsMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  vehicleId?: string;
  category: 'performance' | 'efficiency' | 'safety' | 'utilization' | 'maintenance';
  metadata?: Record<string, any>;
}

export interface RouteAnalytics {
  routeId: string;
  distance: number;
  duration: number;
  averageSpeed: number;
  maxSpeed: number;
  idleTime: number;
  fuelConsumption?: number;
  efficiency: number;
  safetyScore: number;
  deviations: number;
  timestamp: Date;
}

export interface VehiclePerformance {
  vehicleId: string;
  date: Date;
  totalDistance: number;
  totalDuration: number;
  averageSpeed: number;
  maxSpeed: number;
  idleTime: number;
  fuelEfficiency?: number;
  safetyScore: number;
  utilizationRate: number;
  maintenanceAlerts: number;
  geofenceViolations: number;
}

export interface FleetAnalytics {
  date: Date;
  totalVehicles: number;
  activeVehicles: number;
  totalDistance: number;
  totalDuration: number;
  averageUtilization: number;
  fuelConsumption: number;
  safetyIncidents: number;
  maintenanceRequired: number;
  costPerKm: number;
  revenue?: number;
  profitability?: number;
}

export interface RealTimeInsights {
  timestamp: Date;
  activeVehicles: number;
  vehiclesInTransit: number;
  vehiclesIdle: number;
  totalSpeed: number;
  alertsGenerated: number;
  geofenceEvents: number;
  systemLoad: number;
  dataQuality: number;
}

export class GPS51AnalyticsEngine {
  private metrics = new Map<string, AnalyticsMetric>();
  private routeAnalytics = new Map<string, RouteAnalytics>();
  private vehiclePerformance = new Map<string, VehiclePerformance>();
  private fleetAnalytics: FleetAnalytics[] = [];
  private realTimeInsights: RealTimeInsights | null = null;
  
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor() {
    this.setupEventListeners();
    this.startRealTimeProcessing();
  }

  // Real-Time Analytics Processing
  private startRealTimeProcessing(): void {
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing) {
        this.isProcessing = true;
        try {
          await this.processRealTimeAnalytics();
          await this.updateFleetAnalytics();
          await this.detectAnomalies();
        } catch (error) {
          console.error('GPS51AnalyticsEngine: Processing error:', error);
        } finally {
          this.isProcessing = false;
        }
      }
    }, 30000); // Process every 30 seconds
  }

  private async processRealTimeAnalytics(): Promise<void> {
    try {
      // Get recent vehicle positions
      const { data: positions, error } = await supabase
        .from('vehicle_positions')
        .select('*')
        .gte('timestamp', new Date(Date.now() - 300000).toISOString()) // Last 5 minutes
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Process positions for insights
      const insights = this.calculateRealTimeInsights(positions || []);
      this.realTimeInsights = insights;

      // Emit real-time analytics update
      gps51EventBus.emit('gps51.analytics.realtime', insights, {
        source: 'analytics_engine',
        priority: 'normal'
      });

      console.log('GPS51AnalyticsEngine: Real-time analytics updated');

    } catch (error) {
      console.error('GPS51AnalyticsEngine: Error processing real-time analytics:', error);
    }
  }

  private calculateRealTimeInsights(positions: any[]): RealTimeInsights {
    const vehicleData = new Map<string, any[]>();
    
    // Group positions by vehicle
    positions.forEach(pos => {
      if (!vehicleData.has(pos.vehicle_id)) {
        vehicleData.set(pos.vehicle_id, []);
      }
      vehicleData.get(pos.vehicle_id)!.push(pos);
    });

    const activeVehicles = vehicleData.size;
    let vehiclesInTransit = 0;
    let vehiclesIdle = 0;
    let totalSpeed = 0;
    let speedCount = 0;

    // Analyze each vehicle's status
    vehicleData.forEach((vehiclePositions, vehicleId) => {
      const latestPosition = vehiclePositions[0]; // Most recent
      const speed = latestPosition.speed || 0;
      
      if (speed > 5) { // Moving threshold
        vehiclesInTransit++;
      } else {
        vehiclesIdle++;
      }
      
      totalSpeed += speed;
      speedCount++;
    });

    return {
      timestamp: new Date(),
      activeVehicles,
      vehiclesInTransit,
      vehiclesIdle,
      totalSpeed: speedCount > 0 ? totalSpeed / speedCount : 0,
      alertsGenerated: 0, // Would be calculated from alerts
      geofenceEvents: 0, // Would be calculated from geofence events
      systemLoad: Math.random() * 100, // Placeholder
      dataQuality: Math.min(100, (positions.length / activeVehicles) * 20) // Simplified quality metric
    };
  }

  // Vehicle Performance Analytics
  async calculateVehiclePerformance(vehicleId: string, date: Date): Promise<VehiclePerformance> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get vehicle positions for the day
      const { data: positions, error } = await supabase
        .from('vehicle_positions')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .gte('timestamp', startOfDay.toISOString())
        .lte('timestamp', endOfDay.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      if (!positions || positions.length === 0) {
        return this.createEmptyPerformance(vehicleId, date);
      }

      // Calculate performance metrics
      const performance = this.analyzeVehiclePositions(vehicleId, date, positions);
      
      // Store performance data
      this.vehiclePerformance.set(`${vehicleId}_${date.toISOString().split('T')[0]}`, performance);
      
      return performance;

    } catch (error) {
      console.error('GPS51AnalyticsEngine: Error calculating vehicle performance:', error);
      return this.createEmptyPerformance(vehicleId, date);
    }
  }

  private analyzeVehiclePositions(vehicleId: string, date: Date, positions: any[]): VehiclePerformance {
    let totalDistance = 0;
    let totalDuration = 0;
    let maxSpeed = 0;
    let idleTime = 0;
    let speedSum = 0;
    let speedCount = 0;

    // Calculate metrics from positions
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      
      // Calculate distance between points
      const distance = this.calculateDistance(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude
      );
      totalDistance += distance;
      
      // Calculate time difference
      const timeDiff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
      totalDuration += timeDiff;
      
      // Track speeds
      const speed = curr.speed || 0;
      maxSpeed = Math.max(maxSpeed, speed);
      speedSum += speed;
      speedCount++;
      
      // Calculate idle time (speed < 2 km/h)
      if (speed < 2) {
        idleTime += timeDiff;
      }
    }

    const averageSpeed = speedCount > 0 ? speedSum / speedCount : 0;
    const utilizationRate = totalDuration > 0 ? ((totalDuration - idleTime) / totalDuration) * 100 : 0;

    return {
      vehicleId,
      date,
      totalDistance: totalDistance / 1000, // Convert to km
      totalDuration: totalDuration / (1000 * 60 * 60), // Convert to hours
      averageSpeed,
      maxSpeed,
      idleTime: idleTime / (1000 * 60), // Convert to minutes
      fuelEfficiency: this.estimateFuelEfficiency(totalDistance, averageSpeed),
      safetyScore: this.calculateSafetyScore(positions),
      utilizationRate,
      maintenanceAlerts: 0, // Would be calculated from maintenance data
      geofenceViolations: 0 // Would be calculated from geofence events
    };
  }

  private createEmptyPerformance(vehicleId: string, date: Date): VehiclePerformance {
    return {
      vehicleId,
      date,
      totalDistance: 0,
      totalDuration: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      idleTime: 0,
      safetyScore: 100,
      utilizationRate: 0,
      maintenanceAlerts: 0,
      geofenceViolations: 0
    };
  }

  // Route Analytics
  async analyzeRoute(routeId: string, positions: any[]): Promise<RouteAnalytics> {
    if (positions.length < 2) {
      throw new Error('Insufficient position data for route analysis');
    }

    let totalDistance = 0;
    let speedSum = 0;
    let maxSpeed = 0;
    let idleTime = 0;
    let deviations = 0;

    // Analyze route segments
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      
      // Calculate distance
      const distance = this.calculateDistance(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude
      );
      totalDistance += distance;
      
      // Analyze speed
      const speed = curr.speed || 0;
      speedSum += speed;
      maxSpeed = Math.max(maxSpeed, speed);
      
      // Check for idle time
      if (speed < 2) {
        const timeDiff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
        idleTime += timeDiff;
      }
      
      // Detect route deviations (simplified)
      if (distance > 1000) { // Large jump might indicate deviation
        deviations++;
      }
    }

    const duration = new Date(positions[positions.length - 1].timestamp).getTime() - 
                    new Date(positions[0].timestamp).getTime();
    const averageSpeed = positions.length > 1 ? speedSum / (positions.length - 1) : 0;

    const routeAnalytics: RouteAnalytics = {
      routeId,
      distance: totalDistance / 1000, // Convert to km
      duration: duration / (1000 * 60), // Convert to minutes
      averageSpeed,
      maxSpeed,
      idleTime: idleTime / (1000 * 60), // Convert to minutes
      fuelConsumption: this.estimateFuelConsumption(totalDistance, averageSpeed),
      efficiency: this.calculateRouteEfficiency(totalDistance, duration, idleTime),
      safetyScore: this.calculateSafetyScore(positions),
      deviations,
      timestamp: new Date()
    };

    this.routeAnalytics.set(routeId, routeAnalytics);
    return routeAnalytics;
  }

  // Fleet Analytics
  private async updateFleetAnalytics(): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get today's fleet data
      const vehicles = await this.getActiveVehicles();
      const totalVehicles = vehicles.length;
      
      let totalDistance = 0;
      let totalDuration = 0;
      let utilizationSum = 0;
      let fuelConsumption = 0;

      // Aggregate vehicle performance data
      for (const vehicle of vehicles) {
        const performance = this.vehiclePerformance.get(`${vehicle.id}_${today.toISOString().split('T')[0]}`);
        if (performance) {
          totalDistance += performance.totalDistance;
          totalDuration += performance.totalDuration;
          utilizationSum += performance.utilizationRate;
          fuelConsumption += performance.fuelEfficiency || 0;
        }
      }

      const fleetAnalytics: FleetAnalytics = {
        date: today,
        totalVehicles,
        activeVehicles: vehicles.length,
        totalDistance,
        totalDuration,
        averageUtilization: totalVehicles > 0 ? utilizationSum / totalVehicles : 0,
        fuelConsumption,
        safetyIncidents: 0, // Would be calculated from safety data
        maintenanceRequired: 0, // Would be calculated from maintenance data
        costPerKm: this.calculateCostPerKm(totalDistance, fuelConsumption),
        revenue: 0, // Would be calculated from business data
        profitability: 0 // Would be calculated from revenue and costs
      };

      this.fleetAnalytics.push(fleetAnalytics);
      
      // Keep only last 30 days
      if (this.fleetAnalytics.length > 30) {
        this.fleetAnalytics = this.fleetAnalytics.slice(-30);
      }

    } catch (error) {
      console.error('GPS51AnalyticsEngine: Error updating fleet analytics:', error);
    }
  }

  // Anomaly Detection
  private async detectAnomalies(): Promise<void> {
    try {
      // Detect unusual patterns in real-time data
      if (this.realTimeInsights) {
        const insights = this.realTimeInsights;
        
        // Check for anomalies
        if (insights.systemLoad > 90) {
          this.createMetric('system_load_high', insights.systemLoad, '%', 'performance');
        }
        
        if (insights.dataQuality < 50) {
          this.createMetric('data_quality_low', insights.dataQuality, '%', 'performance');
        }
        
        if (insights.vehiclesIdle / insights.activeVehicles > 0.8) {
          this.createMetric('high_idle_rate', (insights.vehiclesIdle / insights.activeVehicles) * 100, '%', 'efficiency');
        }
      }

    } catch (error) {
      console.error('GPS51AnalyticsEngine: Error detecting anomalies:', error);
    }
  }

  // Utility Methods
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private estimateFuelEfficiency(distance: number, averageSpeed: number): number {
    // Simplified fuel efficiency calculation (L/100km)
    const baseConsumption = 8; // Base consumption rate
    const speedFactor = averageSpeed > 80 ? 1.2 : (averageSpeed < 40 ? 1.1 : 1.0);
    return baseConsumption * speedFactor;
  }

  private estimateFuelConsumption(distance: number, averageSpeed: number): number {
    const efficiency = this.estimateFuelEfficiency(distance, averageSpeed);
    return (distance / 1000) * (efficiency / 100); // Liters consumed
  }

  private calculateRouteEfficiency(distance: number, duration: number, idleTime: number): number {
    if (duration === 0) return 0;
    const movingTime = duration - idleTime;
    return (movingTime / duration) * 100; // Percentage of time actually moving
  }

  private calculateSafetyScore(positions: any[]): number {
    // Simplified safety score calculation
    let violations = 0;
    const speedLimit = 80; // km/h
    
    positions.forEach(pos => {
      if ((pos.speed || 0) > speedLimit) {
        violations++;
      }
    });
    
    return Math.max(0, 100 - (violations / positions.length) * 100);
  }

  private calculateCostPerKm(totalDistance: number, fuelConsumption: number): number {
    const fuelPrice = 1.5; // Price per liter
    const maintenanceCost = 0.1; // Per km
    const fuelCost = fuelConsumption * fuelPrice;
    
    if (totalDistance === 0) return 0;
    return (fuelCost + (totalDistance * maintenanceCost)) / totalDistance;
  }

  private async getActiveVehicles(): Promise<any[]> {
    try {
      const { data: vehicles, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('status', 'active');

      if (error) throw error;
      return vehicles || [];
    } catch (error) {
      console.error('GPS51AnalyticsEngine: Error getting active vehicles:', error);
      return [];
    }
  }

  private createMetric(name: string, value: number, unit: string, category: any, vehicleId?: string): void {
    const metric: AnalyticsMetric = {
      id: `${name}_${Date.now()}`,
      name,
      value,
      unit,
      timestamp: new Date(),
      vehicleId,
      category
    };

    this.metrics.set(metric.id, metric);

    // Emit metric event
    gps51EventBus.emit('gps51.analytics.metric', metric, {
      source: 'analytics_engine',
      priority: 'normal'
    });
  }

  private setupEventListeners(): void {
    // Listen for position updates to trigger analytics
    gps51EventBus.on('gps51.positions.updated', async (event) => {
      if (event.data && Array.isArray(event.data)) {
        // Process new positions for analytics
        for (const position of event.data) {
          if (position.vehicleId) {
            await this.calculateVehiclePerformance(position.vehicleId, new Date());
          }
        }
      }
    });
  }

  // Public API
  getMetrics(category?: string, vehicleId?: string): AnalyticsMetric[] {
    const metrics = Array.from(this.metrics.values());
    return metrics.filter(metric => {
      if (category && metric.category !== category) return false;
      if (vehicleId && metric.vehicleId !== vehicleId) return false;
      return true;
    });
  }

  getRouteAnalytics(routeId?: string): RouteAnalytics[] {
    if (routeId) {
      const analytics = this.routeAnalytics.get(routeId);
      return analytics ? [analytics] : [];
    }
    return Array.from(this.routeAnalytics.values());
  }

  getVehiclePerformance(vehicleId?: string, date?: Date): VehiclePerformance[] {
    const performances = Array.from(this.vehiclePerformance.values());
    return performances.filter(perf => {
      if (vehicleId && perf.vehicleId !== vehicleId) return false;
      if (date && perf.date.toDateString() !== date.toDateString()) return false;
      return true;
    });
  }

  getFleetAnalytics(days: number = 7): FleetAnalytics[] {
    return this.fleetAnalytics.slice(-days);
  }

  getRealTimeInsights(): RealTimeInsights | null {
    return this.realTimeInsights;
  }

  destroy(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.metrics.clear();
    this.routeAnalytics.clear();
    this.vehiclePerformance.clear();
    this.fleetAnalytics = [];
    this.realTimeInsights = null;
    console.log('GPS51AnalyticsEngine: Destroyed');
  }
}

// Create singleton instance
export const gps51AnalyticsEngine = new GPS51AnalyticsEngine();
