import { createContext, useContext } from "react";

export const LegalContext = createContext({ open: () => {} });

export function useLegal() {
  return useContext(LegalContext);
}
