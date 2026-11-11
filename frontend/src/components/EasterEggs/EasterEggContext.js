import { createContext, useContext } from "react";

export const EasterEggContext = createContext(null);
export const useEasterEggs = () => useContext(EasterEggContext);
