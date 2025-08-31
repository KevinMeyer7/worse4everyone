import { router } from "../trpc";
import { issueRouter } from "./issue";

export const appRouter = router({ issue: issueRouter });
export type AppRouter = typeof appRouter;
