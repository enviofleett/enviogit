// Stub implementation until database schema is ready
export class MaptilerServiceStub {
  async logUsage(): Promise<void> {
    console.log('MaptilerService: Usage logging temporarily disabled - database schema pending');
  }

  async trackMapLoad(): Promise<void> {
    console.log('MaptilerService: Map load tracking temporarily disabled - database schema pending');
  }

  async trackGeocoding(): Promise<void> {
    console.log('MaptilerService: Geocoding tracking temporarily disabled - database schema pending');
  }

  async getUsageStats(): Promise<any[]> {
    console.log('MaptilerService: Usage stats temporarily disabled - database schema pending');
    return [];
  }
}

export const maptilerServiceStub = new MaptilerServiceStub();