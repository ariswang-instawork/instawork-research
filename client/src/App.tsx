import { Shell } from "@/components/layout/Shell";
import { Route, Switch, Router as WouterRouter } from "wouter";
import Landing from "@/pages/Landing";
import Sessions from "@/pages/Sessions";
import SessionDetail from "@/pages/SessionDetail";
import Admin from "@/pages/Admin";
import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
        <Route path="/sessions" component={Sessions} />
        <Route path="/sessions/:id" component={SessionDetail} />
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
