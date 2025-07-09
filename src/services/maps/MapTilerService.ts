/**
 * MapTiler Service - Handles map initialization and management
 */

export interface MapTilerConfig {
  apiKey: string;
  style: 'streets' | 'satellite' | 'terrain' | 'hybrid';
  center: [number, number];
  zoom: number;
}

export interface MapMarkerData {
  id: string;
  position: [number, number];
  title: string;
  status: 'moving' | 'stationary' | 'offline';
  speed?: number;
  lastUpdate?: Date;
}

export class MapTilerService {
  private map: any = null;
  private markers: Map<string, any> = new Map();
  private config: MapTilerConfig;

  constructor(config: MapTilerConfig) {
    this.config = config;
  }

  async initialize(container: HTMLElement): Promise<boolean> {
    try {
      // Check if MapTiler GL JS is available
      if (typeof window === 'undefined' || !(window as any).maplibregl) {
        console.warn('MapLibre GL JS not available. Loading from CDN...');
        await this.loadMapLibre();
      }

      const maplibregl = (window as any).maplibregl;
      
      // MapTiler styles with API key
      const styleUrl = this.getStyleUrl();
      
      this.map = new maplibregl.Map({
        container,
        style: styleUrl,
        center: this.config.center,
        zoom: this.config.zoom,
        pitch: 0,
        bearing: 0
      });

      // Add navigation controls
      this.map.addControl(new maplibregl.NavigationControl(), 'top-right');
      
      // Add geolocate control
      this.map.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true
          },
          trackUserLocation: true,
          showUserHeading: true
        }),
        'top-right'
      );

      console.log('MapTiler initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize MapTiler:', error);
      return false;
    }
  }

  private async loadMapLibre(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Load MapLibre GL JS CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
      document.head.appendChild(link);

      // Load MapLibre GL JS script
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load MapLibre GL JS'));
      document.head.appendChild(script);
    });
  }

  private getStyleUrl(): string {
    const baseUrl = 'https://api.maptiler.com/maps';
    const key = this.config.apiKey;
    
    switch (this.config.style) {
      case 'satellite':
        return `${baseUrl}/satellite/style.json?key=${key}`;
      case 'terrain':
        return `${baseUrl}/terrain/style.json?key=${key}`;
      case 'hybrid':
        return `${baseUrl}/hybrid/style.json?key=${key}`;
      default:
        return `${baseUrl}/streets/style.json?key=${key}`;
    }
  }

  addMarker(data: MapMarkerData): void {
    if (!this.map) return;

    const maplibregl = (window as any).maplibregl;
    
    // Create marker element
    const markerElement = document.createElement('div');
    markerElement.className = `maptiler-marker ${data.status}`;
    markerElement.innerHTML = `
      <div class="marker-content">
        <div class="marker-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L13.2 8.6L20 7.4L12 15L10.8 8.4L4 9.6L12 2Z" fill="currentColor"/>
          </svg>
        </div>
        <div class="marker-info">
          <div class="vehicle-name">${data.title}</div>
          ${data.speed ? `<div class="vehicle-speed">${data.speed} km/h</div>` : ''}
        </div>
      </div>
    `;

    // Create popup
    const popup = new maplibregl.Popup({
      offset: 25,
      closeButton: false
    }).setHTML(`
      <div class="vehicle-popup">
        <h3>${data.title}</h3>
        ${data.speed ? `<p><strong>Speed:</strong> ${data.speed} km/h</p>` : ''}
        <p><strong>Status:</strong> ${data.status}</p>
        ${data.lastUpdate ? `<p><strong>Last Update:</strong> ${data.lastUpdate.toLocaleTimeString()}</p>` : ''}
      </div>
    `);

    // Create marker
    const marker = new maplibregl.Marker(markerElement)
      .setLngLat(data.position)
      .setPopup(popup)
      .addTo(this.map);

    this.markers.set(data.id, marker);
  }

  removeMarker(id: string): void {
    const marker = this.markers.get(id);
    if (marker) {
      marker.remove();
      this.markers.delete(id);
    }
  }

  clearMarkers(): void {
    this.markers.forEach(marker => marker.remove());
    this.markers.clear();
  }

  fitBounds(positions: [number, number][], padding: number = 50): void {
    if (!this.map || positions.length === 0) return;

    const maplibregl = (window as any).maplibregl;
    const bounds = new maplibregl.LngLatBounds();
    
    positions.forEach(pos => bounds.extend(pos));
    
    this.map.fitBounds(bounds, {
      padding,
      maxZoom: 15
    });
  }

  setCenter(position: [number, number], zoom?: number): void {
    if (!this.map) return;
    
    this.map.flyTo({
      center: position,
      zoom: zoom || this.config.zoom
    });
  }

  updateStyle(style: MapTilerConfig['style']): void {
    if (!this.map) return;
    
    this.config.style = style;
    const styleUrl = this.getStyleUrl();
    this.map.setStyle(styleUrl);
  }

  destroy(): void {
    if (this.map) {
      this.clearMarkers();
      this.map.remove();
      this.map = null;
    }
  }

  getMap(): any {
    return this.map;
  }

  static validateApiKey(apiKey: string): boolean {
    return /^[a-zA-Z0-9]{20,}$/.test(apiKey);
  }

  static async testConnection(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`https://api.maptiler.com/maps/streets/style.json?key=${apiKey}`);
      return response.ok;
    } catch {
      return false;
    }
  }
}