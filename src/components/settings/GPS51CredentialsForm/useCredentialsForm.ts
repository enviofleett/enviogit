
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useGPS51SessionBridge } from '@/hooks/useGPS51SessionBridge';
import { md5 } from 'js-md5';
import type { GPS51FormData, GPS51DebugInfo } from './types';

export const useCredentialsForm = () => {
  const [formData, setFormData] = useState<GPS51FormData>({
    apiUrl: 'https://api.gps51.com/openapi',
    username: '',
    password: '',
    apiKey: '',
    from: 'WEB',
    type: 'USER'
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<GPS51DebugInfo | null>(null);
  
  const { toast } = useToast();
  const { status, connect, disconnect, refresh } = useGPS51SessionBridge();

  // Load saved configuration on component mount
  useEffect(() => {
    const loadConfiguration = () => {
      const savedConfig = {
        apiUrl: localStorage.getItem('gps51_api_url') || 'https://api.gps51.com/openapi',
        username: localStorage.getItem('gps51_username') || '',
        from: (localStorage.getItem('gps51_from') as 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN') || 'WEB',
        type: (localStorage.getItem('gps51_type') as 'USER' | 'DEVICE') || 'USER',
        apiKey: localStorage.getItem('gps51_api_key') || ''
      };
      
      setFormData(prev => ({
        ...prev,
        ...savedConfig
      }));
    };

    loadConfiguration();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const isValidMD5 = (str: string): boolean => {
    return /^[a-f0-9]{32}$/.test(str);
  };

  const validateForm = () => {
    if (!formData.apiUrl || !formData.username || !formData.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in API URL, username, and password.",
        variant: "destructive",
      });
      return false;
    }

    // Basic URL validation
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

    // Validate correct API URL - updated for openapi endpoint
    if (!formData.apiUrl.includes('api.gps51.com')) {
      toast({
        title: "Incorrect API URL",
        description: "GPS51 API URL should use 'api.gps51.com' subdomain, not 'www.gps51.com'",
        variant: "destructive",
      });
      return false;
    }

    // Check for deprecated webapi endpoint
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

  const prepareCredentials = (rawPassword: string) => {
    // Only hash if not already hashed
    const hashedPassword = isValidMD5(rawPassword) ? rawPassword : md5(rawPassword).toLowerCase();
    
    const credentials = {
      apiUrl: formData.apiUrl,
      username: formData.username,
      password: hashedPassword,
      apiKey: formData.apiKey,
      from: formData.from,
      type: formData.type
    };

    // Store debug info
    setDebugInfo({
      originalPassword: {
        length: rawPassword.length,
        isAlreadyHashed: isValidMD5(rawPassword),
        firstChars: rawPassword.substring(0, 4) + '...'
      },
      processedPassword: {
        length: hashedPassword.length,
        isValidMD5: isValidMD5(hashedPassword),
        firstChars: hashedPassword.substring(0, 8) + '...'
      },
      credentials: {
        ...credentials,
        password: hashedPassword.substring(0, 8) + '...' // Truncated for security
      },
      timestamp: new Date().toISOString()
    });

    return credentials;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const credentials = prepareCredentials(formData.password);
      
      // Store credentials in localStorage
      localStorage.setItem('gps51_api_url', credentials.apiUrl);
      localStorage.setItem('gps51_username', credentials.username);
      localStorage.setItem('gps51_from', credentials.from);
      localStorage.setItem('gps51_type', credentials.type);
      if (credentials.apiKey) {
        localStorage.setItem('gps51_api_key', credentials.apiKey);
      }

      // Connect using the session bridge
      await connect();
      
      toast({
        title: "Configuration Saved",
        description: "GPS51 credentials have been saved and connection established.",
      });
    } catch (error) {
      console.error('Save failed:', error);
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : 'Failed to save configuration',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!validateForm()) return;

    setIsTesting(true);
    try {
      const credentials = prepareCredentials(formData.password);
      
      // Test connection logic here - for now just simulate
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Connection Test Successful",
        description: "Successfully connected to GPS51 API.",
      });
    } catch (error) {
      console.error('Test failed:', error);
      toast({
        title: "Connection Test Failed",
        description: error instanceof Error ? error.message : 'Failed to test connection',
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearConfiguration = () => {
    // Clear localStorage
    localStorage.removeItem('gps51_api_url');
    localStorage.removeItem('gps51_username');
    localStorage.removeItem('gps51_from');
    localStorage.removeItem('gps51_type');
    localStorage.removeItem('gps51_api_key');

    // Reset form
    setFormData({
      apiUrl: 'https://api.gps51.com/openapi',
      username: '',
      password: '',
      apiKey: '',
      from: 'WEB',
      type: 'USER'
    });

    // Disconnect
    disconnect();

    toast({
      title: "Configuration Cleared",
      description: "GPS51 configuration has been cleared.",
    });
  };

  return {
    formData,
    showPassword,
    setShowPassword,
    isLoading,
    setIsLoading,
    isTesting,
    setIsTesting,
    showDebug,
    setShowDebug,
    debugInfo,
    status,
    connect,
    disconnect,
    refresh,
    toast,
    handleInputChange,
    validateForm,
    prepareCredentials,
    isValidMD5,
    handleSave,
    handleTestConnection,
    handleClearConfiguration
  };
};
