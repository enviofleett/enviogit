// GPS51 Video Service - Phase 4: Live Video Integration
// Provides live video streaming, channel management, and session handling

import { gps51Client } from './GPS51Client';
import { GPS51_STATUS } from './GPS51Constants';

export interface VideoChannel {
  id: number;
  name: string;
  isActive: boolean;
  resolution?: string;
  quality?: 'low' | 'medium' | 'high';
}

export interface VideoSession {
  id: string;
  deviceId: string;
  channels: number[];
  startTime: Date;
  endTime?: Date;
  streamUrl?: string;
  sessionType: 'live' | 'playback';
  status: 'starting' | 'active' | 'stopping' | 'stopped' | 'error';
  error?: string;
}

export interface VideoSessionOptions {
  channels: number[];
  dataType?: 0 | 1 | 2; // 0: Audio & Video, 1: Video only, 2: Audio only
  playType?: 'flvs' | 'rtmp' | 'hls'; // Default: flvs for web
  quality?: 'low' | 'medium' | 'high';
  autoTimeout?: number; // Minutes, default: 3
}

export class GPS51VideoService {
  private activeSessions = new Map<string, VideoSession>();
  private sessionTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly DEFAULT_TIMEOUT = 3 * 60 * 1000; // 3 minutes

  /**
   * Start live video streaming for a device
   */
  async startLiveVideo(
    deviceId: string,
    options: VideoSessionOptions
  ): Promise<{ success: boolean; sessionId?: string; streamUrl?: string; error?: string }> {
    try {
      console.log('GPS51VideoService: Starting live video:', {
        deviceId,
        channels: options.channels,
        playType: options.playType || 'flvs'
      });

      // Ensure client is authenticated
      if (!gps51Client.isAuthenticated()) {
        throw new Error('GPS51 client not authenticated');
      }

      // Validate channels
      if (!options.channels || options.channels.length === 0) {
        throw new Error('At least one video channel must be specified');
      }

      const sessionId = this.generateSessionId();
      const playType = options.playType || 'flvs'; // Default to FLV for web compatibility
      const dataType = options.dataType ?? 0; // Default to audio & video

      // Create session record
      const session: VideoSession = {
        id: sessionId,
        deviceId,
        channels: options.channels,
        startTime: new Date(),
        sessionType: 'live',
        status: 'starting'
      };

      this.activeSessions.set(sessionId, session);

      // Send start video command to GPS51 API
      const response = await gps51Client['apiClient'].makeRequest('startvideos_sync', gps51Client.getToken()!, {
        deviceid: deviceId,
        channels: options.channels,
        datatype: dataType,
        playtype: playType
      });

      console.log('GPS51VideoService: Start video response:', {
        sessionId,
        status: response.status,
        message: response.message,
        hasStreamUrl: !!response.streamurl
      });

      if (response.status === GPS51_STATUS.SUCCESS) {
        // Update session with stream URL
        session.status = 'active';
        session.streamUrl = response.streamurl || response.url;
        
        this.activeSessions.set(sessionId, session);

        // Set auto-timeout
        const timeoutMs = (options.autoTimeout || 3) * 60 * 1000;
        const timeoutId = setTimeout(() => {
          this.stopLiveVideo(sessionId);
        }, timeoutMs);
        
        this.sessionTimeouts.set(sessionId, timeoutId);

        console.log('GPS51VideoService: Live video started successfully:', {
          sessionId,
          streamUrl: session.streamUrl,
          timeoutMinutes: options.autoTimeout || 3
        });

        return {
          success: true,
          sessionId,
          streamUrl: session.streamUrl
        };

      } else {
        // Handle errors
        const errorMessage = response.cause || response.message || 'Failed to start video stream';
        
        session.status = 'error';
        session.error = errorMessage;
        this.activeSessions.set(sessionId, session);

        console.error('GPS51VideoService: Failed to start video:', {
          sessionId,
          error: errorMessage,
          status: response.status
        });

        return {
          success: false,
          error: errorMessage
        };
      }

    } catch (error) {
      console.error('GPS51VideoService: Error starting live video:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown video error'
      };
    }
  }

  /**
   * Stop live video streaming
   */
  async stopLiveVideo(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      console.log('GPS51VideoService: Stopping live video:', {
        sessionId,
        deviceId: session.deviceId,
        channels: session.channels
      });

      // Update session status
      session.status = 'stopping';
      this.activeSessions.set(sessionId, session);

      // Clear timeout
      const timeoutId = this.sessionTimeouts.get(sessionId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.sessionTimeouts.delete(sessionId);
      }

      // Send stop video command to GPS51 API
      const response = await gps51Client['apiClient'].makeRequest('stopvideos', gps51Client.getToken()!, {
        deviceid: session.deviceId,
        channels: session.channels,
        videoclosetype: 0 // Close audio and video
      });

      console.log('GPS51VideoService: Stop video response:', {
        sessionId,
        status: response.status,
        message: response.message
      });

      if (response.status === GPS51_STATUS.SUCCESS) {
        // Update session
        session.status = 'stopped';
        session.endTime = new Date();
        this.activeSessions.set(sessionId, session);

        console.log('GPS51VideoService: Live video stopped successfully:', sessionId);

        return { success: true };

      } else {
        const errorMessage = response.cause || response.message || 'Failed to stop video stream';
        
        session.status = 'error';
        session.error = errorMessage;
        this.activeSessions.set(sessionId, session);

        return {
          success: false,
          error: errorMessage
        };
      }

    } catch (error) {
      console.error('GPS51VideoService: Error stopping live video:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown video error'
      };
    }
  }

  /**
   * Get available video channels for a device
   */
  async getVideoChannels(deviceId: string): Promise<VideoChannel[]> {
    try {
      // Get device info to check video channel count
      const devices = await gps51Client.getDeviceList();
      const device = devices.find(d => d.deviceid === deviceId);
      
      if (!device) {
        throw new Error(`Device ${deviceId} not found`);
      }

      const channelCount = device.videochannelcount || 0;
      
      if (channelCount === 0) {
        console.log('GPS51VideoService: Device has no video channels:', deviceId);
        return [];
      }

      // Generate channel list
      const channels: VideoChannel[] = [];
      for (let i = 1; i <= channelCount; i++) {
        channels.push({
          id: i,
          name: `Channel ${i}`,
          isActive: true,
          resolution: '720p', // Default assumption
          quality: 'medium'
        });
      }

      console.log('GPS51VideoService: Found video channels:', {
        deviceId,
        channelCount,
        channels: channels.map(c => c.id)
      });

      return channels;

    } catch (error) {
      console.error('GPS51VideoService: Error getting video channels:', error);
      return [];
    }
  }

  /**
   * Get active video sessions
   */
  getActiveSessions(): VideoSession[] {
    return Array.from(this.activeSessions.values())
      .filter(session => session.status === 'active' || session.status === 'starting');
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): VideoSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Get sessions for a device
   */
  getDeviceSessions(deviceId: string): VideoSession[] {
    return Array.from(this.activeSessions.values())
      .filter(session => session.deviceId === deviceId);
  }

  /**
   * Stop all active sessions
   */
  async stopAllSessions(): Promise<void> {
    const activeSessions = this.getActiveSessions();
    
    console.log('GPS51VideoService: Stopping all active sessions:', activeSessions.length);

    const stopPromises = activeSessions.map(session => 
      this.stopLiveVideo(session.id)
    );

    await Promise.allSettled(stopPromises);

    console.log('GPS51VideoService: All sessions stopped');
  }

  /**
   * Clean up old sessions
   */
  cleanupOldSessions(maxAgeHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.status === 'stopped' && session.endTime && session.endTime < cutoffTime) {
        this.activeSessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log('GPS51VideoService: Cleaned up', cleanedCount, 'old sessions');
    }
  }

  /**
   * Get video service statistics
   */
  getVideoStats(): {
    totalSessions: number;
    activeSessions: number;
    stoppedSessions: number;
    errorSessions: number;
    devicesWithVideo: number;
  } {
    const sessions = Array.from(this.activeSessions.values());
    const deviceIds = new Set(sessions.map(s => s.deviceId));

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'active').length,
      stoppedSessions: sessions.filter(s => s.status === 'stopped').length,
      errorSessions: sessions.filter(s => s.status === 'error').length,
      devicesWithVideo: deviceIds.size
    };
  }

  private generateSessionId(): string {
    return `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const gps51VideoService = new GPS51VideoService();