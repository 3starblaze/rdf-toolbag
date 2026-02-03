import { createContext } from "react";

export interface ContextData {
    container?: HTMLElement,
}

export const PortalContext = createContext<ContextData>({});
