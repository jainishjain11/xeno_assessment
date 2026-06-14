import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/store/auth';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Toaster } from '@/components/ui/sonner';

// Layout
import { Layout } from '@/components/layout/Layout';

// Pages
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { CustomerList } from '@/pages/CustomerList';
import { CustomerDetail } from '@/pages/CustomerDetail';
import { SegmentList } from '@/pages/SegmentList';
import { SegmentBuilder } from '@/pages/SegmentBuilder';
import { SegmentDetail } from '@/pages/SegmentDetail';
import { CampaignList } from '@/pages/CampaignList';
import { CampaignBuilder } from '@/pages/CampaignBuilder';
import { CampaignDetail } from '@/pages/CampaignDetail';
import { AIAssistant } from '@/pages/AIAssistant';

// ── Protected Route wrapper ───────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// ── Title Updater ─────────────────────────────────────────────────────────────
function TitleUpdater() {
  useDocumentTitle();
  return null;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TitleUpdater />
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected — wrapped in Layout (sidebar + main area) */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="customers" element={<CustomerList />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="segments" element={<SegmentList />} />
            <Route path="segments/new" element={<SegmentBuilder />} />
            <Route path="segments/:id" element={<SegmentDetail />} />
            <Route path="campaigns" element={<CampaignList />} />
            <Route path="campaigns/new" element={<CampaignBuilder />} />
            <Route path="campaigns/:id" element={<CampaignDetail />} />
            <Route path="ai" element={<AIAssistant />} />
          </Route>

          {/* Catch-all → dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
