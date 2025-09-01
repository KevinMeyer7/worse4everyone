import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  fetchEnvBreakdown,
  fetchModelsOverviewIndex,
  fetchModelTodayIndex,
  fetchRecentReports,
  fetchTopClusters,
  fetchVibeTimeseries,
} from "@/server/tinybird";
import { ModelOverviewRow } from "@/app/types/tinybird";

export const modelRouter = router({
  listOverview: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(24).default(8) }).optional())
    .query(async ({ input }) => {
      const rows: ModelOverviewRow[] = await fetchModelsOverviewIndex(
        input?.limit ?? 8
      );
      return { rows };
    }),

  // (kept for compatibility, but returns normalized vibe rows incl. index_100)
  vibeSeries: publicProcedure
    .input(
      z.object({
        model: z.string(),
        days: z.number().min(7).max(90).default(30),
      })
    )
    .query(async ({ input }) => ({
      rows: await fetchVibeTimeseries(input.model, input.days),
    })),

  summary: publicProcedure
    .input(z.object({ model: z.string() }))
    .query(async ({ input }) => {
      // returns: { today_index_100, avg_prev_7d_index_100, delta_index_pts }
      return await fetchModelTodayIndex(input.model);
    }),

  recent: publicProcedure
    .input(
      z.object({
        model: z.string(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => ({
      rows: await fetchRecentReports(input.model, input.limit),
    })),

  envBreakdown: publicProcedure
    .input(
      z.object({
        model: z.string(),
        date_from: z.string().optional(),
        date_to: z.string().optional(),
      })
    )
    .query(async ({ input }) => ({
      rows: await fetchEnvBreakdown(
        input.model,
        input.date_from,
        input.date_to
      ),
    })),

  topClusters: publicProcedure
    .input(
      z.object({
        model: z.string(),
        date_from: z.string().optional(),
        date_to: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => ({
      rows: await fetchTopClusters(
        input.model,
        input.date_from,
        input.date_to,
        input.limit
      ),
    })),
  timeseries: publicProcedure
    .input(
      z.object({
        model: z.string(),
        days: z.number().min(7).max(90).default(14),
      })
    )
    .query(async ({ input }) => {
      const series = await fetchVibeTimeseries(input.model, input.days);
      return { series };
    }),
});
