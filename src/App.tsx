import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfilesProvider } from "@/contexts/ProfilesContext";
import ProfileGate from "@/components/profiles/ProfileGate";
import Layout from "@/components/Layout";
import ScrollToTop from "@/components/ScrollToTop";
import Home from "@/pages/Home";

// Code-splitting: rutas secundarias en chunks separados
const SearchPage = lazy(() => import("@/pages/Search"));
const Directory = lazy(() => import("@/pages/Directory"));
const AnimeDetail = lazy(() => import("@/pages/AnimeDetail"));
const Watch = lazy(() => import("@/pages/Watch"));
const RecentlyWatched = lazy(() => import("@/pages/RecentlyWatched"));
const Profile = lazy(() => import("@/pages/Profile"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const AuthPage = lazy(() => import("@/pages/Auth"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const AdminPanel = lazy(() => import("@/pages/Admin"));
const TermsPage = lazy(() => import("@/pages/Terms"));
const DownloadPage = lazy(() => import("@/pages/Download"));
const VerifiedPage = lazy(() => import("@/pages/Verified"));
const MyLists = lazy(() => import("@/pages/MyLists"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 30, // 30 min
      gcTime: 1000 * 60 * 60,     // 1 h
    },
  },
});

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <ProfilesProvider>
            <ProfileGate />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/directory" element={<Directory />} />
                <Route path="/anime/:id" element={<AnimeDetail />} />
                <Route path="/watch/:id" element={<Watch />} />
                <Route path="/recent" element={<RecentlyWatched />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/mis-listas" element={<MyLists />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/terms" element={<TermsPage />} />
              </Route>
              <Route path="/download" element={<DownloadPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </ProfilesProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
