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

  const isMainAdmin =
    String(
      admin?.adminId || ""
    ).trim() === "ADM-001";

  if (!isMainAdmin) {
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