import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Activity,
  CreditCard,
  UserPlus,
  RefreshCw
} from 'lucide-react';
import { ReferralAgentService } from '@/services/referrals/ReferralAgentService';
import { ReferralCommissionService } from '@/services/referrals/ReferralCommissionService';
import { ReferralPayoutService } from '@/services/referrals/ReferralPayoutService';
import { useToast } from '@/hooks/use-toast';
import { useBackgroundRefresh } from '@/hooks/useBackgroundRefresh';

interface DashboardStats {
  totalAgents: number;
  activeAgents: number;
  newAgentsThisMonth: number;
  totalCommissions: number;
  pendingCommissions: number;
  totalCommissionAmount: number;
  pendingCommissionAmount: number;
  pendingPayouts: number;
  pendingPayoutAmount: number;
  recentSignups: number;
}

export const ReferralDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalAgents: 0,
    activeAgents: 0,
    newAgentsThisMonth: 0,
    totalCommissions: 0,
    pendingCommissions: 0,
    totalCommissionAmount: 0,
    pendingCommissionAmount: 0,
    pendingPayouts: 0,
    pendingPayoutAmount: 0,
    recentSignups: 0
  });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const { toast } = useToast();

  const loadDashboardData = async () => {
    try {
      // Load agent statistics
      const agentStats = await ReferralAgentService.getDashboardStats();
      
      // Load commission summary
      const commissionSummary = await ReferralCommissionService.getCommissionSummary();
      
      // Load payout summary
      const payoutSummary = await ReferralPayoutService.getPayoutSummary();
      
      // Load recent signups
      const recentSignups = await ReferralCommissionService.getRecentSignups();

      setStats({
        totalAgents: agentStats.totalAgents,
        activeAgents: agentStats.activeAgents,
        newAgentsThisMonth: agentStats.newAgentsThisMonth,
        totalCommissions: commissionSummary.totalCommissions,
        pendingCommissions: commissionSummary.pendingCommissions,
        totalCommissionAmount: commissionSummary.totalAmount,
        pendingCommissionAmount: commissionSummary.pendingAmount,
        pendingPayouts: payoutSummary.pendingPayouts,
        pendingPayoutAmount: payoutSummary.pendingAmount,
        recentSignups
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
    refreshInterval: 45000, // 45 seconds for referrals
    enabled: true,
    onError: (error) => {
      console.error('Background refresh failed:', error);
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
          <h2 className="text-2xl font-bold">Referral Dashboard</h2>
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
          title="Total Agents"
          value={stats.totalAgents}
          icon={Users}
          color="text-blue-600"
          subtitle={`${stats.activeAgents} active`}
        />
        <StatCard
          title="Pending Payouts"
          value={`₦${stats.pendingPayoutAmount.toLocaleString()}`}
          icon={CreditCard}
          color="text-orange-600"
          subtitle={`${stats.pendingPayouts} requests`}
        />
        <StatCard
          title="Total Commissions"
          value={`₦${stats.totalCommissionAmount.toLocaleString()}`}
          icon={DollarSign}
          color="text-green-600"
          subtitle={`${stats.totalCommissions} transactions`}
        />
        <StatCard
          title="New Sign-ups (30d)"
          value={stats.recentSignups}
          icon={UserPlus}
          color="text-purple-600"
          subtitle="Via referrals"
        />
      </div>

      {/* Progress & Analytics */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Agent Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Active Agents</span>
                  <span>{stats.activeAgents}/{stats.totalAgents}</span>
                </div>
                <Progress 
                  value={(stats.activeAgents / Math.max(stats.totalAgents, 1)) * 100} 
                  className="h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Commission Payout Rate</span>
                  <span>
                    {stats.totalCommissions > 0 
                      ? Math.round(((stats.totalCommissions - stats.pendingCommissions) / stats.totalCommissions) * 100)
                      : 0
                    }%
                  </span>
                </div>
                <Progress 
                  value={stats.totalCommissions > 0 ? ((stats.totalCommissions - stats.pendingCommissions) / stats.totalCommissions) * 100 : 0}
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
                <span className="text-sm">Pending Commissions</span>
                <Badge variant={stats.pendingCommissions > 0 ? "secondary" : "default"}>
                  {stats.pendingCommissions > 0 ? `${stats.pendingCommissions} Pending` : 'All Processed'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Payout Requests</span>
                <Badge variant={stats.pendingPayouts > 0 ? "destructive" : "default"}>
                  {stats.pendingPayouts > 0 ? `${stats.pendingPayouts} Pending` : 'Up to Date'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">New Agents This Month</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  {stats.newAgentsThisMonth} New
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 cursor-pointer transition-colors">
              <CardContent className="p-4 text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <h3 className="font-semibold">Manage Agents</h3>
                <p className="text-sm text-muted-foreground">View and manage referral agents</p>
              </CardContent>
            </Card>
            <Card className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 cursor-pointer transition-colors">
              <CardContent className="p-4 text-center">
                <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <h3 className="font-semibold">Process Payouts</h3>
                <p className="text-sm text-muted-foreground">Handle pending commission payouts</p>
              </CardContent>
            </Card>
            <Card className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 cursor-pointer transition-colors">
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <h3 className="font-semibold">View Reports</h3>
                <p className="text-sm text-muted-foreground">Analyze commission performance</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};