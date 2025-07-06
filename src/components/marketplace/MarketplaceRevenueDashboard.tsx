import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, 
  DollarSign, 
  PieChart,
  Calendar,
  Download,
  RefreshCw,
  Users,
  ShoppingCart,
  Percent
} from 'lucide-react';

interface RevenueMetrics {
  totalRevenue: number;
  totalCommission: number;
  totalOrders: number;
  averageOrderValue: number;
  topCategories: Array<{
    category_name: string;
    revenue: number;
    commission: number;
    orders: number;
    commission_rate: number;
  }>;
  recentOrders: Array<{
    id: string;
    amount: number;
    commission: number;
    merchant_name: string;
    offering_name: string;
    category_name: string;
    created_at: string;
    status: string;
  }>;
  monthlyTrends: Array<{
    month: string;
    revenue: number;
    commission: number;
    orders: number;
  }>;
}

export function MarketplaceRevenueDashboard() {
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadRevenueMetrics = async () => {
    try {
      setIsLoading(true);
      
      const daysAgo = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365
      }[selectedPeriod];

      const dateFilter = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

      // Get orders with related data
      const { data: ordersData, error: ordersError } = await supabase
        .from('marketplace_orders')
        .select(`
          id,
          amount,
          platform_fee,
          merchant_amount,
          applied_commission_rate,
          status,
          created_at,
          payment_date,
          merchants!inner(business_name),
          marketplace_offerings!inner(name, service_categories!inner(name, commission_percentage))
        `)
        .gte('created_at', dateFilter)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error loading orders:', ordersError);
        return;
      }

      const orders = ordersData || [];
      const completedOrders = orders.filter(order => 
        order.status === 'completed' || order.status === 'paid'
      );

      // Calculate totals
      const totalRevenue = completedOrders.reduce((sum, order) => sum + order.amount, 0);
      const totalCommission = completedOrders.reduce((sum, order) => sum + order.platform_fee, 0);
      const totalOrders = completedOrders.length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Group by category
      const categoryMap = new Map();
      completedOrders.forEach(order => {
        const categoryName = order.marketplace_offerings?.service_categories?.name || 'Unknown';
        const commissionRate = order.applied_commission_rate || order.marketplace_offerings?.service_categories?.commission_percentage || 0;
        
        if (!categoryMap.has(categoryName)) {
          categoryMap.set(categoryName, {
            category_name: categoryName,
            revenue: 0,
            commission: 0,
            orders: 0,
            commission_rate: commissionRate
          });
        }
        
        const category = categoryMap.get(categoryName);
        category.revenue += order.amount;
        category.commission += order.platform_fee;
        category.orders += 1;
      });

      const topCategories = Array.from(categoryMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Recent orders for activity feed
      const recentOrders = orders.slice(0, 20).map(order => ({
        id: order.id,
        amount: order.amount,
        commission: order.platform_fee,
        merchant_name: order.merchants?.business_name || 'Unknown',
        offering_name: order.marketplace_offerings?.name || 'Unknown',
        category_name: order.marketplace_offerings?.service_categories?.name || 'Unknown',
        created_at: order.created_at,
        status: order.status
      }));

      // Monthly trends (last 12 months for yearly view, or last periods for shorter views)
      const monthlyMap = new Map();
      completedOrders.forEach(order => {
        const date = new Date(order.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, {
            month: monthKey,
            revenue: 0,
            commission: 0,
            orders: 0
          });
        }
        
        const month = monthlyMap.get(monthKey);
        month.revenue += order.amount;
        month.commission += order.platform_fee;
        month.orders += 1;
      });

      const monthlyTrends = Array.from(monthlyMap.values())
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12); // Last 12 periods

      setMetrics({
        totalRevenue,
        totalCommission,
        totalOrders,
        averageOrderValue,
        topCategories,
        recentOrders,
        monthlyTrends
      });

    } catch (error) {
      console.error('Failed to load revenue metrics:', error);
    } finally {
      setIsLoading(false);
      setLastRefresh(new Date());
    }
  };

  useEffect(() => {
    loadRevenueMetrics();
  }, [selectedPeriod]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending_payment':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin" />
            <p>Loading marketplace revenue data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="text-center p-8">
          <PieChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No Revenue Data</h3>
          <p className="text-muted-foreground">No completed orders found for the selected period</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Marketplace Revenue Dashboard</h3>
          <p className="text-sm text-muted-foreground">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="px-3 py-1 border rounded text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <Button 
            onClick={loadRevenueMetrics} 
            variant="outline" 
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Revenue Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(metrics.totalRevenue)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Commission Earned</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(metrics.totalCommission)}
                </p>
              </div>
              <Percent className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold text-purple-600">
                  {metrics.totalOrders.toLocaleString()}
                </p>
              </div>
              <ShoppingCart className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Order Value</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(metrics.averageOrderValue)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="recent">Recent Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Revenue by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.topCategories.map((category, index) => (
                  <div key={category.category_name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium">{index + 1}</span>
                      </div>
                      <div>
                        <h4 className="font-medium">{category.category_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {category.orders} orders • {category.commission_rate}% commission
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(category.revenue)}</p>
                      <p className="text-sm text-green-600">+{formatCurrency(category.commission)} commission</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Monthly Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.monthlyTrends.map((month) => (
                  <div key={month.month} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{month.month}</h4>
                      <p className="text-sm text-muted-foreground">{month.orders} orders</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(month.revenue)}</p>
                      <p className="text-sm text-green-600">+{formatCurrency(month.commission)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Recent Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-medium text-sm">{order.offering_name}</h5>
                        <Badge className={`text-xs ${getStatusColor(order.status)}`}>
                          {order.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {order.merchant_name} • {order.category_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(order.amount)}</p>
                      <p className="text-xs text-green-600">+{formatCurrency(order.commission)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}