import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Brain, Package, MessageSquare, Settings, BarChart3, TestTube, Save } from 'lucide-react';

interface ChatbotConfiguration {
  id: string;
  llm_provider: string;
  api_endpoint?: string;
  model_name?: string;
  welcome_message: string;
  persona_description: string;
  conversation_history_retention_days: number;
}

interface SubscriptionPackage {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface PackageFeature {
  id: string;
  package_id: string;
  feature_name: string;
  is_enabled: boolean;
}

interface UsageLimit {
  id: string;
  package_id: string;
  max_prompts_per_day: number;
  max_prompts_per_week: number;
  max_prompts_per_month: number;
}

const AVAILABLE_FEATURES = [
  { name: 'get_vehicle_location', label: 'Vehicle Location Access', description: 'Allow users to ask for current vehicle location' },
  { name: 'engine_control', label: 'Engine Control', description: 'Allow users to control vehicle engines (with confirmation)' },
  { name: 'subscription_info', label: 'Subscription Information', description: 'Allow users to view their subscription details' },
  { name: 'usage_history', label: 'Usage History', description: 'Allow users to view their platform usage statistics' },
  { name: 'general_qa', label: 'General Q&A', description: 'Allow general questions about the platform' },
  { name: 'create_support_ticket', label: 'Support Tickets', description: 'Allow users to create support tickets' },
  { name: 'vehicle_telemetry', label: 'Vehicle Telemetry', description: 'Allow access to detailed vehicle sensor data' },
];

export const AIChatbotSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<ChatbotConfiguration | null>(null);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [packageFeatures, setPackageFeatures] = useState<PackageFeature[]>([]);
  const [usageLimits, setUsageLimits] = useState<UsageLimit[]>([]);
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [configRes, packagesRes, featuresRes, limitsRes] = await Promise.all([
        supabase.from('chatbot_configurations').select('*').single(),
        supabase.from('subscription_packages').select('*').eq('is_active', true).order('name'),
        supabase.from('chatbot_package_features').select('*'),
        supabase.from('chatbot_usage_limits').select('*'),
      ]);

      if (configRes.data) setConfig(configRes.data);
      if (packagesRes.data) setPackages(packagesRes.data);
      if (featuresRes.data) setPackageFeatures(featuresRes.data);
      if (limitsRes.data) setUsageLimits(limitsRes.data);

    } catch (error) {
      console.error('Error loading chatbot settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load chatbot settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async () => {
    if (!config) return;

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('chatbot_configurations')
        .update({
          llm_provider: config.llm_provider,
          api_endpoint: config.api_endpoint,
          model_name: config.model_name,
          welcome_message: config.welcome_message,
          persona_description: config.persona_description,
          conversation_history_retention_days: config.conversation_history_retention_days,
        })
        .eq('id', config.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Chatbot configuration saved successfully',
      });
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePackageFeature = async (packageId: string, featureName: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('chatbot_package_features')
        .upsert({
          package_id: packageId,
          feature_name: featureName,
          is_enabled: enabled,
        });

      if (error) throw error;

      setPackageFeatures(prev => {
        const existing = prev.find(f => f.package_id === packageId && f.feature_name === featureName);
        if (existing) {
          return prev.map(f => 
            f.package_id === packageId && f.feature_name === featureName 
              ? { ...f, is_enabled: enabled }
              : f
          );
        } else {
          return [...prev, {
            id: crypto.randomUUID(),
            package_id: packageId,
            feature_name: featureName,
            is_enabled: enabled,
          }];
        }
      });

      toast({
        title: 'Success',
        description: 'Package feature updated successfully',
      });
    } catch (error) {
      console.error('Error updating package feature:', error);
      toast({
        title: 'Error',
        description: 'Failed to update package feature',
        variant: 'destructive',
      });
    }
  };

  const updateUsageLimit = async (packageId: string, field: keyof UsageLimit, value: number) => {
    try {
      const existing = usageLimits.find(l => l.package_id === packageId);
      
      if (existing) {
        const { error } = await supabase
          .from('chatbot_usage_limits')
          .update({ [field]: value })
          .eq('package_id', packageId);

        if (error) throw error;

        setUsageLimits(prev => prev.map(l => 
          l.package_id === packageId 
            ? { ...l, [field]: value }
            : l
        ));
      } else {
        const newLimit = {
          package_id: packageId,
          max_prompts_per_day: field === 'max_prompts_per_day' ? value : 10,
          max_prompts_per_week: field === 'max_prompts_per_week' ? value : 50,
          max_prompts_per_month: field === 'max_prompts_per_month' ? value : 200,
        };

        const { error } = await supabase
          .from('chatbot_usage_limits')
          .insert(newLimit);

        if (error) throw error;

        setUsageLimits(prev => [...prev, { 
          id: crypto.randomUUID(), 
          ...newLimit 
        }]);
      }

      toast({
        title: 'Success',
        description: 'Usage limit updated successfully',
      });
    } catch (error) {
      console.error('Error updating usage limit:', error);
      toast({
        title: 'Error',
        description: 'Failed to update usage limit',
        variant: 'destructive',
      });
    }
  };

  const testChatbot = async () => {
    if (!testMessage.trim()) return;

    try {
      setLoading(true);
      setTestResponse('Processing...');

      const { data, error } = await supabase.functions.invoke('ai-vehicle-chatbot', {
        body: {
          message: testMessage,
          sessionId: 'test-session',
          userId: (await supabase.auth.getUser()).data.user?.id,
          context: {
            userId: (await supabase.auth.getUser()).data.user?.id,
            vehicleIds: [],
            features: {
              get_vehicle_location: true,
              engine_control: false,
              subscription_info: true,
              usage_history: true,
              general_qa: true,
              create_support_ticket: true,
              vehicle_telemetry: false,
            },
            usageLimits: { max_prompts_per_day: 1000, max_prompts_per_week: 1000, max_prompts_per_month: 1000 },
            currentUsage: { today: 0, week: 0, month: 0 },
          },
          conversationHistory: [],
          configuration: config,
        },
      });

      if (error) throw error;

      setTestResponse(data.response || 'No response received');
    } catch (error) {
      console.error('Test error:', error);
      setTestResponse(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getFeatureEnabled = (packageId: string, featureName: string) => {
    return packageFeatures.find(f => f.package_id === packageId && f.feature_name === featureName)?.is_enabled || false;
  };

  const getUsageLimit = (packageId: string, field: keyof UsageLimit) => {
    const limit = usageLimits.find(l => l.package_id === packageId);
    return limit?.[field] as number || (field === 'max_prompts_per_day' ? 10 : field === 'max_prompts_per_week' ? 50 : 200);
  };

  if (loading && !config) {
    return <div className="p-6">Loading AI chatbot settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">AI Chatbot Settings</h2>
        <p className="text-muted-foreground">
          Configure the AI chatbot system for vehicle interactions and customer support.
        </p>
      </div>

      <Tabs defaultValue="configuration" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="configuration" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI Configuration
          </TabsTrigger>
          <TabsTrigger value="packages" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Package Features
          </TabsTrigger>
          <TabsTrigger value="limits" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Usage Limits
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Test
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configuration">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                AI Model Configuration
              </CardTitle>
              <CardDescription>
                Configure the AI model provider and behavior settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="llm_provider">LLM Provider</Label>
                  <Select 
                    value={config?.llm_provider || 'gemini-2.0-flash'} 
                    onValueChange={(value) => config && setConfig({ ...config, llm_provider: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash (Canvas Default)</SelectItem>
                      <SelectItem value="custom">Custom API Endpoint</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retention">History Retention (Days)</Label>
                  <Input
                    id="retention"
                    type="number"
                    min="0"
                    max="30"
                    value={config?.conversation_history_retention_days || 7}
                    onChange={(e) => config && setConfig({ 
                      ...config, 
                      conversation_history_retention_days: parseInt(e.target.value) 
                    })}
                  />
                </div>
              </div>

              {config?.llm_provider === 'custom' && (
                <div className="grid grid-cols-2 gap-6 p-4 border rounded-lg bg-muted/50">
                  <div className="space-y-2">
                    <Label htmlFor="api_endpoint">API Endpoint URL</Label>
                    <Input
                      id="api_endpoint"
                      placeholder="https://api.example.com/v1/chat"
                      value={config?.api_endpoint || ''}
                      onChange={(e) => setConfig({ ...config, api_endpoint: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model_name">Model Name</Label>
                    <Input
                      id="model_name"
                      placeholder="gpt-4, llama-3, etc."
                      value={config?.model_name || ''}
                      onChange={(e) => setConfig({ ...config, model_name: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="welcome_message">Welcome Message</Label>
                <Textarea
                  id="welcome_message"
                  rows={3}
                  value={config?.welcome_message || ''}
                  onChange={(e) => config && setConfig({ ...config, welcome_message: e.target.value })}
                  placeholder="Hello! I'm your AI vehicle assistant. How can I help you today?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="persona_description">Chatbot Persona Description</Label>
                <Textarea
                  id="persona_description"
                  rows={4}
                  value={config?.persona_description || ''}
                  onChange={(e) => config && setConfig({ ...config, persona_description: e.target.value })}
                  placeholder="You are a helpful, concise, and polite vehicle assistant. Always prioritize user safety and privacy."
                />
              </div>

              <Button onClick={saveConfiguration} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Save Configuration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packages">
          <Card>
            <CardHeader>
              <CardTitle>Package Feature Configuration</CardTitle>
              <CardDescription>
                Configure which chatbot features are available for each subscription package
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {packages.map((pkg) => (
                  <div key={pkg.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold">{pkg.name}</h3>
                        <p className="text-sm text-muted-foreground">{pkg.description}</p>
                      </div>
                      <Badge variant={pkg.is_active ? "default" : "secondary"}>
                        {pkg.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {AVAILABLE_FEATURES.map((feature) => (
                        <div key={feature.name} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-medium text-sm">{feature.label}</p>
                            <p className="text-xs text-muted-foreground">{feature.description}</p>
                          </div>
                          <Switch
                            checked={getFeatureEnabled(pkg.id, feature.name)}
                            onCheckedChange={(enabled) => updatePackageFeature(pkg.id, feature.name, enabled)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="limits">
          <Card>
            <CardHeader>
              <CardTitle>Usage Limits by Package</CardTitle>
              <CardDescription>
                Set prompt limits to control AI usage and manage costs per subscription tier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {packages.map((pkg) => (
                  <div key={pkg.id} className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-4">{pkg.name}</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Max Prompts per Day</Label>
                        <Input
                          type="number"
                          min="0"
                          value={getUsageLimit(pkg.id, 'max_prompts_per_day')}
                          onChange={(e) => updateUsageLimit(pkg.id, 'max_prompts_per_day', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Prompts per Week</Label>
                        <Input
                          type="number"
                          min="0"
                          value={getUsageLimit(pkg.id, 'max_prompts_per_week')}
                          onChange={(e) => updateUsageLimit(pkg.id, 'max_prompts_per_week', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Prompts per Month</Label>
                        <Input
                          type="number"
                          min="0"
                          value={getUsageLimit(pkg.id, 'max_prompts_per_month')}
                          onChange={(e) => updateUsageLimit(pkg.id, 'max_prompts_per_month', parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Test Chatbot
              </CardTitle>
              <CardDescription>
                Test the AI chatbot functionality with sample messages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test_message">Test Message</Label>
                <Textarea
                  id="test_message"
                  rows={3}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Ask something like: Where is my vehicle? or What's my subscription status?"
                />
              </div>
              <Button onClick={testChatbot} disabled={loading || !testMessage.trim()}>
                <TestTube className="h-4 w-4 mr-2" />
                Test Chatbot
              </Button>
              {testResponse && (
                <div className="p-4 border rounded-lg bg-muted/50">
                  <Label className="text-sm font-medium">Response:</Label>
                  <p className="mt-2 whitespace-pre-wrap">{testResponse}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};