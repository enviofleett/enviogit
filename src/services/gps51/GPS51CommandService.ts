// GPS51 Command Service - Phase 1: Advanced Device Commands
// Provides engine control, speed limiting, and command status tracking

import { gps51Client } from './GPS51Client';
import { GPS51_STATUS } from './GPS51Constants';

export interface CommandResult {
  success: boolean;
  commandId?: string;
  status?: CommandStatus;
  message?: string;
  error?: string;
}

export interface CommandStatus {
  id: string;
  deviceId: string;
  command: string;
  status: 'pending' | 'sent' | 'confirmed' | 'failed' | 'timeout';
  sentAt: Date;
  confirmedAt?: Date;
  error?: string;
}

export const CMD_STATUS = {
  UNKNOWN_ERROR: -1,
  SEND_UNCONFIRMED: 0,
  PASSWORD_ERROR: 1,
  DEVICE_OFFLINE: 2,
  CONFIRMED_SUCCESS: 6,
  TIMEOUT: 8
} as const;

export const COMMAND_TYPES = {
  ENGINE_DISABLE: 'TYPE_SERVER_UNLOCK_CAR',
  ENGINE_ENABLE: 'TYPE_SERVER_SET_RELAY_OIL',
  SET_SPEED_LIMIT: 'TYPE_SERVER_SET_SPEED_LIMIT',
  LOCATE_VEHICLE: 'TYPE_SERVER_GET_LOCATION',
  RESET_MILEAGE: 'TYPE_SERVER_RESET_MILEAGE'
} as const;

export class GPS51CommandService {
  private pendingCommands = new Map<string, CommandStatus>();
  private commandHistory: CommandStatus[] = [];
  private defaultPassword = 'zhuyi'; // GPS51 default command password

  /**
   * Disable vehicle engine remotely
   */
  async disableEngine(deviceId: string, password?: string): Promise<CommandResult> {
    return this.sendCommand(deviceId, COMMAND_TYPES.ENGINE_DISABLE, ['1'], password);
  }

  /**
   * Enable vehicle engine remotely
   */
  async enableEngine(deviceId: string, password?: string): Promise<CommandResult> {
    return this.sendCommand(deviceId, COMMAND_TYPES.ENGINE_ENABLE, ['0'], password);
  }

  /**
   * Set speed limit for vehicle
   */
  async setSpeedLimit(
    deviceId: string, 
    speedLimitKmh: number, 
    durationSeconds: number = 35, 
    password?: string
  ): Promise<CommandResult> {
    const params = [speedLimitKmh.toString(), durationSeconds.toString()];
    return this.sendCommand(deviceId, COMMAND_TYPES.SET_SPEED_LIMIT, params, password);
  }

  /**
   * Request immediate location update
   */
  async locateVehicle(deviceId: string, password?: string): Promise<CommandResult> {
    return this.sendCommand(deviceId, COMMAND_TYPES.LOCATE_VEHICLE, [], password);
  }

  /**
   * Send generic command to device
   */
  async sendCommand(
    deviceId: string,
    commandCode: string,
    params: string[] = [],
    password?: string
  ): Promise<CommandResult> {
    try {
      console.log('GPS51CommandService: Sending command:', {
        deviceId,
        commandCode,
        params,
        hasPassword: !!password
      });

      // Ensure client is authenticated
      if (!gps51Client.isAuthenticated()) {
        throw new Error('GPS51 client not authenticated');
      }

      const commandId = this.generateCommandId();
      const cmdPassword = password || this.defaultPassword;

      const response = await gps51Client['apiClient'].makeRequest('sendcmd', gps51Client.getToken()!, {
        deviceid: deviceId,
        cmdcode: commandCode,
        params: params,
        state: -1,
        cmdpwd: cmdPassword
      });

      console.log('GPS51CommandService: Command response:', {
        commandId,
        status: response.status,
        message: response.message,
        cause: response.cause
      });

      // Create command status record
      const commandStatus: CommandStatus = {
        id: commandId,
        deviceId,
        command: commandCode,
        status: 'sent',
        sentAt: new Date()
      };

      // Analyze response
      if (response.status === GPS51_STATUS.SUCCESS) {
        commandStatus.status = 'confirmed';
        commandStatus.confirmedAt = new Date();
        
        this.pendingCommands.set(commandId, commandStatus);
        this.commandHistory.push(commandStatus);

        return {
          success: true,
          commandId,
          status: commandStatus,
          message: 'Command sent successfully'
        };
      } else {
        // Handle various error conditions
        let errorMessage = response.cause || response.message || 'Command failed';
        let status: CommandStatus['status'] = 'failed';

        switch (response.status) {
          case CMD_STATUS.PASSWORD_ERROR:
            errorMessage = 'Command password incorrect';
            break;
          case CMD_STATUS.DEVICE_OFFLINE:
            errorMessage = 'Device is offline';
            break;
          case CMD_STATUS.TIMEOUT:
            status = 'timeout';
            errorMessage = 'Command timeout';
            break;
          default:
            errorMessage = `Command failed with status ${response.status}: ${errorMessage}`;
        }

        commandStatus.status = status;
        commandStatus.error = errorMessage;
        
        this.pendingCommands.set(commandId, commandStatus);
        this.commandHistory.push(commandStatus);

        return {
          success: false,
          commandId,
          status: commandStatus,
          error: errorMessage
        };
      }

    } catch (error) {
      console.error('GPS51CommandService: Command error:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown command error'
      };
    }
  }

  /**
   * Get command status by ID
   */
  getCommandStatus(commandId: string): CommandStatus | null {
    return this.pendingCommands.get(commandId) || null;
  }

  /**
   * Get command history for device
   */
  getCommandHistory(deviceId?: string, limit: number = 50): CommandStatus[] {
    let history = this.commandHistory;
    
    if (deviceId) {
      history = history.filter(cmd => cmd.deviceId === deviceId);
    }
    
    return history
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get pending commands
   */
  getPendingCommands(): CommandStatus[] {
    return Array.from(this.pendingCommands.values())
      .filter(cmd => cmd.status === 'pending' || cmd.status === 'sent');
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.commandHistory = [];
    this.pendingCommands.clear();
    console.log('GPS51CommandService: Command history cleared');
  }

  /**
   * Set default command password
   */
  setDefaultPassword(password: string): void {
    this.defaultPassword = password;
    console.log('GPS51CommandService: Default password updated');
  }

  /**
   * Get command statistics
   */
  getCommandStats(): {
    totalCommands: number;
    successfulCommands: number;
    failedCommands: number;
    pendingCommands: number;
    successRate: number;
  } {
    const total = this.commandHistory.length;
    const successful = this.commandHistory.filter(cmd => cmd.status === 'confirmed').length;
    const failed = this.commandHistory.filter(cmd => cmd.status === 'failed' || cmd.status === 'timeout').length;
    const pending = this.getPendingCommands().length;
    
    return {
      totalCommands: total,
      successfulCommands: successful,
      failedCommands: failed,
      pendingCommands: pending,
      successRate: total > 0 ? (successful / total) * 100 : 0
    };
  }

  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const gps51CommandService = new GPS51CommandService();