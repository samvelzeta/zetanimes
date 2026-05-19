import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  resolveUserPermissions,
  FREE_PERMISSIONS,
  type PlanPermissions,
} from "@/lib/plan-permissions";

export function usePlanPermissions() {
  const { user, roles, loading } = useAuth();
  const [permissions, setPermissions] = useState<PlanPermissions>(FREE_PERMISSIONS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancel = false;
    if (loading) return;
    if (!user) {
      setPermissions(FREE_PERMISSIONS);
      setReady(true);
      return;
    }
    setReady(false);
    resolveUserPermissions(user.id, roles).then((p) => {
      if (!cancel) {
        setPermissions(p);
        setReady(true);
      }
    });
    return () => {
      cancel = true;
    };
  }, [user, roles.join(","), loading]);

  return { permissions, ready, loading: loading || !ready };
}
