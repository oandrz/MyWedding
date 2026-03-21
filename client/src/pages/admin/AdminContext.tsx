import { createContext, useContext } from "react";

interface AdminContextType {
  handleAutoLogout: (error: Error) => void;
}

export const AdminContext = createContext<AdminContextType>({
  handleAutoLogout: () => {},
});

export const useAdminContext = () => useContext(AdminContext);
