import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { Home } from "@/pages/home";
import { Workout } from "@/pages/workout";
import { History } from "@/pages/history";
import { SessionDetail } from "@/pages/session-detail";
import { Progress } from "@/pages/progress";
import { Exercises } from "@/pages/exercises";
import { SkillTreePage } from "@/pages/skill-tree";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/workout" component={Workout} />
        <Route path="/history" component={History} />
        <Route path="/session/:id" component={SessionDetail} />
        <Route path="/progress" component={Progress} />
        <Route path="/exercises" component={Exercises} />
        <Route path="/skill-tree" component={SkillTreePage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
