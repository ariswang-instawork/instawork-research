import { Shell } from "@/components/layout/Shell";
import { Route, Switch, Redirect, Router as WouterRouter } from "wouter";
import Landing from "@/pages/Landing";
import SessionDetail from "@/pages/SessionDetail";
import GetApp from "@/pages/GetApp";
import MySessions from "@/pages/MySessions";
import Admin from "@/pages/Admin";
import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { consumeAuthReturn } from "@/hooks/use-auth";

// After the OAuth callback redirects to "/?auth=success", restore the page
// the user was on when they hit "Log in". Runs before the router mounts.
consumeAuthReturn();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRouter() {
  return (
    <Shell>
      <Switch>
        <Route path="/" component={Landing} />
        {/* The session list now lives inline on the landing page. */}
        <Route path="/sessions">
          <Redirect to="/" />
        </Route>
        <Route path="/sessions/:id" component={SessionDetail} />
        <Route path="/my-sessions" component={MySessions} />
        <Route path="/get-app" component={GetApp} />
        <Route path="/admin" component={Admin} />
        <Route>
          <div className="flex-1 flex items-center justify-center flex-col gap-4">
            <h1 className="text-xl font-bold">Page Not Found</h1>
          </div>
        </Route>
      </Switch>
    </Shell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, '') || ""}>
        <AppRouter />
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
