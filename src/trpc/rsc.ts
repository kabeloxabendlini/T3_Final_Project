// src/trpc/rsc.ts
import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { createHydrationHelpers } from "@trpc/react-query/rsc";

import { createCaller, type AppRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { createQueryClient } from "./query-client";

// Cached RSC context
const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");
  return createTRPCContext({ headers: heads });
});

const getQueryClient = cache(createQueryClient);

// ✅ Fully resolved caller (async)
const resolvedCaller = cache(async () => createCaller(await createContext()));

// ✅ Hydration helpers (pass the resolved caller itself)
export const { trpc: api, HydrateClient } = createHydrationHelpers<AppRouter>(
  await resolvedCaller(), // ⚡ call it here, not a function reference
  getQueryClient
);