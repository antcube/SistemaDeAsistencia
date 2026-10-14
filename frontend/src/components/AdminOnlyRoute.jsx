import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const AdminOnlyRoute = () => {
  const { admin } = useAuth();

  const location =
    useLocation();

  const isGeneralAdmin =
    String(
      admin?.role || ""
    ).trim() === "Administrador General" ||
    String(
      admin?.adminId || ""
    ).trim() === "ADM-001";

  if (!isGeneralAdmin) {
    return (
      <Navigate
        to="/reports"
        replace
        state={{
          from:
            location.pathname,
        }}
      />
    );
  }

  return <Outlet />;
};

export default AdminOnlyRoute;