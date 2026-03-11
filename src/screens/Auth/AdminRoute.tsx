import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Loader from "../../components/loader/loader";

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * AdminRoute — only allows users with acc_lvl === 0.
 * - Unauthenticated  → redirect to login (with ?next=)
 * - Authenticated but acc_lvl > 0 → redirect to user panel
 */
const AdminRoute = ({ children }: AdminRouteProps) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <Loader />;

  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/dtms/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  if (user && user.acc_lvl !== 0) {
    return <Navigate to="/dtms/user/documents" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
