import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, 
  Star, 
  MapPin, 
  ShoppingCart,
  Filter
} from 'lucide-react';
import type { ServiceCategory, MarketplaceOffering } from '@/types/marketplace';

interface MarketplaceBrowseProps {
  onPurchase?: (offering: MarketplaceOffering) => void;
}

export const MarketplaceBrowse: React.FC<MarketplaceBrowseProps> = ({ onPurchase }) => {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [filteredOfferings, setFilteredOfferings] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterOfferings();
  }, [offerings, searchTerm, selectedCategory, showFavoritesOnly]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [categoriesRes, offeringsRes] = await Promise.all([
        supabase.from('service_categories').select('*').eq('is_active', true).order('name'),
        supabase.from('marketplace_offerings')
          .select(`
            *,
            merchants(business_name, city, country),
            service_categories(name)
          `)
          .eq('is_active', true)
          .order('is_favorite', { ascending: false })
          .order('created_at', { ascending: false })
      ]);

      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (offeringsRes.data) setOfferings(offeringsRes.data);
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

  const filterOfferings = () => {
    let filtered = offerings;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(offering => 
        offering.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        offering.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        offering.merchants?.business_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(offering => offering.category_id === selectedCategory);
    }

    // Filter by favorites
    if (showFavoritesOnly) {
      filtered = filtered.filter(offering => offering.is_favorite);
    }

    setFilteredOfferings(filtered);
  };

  const formatPrice = (price: number, currency: string, pricingModel: string) => {
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency
    }).format(price);

    const modelSuffix = {
      one_off: '',
      subscription: '/month',
      quarterly: '/quarter',
      annually: '/year'
    };

    return `${formatted}${modelSuffix[pricingModel as keyof typeof modelSuffix] || ''}`;
  };

  const handlePurchase = (offering: MarketplaceOffering) => {
    if (onPurchase) {
      onPurchase(offering);
    } else {
      toast({
        title: "Purchase",
        description: "Purchase functionality will be implemented",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Marketplace</h2>
        <p className="text-muted-foreground">
          Discover services for your vehicles
        </p>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={showFavoritesOnly ? "default" : "outline"}
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className="w-full sm:w-auto"
            >
              <Star className={`h-4 w-4 mr-2 ${showFavoritesOnly ? 'fill-current' : ''}`} />
              Featured
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {categories.map((category) => (
          <Card 
            key={category.id}
            className={`cursor-pointer transition-colors hover:bg-muted/50 ${
              selectedCategory === category.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedCategory(selectedCategory === category.id ? 'all' : category.id)}
          >
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <div className="text-primary font-semibold">
                  {category.name.charAt(0)}
                </div>
              </div>
              <p className="text-sm font-medium">{category.name}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Offerings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOfferings.map((offering) => (
          <Card key={offering.id} className="overflow-hidden">
            <div className="aspect-video bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
              <div className="text-4xl font-bold text-primary/20">
                {offering.name.charAt(0)}
              </div>
            </div>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{offering.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    by {offering.merchants?.business_name}
                  </p>
                </div>
                {offering.is_favorite && (
                  <Badge variant="secondary" className="ml-2">
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    Featured
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {offering.description && (
                <p className="text-sm text-muted-foreground">
                  {offering.description}
                </p>
              )}
              
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mr-1" />
                {offering.merchants?.city}, {offering.merchants?.country}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold">
                    {formatPrice(offering.price, offering.currency, offering.pricing_model)}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {offering.service_categories?.name}
                  </Badge>
                </div>
                <Button
                  onClick={() => handlePurchase(offering)}
                  className="ml-4"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Purchase
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredOfferings.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No services found matching your criteria</p>
              <p className="text-sm mt-2">Try adjusting your search or filters</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-video bg-muted animate-pulse" />
              <CardHeader>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded animate-pulse" />
                  <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};