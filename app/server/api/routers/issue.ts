import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { fetchIssueBreakdown } from "../../tinybird";

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
      if (!process.env.TB_TOKEN) {
        throw new Error("Server missing TB_TOKEN env var");
      }
      const rows = await fetchIssueBreakdown(input);
      return { rows };
    }),
});
