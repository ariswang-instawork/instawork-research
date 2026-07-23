import { useState } from "react";
import { useGetAdminStatus, useTriggerAdminSync, AdminStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, RefreshCw, Server, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState(false);
  const [status, setStatus] = useState<AdminStatus | null>(null);

  const statusMutation = useGetAdminStatus();
  const syncMutation = useTriggerAdminSync();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setAuthError(false);

    statusMutation.mutate({ data: { password } }, {
      onSuccess: (data) => {
        setStatus(data);
      },
      onError: (err: any) => {
        if (err.status === 401) {
          setAuthError(true);
        }
      }
    });
  };

  const handleSync = () => {
    syncMutation.mutate({ data: { password } }, {
      onSuccess: () => {
        // Refresh status after a short delay to let sync start
        setTimeout(() => {
          statusMutation.mutate({ data: { password } }, {
            onSuccess: (data) => setStatus(data)
          });
        }, 1000);
      }
    });
  };

  if (!status) {
    return (
      <div className="flex-1 flex flex-col bg-muted/20 items-center justify-center p-5">
        <Card className="w-full max-w-sm rounded-[24px] shadow-sm">
          <CardHeader className="text-center pb-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
              <Lock className="w-6 h-6" />
            </div>
            <CardTitle>Admin Access</CardTitle>
            <CardDescription>Enter password to manage sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Input 
                  type="password" 
                  placeholder="Password" 
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setAuthError(false); }}
                  className="rounded-[12px] h-12"
                />
                {authError && <p className="text-sm text-destructive font-medium">Wrong password.</p>}
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 rounded-[14px] font-bold"
                disabled={statusMutation.isPending || !password}
              >
                {statusMutation.isPending ? "Checking..." : "Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-muted/20 pb-10">
      <header className="bg-white border-b px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="font-bold flex items-center gap-2">
          <Server className="w-5 h-5 text-muted-foreground" />
          Admin Dashboard
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => { setStatus(null); setPassword(""); }}
          className="rounded-lg font-medium"
        >
          Lock
        </Button>
      </header>

      <main className="p-5 space-y-6 max-w-2xl mx-auto w-full">
        <div className="grid grid-cols-2 gap-4">
          <Card className="rounded-[20px] shadow-sm">
            <CardContent className="p-5 flex flex-col justify-center gap-1">
              <div className="text-sm font-semibold text-muted-foreground">Sessions</div>
              <div className="text-3xl font-black">{status.sessionCount}</div>
            </CardContent>
          </Card>
          <Card className="rounded-[20px] shadow-sm">
            <CardContent className="p-5 flex flex-col justify-center gap-1">
              <div className="text-sm font-semibold text-muted-foreground">Sites</div>
              <div className="text-3xl font-black">{status.siteCount}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[20px] shadow-sm">
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between space-y-0 px-5 py-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-muted-foreground" />
              Data Sync
            </CardTitle>
            <Button 
              size="sm" 
              onClick={handleSync} 
              disabled={syncMutation.isPending}
              className="rounded-lg font-semibold gap-2"
            >
              {syncMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Sync Now
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {syncMutation.isSuccess && (
              <div className="bg-success/10 px-5 py-3 border-b flex items-center gap-2 text-success font-medium text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Sync triggered successfully.
              </div>
            )}
            {syncMutation.isError && (
              <div className="bg-destructive/10 px-5 py-3 border-b flex items-center gap-2 text-destructive font-medium text-sm">
                <AlertCircle className="w-4 h-4" />
                Failed to trigger sync.
              </div>
            )}
            
            <div className="divide-y max-h-[300px] overflow-y-auto">
              {status.recentRuns.length === 0 ? (
                <div className="p-5 text-center text-muted-foreground text-sm">No recent sync runs.</div>
              ) : (
                status.recentRuns.map((run, i) => (
                  <div key={i} className="p-4 flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {run.status === "completed" ? (
                        <CheckCircle2 className="w-5 h-5 text-success" />
                      ) : run.status === "failed" ? (
                        <AlertCircle className="w-5 h-5 text-destructive" />
                      ) : (
                        <RefreshCw className="w-5 h-5 text-brand-violet animate-spin-slow" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="font-semibold capitalize text-[15px]">{run.status}</span>
                        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(run.startedAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {run.message || (run.status === "completed" ? `Synced ${run.rowCount} rows to ${run.siteCount} sites.` : 'Processing...')}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
