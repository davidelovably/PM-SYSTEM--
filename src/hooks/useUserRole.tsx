import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setRole(data?.role || null);
      setLoading(false);
    };

    fetchRole();
  }, [user]);

  return {
    role,
    loading,
    isSuperAdmin: role === "super_admin",
    isAdmin: role === "admin",
    isProjectManager: role === "project_manager",
    isCollaborator: role === "collaborator",
    isClient: role === "client",
  };
}
