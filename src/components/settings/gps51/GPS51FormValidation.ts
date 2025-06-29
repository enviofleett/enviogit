
import { useToast } from '@/hooks/use-toast';

export interface GPS51FormData {
  apiUrl: string;
  username: string;
  password: string;
  apiKey: string;
  from: 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN';
  type: 'USER' | 'DEVICE';
}

export const useGPS51FormValidation = () => {
  const { toast } = useToast();

  const validateForm = (formData: GPS51FormData) => {
    if (!formData.apiUrl || !formData.username || !formData.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in API URL, username, and password.",
        variant: "destructive",
      });
      return false;
    }

    try {
      new URL(formData.apiUrl);
    } catch {
      toast({
        title: "Invalid API URL",
        description: "Please enter a valid API URL.",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.apiUrl.includes('api.gps51.com')) {
      toast({
        title: "Incorrect API URL",
        description: "GPS51 API URL should use 'api.gps51.com' subdomain, not 'www.gps51.com'",
        variant: "destructive",
      });
      return false;
    }

    if (formData.apiUrl.includes('/webapi')) {
      toast({
        title: "Deprecated API Endpoint",
        description: "Please update your API URL to use the new '/openapi' endpoint instead of '/webapi'",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  return { validateForm };
};
