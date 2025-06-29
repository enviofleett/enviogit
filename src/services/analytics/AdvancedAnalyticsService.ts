export interface VehicleUtilizationPattern {
  vehicleId: string;
  dailyUtilization: number[];
  weeklyPattern: number[];
  peakHours: number[];
  averageSpeed: number;
  totalDistance: number;
  idleTimePercent: number;
}

export interface PredictivePositioning {
  vehicleId: string;
  predictedLat: number;
  predictedLng: number;
  confidence: number;
  timeToArrival: number;
  route: { lat: number; lng: number }[];
}

export interface OptimizationInsight {
  type: 'frequency' | 'route' | 'maintenance' | 'fuel';
  vehicleId: string;
  recommendation: string;
  potentialSavings: number;
  priority: 'low' | 'medium' | 'high';
}

export class AdvancedAnalyticsService {
  private static instance: AdvancedAnalyticsService;
  private utilizationHistory = new Map<string, VehicleUtilizationPattern>();
  private positionHistory = new Map<string, Array<{ lat: number; lng: number; timestamp: Date; speed: number }>>();

  static getInstance(): AdvancedAnalyticsService {
    if (!AdvancedAnalyticsService.instance) {
      AdvancedAnalyticsService.instance = new AdvancedAnalyticsService();
    }
    return AdvancedAnalyticsService.instance;
  }

  // Track vehicle utilization patterns
  updateVehicleUtilization(vehicleId: string, position: {
    lat: number;
    lng: number;
    speed: number;
    timestamp: Date;
    ignitionStatus: boolean;
  }): void {
    // Update position history
    let history = this.positionHistory.get(vehicleId) || [];
    history.push({
      lat: position.lat,
      lng: position.lng,
      timestamp: position.timestamp,
      speed: position.speed
    });

    // Keep only last 1000 positions
    if (history.length > 1000) {
      history = history.slice(-1000);
    }
    this.positionHistory.set(vehicleId, history);

    // Update utilization pattern
    this.calculateUtilizationPattern(vehicleId, history);
  }

  private calculateUtilizationPattern(vehicleId: string, history: Array<{ lat: number; lng: number; timestamp: Date; speed: number }>): void {
    if (history.length < 10) return;

    const last24Hours = history.filter(p => 
      Date.now() - p.timestamp.getTime() < 24 * 60 * 60 * 1000
    );

    const dailyUtilization = new Array(24).fill(0);
    const weeklyPattern = new Array(7).fill(0);
    let totalDistance = 0;
    let movingTime = 0;
    let totalTime = 0;

    last24Hours.forEach((point, index) => {
      const hour = point.timestamp.getHours();
      const dayOfWeek = point.timestamp.getDay();
      
      dailyUtilization[hour]++;
      weeklyPattern[dayOfWeek]++;

      if (index > 0) {
        const prevPoint = last24Hours[index - 1];
        const distance = this.calculateDistance(
          prevPoint.lat, prevPoint.lng,
          point.lat, point.lng
        );
        totalDistance += distance;
        
        const timeDiff = point.timestamp.getTime() - prevPoint.timestamp.getTime();
        totalTime += timeDiff;
        
        if (point.speed > 5) {
          movingTime += timeDiff;
        }
      }
    });

    const averageSpeed = totalTime > 0 ? (totalDistance / (totalTime / 3600000)) : 0;
    const idleTimePercent = totalTime > 0 ? ((totalTime - movingTime) / totalTime) * 100 : 0;

    const peakHours = dailyUtilization
      .map((usage, hour) => ({ hour, usage }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 3)
      .map(item => item.hour);

    this.utilizationHistory.set(vehicleId, {
      vehicleId,
      dailyUtilization,
      weeklyPattern,
      peakHours,
      averageSpeed,
      totalDistance,
      idleTimePercent
    });
  }

  // Predictive positioning using historical data
  predictNextPosition(vehicleId: string, minutesAhead: number = 5): PredictivePositioning | null {
    const history = this.positionHistory.get(vehicleId);
    if (!history || history.length < 5) return null;

    const recentHistory = history.slice(-10); // Last 10 positions
    
    // Simple linear prediction based on recent movement pattern
    const latTrend = this.calculateTrend(recentHistory.map(p => p.lat));
    const lngTrend = this.calculateTrend(recentHistory.map(p => p.lng));
    
    const lastPosition = recentHistory[recentHistory.length - 1];
    const predictedLat = lastPosition.lat + (latTrend * minutesAhead);
    const predictedLng = lastPosition.lng + (lngTrend * minutesAhead);

    // Calculate confidence based on consistency of movement
    const speedVariance = this.calculateVariance(recentHistory.map(p => p.speed));
    const confidence = Math.max(0.1, Math.min(0.9, 1 - (speedVariance / 100)));

    // Estimate time to arrival based on average speed
    const avgSpeed = recentHistory.reduce((sum, p) => sum + p.speed, 0) / recentHistory.length;
    const distance = this.calculateDistance(lastPosition.lat, lastPosition.lng, predictedLat, predictedLng);
    const timeToArrival = avgSpeed > 0 ? (distance / avgSpeed) * 60 : 0; // minutes

    return {
      vehicleId,
      predictedLat,
      predictedLng,
      confidence,
      timeToArrival,
      route: this.generatePredictedRoute(lastPosition, { lat: predictedLat, lng: predictedLng })
    };
  }

  // Generate optimization insights
  generateOptimizationInsights(): OptimizationInsight[] {
    const insights: OptimizationInsight[] = [];

    for (const [vehicleId, pattern] of this.utilizationHistory.entries()) {
      // High idle time insight
      if (pattern.idleTimePercent > 70) {
        insights.push({
          type: 'frequency',
          vehicleId,
          recommendation: `Reduce sync frequency during idle periods (${pattern.idleTimePercent.toFixed(1)}% idle time)`,
          potentialSavings: pattern.idleTimePercent * 0.5, // Estimated cost savings
          priority: 'medium'
        });
      }

      // Low utilization insight
      const avgDailyUtilization = pattern.dailyUtilization.reduce((a, b) => a + b, 0) / 24;
      if (avgDailyUtilization < 5) {
        insights.push({
          type: 'route',
          vehicleId,
          recommendation: 'Vehicle shows low utilization - consider route optimization',
          potentialSavings: 20,
          priority: 'low'
        });
      }

      // Speed-based optimization
      if (pattern.averageSpeed > 60) {
        insights.push({
          type: 'frequency',
          vehicleId,
          recommendation: 'Increase sync frequency for high-speed vehicle',
          potentialSavings: -5, // Negative savings but better tracking
          priority: 'high'
        });
      }
    }

    return insights.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + (x * y), 0);
    const sumX2 = values.reduce((sum, _, x) => sum + (x * x), 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private generatePredictedRoute(start: { lat: number; lng: number }, end: { lat: number; lng: number }): { lat: number; lng: number }[] {
    // Simple linear interpolation - in production, you'd use a routing service
    const steps = 5;
    const route = [];
    
    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps;
      route.push({
        lat: start.lat + (end.lat - start.lat) * ratio,
        lng: start.lng + (end.lng - start.lng) * ratio
      });
    }
    
    return route;
  }

  getVehicleUtilizationPattern(vehicleId: string): VehicleUtilizationPattern | null {
    return this.utilizationHistory.get(vehicleId) || null;
  }

  getAllUtilizationPatterns(): VehicleUtilizationPattern[] {
    return Array.from(this.utilizationHistory.values());
  }
}

export const advancedAnalyticsService = AdvancedAnalyticsService.getInstance();
