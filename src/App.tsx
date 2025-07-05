
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Sidebar from "./components/layout/Sidebar";
import Index from "./pages/Index";
import TrackingPage from "./pages/TrackingPage";
import Settings from "./pages/Settings";
import DevelopersPage from "./pages/DevelopersPage";
import NotFound from "./pages/NotFound";
import { gps51StartupService } from "./services/gps51/GPS51StartupService";

const queryClient = new QueryClient();

const App = () => {
  // Initialize GPS51 services on app startup
  useEffect(() => {
    const initializeGPS51 = async () => {
      try {
        console.log('🚀 Initializing GPS51 services on app startup...');
        const initialized = await gps51StartupService.initialize();
        
        if (initialized) {
          console.log('✅ GPS51 services initialized successfully');
        } else {
          console.log('⚠️ GPS51 services not initialized (not configured or authentication failed)');
        }
      } catch (error) {
        console.error('❌ Failed to initialize GPS51 services:', error);
      }
    };

    initializeGPS51();

    // Listen for token refresh events
    const handleTokenRefresh = async () => {
      console.log('🔄 Token refresh event received');
      await gps51StartupService.refreshAuthentication();
    };

    window.addEventListener('gps51-token-refresh-needed', handleTokenRefresh);

    return () => {
      window.removeEventListener('gps51-token-refresh-needed', handleTokenRefresh);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="flex min-h-screen bg-gray-50">
            <Sidebar />
            <main className="flex-1 overflow-auto">
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/tracking" element={<TrackingPage />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/developers" element={<DevelopersPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
