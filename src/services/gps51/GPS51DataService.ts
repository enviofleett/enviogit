
import { supabase } from '@/integrations/supabase/client';

export interface GPS51User {
  id: string;
  gps51_username: string;
  password_hash: string;
  email?: string;
  phone?: string;
  nickname?: string;
  user_type?: number;
  created_at: string;
}

export interface GPS51Device {
  id: string;
  device_id: string;
  device_name?: string;
  gps51_group_id?: string;
  assigned_user_id?: string;
  last_seen_at?: string;
  created_at: string;
}

export interface GPS51Position {
  id: number;
  device_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  speed_kph?: number;
  heading?: number;
  ignition_on: boolean;
  battery_voltage?: number;
  raw_data?: any;
  created_at: string;
}

export class GPS51DataService {
  // User management
  static async createUser(userData: Omit<GPS51User, 'id' | 'created_at'>): Promise<GPS51User> {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getUserByUsername(username: string): Promise<GPS51User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('gps51_username', username)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async updateUser(id: string, updates: Partial<GPS51User>): Promise<GPS51User> {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Device management
  static async createDevice(deviceData: Omit<GPS51Device, 'id' | 'created_at'>): Promise<GPS51Device> {
    const { data, error } = await supabase
      .from('devices')
      .insert(deviceData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getDeviceByDeviceId(deviceId: string): Promise<GPS51Device | null> {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('device_id', deviceId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async getUserDevices(userId: string): Promise<GPS51Device[]> {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('assigned_user_id', userId);

    if (error) throw error;
    return data || [];
  }

  static async updateDevice(id: string, updates: Partial<GPS51Device>): Promise<GPS51Device> {
    const { data, error } = await supabase
      .from('devices')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateDeviceLastSeen(deviceId: string, timestamp: string): Promise<void> {
    const { error } = await supabase
      .from('devices')
      .update({ last_seen_at: timestamp })
      .eq('device_id', deviceId);

    if (error) throw error;
  }

  // Position management
  static async createPosition(positionData: Omit<GPS51Position, 'id' | 'created_at'>): Promise<GPS51Position> {
    const { data, error } = await supabase
      .from('positions')
      .insert(positionData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async createPositions(positionsData: Omit<GPS51Position, 'id' | 'created_at'>[]): Promise<GPS51Position[]> {
    const { data, error } = await supabase
      .from('positions')
      .insert(positionsData)
      .select();

    if (error) throw error;
    return data || [];
  }

  static async getLatestPositions(deviceIds: string[]): Promise<GPS51Position[]> {
    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .in('device_id', deviceIds)
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getDevicePositions(
    deviceId: string, 
    limit: number = 100,
    startTime?: string,
    endTime?: string
  ): Promise<GPS51Position[]> {
    let query = supabase
      .from('positions')
      .select('*')
      .eq('device_id', deviceId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (startTime) {
      query = query.gte('timestamp', startTime);
    }
    if (endTime) {
      query = query.lte('timestamp', endTime);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  static async getLatestPositionForDevice(deviceId: string): Promise<GPS51Position | null> {
    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .eq('device_id', deviceId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // Bulk operations for GPS51 sync
  static async syncDevicesFromGPS51(gps51Devices: any[], userId: string): Promise<void> {
    console.log(`Syncing ${gps51Devices.length} devices for user ${userId}`);
    
    for (const gps51Device of gps51Devices) {
      try {
        // Check if device already exists
        const existingDevice = await this.getDeviceByDeviceId(gps51Device.deviceid);
        
        if (existingDevice) {
          // Update existing device
          await this.updateDevice(existingDevice.id, {
            device_name: gps51Device.devicename,
            gps51_group_id: gps51Device.groupid,
            assigned_user_id: userId,
            last_seen_at: new Date().toISOString()
          });
        } else {
          // Create new device
          await this.createDevice({
            device_id: gps51Device.deviceid,
            device_name: gps51Device.devicename,
            gps51_group_id: gps51Device.groupid,
            assigned_user_id: userId
          });
        }
      } catch (error) {
        console.error(`Failed to sync device ${gps51Device.deviceid}:`, error);
      }
    }
  }

  static async syncPositionsFromGPS51(gps51Positions: any[]): Promise<void> {
    console.log(`Syncing ${gps51Positions.length} positions`);
    
    const positionsToInsert = gps51Positions.map(pos => ({
      device_id: pos.deviceid,
      latitude: pos.callat,
      longitude: pos.callon,
      timestamp: new Date(pos.updatetime).toISOString(),
      speed_kph: pos.speed,
      heading: pos.course,
      ignition_on: pos.moving === 1,
      battery_voltage: pos.voltage,
      raw_data: pos
    }));

    // Insert positions in batches of 100
    const batchSize = 100;
    for (let i = 0; i < positionsToInsert.length; i += batchSize) {
      const batch = positionsToInsert.slice(i, i + batchSize);
      try {
        await this.createPositions(batch);
      } catch (error) {
        console.error(`Failed to insert position batch ${i / batchSize + 1}:`, error);
      }
    }

    // Update device last seen timestamps
    const deviceIds = [...new Set(gps51Positions.map(pos => pos.deviceid))];
    for (const deviceId of deviceIds) {
      try {
        await this.updateDeviceLastSeen(deviceId, new Date().toISOString());
      } catch (error) {
        console.error(`Failed to update last seen for device ${deviceId}:`, error);
      }
    }
  }
}
