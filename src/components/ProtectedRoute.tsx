import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  
  // Check if admin is logged in for current session only
  const isAdminLoggedIn = sessionStorage.getItem("isAdminLoggedIn") === "true";

  useEffect(() => {
    if (!isAdminLoggedIn) {
      navigate("/admin-login");
    }
  }, [isAdminLoggedIn, navigate]);

  if (!isAdminLoggedIn) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;