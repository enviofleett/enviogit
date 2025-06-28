
import { GPS51Vehicle, GPS51Position, GPS51Telemetry } from './types';

// Transform GPS51 data to our internal format
export class GPS51DataProcessor {
  static transformVehicle(gps51Vehicle: GPS51Vehicle) {
    return {
      id: gps51Vehicle.id,
      name: gps51Vehicle.name,
      license_plate: gps51Vehicle.plate,
      brand: gps51Vehicle.brand,
      model: gps51Vehicle.model,
      type: this.mapVehicleType(gps51Vehicle.type),
      status: this.mapVehicleStatus(gps51Vehicle.status),
      created_at: new Date(gps51Vehicle.createdAt).toISOString(),
      updated_at: new Date(gps51Vehicle.updatedAt).toISOString(),
    };
  }

  static transformPosition(gps51Position: GPS51Position) {
    return {
      vehicle_id: gps51Position.vehicleId,
      latitude: gps51Position.latitude,
      longitude: gps51Position.longitude,
      speed: gps51Position.speed,
      heading: gps51Position.heading,
      altitude: gps51Position.altitude || 0,
      accuracy: gps51Position.accuracy || 0,
      timestamp: new Date(gps51Position.timestamp).toISOString(),
      address: gps51Position.address,
      ignition_status: gps51Position.ignition,
      fuel_level: gps51Position.fuel,
      engine_temperature: gps51Position.temperature,
      battery_level: gps51Position.batteryLevel,
    };
  }

  static transformTelemetry(gps51Telemetry: GPS51Telemetry) {
    return {
      vehicle_id: gps51Telemetry.vehicleId,
      odometer: gps51Telemetry.odometer,
      fuel_level: gps51Telemetry.fuelLevel,
      engine_temperature: gps51Telemetry.engineTemperature,
      battery_voltage: gps51Telemetry.batteryVoltage,
      engine_hours: gps51Telemetry.engineHours,
      recorded_at: new Date(gps51Telemetry.timestamp).toISOString(),
    };
  }

  private static mapVehicleType(gps51Type: string) {
    const typeMap: Record<string, string> = {
      'car': 'sedan',
      'truck': 'truck',
      'van': 'van',
      'motorcycle': 'motorcycle',
    };
    return typeMap[gps51Type] || 'other';
  }

  private static mapVehicleStatus(gps51Status: string) {
    const statusMap: Record<string, string> = {
      'active': 'available',
      'inactive': 'unavailable',
      'maintenance': 'maintenance',
    };
    return statusMap[gps51Status] || 'unavailable';
  }

  // Calculate AI efficiency score based on telemetry data
  static calculateAIScore(position: GPS51Position, telemetry?: GPS51Telemetry): number {
    let score = 100;

    // Fuel efficiency factor
    if (telemetry?.fuelLevel) {
      if (telemetry.fuelLevel < 20) score -= 15;
      else if (telemetry.fuelLevel < 50) score -= 5;
    }

    // Speed factor (penalize excessive speeding)
    if (position.speed > 120) score -= 20;
    else if (position.speed > 80) score -= 10;

    // Engine temperature factor
    if (telemetry?.engineTemperature) {
      if (telemetry.engineTemperature > 100) score -= 25;
      else if (telemetry.engineTemperature > 90) score -= 10;
    }

    // Battery health factor
    if (telemetry?.batteryVoltage) {
      if (telemetry.batteryVoltage < 11.5) score -= 15;
      else if (telemetry.batteryVoltage < 12.0) score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }
}
