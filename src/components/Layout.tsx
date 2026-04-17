import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import HeaderBar from "@/components/HeaderBar";
import TVSidebar from "@/components/TVSidebar";
import { useIsTV } from "@/hooks/useIsTV";
import { useTVRemote } from "@/hooks/useTVRemote";

const NO_NAV_PAGES = ["/watch", "/auth", "/reset-password", "/download"];
const NO_HEADER_PAGES = ["/watch", "/auth", "/reset-password", "/settings", "/admin", "/download"];

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
          <main className={`${hideNav ? "" : "pb-20"} ${!hideHeader && !transparentHeader ? "pt-12" : ""}`}>
            <Outlet />
          </main>
          {!hideNav && <BottomNav />}
        </>
      )}
    </div>
  );
}
