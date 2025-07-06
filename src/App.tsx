
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Sidebar from "./components/layout/Sidebar";
import Index from "./pages/Index";
import Settings from "./pages/Settings";
import MobileApp from "./pages/MobileApp";
import NotFound from "./pages/NotFound";
import { gps51ProductionBootstrap } from "./services/production/GPS51ProductionBootstrap";

const queryClient = new QueryClient();

const App = () => {
  // Initialize production system on app startup
  useEffect(() => {
    const initializeProductionSystem = async () => {
      try {
        console.log('🚀 Initializing production system...');
        const result = await gps51ProductionBootstrap.initializeProductionSystem();
        
        if (result.success) {
          console.log('✅ Production system initialized successfully');
          if (result.systemReady) {
            console.log('🎉 System is production ready!');
          }
        } else {
          console.log('⚠️ Production system initialization completed with issues:', result.errors);
        }

        // Log any warnings
        if (result.warnings.length > 0) {
          console.warn('⚠️ Production system warnings:', result.warnings);
        }
      } catch (error) {
        console.error('❌ Failed to initialize production system:', error);
      }
    };

    initializeProductionSystem();
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
                <Route path="/mobile" element={<MobileApp />} />
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
