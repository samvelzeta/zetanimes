import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import SearchPage from "@/pages/Search";
import Directory from "@/pages/Directory";
import AnimeDetail from "@/pages/AnimeDetail";
import Watch from "@/pages/Watch";
import RecentlyWatched from "@/pages/RecentlyWatched";
import Profile from "@/pages/Profile";
import SettingsPage from "@/pages/Settings";
import AuthPage from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import AdminPanel from "@/pages/Admin";
import TermsPage from "@/pages/Terms";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/directory" element={<Directory />} />
              <Route path="/anime/:id" element={<AnimeDetail />} />
              <Route path="/watch/:id" element={<Watch />} />
              <Route path="/recent" element={<RecentlyWatched />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/terms" element={<TermsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
