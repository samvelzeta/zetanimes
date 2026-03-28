import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "@/components/BottomNav";

const NO_NAV_PAGES = ["/watch"];

export default function Layout() {
  const location = useLocation();
  const hideNav = NO_NAV_PAGES.some((p) => location.pathname.startsWith(p));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className={hideNav ? "" : "pb-20"}>
        <Outlet />
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
