import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import HeaderBar from "@/components/HeaderBar";

const NO_NAV_PAGES = ["/watch", "/auth", "/reset-password"];
const NO_HEADER_PAGES = ["/watch", "/auth", "/reset-password", "/settings", "/admin"];

export default function Layout() {
  const location = useLocation();
  const hideNav = NO_NAV_PAGES.some((p) => location.pathname.startsWith(p));
  const hideHeader = NO_HEADER_PAGES.some((p) => location.pathname.startsWith(p));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!hideHeader && <HeaderBar />}
      <main className={`${hideNav ? "" : "pb-20"} ${!hideHeader ? "pt-12" : ""}`}>
        <Outlet />
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
