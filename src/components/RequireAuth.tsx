import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, guest, loading, profileStatus, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session && !guest) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  // Authenticated but pending approval
  if (session && profileStatus === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <h2 className="text-xl font-semibold">Account pending approval</h2>
            <p className="text-sm text-muted-foreground">
              Thanks for signing up. Your access is pending review by the project administrator.
              You'll receive an email once approved.
            </p>
            <Button variant="outline" onClick={signOut}>Log out</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (session && profileStatus === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <h2 className="text-xl font-semibold">Access denied</h2>
            <p className="text-sm text-muted-foreground">Your access request was not approved.</p>
            <Button variant="outline" onClick={signOut}>Log out</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}