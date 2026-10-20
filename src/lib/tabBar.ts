import { createContext, useContext } from "react";

/** Height the floating tab bar covers above the safe area, so tab screens can scroll clear of it. */
export const TAB_BAR_SPACE = 96;

const Space = createContext(0);

/** Provided by the tabs layout; 0 on stack screens that have no tab bar. */
export const TabBarSpace = Space.Provider;

export function useTabBarSpace(): number {
  return useContext(Space);
}
