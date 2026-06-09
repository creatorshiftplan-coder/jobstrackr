import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AdminRoleType = "admin" | "data_entry" | null;

export function useAdminRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AdminRoleType>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAdminRole() {
      if (!user) {
        setRole(null);
        setIsLoading(false);
        return;
      }

      try {
        // First check for full admin role
        const { data: isAdmin, error: adminError } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });

        if (adminError) throw adminError;

        if (isAdmin === true) {
          setRole("admin");
          setIsLoading(false);
          return;
        }

        // If not full admin, check for data_entry role
        const { data: isDataEntry, error: dataEntryError } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "data_entry" as any, // Type not yet in generated Supabase types
        });

        if (dataEntryError) throw dataEntryError;

        if (isDataEntry === true) {
          setRole("data_entry");
        } else {
          setRole(null);
        }
      } catch (error) {
        console.error("Error checking admin role:", error);
        setRole(null);
      } finally {
        setIsLoading(false);
      }
    }

    checkAdminRole();
  }, [user]);

  // Computed properties for easy access
  const isAdmin = role === "admin" || role === "data_entry"; // Has any admin access
  const isFullAdmin = role === "admin"; // Has full admin access
  const isDataEntry = role === "data_entry"; // Has restricted data entry access

  return {
    role,
    isAdmin,           // true if user has ANY admin role (admin or data_entry)
    isFullAdmin,       // true only for full admin
    isDataEntry,       // true only for data_entry role
    isLoading
  };
}
