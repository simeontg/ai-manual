import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  isHost: boolean;
  isChecker: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
