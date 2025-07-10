import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw
} from 'lucide-react';
import { TechnicalPartnerService } from '@/services/partners/TechnicalPartnerService';
import { PartnerWalletService } from '@/services/partners/PartnerWalletService';
import { useToast } from '@/hooks/use-toast';
import { useBackgroundRefresh } from '@/hooks/useBackgroundRefresh';

interface DashboardStats {
  totalPartners: number;
  pendingApplications: number;
  activePartners: number;
  totalWalletBalance: number;
  pendingPayouts: number;
  monthlyEarnings: number;
  recentActivities: any[];
}

export const PartnerDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalPartners: 0,
    pendingApplications: 0,
    activePartners: 0,
    totalWalletBalance: 0,
    pendingPayouts: 0,
    monthlyEarnings: 0,
    recentActivities: []
  });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const { toast } = useToast();

  const loadDashboardData = async () => {
    try {
      // Load partner statistics
      const [allPartners, pendingPartners, activePartners] = await Promise.all([
        TechnicalPartnerService.getAllPartners(),
        TechnicalPartnerService.getAllPartners('pending'),
        TechnicalPartnerService.getAllPartners('approved')
      ]);

      // Load wallet and payout data
      const [walletSummary, payoutRequests] = await Promise.all([
        PartnerWalletService.getWalletSummary(),
        PartnerWalletService.getAllPayoutRequests()
      ]);

      setStats({
        totalPartners: allPartners.length,
        pendingApplications: pendingPartners.length,
        activePartners: activePartners.length,
        totalWalletBalance: walletSummary.totalBalance || 0,
        pendingPayouts: payoutRequests.filter(req => req.status === 'pending').length,
        monthlyEarnings: walletSummary.monthlyEarnings || 0,
        recentActivities: [] // We'll implement activity tracking later
      });

      if (isInitialLoading) {
        setIsInitialLoading(false);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      if (isInitialLoading) {
        toast({
          title: "Error",
          description: "Failed to load dashboard data",
          variant: "destructive",
        });
      }
    }
  };

  // Set up background refresh
  const backgroundRefresh = useBackgroundRefresh(loadDashboardData, {
    refreshInterval: 30000, // 30 seconds
    enabled: true,
    onError: (error) => {
      console.error('Background refresh failed:', error);
      // Only show toast for critical errors, not background failures
    }
  });

  // Initial load
  useEffect(() => {
    loadDashboardData();
  }, []);

  const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );

  if (isInitialLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Partner Dashboard</h2>
          {backgroundRefresh.lastRefresh && (
            <p className="text-sm text-muted-foreground">
              Last updated: {backgroundRefresh.lastRefresh.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={backgroundRefresh.error ? "destructive" : "default"} className="text-xs">
            {backgroundRefresh.error ? 'Sync Error' : 'Live'}
          </Badge>
          <button
            onClick={backgroundRefresh.manualRefresh}
            disabled={backgroundRefresh.isRefreshing}
            className="p-2 rounded-md hover:bg-muted transition-colors"
            title="Refresh data"
          >
            <RefreshCw className={`h-4 w-4 ${backgroundRefresh.isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Partners"
          value={stats.totalPartners}
          icon={Users}
          color="text-blue-600"
          subtitle={`${stats.activePartners} active`}
        />
        <StatCard
          title="Pending Applications"
          value={stats.pendingApplications}
          icon={Clock}
          color="text-yellow-600"
          subtitle="Awaiting review"
        />
        <StatCard
          title="Total Wallet Balance"
          value={`₦${stats.totalWalletBalance.toLocaleString()}`}
          icon={DollarSign}
          color="text-green-600"
          subtitle="Across all partners"
        />
        <StatCard
          title="Pending Payouts"
          value={stats.pendingPayouts}
          icon={AlertTriangle}
          color="text-orange-600"
          subtitle="Awaiting approval"
        />
      </div>

      {/* Quick Actions & Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Partner Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Active Partners</span>
                  <span>{stats.activePartners}/{stats.totalPartners}</span>
                </div>
                <Progress 
                  value={(stats.activePartners / Math.max(stats.totalPartners, 1)) * 100} 
                  className="h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Application Approval Rate</span>
                  <span>
                    {stats.totalPartners > 0 
                      ? Math.round((stats.activePartners / stats.totalPartners) * 100)
                      : 0
                    }%
                  </span>
                </div>
                <Progress 
                  value={stats.totalPartners > 0 ? (stats.activePartners / stats.totalPartners) * 100 : 0}
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Partner Applications</span>
                <Badge variant={stats.pendingApplications > 0 ? "secondary" : "default"}>
                  {stats.pendingApplications > 0 ? `${stats.pendingApplications} Pending` : 'Up to date'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Payout Requests</span>
                <Badge variant={stats.pendingPayouts > 0 ? "destructive" : "default"}>
                  {stats.pendingPayouts > 0 ? `${stats.pendingPayouts} Pending` : 'Processed'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">System Health</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Operational
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Activity tracking will be available soon</p>
            <p className="text-sm">Partner actions and system events will appear here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};