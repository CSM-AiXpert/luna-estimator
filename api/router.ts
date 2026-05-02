import { authRouter } from "./auth-router";
import { aiRouter } from "./ai-router";
import { mediaRouter } from "./media-router";
import { projectsRouter, roomsRouter, lineItemsRouter } from "./projects-router";
import { syncRouter } from "./sync-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  ai: aiRouter,
  media: mediaRouter,
  projects: projectsRouter,
  rooms: roomsRouter,
  lineItems: lineItemsRouter,
  sync: syncRouter,
});

export type AppRouter = typeof appRouter;
