import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import RequireAuth from "@/components/RequireAuth";
import AuthPage from "@/pages/AuthPage";
import UnsubscribePage from "@/pages/UnsubscribePage";
import AppLayout from "@/components/AppLayout";
import DealsPage from "@/pages/DealsPage";
import MessagesPage from "@/pages/MessagesPage";
import InboxPage from "@/pages/InboxPage";
import AIDraftPage from "@/pages/AIDraftPage";
import UserManagementPage from "@/pages/UserManagementPage";
import AuditLogPage from "@/pages/AuditLogPage";
import MasterAdminPage from "@/pages/MasterAdminPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function GuestBlock({ children }: { children: React.ReactNode }) {
  const { guest } = useAuth();
  if (guest) return <Navigate to="/messages" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/unsubscribe" element={<UnsubscribePage />} />
            <Route path="/*" element={
              <RequireAuth>
                <AppProvider>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Navigate to="/messages" replace />} />
                      <Route path="/deals" element={<GuestBlock><DealsPage /></GuestBlock>} />
                      <Route path="/messages" element={<MessagesPage />} />
                      <Route path="/inbox" element={<InboxPage />} />
                      <Route path="/ai-draft" element={<GuestBlock><AIDraftPage /></GuestBlock>} />
                      <Route path="/admin" element={<GuestBlock><UserManagementPage /></GuestBlock>} />
                      <Route path="/audit-log" element={<GuestBlock><AuditLogPage /></GuestBlock>} />
                      <Route path="/master-admin" element={<GuestBlock><MasterAdminPage /></GuestBlock>} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                </AppProvider>
              </RequireAuth>
            } />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
