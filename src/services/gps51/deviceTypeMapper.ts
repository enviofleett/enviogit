
export class GPS51DeviceTypeMapper {
  static mapDeviceTypeToVehicleType(deviceType: string): 'sedan' | 'truck' | 'van' | 'motorcycle' | 'bike' | 'other' {
    // Map GPS51 device types to our vehicle types
    // Convert string to number for comparison if it's a numeric string
    const typeNumber = parseInt(deviceType, 10);
    
    if (!isNaN(typeNumber)) {
      switch (typeNumber) {
        case 1:
        case 2:
          return 'sedan';
        case 3:
        case 4:
          return 'truck';
        case 5:
          return 'van';
        case 6:
          return 'motorcycle';
        case 7:
          return 'bike';
        default:
          return 'other';
      }
    }
    
    // Handle string-based device types
    switch (deviceType.toLowerCase()) {
      case 'car':
      case 'sedan':
        return 'sedan';
      case 'truck':
        return 'truck';
      case 'van':
        return 'van';
      case 'motorcycle':
      case 'motorbike':
        return 'motorcycle';
      case 'bike':
      case 'bicycle':
        return 'bike';
      default:
        return 'other';
    }
  }
}
