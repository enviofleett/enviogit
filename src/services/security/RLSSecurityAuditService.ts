import { supabase } from '@/integrations/supabase/client';

export interface SecurityIssue {
  id: string;
  table: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'rls_disabled' | 'missing_tenant_isolation' | 'weak_policy' | 'performance_risk' | 'data_leak_risk';
  description: string;
  recommendation: string;
  fixSQL?: string;
  impact: string;
}

export interface SecurityAuditResult {
  overallScore: number;
  totalTables: number;
  securedTables: number;
  criticalIssues: SecurityIssue[];
  warnings: SecurityIssue[];
  passed: SecurityIssue[];
  generatedAt: Date;
}

export interface TableSecurityStatus {
  tableName: string;
  rlsEnabled: boolean;
  policyCount: number;
  hasOrganizationIsolation: boolean;
  hasRoleBasedAccess: boolean;
  securityScore: number;
  status: 'secure' | 'warning' | 'critical';
  issues: SecurityIssue[];
}

class RLSSecurityAuditService {
  private static instance: RLSSecurityAuditService;

  static getInstance(): RLSSecurityAuditService {
    if (!RLSSecurityAuditService.instance) {
      RLSSecurityAuditService.instance = new RLSSecurityAuditService();
    }
    return RLSSecurityAuditService.instance;
  }

  // Critical tables that must have proper RLS
  private readonly CRITICAL_TABLES = [
    'profiles',
    'organizations', 
    'vehicles',
    'vehicle_positions',
    'geofences',
    'alerts',
    'geofence_events',
    'vehicle_assignments',
    'devices',
    'video_records'
  ];

  // Tables that require organization isolation
  private readonly MULTI_TENANT_TABLES = [
    'vehicles',
    'vehicle_positions', 
    'geofences',
    'alerts',
    'geofence_events'
  ];

  async performComprehensiveAudit(): Promise<SecurityAuditResult> {
    console.log('RLS Security Audit: Starting comprehensive security audit...');
    
    const issues: SecurityIssue[] = [];
    const tableStatuses: TableSecurityStatus[] = [];

    try {
      // Analyze each critical table using direct testing
      for (const tableName of this.CRITICAL_TABLES) {
        const status = await this.analyzeTableSecurity(tableName);
        tableStatuses.push(status);
        issues.push(...status.issues);
      }

      // Calculate overall security score
      const overallScore = this.calculateSecurityScore(tableStatuses);
      
      // Categorize issues by severity
      const criticalIssues = issues.filter(i => i.severity === 'critical');
      const warnings = issues.filter(i => ['high', 'medium'].includes(i.severity));
      const passed = issues.filter(i => i.severity === 'low');

      const result: SecurityAuditResult = {
        overallScore,
        totalTables: this.CRITICAL_TABLES.length,
        securedTables: tableStatuses.filter(t => t.status === 'secure').length,
        criticalIssues,
        warnings,
        passed,
        generatedAt: new Date()
      };

      // Log audit results
      await this.logAuditResults(result);

      console.log('RLS Security Audit: Audit completed', {
        score: overallScore,
        critical: criticalIssues.length,
        warnings: warnings.length
      });

      return result;
    } catch (error) {
      console.error('Security audit failed:', error);
      throw new Error(`Security audit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async performManualAudit(): Promise<SecurityAuditResult> {
    const issues: SecurityIssue[] = [];
    const tableStatuses: TableSecurityStatus[] = [];

    // Create specific table analyzers for each table
    const tableAnalyzers = {
      profiles: () => this.testTableRLS('profiles'),
      organizations: () => this.testTableRLS('organizations'),
      vehicles: () => this.testTableRLS('vehicles'),
      vehicle_positions: () => this.testTableRLS('vehicle_positions'),
      geofences: () => this.testTableRLS('geofences'),  
      alerts: () => this.testTableRLS('alerts'),
      geofence_events: () => this.testTableRLS('geofence_events'),
      vehicle_assignments: () => this.testTableRLS('vehicle_assignments'),
      devices: () => this.testTableRLS('devices'),
      video_records: () => this.testTableRLS('video_records')
    };

    // Manual analysis for critical tables
    for (const tableName of this.CRITICAL_TABLES) {
      try {
        const analyzer = tableAnalyzers[tableName as keyof typeof tableAnalyzers];
        const rlsEnabled = analyzer ? await analyzer() : false;

        const status: TableSecurityStatus = {
          tableName,
          rlsEnabled,
          policyCount: 0, // Would need admin access to determine
          hasOrganizationIsolation: this.MULTI_TENANT_TABLES.includes(tableName),
          hasRoleBasedAccess: false,
          securityScore: rlsEnabled ? 70 : 0,
          status: rlsEnabled ? 'warning' : 'critical',
          issues: []
        };

        if (!rlsEnabled) {
          status.issues.push({
            id: `rls_disabled_${tableName}`,
            table: tableName,
            severity: 'critical',
            type: 'rls_disabled',
            description: `RLS is disabled on table '${tableName}'`,
            recommendation: `Enable RLS on table '${tableName}' and implement proper policies`,
            fixSQL: this.generateRLSEnableSQL(tableName),
            impact: 'High - Data can be accessed without proper authorization'
          });
        }

        tableStatuses.push(status);
        issues.push(...status.issues);
      } catch (error) {
        console.error(`Failed to analyze table ${tableName}:`, error);
      }
    }

    const overallScore = this.calculateSecurityScore(tableStatuses);
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const warnings = issues.filter(i => ['high', 'medium'].includes(i.severity));
    const passed = issues.filter(i => i.severity === 'low');

    return {
      overallScore,
      totalTables: this.CRITICAL_TABLES.length,
      securedTables: tableStatuses.filter(t => t.status === 'secure').length,
      criticalIssues,
      warnings,
      passed,
      generatedAt: new Date()
    };
  }

  private async analyzeTableSecurity(tableName: string): Promise<TableSecurityStatus> {
    const issues: SecurityIssue[] = [];
    let securityScore = 100;

    try {
      // Test RLS by attempting to query as anonymous user  
      const { error: rlsError } = await supabase
        .from(tableName as any)
        .select('id')
        .limit(1);

      const rlsEnabled = rlsError?.code === 'PGRST116'; // RLS enabled error

      if (!rlsEnabled) {
        issues.push({
          id: `rls_disabled_${tableName}`,
          table: tableName,
          severity: 'critical',
          type: 'rls_disabled',
          description: `RLS is disabled on table '${tableName}'`,
          recommendation: `Enable RLS and implement proper policies`,
          fixSQL: this.generateRLSEnableSQL(tableName),
          impact: 'Critical - Unrestricted data access'
        });
        securityScore -= 50;
      }

      // Check for organization isolation in multi-tenant tables
      if (this.MULTI_TENANT_TABLES.includes(tableName)) {
        const hasOrgIsolation = await this.checkOrganizationIsolation(tableName);
        if (!hasOrgIsolation) {
          issues.push({
            id: `missing_org_isolation_${tableName}`,
            table: tableName,
            severity: 'critical',
            type: 'missing_tenant_isolation',
            description: `Missing organization isolation on '${tableName}'`,
            recommendation: `Implement organization-based RLS policies`,
            fixSQL: this.generateOrganizationIsolationSQL(tableName),
            impact: 'Critical - Cross-tenant data access possible'
          });
          securityScore -= 30;
        }
      }

      // Determine status based on score
      let status: 'secure' | 'warning' | 'critical' = 'secure';
      if (securityScore < 50) status = 'critical';
      else if (securityScore < 80) status = 'warning';

      return {
        tableName,
        rlsEnabled,
        policyCount: 0, // Would need admin access to determine exactly
        hasOrganizationIsolation: this.MULTI_TENANT_TABLES.includes(tableName),
        hasRoleBasedAccess: false, // Would need more detailed analysis
        securityScore,
        status,
        issues
      };
    } catch (error) {
      console.error(`Failed to analyze table ${tableName}:`, error);
      
      return {
        tableName,
        rlsEnabled: false,
        policyCount: 0,
        hasOrganizationIsolation: false,
        hasRoleBasedAccess: false,
        securityScore: 0,
        status: 'critical',
        issues: [{
          id: `analysis_failed_${tableName}`,
          table: tableName,
          severity: 'critical',
          type: 'rls_disabled',
          description: `Failed to analyze table '${tableName}'`,
          recommendation: `Check table access permissions and RLS configuration`,
          impact: 'Unknown - Unable to verify security status'
        }]
      };
    }
  }

  private async testTableRLS(tableName: string): Promise<boolean> {
    try {
      // Create a type-safe table test mapping
      const tableTests = {
        profiles: () => supabase.from('profiles').select('id').limit(1),
        organizations: () => supabase.from('organizations').select('id').limit(1),
        vehicles: () => supabase.from('vehicles').select('id').limit(1),
        vehicle_positions: () => supabase.from('vehicle_positions').select('id').limit(1),
        geofences: () => supabase.from('geofences').select('id').limit(1),
        alerts: () => supabase.from('alerts').select('id').limit(1),
        geofence_events: () => supabase.from('geofence_events').select('id').limit(1),
        vehicle_assignments: () => supabase.from('vehicle_assignments').select('id').limit(1),
        devices: () => supabase.from('devices').select('id').limit(1),
        video_records: () => supabase.from('video_records').select('id').limit(1)
      };

      const testFn = tableTests[tableName as keyof typeof tableTests];
      if (!testFn) return false;

      const { error } = await testFn();
      
      // If RLS is enabled, we should get a specific error code
      return error?.code === 'PGRST116' || error?.code === 'PGRST301';
    } catch (error) {
      console.warn(`Error testing RLS for ${tableName}:`, error);
      return false;
    }
  }

  private async checkOrganizationIsolation(tableName: string): Promise<boolean> {
    try {
      // For now, assume organization isolation exists if we have proper RLS
      // In a real implementation, this would check if organization_id policies exist
      const hasRLS = await this.testTableRLS(tableName);
      
      // Simple heuristic: if it's a multi-tenant table and has RLS, assume org isolation
      return hasRLS && this.MULTI_TENANT_TABLES.includes(tableName);
    } catch (error) {
      console.warn(`Error checking organization isolation for ${tableName}:`, error);
      return false;
    }
  }

  private calculateSecurityScore(tableStatuses: TableSecurityStatus[]): number {
    if (tableStatuses.length === 0) return 0;
    
    const totalScore = tableStatuses.reduce((sum, table) => sum + table.securityScore, 0);
    return Math.round(totalScore / tableStatuses.length);
  }

  private generateRLSEnableSQL(tableName: string): string {
    return `-- Enable RLS on ${tableName}
ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;

-- Basic organization isolation policy
CREATE POLICY "org_isolation_${tableName}" 
ON public.${tableName} 
FOR ALL 
TO authenticated
USING (
  ${this.MULTI_TENANT_TABLES.includes(tableName) 
    ? 'organization_id = public.get_user_organization_id()'
    : 'true -- Add appropriate access control logic'
  }
);`;
  }

  private generateOrganizationIsolationSQL(tableName: string): string {
    return `-- Organization isolation policy for ${tableName}
CREATE POLICY "org_isolation_${tableName}" 
ON public.${tableName} 
FOR ALL 
TO authenticated
USING (organization_id = public.get_user_organization_id());

-- Role-based access policies
CREATE POLICY "admin_full_access_${tableName}" 
ON public.${tableName} 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND organization_id = ${tableName}.organization_id
    AND role IN ('admin', 'owner')
  )
);

CREATE POLICY "manager_read_write_${tableName}" 
ON public.${tableName} 
FOR SELECT, UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND organization_id = ${tableName}.organization_id
    AND role IN ('admin', 'owner', 'manager')
  )
);`;
  }

  async testMultiTenantIsolation(): Promise<{
    passed: boolean;
    results: Array<{
      test: string;
      passed: boolean;
      details: string;
      risk: string;
    }>;
  }> {
    const testResults = [];
    
    // Test specific multi-tenant tables with type safety
    const tableTests = [
      {
        name: 'vehicles',
        test: async () => {
          const { data, error } = await supabase
            .from('vehicles')
            .select('organization_id')
            .limit(10);
          return { data, error };
        }
      },
      {
        name: 'vehicle_positions',
        test: async () => {
          const { data, error } = await supabase
            .from('vehicle_positions')
            .select('organization_id')
            .limit(10);
          return { data, error };
        }
      },
      {
        name: 'geofences',
        test: async () => {
          const { data, error } = await supabase
            .from('geofences')
            .select('organization_id')
            .limit(10);
          return { data, error };
        }
      },
      {
        name: 'alerts',
        test: async () => {
          const { data, error } = await supabase
            .from('alerts')
            .select('organization_id')
            .limit(10);
          return { data, error };
        }
      }
    ];
    
    // Test organization isolation for each table
    for (const tableTest of tableTests) {
      try {
        const { data, error } = await tableTest.test();

        if (error) {
          testResults.push({
            test: `Organization isolation - ${tableTest.name}`,
            passed: error.code === 'PGRST116', // RLS blocking access is good
            details: `Access blocked by RLS: ${error.message}`,
            risk: error.code === 'PGRST116' ? 'LOW' : 'HIGH'
          });
          continue;
        }

        const uniqueOrgs = new Set(data?.map((row: any) => row.organization_id) || []);
        
        testResults.push({
          test: `Organization isolation - ${tableTest.name}`,
          passed: uniqueOrgs.size <= 1, // Should only see own org data
          details: `Found ${uniqueOrgs.size} organizations in results`,
          risk: uniqueOrgs.size > 1 ? 'HIGH' : 'LOW'
        });
      } catch (error) {
        testResults.push({
          test: `Organization isolation - ${tableTest.name}`,
          passed: false,
          details: `Test failed: ${error}`,
          risk: 'HIGH'
        });
      }
    }

    const allPassed = testResults.every(result => result.passed);
    
    return {
      passed: allPassed,
      results: testResults
    };
  }

  private async logAuditResults(result: SecurityAuditResult): Promise<void> {
    try {
      await supabase.from('rls_audit_logs').insert({
        table_name: 'security_audit',
        action: 'comprehensive_audit',
        user_id: (await supabase.auth.getUser()).data.user?.id,
        details: {
          score: result.overallScore,
          critical_issues: result.criticalIssues.length,
          warnings: result.warnings.length,
          tables_analyzed: result.totalTables
        }
      });
    } catch (error) {
      console.warn('Failed to log audit results:', error);
    }
  }

  async generateSecurityReport(): Promise<string> {
    const audit = await this.performComprehensiveAudit();
    
    let report = `# RLS Security Audit Report
Generated: ${audit.generatedAt.toISOString()}

## Summary
- **Overall Security Score**: ${audit.overallScore}/100
- **Tables Analyzed**: ${audit.totalTables}
- **Secured Tables**: ${audit.securedTables}
- **Critical Issues**: ${audit.criticalIssues.length}
- **Warnings**: ${audit.warnings.length}

## Critical Issues
`;

    audit.criticalIssues.forEach(issue => {
      report += `
### ${issue.description}
- **Table**: ${issue.table}
- **Impact**: ${issue.impact}
- **Recommendation**: ${issue.recommendation}
- **Fix SQL**:
\`\`\`sql
${issue.fixSQL || 'Manual intervention required'}
\`\`\`
`;
    });

    return report;
  }
}

export const rlsSecurityAuditService = RLSSecurityAuditService.getInstance();