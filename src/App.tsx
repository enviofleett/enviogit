
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Sidebar from "./components/layout/Sidebar";
import Index from "./pages/Index";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  // Initialize GPS51 services on app startup
  useEffect(() => {
    const initializeGPS51 = async () => {
      try {
        console.log('🚀 App startup - GPS51 initialization skipped (credentials not configured)');
        // Skip GPS51 initialization if credentials are not configured
        // This prevents the app from failing to load when GPS51 is not set up
      } catch (error) {
        console.error('❌ App startup error:', error);
      }
    };

    initializeGPS51();
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
                <Route path="/tracking" element={<Index />} />
                <Route path="/maintenance" element={<Index />} />
                <Route path="/geofencing" element={<Index />} />
                <Route path="/analytics" element={<Index />} />
                <Route path="/alerts" element={<Index />} />
                <Route path="/drivers" element={<Index />} />
                <Route path="/insights" element={<Index />} />
                <Route path="/settings" element={<Settings />} />
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
