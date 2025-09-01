import { router } from "../trpc";
import { issueRouter } from "./issue";
import { modelRouter } from "./model";
import { reportRouter } from "./report";

export const appRouter = router({
  issue: issueRouter,
  model: modelRouter,
  report: reportRouter,
});
export type AppRouter = typeof appRouter;
