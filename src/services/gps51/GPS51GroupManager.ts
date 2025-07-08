/**
 * GPS51 Group Manager - Phase 5
 * Group-based fleet organization and hierarchical device management
 */

export interface GPS51Group {
  groupid: string;
  groupname: string;
  parentid?: string;
  icon?: string;
  remark?: string;
  shared?: number;
  devices: GPS51GroupDevice[];
  subGroups?: GPS51Group[];
}

export interface GPS51GroupDevice {
  deviceid: string;
  devicename: string;
  simnum: string;
  devicetype?: string;
  lastactivetime: string;
  overduetime?: number;
  expirenotifytime?: number;
  remark?: string;
  creater?: string;
  videochannelcount?: number;
  isfree?: number;
  allowedit?: number;
  icon?: string;
  stared?: number;
  loginame?: string;
}

export interface FleetHierarchy {
  rootGroups: GPS51Group[];
  userAccessibleGroups: GPS51Group[];
  userDevices: GPS51GroupDevice[];
  totalDevices: number;
}

export interface GroupPermissions {
  canViewGroup: boolean;
  canManageGroup: boolean;
  canAddDevices: boolean;
  canRemoveDevices: boolean;
  canCreateSubGroups: boolean;
}

export class GPS51GroupManager {
  private static instance: GPS51GroupManager;
  
  private groupHierarchy: GPS51Group[] = [];
  private groupPermissions = new Map<string, GroupPermissions>();
  private userGroupAccess = new Map<string, string[]>(); // username -> accessible group IDs

  static getInstance(): GPS51GroupManager {
    if (!GPS51GroupManager.instance) {
      GPS51GroupManager.instance = new GPS51GroupManager();
    }
    return GPS51GroupManager.instance;
  }

  /**
   * Process GPS51 groups response and build hierarchy
   */
  processGroupsResponse(groupsData: any[], userRole: string): FleetHierarchy {
    console.log('GPS51GroupManager: Processing groups data:', groupsData.length);
    
    // Reset hierarchy
    this.groupHierarchy = [];
    
    // Build group hierarchy
    const groups = this.buildGroupHierarchy(groupsData);
    const userAccessibleGroups = this.filterGroupsByUserAccess(groups, userRole);
    const allDevices = this.extractAllDevices(userAccessibleGroups);

    const hierarchy: FleetHierarchy = {
      rootGroups: groups,
      userAccessibleGroups,
      userDevices: allDevices,
      totalDevices: allDevices.length
    };

    console.log('GPS51GroupManager: Built hierarchy:', {
      totalGroups: groups.length,
      accessibleGroups: userAccessibleGroups.length,
      totalDevices: allDevices.length
    });

    return hierarchy;
  }

  /**
   * Build hierarchical group structure
   */
  private buildGroupHierarchy(groupsData: any[]): GPS51Group[] {
    const groupMap = new Map<string, GPS51Group>();
    const rootGroups: GPS51Group[] = [];

    // First pass: create all groups
    for (const groupData of groupsData) {
      const group: GPS51Group = {
        groupid: groupData.groupid,
        groupname: groupData.groupname || `Group ${groupData.groupid}`,
        parentid: groupData.parentid,
        icon: groupData.icon,
        remark: groupData.remark,
        shared: groupData.shared,
        devices: (groupData.devices || []).map((device: any) => ({
          deviceid: device.deviceid,
          devicename: device.devicename || `Device ${device.deviceid}`,
          simnum: device.simnum || '',
          devicetype: device.devicetype,
          lastactivetime: device.lastactivetime || '',
          overduetime: device.overduetime,
          expirenotifytime: device.expirenotifytime,
          remark: device.remark,
          creater: device.creater,
          videochannelcount: device.videochannelcount,
          isfree: device.isfree,
          allowedit: device.allowedit,
          icon: device.icon,
          stared: device.stared,
          loginame: device.loginame
        })),
        subGroups: []
      };

      groupMap.set(group.groupid, group);
    }

    // Second pass: build hierarchy
    for (const group of groupMap.values()) {
      if (group.parentid && groupMap.has(group.parentid)) {
        const parent = groupMap.get(group.parentid)!;
        parent.subGroups = parent.subGroups || [];
        parent.subGroups.push(group);
      } else {
        rootGroups.push(group);
      }
    }

    this.groupHierarchy = rootGroups;
    return rootGroups;
  }

  /**
   * Filter groups based on user access level
   */
  private filterGroupsByUserAccess(groups: GPS51Group[], userRole: string): GPS51Group[] {
    // For now, return all groups - in production, implement proper filtering
    // based on user permissions and group access rules
    return this.flattenGroups(groups);
  }

  /**
   * Flatten nested groups into a single array
   */
  private flattenGroups(groups: GPS51Group[]): GPS51Group[] {
    const flattened: GPS51Group[] = [];
    
    for (const group of groups) {
      flattened.push(group);
      if (group.subGroups && group.subGroups.length > 0) {
        flattened.push(...this.flattenGroups(group.subGroups));
      }
    }
    
    return flattened;
  }

  /**
   * Extract all devices from accessible groups
   */
  private extractAllDevices(groups: GPS51Group[]): GPS51GroupDevice[] {
    const allDevices: GPS51GroupDevice[] = [];
    
    for (const group of groups) {
      allDevices.push(...group.devices);
    }
    
    return allDevices;
  }

  /**
   * Get devices by group ID
   */
  getDevicesByGroup(groupId: string): GPS51GroupDevice[] {
    const group = this.findGroupById(groupId, this.groupHierarchy);
    return group ? group.devices : [];
  }

  /**
   * Find group by ID in hierarchy
   */
  private findGroupById(groupId: string, groups: GPS51Group[]): GPS51Group | null {
    for (const group of groups) {
      if (group.groupid === groupId) {
        return group;
      }
      
      if (group.subGroups) {
        const found = this.findGroupById(groupId, group.subGroups);
        if (found) return found;
      }
    }
    
    return null;
  }

  /**
   * Get group hierarchy for user
   */
  getUserGroupHierarchy(username: string): GPS51Group[] {
    const accessibleGroupIds = this.userGroupAccess.get(username) || [];
    
    if (accessibleGroupIds.length === 0) {
      return this.groupHierarchy; // Return all if no restrictions
    }
    
    return this.groupHierarchy.filter(group => 
      this.isGroupAccessible(group, accessibleGroupIds)
    );
  }

  /**
   * Check if group is accessible to user
   */
  private isGroupAccessible(group: GPS51Group, accessibleIds: string[]): boolean {
    if (accessibleIds.includes(group.groupid)) {
      return true;
    }
    
    // Check sub-groups
    if (group.subGroups) {
      return group.subGroups.some(subGroup => 
        this.isGroupAccessible(subGroup, accessibleIds)
      );
    }
    
    return false;
  }

  /**
   * Set user group access
   */
  setUserGroupAccess(username: string, groupIds: string[]): void {
    this.userGroupAccess.set(username, groupIds);
  }

  /**
   * Get group permissions for user
   */
  getGroupPermissions(groupId: string, userRole: string): GroupPermissions {
    // Implement role-based permissions
    const isAdmin = userRole === 'admin' || userRole === 'fleet_manager';
    
    return {
      canViewGroup: true,
      canManageGroup: isAdmin,
      canAddDevices: isAdmin,
      canRemoveDevices: isAdmin,
      canCreateSubGroups: isAdmin
    };
  }

  /**
   * Get fleet statistics
   */
  getFleetStatistics(): {
    totalGroups: number;
    totalDevices: number;
    devicesByGroup: Record<string, number>;
    groupHierarchyDepth: number;
  } {
    const allGroups = this.flattenGroups(this.groupHierarchy);
    const devicesByGroup: Record<string, number> = {};
    let totalDevices = 0;
    
    for (const group of allGroups) {
      devicesByGroup[group.groupid] = group.devices.length;
      totalDevices += group.devices.length;
    }
    
    return {
      totalGroups: allGroups.length,
      totalDevices,
      devicesByGroup,
      groupHierarchyDepth: this.calculateMaxDepth(this.groupHierarchy)
    };
  }

  /**
   * Calculate maximum hierarchy depth
   */
  private calculateMaxDepth(groups: GPS51Group[], currentDepth = 0): number {
    let maxDepth = currentDepth;
    
    for (const group of groups) {
      if (group.subGroups && group.subGroups.length > 0) {
        const depth = this.calculateMaxDepth(group.subGroups, currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    }
    
    return maxDepth;
  }

  /**
   * Search devices across all groups
   */
  searchDevices(query: string): GPS51GroupDevice[] {
    const allDevices = this.extractAllDevices(this.flattenGroups(this.groupHierarchy));
    const lowerQuery = query.toLowerCase();
    
    return allDevices.filter(device => 
      device.devicename.toLowerCase().includes(lowerQuery) ||
      device.deviceid.toLowerCase().includes(lowerQuery) ||
      device.simnum.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get current hierarchy
   */
  getGroupHierarchy(): GPS51Group[] {
    return this.groupHierarchy;
  }

  /**
   * Clear hierarchy (for reset/logout)
   */
  clearHierarchy(): void {
    this.groupHierarchy = [];
    this.groupPermissions.clear();
    this.userGroupAccess.clear();
  }
}

export const gps51GroupManager = GPS51GroupManager.getInstance();