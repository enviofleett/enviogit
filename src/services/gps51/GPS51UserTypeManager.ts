/**
 * GPS51 User Type Manager - Phase 5
 * Enhanced user type management and hierarchical access control
 */

export enum GPS51UserType {
  SUB_ADMIN = 3,
  COMPANY_ADMIN = 4,
  END_USER = 11,
  DEVICE = 99
}

export enum EnvioUserRole {
  ADMIN = 'admin',
  FLEET_MANAGER = 'fleet_manager',
  INDIVIDUAL_OWNER = 'individual_owner',
  DRIVER = 'driver'
}

export interface UserTypeMapping {
  envioRole: EnvioUserRole;
  gps51UserType: GPS51UserType;
  canManageOthers: boolean;
  canCreateDevices: boolean;
  canViewAllDevices: boolean;
  maxDevices?: number;
}

export interface GPS51UserProfile {
  username: string;
  usertype: GPS51UserType;
  envioRole: EnvioUserRole;
  companyname?: string;
  showname: string;
  email: string;
  phone?: string;
  permissions: UserPermissions;
}

export interface UserPermissions {
  canManageUsers: boolean;
  canManageDevices: boolean;
  canViewReports: boolean;
  canConfigureAlerts: boolean;
  deviceAccessLevel: 'own' | 'group' | 'company' | 'all';
}

export class GPS51UserTypeManager {
  private static instance: GPS51UserTypeManager;

  private readonly userTypeMappings: UserTypeMapping[] = [
    {
      envioRole: EnvioUserRole.ADMIN,
      gps51UserType: GPS51UserType.COMPANY_ADMIN,
      canManageOthers: true,
      canCreateDevices: true,
      canViewAllDevices: true
    },
    {
      envioRole: EnvioUserRole.FLEET_MANAGER,
      gps51UserType: GPS51UserType.SUB_ADMIN,
      canManageOthers: true,
      canCreateDevices: true,
      canViewAllDevices: true,
      maxDevices: 50
    },
    {
      envioRole: EnvioUserRole.INDIVIDUAL_OWNER,
      gps51UserType: GPS51UserType.END_USER,
      canManageOthers: false,
      canCreateDevices: false,
      canViewAllDevices: false,
      maxDevices: 5
    },
    {
      envioRole: EnvioUserRole.DRIVER,
      gps51UserType: GPS51UserType.END_USER,
      canManageOthers: false,
      canCreateDevices: false,
      canViewAllDevices: false,
      maxDevices: 1
    }
  ];

  static getInstance(): GPS51UserTypeManager {
    if (!GPS51UserTypeManager.instance) {
      GPS51UserTypeManager.instance = new GPS51UserTypeManager();
    }
    return GPS51UserTypeManager.instance;
  }

  /**
   * Get GPS51 user type for Envio role
   */
  getGPS51UserType(envioRole: EnvioUserRole): GPS51UserType {
    const mapping = this.userTypeMappings.find(m => m.envioRole === envioRole);
    return mapping?.gps51UserType || GPS51UserType.END_USER;
  }

  /**
   * Get Envio role from GPS51 user type
   */
  getEnvioRole(gps51UserType: GPS51UserType): EnvioUserRole {
    const mapping = this.userTypeMappings.find(m => m.gps51UserType === gps51UserType);
    return mapping?.envioRole || EnvioUserRole.INDIVIDUAL_OWNER;
  }

  /**
   * Get user permissions based on role
   */
  getUserPermissions(envioRole: EnvioUserRole): UserPermissions {
    const mapping = this.userTypeMappings.find(m => m.envioRole === envioRole);
    
    if (!mapping) {
      return this.getDefaultPermissions();
    }

    return {
      canManageUsers: mapping.canManageOthers,
      canManageDevices: mapping.canCreateDevices,
      canViewReports: true,
      canConfigureAlerts: mapping.canManageOthers,
      deviceAccessLevel: this.getDeviceAccessLevel(envioRole)
    };
  }

  /**
   * Get device access level for role
   */
  private getDeviceAccessLevel(envioRole: EnvioUserRole): 'own' | 'group' | 'company' | 'all' {
    switch (envioRole) {
      case EnvioUserRole.ADMIN:
        return 'all';
      case EnvioUserRole.FLEET_MANAGER:
        return 'company';
      case EnvioUserRole.INDIVIDUAL_OWNER:
        return 'own';
      case EnvioUserRole.DRIVER:
        return 'own';
      default:
        return 'own';
    }
  }

  /**
   * Validate user can perform action
   */
  canUserPerformAction(userRole: EnvioUserRole, action: string, targetRole?: EnvioUserRole): boolean {
    const permissions = this.getUserPermissions(userRole);
    
    switch (action) {
      case 'manage_users':
        return permissions.canManageUsers;
      case 'manage_devices':
        return permissions.canManageDevices;
      case 'view_reports':
        return permissions.canViewReports;
      case 'configure_alerts':
        return permissions.canConfigureAlerts;
      case 'create_user':
        if (!permissions.canManageUsers) return false;
        if (targetRole && this.isHigherRole(targetRole, userRole)) return false;
        return true;
      default:
        return false;
    }
  }

  /**
   * Check if role is higher than another
   */
  private isHigherRole(role1: EnvioUserRole, role2: EnvioUserRole): boolean {
    const hierarchy = {
      [EnvioUserRole.ADMIN]: 4,
      [EnvioUserRole.FLEET_MANAGER]: 3,
      [EnvioUserRole.INDIVIDUAL_OWNER]: 2,
      [EnvioUserRole.DRIVER]: 1
    };

    return hierarchy[role1] > hierarchy[role2];
  }

  /**
   * Get default permissions for unknown users
   */
  private getDefaultPermissions(): UserPermissions {
    return {
      canManageUsers: false,
      canManageDevices: false,
      canViewReports: true,
      canConfigureAlerts: false,
      deviceAccessLevel: 'own'
    };
  }

  /**
   * Create user registration payload
   */
  createUserRegistrationPayload(
    username: string, 
    password: string, 
    envioRole: EnvioUserRole,
    additionalData?: Partial<GPS51UserProfile>
  ): any {
    const gps51UserType = this.getGPS51UserType(envioRole);
    
    return {
      username,
      password, // Will be MD5 hashed by the service
      usertype: gps51UserType,
      multilogin: envioRole === EnvioUserRole.DRIVER ? 0 : 1, // Drivers single login
      showname: additionalData?.showname || username.split('@')[0],
      companyname: additionalData?.companyname || '',
      creater: additionalData?.username || 'system'
    };
  }

  /**
   * Get max devices allowed for role
   */
  getMaxDevicesAllowed(envioRole: EnvioUserRole): number | undefined {
    const mapping = this.userTypeMappings.find(m => m.envioRole === envioRole);
    return mapping?.maxDevices;
  }

  /**
   * Validate device count against role limits
   */
  canAddMoreDevices(envioRole: EnvioUserRole, currentDeviceCount: number): boolean {
    const maxDevices = this.getMaxDevicesAllowed(envioRole);
    return maxDevices === undefined || currentDeviceCount < maxDevices;
  }
}

export const gps51UserTypeManager = GPS51UserTypeManager.getInstance();