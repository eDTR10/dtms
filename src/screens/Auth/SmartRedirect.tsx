import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Loader from "../../components/loader/loader";

/**
 * SmartRedirect — used on the root route.
 * - Not authenticated  → login page
 * - acc_lvl === 0      → admin dashboard
 * - acc_lvl > 0        → user documents panel
 */
const SmartRedirect = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <Loader />;

  if (!isAuthenticated) {
    return <Navigate to="/dtms/login" replace />;
  }

  if (user?.acc_lvl === 0) {
    return <Navigate to="/dtms/admin/dashboard" replace />;
  }

  return <Navigate to="/dtms/user/documents" replace />;
};

export default SmartRedirect;
