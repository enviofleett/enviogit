
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SafeComponentWrapper } from "./components/SafeComponentWrapper";
import Sidebar from "./components/layout/Sidebar";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import TrackingPage from "./pages/TrackingPage";
import DevelopersPage from "./pages/DevelopersPage";
import Dashboard from "./pages/Dashboard";
import { gps51StartupService } from "./services/gps51/GPS51StartupService";

const queryClient = new QueryClient();

const App = () => {
  // Initialize GPS51 services on app startup with comprehensive error handling
  useEffect(() => {
    const initializeGPS51 = async () => {
      try {
        console.log('🚀 Starting GPS51 system initialization...');
        
        // Set a timeout to prevent hanging on startup
        const initTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('GPS51 initialization timeout after 10 seconds')), 10000);
        });
        
        const initPromise = gps51StartupService.initialize();
        
        const initialized = await Promise.race([initPromise, initTimeout]) as boolean;
        
        if (initialized) {
          console.log('✅ GPS51 services initialized successfully');
          
          // Dispatch success event for other components
          window.dispatchEvent(new CustomEvent('gps51-system-ready', {
            detail: { status: 'initialized', timestamp: Date.now() }
          }));
        } else {
          console.log('⚠️ GPS51 services not initialized (credentials may not be configured)');
          
          // Dispatch not-ready event
          window.dispatchEvent(new CustomEvent('gps51-system-not-ready', {
            detail: { 
              status: 'not_configured', 
              message: 'GPS51 credentials not configured', 
              timestamp: Date.now() 
            }
          }));
        }
      } catch (error) {
        console.error('❌ GPS51 initialization failed:', error);
        
        // Dispatch error event but don't break the app
        window.dispatchEvent(new CustomEvent('gps51-system-error', {
          detail: { 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now() 
          }
        }));
        
        // The app should continue to work even if GPS51 fails
        console.log('📱 App will continue to work without GPS51 services');
      }
    };

    // Use setTimeout to ensure this runs after the initial render
    const timer = setTimeout(initializeGPS51, 100);

    // Listen for token refresh events with error handling
    const handleTokenRefresh = async () => {
      try {
        console.log('🔄 Token refresh event received');
        await gps51StartupService.refreshAuthentication();
      } catch (error) {
        console.error('❌ Token refresh failed:', error);
      }
    };

    // Listen for manual GPS51 restart requests
    const handleGPS51Restart = async () => {
      try {
        console.log('🔄 Manual GPS51 restart requested');
        await gps51StartupService.restart();
      } catch (error) {
        console.error('❌ GPS51 restart failed:', error);
      }
    };

    window.addEventListener('gps51-token-refresh-needed', handleTokenRefresh);
    window.addEventListener('gps51-system-restart', handleGPS51Restart);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('gps51-token-refresh-needed', handleTokenRefresh);
      window.removeEventListener('gps51-system-restart', handleGPS51Restart);
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <div className="flex min-h-screen bg-gray-50">
              <SafeComponentWrapper componentName="Navigation Sidebar">
                <Sidebar />
              </SafeComponentWrapper>
              <main className="flex-1 overflow-auto">
                <Routes>
                  <Route path="/" element={
                    <SafeComponentWrapper componentName="Home Page">
                      <Index />
                    </SafeComponentWrapper>
                  } />
                  <Route path="/dashboard" element={
                    <SafeComponentWrapper componentName="Dashboard">
                      <Dashboard />
                    </SafeComponentWrapper>
                  } />
                  <Route path="/tracking" element={
                    <SafeComponentWrapper componentName="Tracking Page">
                      <TrackingPage />
                    </SafeComponentWrapper>
                  } />
                  <Route path="/settings" element={
                    <SafeComponentWrapper componentName="Settings Page">
                      <Settings />
                    </SafeComponentWrapper>
                  } />
                  <Route path="/developers" element={
                    <SafeComponentWrapper componentName="Developers Console">
                      <DevelopersPage />
                    </SafeComponentWrapper>
                  } />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
            </div>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
