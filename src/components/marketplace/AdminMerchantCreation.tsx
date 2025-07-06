import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Building, Mail, Phone, MapPin, CheckCircle } from 'lucide-react';

interface MerchantFormData {
  business_name: string;
  business_email: string;
  business_phone: string;
  business_description: string;
  city: string;
  country: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'suspended';
  bank_account_details: {
    account_name: string;
    account_number: string;
    bank_name: string;
    bank_code: string;
  };
  social_media: {
    website?: string;
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
}

export const AdminMerchantCreation: React.FC = () => {
  const [formData, setFormData] = useState<MerchantFormData>({
    business_name: '',
    business_email: '',
    business_phone: '',
    business_description: '',
    city: '',
    country: 'Nigeria',
    status: 'approved',
    bank_account_details: {
      account_name: '',
      account_number: '',
      bank_name: '',
      bank_code: ''
    },
    social_media: {
      website: '',
      facebook: '',
      instagram: '',
      twitter: ''
    }
  });
  const [isCreating, setIsCreating] = useState(false);
  const [isCSVMode, setIsCSVMode] = useState(false);
  const [csvData, setCSVData] = useState('');
  const { toast } = useToast();

  const updateFormData = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => {
        const parentObj = prev[parent as keyof MerchantFormData] as any;
        return {
          ...prev,
          [parent]: {
            ...parentObj,
            [child]: value
          }
        };
      });
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const createSingleMerchant = async () => {
    setIsCreating(true);
    try {
      // Create a temporary user account for the merchant if needed
      // In a real implementation, you might want to send an invitation email instead
      const { error } = await supabase
        .from('merchants')
        .insert([{
          user_id: null, // Will be linked when merchant signs up
          business_name: formData.business_name,
          business_email: formData.business_email,
          business_phone: formData.business_phone,
          business_description: formData.business_description,
          city: formData.city,
          country: formData.country,
          status: formData.status,
          bank_account_details: formData.bank_account_details,
          social_media: formData.social_media,
          approval_date: formData.status === 'approved' ? new Date().toISOString() : null,
          approved_by: formData.status === 'approved' ? (await supabase.auth.getUser()).data.user?.id : null
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Merchant created successfully"
      });

      // Reset form
      setFormData({
        business_name: '',
        business_email: '',
        business_phone: '',
        business_description: '',
        city: '',
        country: 'Nigeria',
        status: 'approved',
        bank_account_details: {
          account_name: '',
          account_number: '',
          bank_name: '',
          bank_code: ''
        },
        social_media: {
          website: '',
          facebook: '',
          instagram: '',
          twitter: ''
        }
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const createMerchantsFromCSV = async () => {
    setIsCreating(true);
    try {
      const lines = csvData.trim().split('\n');
      const merchants = [];

      for (let i = 1; i < lines.length; i++) { // Skip header
        const [business_name, business_email, business_phone, city, country, account_name, account_number, bank_name] = lines[i].split(',');
        
        merchants.push({
          user_id: null,
          business_name: business_name?.trim(),
          business_email: business_email?.trim(),
          business_phone: business_phone?.trim(),
          city: city?.trim(),
          country: country?.trim() || 'Nigeria',
          status: 'approved',
          bank_account_details: {
            account_name: account_name?.trim(),
            account_number: account_number?.trim(),
            bank_name: bank_name?.trim(),
            bank_code: ''
          },
          social_media: {},
          approval_date: new Date().toISOString(),
          approved_by: (await supabase.auth.getUser()).data.user?.id
        });
      }

      const { error } = await supabase
        .from('merchants')
        .insert(merchants);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${merchants.length} merchants created successfully`
      });

      setCSVData('');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Create Merchants
        </h3>
        <p className="text-muted-foreground">
          Add new merchants to the marketplace directly
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        <Button
          variant={!isCSVMode ? "default" : "outline"}
          onClick={() => setIsCSVMode(false)}
        >
          Single Merchant
        </Button>
        <Button
          variant={isCSVMode ? "default" : "outline"}
          onClick={() => setIsCSVMode(true)}
        >
          Bulk CSV Import
        </Button>
      </div>

      {!isCSVMode ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Create Single Merchant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Business Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="business_name">Business Name *</Label>
                <Input
                  id="business_name"
                  value={formData.business_name}
                  onChange={(e) => updateFormData('business_name', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="business_email">Business Email *</Label>
                <Input
                  id="business_email"
                  type="email"
                  value={formData.business_email}
                  onChange={(e) => updateFormData('business_email', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="business_phone">Business Phone</Label>
                <Input
                  id="business_phone"
                  value={formData.business_phone}
                  onChange={(e) => updateFormData('business_phone', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => updateFormData('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending_approval">Pending Approval</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="business_description">Business Description</Label>
              <Textarea
                id="business_description"
                value={formData.business_description}
                onChange={(e) => updateFormData('business_description', e.target.value)}
                rows={3}
              />
            </div>

            {/* Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => updateFormData('city', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => updateFormData('country', e.target.value)}
                />
              </div>
            </div>

            {/* Bank Details */}
            <div>
              <h4 className="font-medium mb-3">Bank Account Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="account_name">Account Name</Label>
                  <Input
                    id="account_name"
                    value={formData.bank_account_details.account_name}
                    onChange={(e) => updateFormData('bank_account_details.account_name', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input
                    id="account_number"
                    value={formData.bank_account_details.account_number}
                    onChange={(e) => updateFormData('bank_account_details.account_number', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="bank_name">Bank Name</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_account_details.bank_name}
                    onChange={(e) => updateFormData('bank_account_details.bank_name', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="bank_code">Bank Code</Label>
                  <Input
                    id="bank_code"
                    value={formData.bank_account_details.bank_code}
                    onChange={(e) => updateFormData('bank_account_details.bank_code', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Social Media */}
            <div>
              <h4 className="font-medium mb-3">Social Media (Optional)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.social_media.website || ''}
                    onChange={(e) => updateFormData('social_media.website', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="facebook">Facebook</Label>
                  <Input
                    id="facebook"
                    value={formData.social_media.facebook || ''}
                    onChange={(e) => updateFormData('social_media.facebook', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={createSingleMerchant}
              disabled={isCreating || !formData.business_name || !formData.business_email}
              className="w-full"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {isCreating ? 'Creating...' : 'Create Merchant'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Bulk CSV Import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="csv-data">CSV Data</Label>
              <Textarea
                id="csv-data"
                value={csvData}
                onChange={(e) => setCSVData(e.target.value)}
                placeholder="business_name,business_email,business_phone,city,country,account_name,account_number,bank_name&#10;Auto Clinic Lagos,clinic@example.com,+234123456789,Lagos,Nigeria,Auto Clinic,1234567890,First Bank"
                rows={10}
              />
            </div>
            <Alert>
              <AlertDescription>
                CSV Format: business_name,business_email,business_phone,city,country,account_name,account_number,bank_name
                <br />
                First row should be the header. All merchants will be created with 'approved' status.
              </AlertDescription>
            </Alert>
            <Button
              onClick={createMerchantsFromCSV}
              disabled={isCreating || !csvData.trim()}
              className="w-full"
            >
              {isCreating ? 'Creating...' : 'Import Merchants'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};