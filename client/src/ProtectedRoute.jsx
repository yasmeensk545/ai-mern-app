import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ token, children }) {
  const location = useLocation();

  if (!token) {
    return <Navigate to="/health-worker-login" replace state={{ from: location }} />;
  }

  return typeof children === "function" ? children() : children;
}
