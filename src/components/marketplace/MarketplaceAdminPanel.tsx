import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Store, 
  Users, 
  Package, 
  ShoppingCart, 
  Star, 
  CheckCircle, 
  XCircle, 
  Plus,
  Edit,
  Trash2,
  Eye
} from 'lucide-react';
import type { Merchant, ServiceCategory, MarketplaceOffering, MarketplaceOrder } from '@/types/marketplace';

export const MarketplaceAdminPanel: React.FC = () => {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [offerings, setOfferings] = useState<MarketplaceOffering[]>([]);
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '', icon_url: '' });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [merchantsRes, categoriesRes, offeringsRes, ordersRes] = await Promise.all([
        supabase.from('merchants').select('*').order('created_at', { ascending: false }),
        supabase.from('service_categories').select('*').order('name'),
        supabase.from('marketplace_offerings').select('*, merchants(business_name), service_categories(name)').order('created_at', { ascending: false }),
        supabase.from('marketplace_orders').select('*, merchants(business_name), marketplace_offerings(name)').order('created_at', { ascending: false }).limit(50)
      ]);

      if (merchantsRes.data) setMerchants(merchantsRes.data as Merchant[]);
      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (offeringsRes.data) setOfferings(offeringsRes.data as any);
      if (ordersRes.data) setOrders(ordersRes.data as any);
    } catch (error) {
      console.error('Error loading marketplace data:', error);
      toast({
        title: "Error",
        description: "Failed to load marketplace data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const approveMerchant = async (merchantId: string) => {
    try {
      const { error } = await supabase
        .from('merchants')
        .update({ 
          status: 'approved', 
          approval_date: new Date().toISOString(),
          approved_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', merchantId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Merchant approved successfully"
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const rejectMerchant = async (merchantId: string) => {
    try {
      const { error } = await supabase
        .from('merchants')
        .update({ status: 'rejected' })
        .eq('id', merchantId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Merchant rejected"
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const createCategory = async () => {
    if (!newCategory.name.trim()) {
      toast({
        title: "Error",
        description: "Category name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('service_categories')
        .insert([newCategory]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Category created successfully"
      });
      setNewCategory({ name: '', description: '', icon_url: '' });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const toggleOfferingFavorite = async (offeringId: string, isFavorite: boolean) => {
    try {
      const { error } = await supabase
        .from('marketplace_offerings')
        .update({ is_favorite: !isFavorite })
        .eq('id', offeringId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Offering ${!isFavorite ? 'added to' : 'removed from'} favorites`
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending_approval: 'secondary',
      approved: 'default',
      rejected: 'destructive',
      suspended: 'outline'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Marketplace Management</h2>
        <p className="text-muted-foreground">
          Manage merchants, categories, products, and orders
        </p>
      </div>

      <Tabs defaultValue="merchants" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="merchants" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Merchants
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="offerings" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Offerings
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Orders
          </TabsTrigger>
        </TabsList>

        <TabsContent value="merchants">
          <Card>
            <CardHeader>
              <CardTitle>Merchant Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {merchants.filter(m => m.status === 'pending_approval').map((merchant) => (
                  <div key={merchant.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-semibold">{merchant.business_name}</h3>
                      <p className="text-sm text-muted-foreground">{merchant.business_email}</p>
                      <p className="text-sm text-muted-foreground">{merchant.city}, {merchant.country}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(merchant.status)}
                      <Button
                        size="sm"
                        onClick={() => approveMerchant(merchant.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rejectMerchant(merchant.id)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
                {merchants.filter(m => m.status === 'pending_approval').length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    No pending merchant approvals
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>All Merchants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {merchants.map((merchant) => (
                  <div key={merchant.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <span className="font-medium">{merchant.business_name}</span>
                      <span className="text-sm text-muted-foreground ml-2">({merchant.business_email})</span>
                    </div>
                    {getStatusBadge(merchant.status)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <CardTitle>Service Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="category-name">Category Name</Label>
                  <Input
                    id="category-name"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Vehicle Maintenance"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="category-description">Description</Label>
                  <Input
                    id="category-description"
                    value={newCategory.description}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={createCategory}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Category
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <span className="font-medium">{category.name}</span>
                      {category.description && (
                        <span className="text-sm text-muted-foreground ml-2">- {category.description}</span>
                      )}
                    </div>
                    <Badge variant={category.is_active ? 'default' : 'secondary'}>
                      {category.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offerings">
          <Card>
            <CardHeader>
              <CardTitle>Marketplace Offerings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {offerings.map((offering: any) => (
                  <div key={offering.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-semibold">{offering.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        by {offering.merchants?.business_name} • {offering.service_categories?.name}
                      </p>
                      <p className="text-sm font-medium">
                        ₦{offering.price.toLocaleString()} ({offering.pricing_model})
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={offering.is_favorite ? "default" : "outline"}
                        onClick={() => toggleOfferingFavorite(offering.id, offering.is_favorite)}
                      >
                        <Star className={`h-4 w-4 mr-1 ${offering.is_favorite ? 'fill-current' : ''}`} />
                        {offering.is_favorite ? 'Featured' : 'Feature'}
                      </Button>
                      <Badge variant={offering.is_active ? 'default' : 'secondary'}>
                        {offering.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {orders.map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-semibold">{order.marketplace_offerings?.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        by {order.merchants?.business_name}
                      </p>
                      <p className="text-sm">
                        ₦{order.amount.toLocaleString()} • Device: {order.vehicle_device_id}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={
                        order.status === 'completed' ? 'default' :
                        order.status === 'service_validated' ? 'secondary' :
                        order.status === 'paid_pending_validation' ? 'outline' :
                        'destructive'
                      }>
                        {order.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
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
};