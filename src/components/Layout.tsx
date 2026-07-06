import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import HeaderBar from "@/components/HeaderBar";
import TVSidebar from "@/components/TVSidebar";
import AdblockGate from "@/components/AdblockGate";
import ExpiryAlert from "@/components/premium/ExpiryAlert";
import PremiumGhostAds from "@/components/ads/PremiumGhostAds";
import { useIsTV } from "@/hooks/useIsTV";
import { useTVRemote } from "@/hooks/useTVRemote";

const NO_NAV_PAGES = ["/watch", "/auth", "/reset-password", "/download"];
const NO_HEADER_PAGES = ["/watch", "/auth", "/reset-password", "/settings", "/admin", "/download", "/profile"];

export default function Layout() {
  const location = useLocation();
  const isTV = useIsTV();
  // D-Pad spatial navigation activa solo en TV mode (el hook chequea internamente)
  useTVRemote();

  const hideNav = NO_NAV_PAGES.some((p) => location.pathname.startsWith(p));
  const hideHeader = NO_HEADER_PAGES.some((p) => location.pathname.startsWith(p));
  const transparentHeader = location.pathname === "/" || location.pathname.startsWith("/anime/");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdblockGate />
      <ExpiryAlert />
      {/* Motor fantasma 0×0 — solo se monta en premium, invisible e intocable. */}
      <PremiumGhostAds />
      {isTV ? (
        <>
          {!hideNav && <TVSidebar />}
          <main>
            <Outlet />
          </main>
        </>
      ) : (
        <>
          {!hideHeader && <HeaderBar />}
          <main className={`${hideNav ? "" : "pb-20 lg:pb-0"} ${!hideHeader && !transparentHeader ? "pt-12" : ""}`}>
            <Outlet />
          </main>
          {!hideNav && <BottomNav />}
        </>
      )}
    </div>
  );
}
