import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { submitFeedback } from "@/server/tinybird";

export const reportRouter = router({
  submit: publicProcedure
    .input(
      z.object({
        model: z.string().min(1),
        environment: z.string().min(1),
        issue_category: z.string().min(1),
        issue_tags: z.array(z.string()).optional(),
        severity: z.enum(["minor", "noticeable", "major", "blocking"]),
        repro: z.enum(["once", "sometimes", "often", "always"]),
        vibe: z.enum(["worse", "better", "normal"]),
        details: z.string().max(2000).optional(),
        location: z.string().length(2).optional(),
        environment_version: z.string().optional(),
        mode: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const ua =
        // @ts-expect-error (Edge/Node difference across adapters)
        ctx?.req?.headers?.get?.("user-agent") ||
        (typeof window === "undefined" ? "" : navigator.userAgent) ||
        "";
      const ip =
        // If you run behind a proxy on Vercel/NGINX, forward X-Forwarded-For
        // @ts-expect-error (Edge/Node difference across adapters)
        ctx?.req?.headers?.get?.("x-forwarded-for") || "";

      console.log("input:", input);
      console.log("ua:", ua);
      console.log("ip:", ip);

      await submitFeedback({
        ...input,
        user_agent: ua,
        ip_address: ip,
        mode: input.mode ?? "text",
      });
      return { ok: true };
    }),
});
