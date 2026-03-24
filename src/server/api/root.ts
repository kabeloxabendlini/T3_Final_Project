import { createTRPCRouter } from "~/server/api/trpc";
import { postsRouter } from "~/server/api/routers/posts";

export const appRouter = createTRPCRouter({
  posts: postsRouter, // ✅ REQUIRED
});

import type { inferRouterOutputs } from "@trpc/server";
export type RouterOutputs = inferRouterOutputs<AppRouter>;

// ✅ Server-side caller helper (v11)
export const createCaller = (ctx: Parameters<typeof appRouter.createCaller>[0]) =>
  appRouter.createCaller(ctx);

// ✅ Type exports
export type AppRouter = typeof appRouter;