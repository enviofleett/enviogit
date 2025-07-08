
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Sidebar from "./components/layout/Sidebar";
import { AuthGuard } from "./components/auth/AuthGuard";
import Index from "./pages/Index";
import Settings from "./pages/Settings";
import Developer from "./pages/Developer";
import Marketplace from "./pages/Marketplace";
import MobileApp from "./pages/MobileApp";
import Partners from "./pages/Partners";
import Referrals from "./pages/Referrals";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import GPS51LiveTrackingEnhanced from "./pages/GPS51LiveTrackingEnhanced";
import { gps51ProductionBootstrap } from "./services/production/GPS51ProductionBootstrap";

const queryClient = new QueryClient();

const App = () => {
  // PHASE 3 EMERGENCY: Skip production system to prevent API spikes
  useEffect(() => {
    console.log('🚨 PHASE 3 EMERGENCY MODE: Skipping GPS51 production bootstrap to prevent API spikes');
    console.log('✅ App initialized in emergency mode - minimal features active');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={
              <AuthGuard requireAuth={false}>
                <Auth />
              </AuthGuard>
            } />
            <Route path="/*" element={
              <AuthGuard requireAuth={true}>
                <div className="flex min-h-screen bg-gray-50">
                  <Sidebar />
                  <main className="flex-1 overflow-auto">
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/tracking" element={<GPS51LiveTrackingEnhanced />} />
                      <Route path="/marketplace" element={<Marketplace />} />
                      <Route path="/partners" element={<Partners />} />
                      <Route path="/referrals" element={<Referrals />} />
                      <Route path="/developer" element={<Developer />} />
                      <Route path="/mobile" element={<MobileApp />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </main>
                </div>
              </AuthGuard>
            } />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
