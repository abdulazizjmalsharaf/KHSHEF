import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import Home from '@/pages/home';
import NotFound from '@/pages/not-found';
import LoginPage from '@/pages/login';
import RegisterPage from '@/pages/register';
import ForgotPasswordPage from '@/pages/forgot-password';
import ResetPasswordPage from '@/pages/reset-password';
import InvoiceListPage from '@/pages/invoice-list';
import NewInvoicePage from '@/pages/new-invoice';
import InvoiceDetailPage from '@/pages/invoice-detail';
import SupplierPricesPage from '@/pages/supplier-prices';
import { AuthProvider } from '@/components/auth-provider';
import { AuthGate } from '@/components/auth-gate';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();


function Router() {
  return (
    <AuthProvider>
      {/* Keep the page boundary outside routes so it resets on navigation. */}
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/login" component={LoginPage} />
          <Route path="/register" component={RegisterPage} />
          <Route path="/forgot-password" component={ForgotPasswordPage} />
          <Route path="/reset-password" component={ResetPasswordPage} />
          <Route path="/app">
            <AuthGate><InvoiceListPage /></AuthGate>
          </Route>
          <Route path="/invoices/new">
            <AuthGate><NewInvoicePage /></AuthGate>
          </Route>
          <Route path="/invoices/:invoiceId">
            <AuthGate><InvoiceDetailPage /></AuthGate>
          </Route>
          <Route path="/supplier-prices">
            <AuthGate><SupplierPricesPage /></AuthGate>
          </Route>
          <Route path="/invoices">
            <AuthGate><InvoiceListPage /></AuthGate>
          </Route>
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </AuthProvider>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
