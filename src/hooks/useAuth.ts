import { trpc } from "@/providers/trpc";
import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { LOGIN_PATH } from "@/const";
import { useSupabaseAuth } from "@/providers/SupabaseAuthProvider";
import { isSupabaseConfigured, signOutSupabase } from "@/lib/supabase";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = LOGIN_PATH } =
    options ?? {};

  const navigate = useNavigate();
  const supabaseAuth = useSupabaseAuth();

  const utils = trpc.useUtils();

  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = trpc.auth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate(redirectPath);
    },
  });

  const logout = useCallback(async () => {
    if (isSupabaseConfigured) {
      await signOutSupabase();
      navigate(redirectPath);
      return;
    }
    logoutMutation.mutate();
  }, [logoutMutation, navigate, redirectPath]);

  const supabaseUser = supabaseAuth.user
    ? {
        id: supabaseAuth.user.id,
        name: supabaseAuth.user.user_metadata?.full_name || supabaseAuth.user.email || "Luna User",
        email: supabaseAuth.user.email || null,
        role: "admin",
      }
    : null;
  const resolvedUser = supabaseUser ?? user ?? null;
  const resolvedIsLoading =
    logoutMutation.isPending || (!supabaseAuth.isReady && isLoading);
  const resolvedIsAuthenticated = Boolean(supabaseUser ?? user);

  useEffect(() => {
    if (redirectOnUnauthenticated && !resolvedIsLoading && !resolvedIsAuthenticated) {
      const currentPath = window.location.pathname;
      if (currentPath !== redirectPath) {
        navigate(redirectPath);
      }
    }
  }, [redirectOnUnauthenticated, resolvedIsLoading, resolvedIsAuthenticated, navigate, redirectPath]);

  return useMemo(
    () => ({
      user: resolvedUser,
      isAuthenticated: resolvedIsAuthenticated,
      isLoading: resolvedIsLoading,
      error,
      logout,
      refresh: refetch,
    }),
    [resolvedUser, resolvedIsAuthenticated, resolvedIsLoading, error, logout, refetch],
  );
}
