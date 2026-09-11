import { useAuth } from "../context/AuthContext";

const PermissionGate = ({
  children,
  roles = [],
  fallback = null,
}) => {
  const { user } = useAuth();

  if (!roles.length) {
    return children;
  }

  const currentRole = user?.role;

  if (!roles.includes(currentRole)) {
    return fallback;
  }

  return children;
};

export default PermissionGate;