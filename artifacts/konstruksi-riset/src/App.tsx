import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Toaster } from 'sonner';
import { Shell } from './components/layout/shell';
import FloatingChatbot from './components/FloatingChatbot';
import LoginPage from './pages/login';
import { useAuth } from './hooks/useAuth';

// Lazy-loaded pages — each becomes a separate JS chunk at build time,
// keeping the initial bundle small and preventing OOM during CI builds.
const Dashboard           = lazy(() => import('./pages/dashboard'));
const Research            = lazy(() => import('./pages/research'));
const Contractors         = lazy(() => import('./pages/contractors'));
const SkkHolders          = lazy(() => import('./pages/skk'));
const Tenders             = lazy(() => import('./pages/tenders'));
const PainPoints          = lazy(() => import('./pages/pain-points'));
const DataCollector       = lazy(() => import('./pages/data-collector'));
const OutputProduk        = lazy(() => import('./pages/output-produk'));
const AiRekomendasi       = lazy(() => import('./pages/ai-rekomendasi'));
const StrategiMarketing   = lazy(() => import('./pages/strategi-marketing'));
const SuratPenawaran      = lazy(() => import('./pages/surat-penawaran'));
const Workroom            = lazy(() => import('./pages/workroom'));
const Landing             = lazy(() => import('./pages/landing'));
const Inspirasi           = lazy(() => import('./pages/inspirasi'));
const Regulasi            = lazy(() => import('./pages/regulasi'));
const Kompetitor          = lazy(() => import('./pages/kompetitor'));
const SinyalPasar         = lazy(() => import('./pages/sinyal-pasar'));
const KnowledgeRegistry   = lazy(() => import('./pages/knowledge-registry'));
const PerumusanMasalah    = lazy(() => import('./pages/perumusan-masalah'));
const PengaturanNotifikasi = lazy(() => import('./pages/pengaturan-notifikasi'));
const LaporanIntelijen    = lazy(() => import('./pages/laporan-intelijen'));
const ModulEbt            = lazy(() => import('./pages/modul-ebt'));
const ModulPertambangan   = lazy(() => import('./pages/modul-pertambangan'));
const ModulLingkungan     = lazy(() => import('./pages/modul-lingkungan'));
const ModulIsoK3          = lazy(() => import('./pages/modul-iso-k3'));
const NotFound            = lazy(() => import('./pages/not-found'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64 w-full">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/landing" component={Landing} />
        <Route>
          <Shell>
            <Suspense fallback={<PageLoader />}>
              <Switch>
                <Route path="/"                      component={Dashboard} />
                <Route path="/riset"                 component={Research} />
                <Route path="/kontraktor"            component={Contractors} />
                <Route path="/skk"                   component={SkkHolders} />
                <Route path="/tender"                component={Tenders} />
                <Route path="/pain-points"           component={PainPoints} />
                <Route path="/data-collector"        component={DataCollector} />
                <Route path="/output-produk"         component={OutputProduk} />
                <Route path="/ai-rekomendasi"        component={AiRekomendasi} />
                <Route path="/strategi-marketing"    component={StrategiMarketing} />
                <Route path="/surat-penawaran"       component={SuratPenawaran} />
                <Route path="/workroom"              component={Workroom} />
                <Route path="/inspirasi"             component={Inspirasi} />
                <Route path="/regulasi"              component={Regulasi} />
                <Route path="/kompetitor"            component={Kompetitor} />
                <Route path="/sinyal-pasar"          component={SinyalPasar} />
                <Route path="/knowledge-registry"    component={KnowledgeRegistry} />
                <Route path="/perumusan-masalah"     component={PerumusanMasalah} />
                <Route path="/pengaturan-notifikasi" component={PengaturanNotifikasi} />
                <Route path="/laporan-intelijen"     component={LaporanIntelijen} />
                <Route path="/modul-ebt"             component={ModulEbt} />
                <Route path="/modul-pertambangan"    component={ModulPertambangan} />
                <Route path="/modul-lingkungan"      component={ModulLingkungan} />
                <Route path="/modul-iso-k3"          component={ModulIsoK3} />
                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </Shell>
        </Route>
      </Switch>
    </Suspense>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { checked, authEnabled, authenticated, login } = useAuth();

  // Still checking session status — brief fade-in loader
  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Auth is enabled but user is not authenticated — show login page
  if (authEnabled && !authenticated) {
    return <LoginPage onLogin={login} />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
          <FloatingChatbot />
        </WouterRouter>
      </AuthGate>
      <Toaster position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}

export default App;
