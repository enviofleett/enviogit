import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Fuel, 
  TrendingUp, 
  TrendingDown, 
  Gauge, 
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Calendar,
  RefreshCw,
  Car
} from 'lucide-react';
import { FuelConsumptionInsights } from '@/services/fuel/FuelConsumptionAnalysisEngine';

interface FuelConsumptionDashboardProps {
  vehicleId?: string;
  subscriptionTier?: string;
}

export function FuelConsumptionDashboard({ 
  vehicleId, 
  subscriptionTier = 'basic' 
}: FuelConsumptionDashboardProps) {
  const [insights, setInsights] = useState<FuelConsumptionInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [selectedVehicle, setSelectedVehicle] = useState(vehicleId || '');
  const { toast } = useToast();

  useEffect(() => {
    if (selectedVehicle) {
      loadFuelInsights();
    }
  }, [selectedVehicle, selectedPeriod]);

  const loadFuelInsights = async () => {
    if (!selectedVehicle) return;
    
    setLoading(true);
    try {
      // This would typically call an API endpoint that uses our fuel analysis services
      const response = await fetch(`/api/fuel-insights/${selectedVehicle}?period=${selectedPeriod}`);
      if (response.ok) {
        const data = await response.json();
        setInsights(data);
      } else {
        throw new Error('Failed to load fuel insights');
      }
    } catch (error) {
      console.error('Failed to load fuel insights:', error);
      toast({
        title: "Error Loading Data",
        description: "Failed to load fuel consumption insights",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getEfficiencyColor = (rating: string) => {
    switch (rating) {
      case 'optimal': return 'text-green-600';
      case 'above_expected': return 'text-yellow-600';
      case 'high_consumption': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getEfficiencyIcon = (rating: string) => {
    switch (rating) {
      case 'optimal': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'above_expected': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'high_consumption': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Gauge className="h-4 w-4" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingDown className="h-4 w-4 text-green-600" />;
      case 'declining': return <TrendingUp className="h-4 w-4 text-red-600" />;
      default: return <BarChart3 className="h-4 w-4 text-blue-600" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin" />
            <p>Loading fuel consumption insights...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Fuel className="h-5 w-5" />
                Fuel Consumption Intelligence
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Advanced fuel efficiency analysis and insights
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Select value={selectedPeriod} onValueChange={(value: any) => setSelectedPeriod(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={loadFuelInsights} disabled={loading} size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {!insights ? (
        <Card>
          <CardContent className="text-center p-8">
            <Car className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Data Available</h3>
            <p className="text-muted-foreground">
              Select a vehicle and ensure GPS51 data is available to view fuel insights.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="comparison">Comparison</TabsTrigger>
            <TabsTrigger value="analysis" disabled={subscriptionTier === 'basic'}>
              Speed Analysis
            </TabsTrigger>
            <TabsTrigger value="trends" disabled={subscriptionTier === 'basic'}>
              Historical
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Actual Consumption */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Actual Consumption</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {insights.actualConsumption.lPer100km.toFixed(1)} L/100km
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {insights.actualConsumption.totalDistance.toFixed(0)} km driven
                  </p>
                </CardContent>
              </Card>

              {/* Efficiency Rating */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Efficiency Rating</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {insights.comparison && getEfficiencyIcon(insights.comparison.efficiencyRating)}
                    <span className={`text-sm font-medium ${
                      insights.comparison ? getEfficiencyColor(insights.comparison.efficiencyRating) : ''
                    }`}>
                      {insights.comparison?.efficiencyRating.replace('_', ' ').toUpperCase() || 'No Data'}
                    </span>
                  </div>
                  {insights.comparison && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {insights.comparison.deviationPercentage >= 0 ? '+' : ''}
                      {insights.comparison.deviationPercentage.toFixed(1)}% vs manufacturer
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Fuel Cost */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Estimated Cost</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${insights.actualConsumption.costEstimate?.toFixed(2) || '0.00'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {insights.actualConsumption.totalFuelUsed.toFixed(1)}L used
                  </p>
                </CardContent>
              </Card>

              {/* Data Quality */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Data Quality</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-2">
                    <Progress value={insights.dataQuality.completeness} className="flex-1" />
                    <span className="text-sm">{insights.dataQuality.completeness}%</span>
                  </div>
                  <Badge variant={
                    insights.dataQuality.reliability === 'high' ? 'default' : 
                    insights.dataQuality.reliability === 'medium' ? 'secondary' : 'destructive'
                  }>
                    {insights.dataQuality.reliability} reliability
                  </Badge>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="comparison">
            {insights.comparison && insights.manufacturerBenchmark ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Manufacturer Comparison</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      How your actual consumption compares to manufacturer specifications
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="font-medium mb-2">Your Consumption</h4>
                        <div className="text-3xl font-bold text-primary">
                          {insights.actualConsumption.lPer100km.toFixed(1)} L/100km
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">
                          Manufacturer ({insights.manufacturerBenchmark.source})
                        </h4>
                        <div className="text-3xl font-bold text-muted-foreground">
                          {insights.manufacturerBenchmark.statedConsumption.toFixed(1)} L/100km
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm">{insights.comparison.explanation}</p>
                      {insights.comparison.factors.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium mb-1">Contributing factors:</p>
                          <ul className="text-xs text-muted-foreground list-disc list-inside">
                            {insights.comparison.factors.map((factor, index) => (
                              <li key={index}>{factor}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="text-center p-8">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Manufacturer Data</h3>
                  <p className="text-muted-foreground">
                    Complete your vehicle profile to enable manufacturer comparisons.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="analysis">
            {subscriptionTier === 'basic' ? (
              <Card>
                <CardContent className="text-center p-8">
                  <Badge className="mb-4" variant="secondary">Premium Feature</Badge>
                  <h3 className="text-lg font-medium mb-2">Speed Impact Analysis</h3>
                  <p className="text-muted-foreground">
                    Upgrade to Premium to unlock detailed speed impact analysis and driving insights.
                  </p>
                </CardContent>
              </Card>
            ) : insights.speedAnalysis ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Speed Impact Analysis</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      How your driving speed affects fuel consumption
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 mb-4">
                      <div>
                        <h4 className="font-medium mb-2">Average Speed</h4>
                        <div className="text-2xl font-bold">
                          {insights.speedAnalysis.avgSpeed.toFixed(1)} km/h
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Speed Distribution</h4>
                        <div className="space-y-2">
                          {Object.entries(insights.speedAnalysis.speedDistribution).map(([range, percentage]) => (
                            <div key={range} className="flex items-center justify-between text-sm">
                              <span>{range.replace('_', ' ').replace(/([a-z])([0-9])/g, '$1 $2')}</span>
                              <span>{percentage}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm">{insights.speedAnalysis.impactExplanation}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="text-center p-8">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No speed analysis data available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="trends">
            {subscriptionTier === 'basic' ? (
              <Card>
                <CardContent className="text-center p-8">
                  <Badge className="mb-4" variant="secondary">Premium Feature</Badge>
                  <h3 className="text-lg font-medium mb-2">Historical Trends</h3>
                  <p className="text-muted-foreground">
                    Upgrade to Premium to view historical fuel consumption trends and performance tracking.
                  </p>
                </CardContent>
              </Card>
            ) : insights.historicalTrends ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {getTrendIcon(insights.historicalTrends.trend)}
                      Historical Trends
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Your fuel consumption performance over time
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <Badge variant={
                        insights.historicalTrends.trend === 'improving' ? 'default' :
                        insights.historicalTrends.trend === 'declining' ? 'destructive' : 'secondary'
                      }>
                        Trend: {insights.historicalTrends.trend}
                      </Badge>
                    </div>
                    
                    {insights.historicalTrends.previousPeriods.length > 0 ? (
                      <div className="space-y-2">
                        <h4 className="font-medium">Previous Periods</h4>
                        {insights.historicalTrends.previousPeriods.map((period, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                            <span className="text-sm">{period.period}</span>
                            <div className="text-right">
                              <div className="text-sm font-medium">{period.consumption.toFixed(1)} L/100km</div>
                              <div className={`text-xs ${period.deviation >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {period.deviation >= 0 ? '+' : ''}{period.deviation.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No historical data available yet. Keep tracking to build your performance history.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="text-center p-8">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No historical trends data available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}