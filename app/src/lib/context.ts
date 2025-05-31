import type { Context } from 'solid-js';
import { createContext } from "solid-js";

export interface AlertStore {
    success(title: string): void;
    fail(title: string): void;
}

export const AlertContext: Context<AlertStore | undefined> = createContext();
