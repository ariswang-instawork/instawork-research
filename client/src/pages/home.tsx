import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { LogIn, LogOut, User, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

function AuthStatusBanner({ error }: { error: string | null }) {
  if (!error) return null;

  const messages: Record<string, string> = {
    no_code: "Authorization failed — no code was returned.",
    invalid_state: "Authorization failed — invalid state parameter (possible CSRF attack).",
    token_exchange_failed: "Failed to exchange authorization code for a token.",
    token_exchange_error: "An error occurred during token exchange.",
  };

  return (
    <div
      data-testid="alert-auth-error"
      className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{messages[error] || `Authentication error: ${error}`}</span>
    </div>
  );
}

function AuthSuccessBanner() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      data-testid="alert-auth-success"
      className="flex items-center gap-3 rounded-md border border-green-500/30 bg-green-500/5 p-4 text-sm text-green-700 dark:text-green-400"
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <span>Successfully authenticated with Instawork.</span>
    </div>
  );
}

function UserProfile({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);

  return (
    <div data-testid="container-user-profile" className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold" data-testid="text-user-name">
            {(data.first_name as string) || (data.name as string) || (data.username as string) || (data.email as string) || "Instawork User"}
          </h3>
          {data.email && (
            <p className="text-sm text-muted-foreground" data-testid="text-user-email">
              {data.email as string}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-muted/30 p-4">
        <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Full API Response
        </h4>
        <div className="space-y-2">
          {entries.map(([key, value]) => (
            <div
              key={key}
              className="flex items-start justify-between gap-4 text-sm"
              data-testid={`field-${key}`}
            >
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{key}</span>
              <span className="text-right break-all">
                {typeof value === "object" && value !== null
                  ? JSON.stringify(value, null, 2)
                  : String(value ?? "null")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <Skeleton className="h-32 w-full rounded-md" />
    </div>
  );
}

export default function Home() {
  const urlParams = new URLSearchParams(window.location.search);
  const authError = urlParams.get("error");
  const authSuccess = urlParams.get("auth") === "success";

  const authStatus = useQuery<{ authenticated: boolean }>({
    queryKey: ["/api/auth/status"],
  });

  const userQuery = useQuery<Record<string, unknown>>({
    queryKey: ["/api/users/me"],
    enabled: authStatus.data?.authenticated === true,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("GET", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
      queryClient.removeQueries({ queryKey: ["/api/users/me"] });
      window.history.replaceState({}, "", "/");
    },
  });

  const handleLogin = async () => {
    try {
      const res = await fetch("/api/auth/login");
      const data = await res.json();
      window.location.href = data.url;
    } catch (err) {
      console.error("Failed to get login URL:", err);
    }
  };

  const isAuthenticated = authStatus.data?.authenticated === true;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-4">
        {authError && <AuthStatusBanner error={authError} />}
        {authSuccess && !authError && <AuthSuccessBanner />}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl" data-testid="text-page-title">
                  Instawork OAuth
                </CardTitle>
                <CardDescription>
                  {isAuthenticated
                    ? "You are authenticated. Here is your user profile."
                    : "Connect your Instawork account to get started."}
                </CardDescription>
              </div>
              <Badge
                variant={isAuthenticated ? "default" : "secondary"}
                data-testid="badge-auth-status"
              >
                {authStatus.isLoading ? "Checking..." : isAuthenticated ? "Connected" : "Not connected"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {authStatus.isLoading ? (
              <LoadingSkeleton />
            ) : isAuthenticated ? (
              <>
                {userQuery.isLoading && <LoadingSkeleton />}
                {userQuery.isError && (
                  <div
                    data-testid="alert-user-error"
                    className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Failed to load user data: {userQuery.error?.message}</span>
                  </div>
                )}
                {userQuery.data && <UserProfile data={userQuery.data} />}

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    data-testid="button-refresh"
                    onClick={() => userQuery.refetch()}
                    disabled={userQuery.isFetching}
                  >
                    <RefreshCw className={`mr-2 h-3.5 w-3.5 ${userQuery.isFetching ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    data-testid="button-logout"
                    onClick={() => logoutMutation.mutate()}
                    disabled={logoutMutation.isPending}
                  >
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    Disconnect
                  </Button>
                </div>
              </>
            ) : (
              <Button
                data-testid="button-login"
                onClick={handleLogin}
                className="w-full"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Connect with Instawork
              </Button>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          OAuth 2.0 Authorization Code Flow
        </p>
      </div>
    </div>
  );
}
