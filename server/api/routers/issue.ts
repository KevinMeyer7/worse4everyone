import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { fetchIssueBreakdown } from "@/server/tinybird";

export const issueRouter = router({
  breakdown: publicProcedure
    .input(
      z.object({
        model: z.string().default("GPT-5"),
        date_from: z.string().optional(),
        date_to: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const rows = await fetchIssueBreakdown(
        input.model,
        input.date_from,
        input.date_to
      );
      return { rows };
    }),
});
