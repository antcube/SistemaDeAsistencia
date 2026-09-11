import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = () => {
  const { admin, loading } = useAuth();

  if (loading) {
    return (
      <div className="route-loading">
        Cargando...
      </div>
    );
  }

  if (!admin) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;