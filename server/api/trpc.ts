import { initTRPC } from "@trpc/server";
import superjson from "superjson";

const t = initTRPC.create({ transformer: superjson });
export const router = t.router;
export const publicProcedure = t.procedure;
export type Context = Record<string, never>;
export function createContext(): Context {
  return {};
}
