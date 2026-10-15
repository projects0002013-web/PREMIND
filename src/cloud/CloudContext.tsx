import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { client, configError } from "./client";
interface CloudState {
  session: Session | null;
  loading: boolean;
  authError: boolean;
  configured: boolean;
  invalidConfig: boolean;
  recovering: boolean;
  finishRecovery: () => void;
}
const Context = createContext<CloudState>({
  session: null,
  loading: false,
  authError: false,
  configured: false,
  invalidConfig: false,
  recovering: false,
  finishRecovery: () => {},
});
export const useCloud = () => useContext(Context);
export function CloudProvider({ children }: { children: ReactNode }) {
  const [recovering, setRecovering] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!client);
  const [authError, setAuthError] = useState(false);
  useEffect(() => {
    if (!client) return;
    let active = true;
    let authChanged = false;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") setRecovering(false);
      authChanged = true;
      if (active) {
        setSession(next);
        setLoading(false);
      }
    });
    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (active) {
          if (!authChanged) setSession(data.session);
          setAuthError(!!error);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setAuthError(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  return (
    <Context.Provider
      value={{
        session,
        loading,
        authError,
        configured: !!client,
        invalidConfig: configError,
        recovering,
        finishRecovery: () => setRecovering(false),
      }}
    >
      {children}
    </Context.Provider>
  );
}
