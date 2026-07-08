import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// v6-correct pattern: a plain wrapper rendering <Outlet/>, used as a parent
// Route rather than something rendered in place of one (see the earlier
// invariant error this conversation already fixed — this mirrors that fix).
export default function PrivateRoute() {
  const { user, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) {
    // Avoid a redirect flash while the silent-refresh-on-load check is still running.
    return null;
  }

  if (!user) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
