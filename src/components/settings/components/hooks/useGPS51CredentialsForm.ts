
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { GPS51ConnectionService } from '@/services/gps51/GPS51ConnectionService';
import { CredentialsValidator } from '../CredentialsValidator';

interface FormData {
  apiUrl: string;
  username: string;
  password: string;
  from: string;
  type: string;
}

interface ConfigStatus {
  isConfigured: boolean;
  missingCredentials: string[];
  apiUrl: string;
  username: string;
}

interface SessionStatus {
  error: string | null;
  isAuthenticated: boolean;
  connectionHealth: string;
  syncStatus: string;
  lastSync: Date | null;
}

interface DebugInfo {
  timestamp: string;
  formData: Partial<FormData>;
  validation: any;
  configStatus: ConfigStatus;
}

export const useGPS51CredentialsForm = () => {
  const { toast } = useToast();
  const connectionService = new GPS51ConnectionService();

  const [formData, setFormData] = useState<FormData>({
    apiUrl: 'https://api.gps51.com/openapi',
    username: '',
    password: '',
    from: 'WEB',
    type: 'USER'
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  
  const [configStatus, setConfigStatus] = useState<ConfigStatus>({
    isConfigured: false,
    missingCredentials: [],
    apiUrl: '',
    username: ''
  });

  const [status, setStatus] = useState<SessionStatus>({
    error: null,
    isAuthenticated: false,
    connectionHealth: 'lost',
    syncStatus: 'idle',
    lastSync: null
  });

  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    timestamp: new Date().toISOString(),
    formData: {},
    validation: null,
    configStatus: configStatus
  });

  // Load saved credentials on mount
  useEffect(() => {
    const loadSavedCredentials = () => {
      try {
        const savedApiUrl = localStorage.getItem('gps51_api_url');
        const savedUsername = localStorage.getItem('gps51_username');
        const savedFrom = localStorage.getItem('gps51_from');
        const savedType = localStorage.getItem('gps51_type');

        if (savedApiUrl || savedUsername) {
          setFormData({
            apiUrl: savedApiUrl || 'https://api.gps51.com/openapi',
            username: savedUsername || '',
            password: '', // Never pre-fill password for security
            from: savedFrom || 'WEB',
            type: savedType || 'USER'
          });
        }

        // Update config status
        const configStatus = connectionService.getConfigurationStatus();
        setConfigStatus(configStatus);

        // Update status if already configured
        if (configStatus.isConfigured) {
          setStatus(prev => ({
            ...prev,
            isAuthenticated: true,
            connectionHealth: 'good',
            syncStatus: 'success'
          }));
        }
      } catch (error) {
        console.error('Error loading saved credentials:', error);
      }
    };

    loadSavedCredentials();
  }, []);

  // Update debug info when relevant state changes
  useEffect(() => {
    setDebugInfo({
      timestamp: new Date().toISOString(),
      formData: { ...formData, password: formData.password ? '***hidden***' : '' },
      validation: validationResult,
      configStatus
    });
  }, [formData, validationResult, configStatus]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Validate on change
    const validation = CredentialsValidator.validateCredentials({
      ...formData,
      [field]: value
    });
    setValidationResult(validation);
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      setStatus(prev => ({ ...prev, error: null, syncStatus: 'syncing' }));

      // Validate first
      const validation = CredentialsValidator.validateCredentials(formData);
      setValidationResult(validation);

      if (!validation.isValid) {
        toast({
          title: 'Validation Failed',
          description: validation.errors.join(', '),
          variant: 'destructive'
        });
        return;
      }

      // Save credentials
      const result = await connectionService.connect({
        apiUrl: formData.apiUrl,
        username: formData.username,
        password: formData.password,
        from: formData.from,
        type: formData.type
      });

      if (result.success) {
        toast({
          title: 'GPS51 Configured Successfully',
          description: `Connected with ${result.vehiclesSynced || 0} vehicles found`
        });

        setStatus({
          error: null,
          isAuthenticated: true,
          connectionHealth: 'good',
          syncStatus: 'success',
          lastSync: new Date()
        });

        setConfigStatus({
          isConfigured: true,
          missingCredentials: [],
          apiUrl: formData.apiUrl,
          username: formData.username
        });
      } else {
        throw new Error(result.error || 'Configuration failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Configuration failed';
      
      toast({
        title: 'Configuration Failed',
        description: errorMessage,
        variant: 'destructive'
      });

      setStatus(prev => ({
        ...prev,
        error: errorMessage,
        isAuthenticated: false,
        connectionHealth: 'lost',
        syncStatus: 'error'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setIsTesting(true);
      setStatus(prev => ({ ...prev, error: null, syncStatus: 'syncing' }));

      const validation = CredentialsValidator.validateCredentials(formData);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      const result = await connectionService.connect({
        apiUrl: formData.apiUrl,
        username: formData.username,
        password: formData.password,
        from: formData.from,
        type: formData.type
      });

      if (result.success) {
        toast({
          title: 'Connection Test Successful',
          description: `Found ${result.vehiclesSynced || 0} vehicles`
        });

        setStatus(prev => ({
          ...prev,
          error: null,
          connectionHealth: 'good',
          syncStatus: 'success',
          lastSync: new Date()
        }));
      } else {
        throw new Error(result.error || 'Connection test failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
      
      toast({
        title: 'Connection Test Failed',
        description: errorMessage,
        variant: 'destructive'
      });

      setStatus(prev => ({
        ...prev,
        error: errorMessage,
        connectionHealth: 'poor',
        syncStatus: 'error'
      }));
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncData = async () => {
    if (!configStatus.isConfigured) {
      toast({
        title: 'Configuration Required',
        description: 'Please save your GPS51 credentials before syncing data',
        variant: 'destructive'
      });
      return;
    }

    try {
      setStatus(prev => ({ ...prev, syncStatus: 'syncing' }));
      
      const result = await connectionService.refresh();
      
      if (result.success) {
        toast({
          title: 'Data Sync Completed',
          description: `Synced ${result.vehiclesSynced || 0} vehicles and ${result.positionsStored || 0} positions`
        });

        setStatus(prev => ({
          ...prev,
          syncStatus: 'success',
          lastSync: new Date(),
          error: null
        }));
      } else {
        throw new Error(result.error || 'Data sync failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Data sync failed';
      
      toast({
        title: 'Data Sync Failed',
        description: errorMessage,
        variant: 'destructive'
      });

      setStatus(prev => ({
        ...prev,
        error: errorMessage,
        syncStatus: 'error'
      }));
    }
  };

  const handleClearConfiguration = () => {
    connectionService.disconnect();
    
    setFormData({
      apiUrl: 'https://api.gps51.com/openapi',
      username: '',
      password: '',
      from: 'WEB',
      type: 'USER'
    });

    setConfigStatus({
      isConfigured: false,
      missingCredentials: ['apiUrl', 'username', 'password'],
      apiUrl: '',
      username: ''
    });

    setStatus({
      error: null,
      isAuthenticated: false,
      connectionHealth: 'lost',
      syncStatus: 'idle',
      lastSync: null
    });

    setValidationResult(null);

    toast({
      title: 'Configuration Cleared',
      description: 'GPS51 credentials have been removed'
    });
  };

  return {
    formData,
    showPassword,
    isLoading,
    isTesting,
    showDebug,
    debugInfo,
    validationResult,
    configStatus,
    status,
    handleInputChange,
    setShowPassword,
    setShowDebug,
    handleSave,
    handleTestConnection,
    handleSyncData,
    handleClearConfiguration
  };
};
