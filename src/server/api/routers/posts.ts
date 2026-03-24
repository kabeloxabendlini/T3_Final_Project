import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import type { Prisma } from "../../../../generated/prisma";

export type PostWithUser = Prisma.PostGetPayload<{
  include: { createdBy: { select: { id: true; name: true; image: true } } };
}>;

export const postsRouter = createTRPCRouter({
  infinite: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional(),
        cursor: z.string().nullish(),
      })
    )
    .query(async ({ input }) => {
      const limit = input.limit ?? 10;
      const posts = await db.post.findMany({
        take: limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { id: true, name: true, image: true } } },
      });

      let nextCursor: string | undefined = undefined;
      if (posts.length > limit) {
        const nextItem = posts.pop();
        nextCursor = nextItem!.id;
      }

      return { posts, nextCursor };
    }),

  create: publicProcedure
    .input(z.object({
      content: z.string().min(1).max(500),
      authorId: z.string(),
      authorName: z.string().nullable(),
      authorImage: z.string().nullable(),
    }))
    .mutation(async ({ input }) => {
      const user = await db.user.upsert({
        where: { clerkId: input.authorId },
        update: {
          name: input.authorName,
          image: input.authorImage,
        },
        create: {
          clerkId: input.authorId,
          name: input.authorName,
          email: null,
          image: input.authorImage,
        },
      });

      return db.post.create({
        data: { content: input.content, createdById: user.id },
        include: { createdBy: { select: { id: true, name: true, image: true } } },
      });
    }),

  delete: publicProcedure
    .input(z.object({ postId: z.string(), authorId: z.string() }))
    .mutation(async ({ input }) => {
      const user = await db.user.findUnique({ where: { clerkId: input.authorId } });
      if (!user) throw new Error("User not found");

      const post = await db.post.findUnique({ where: { id: input.postId } });
      if (!post) throw new Error("Post not found");
      if (post.createdById !== user.id) throw new Error("Not authorized");

      return db.post.delete({ where: { id: input.postId } });
    }),

  edit: publicProcedure
    .input(z.object({
      postId: z.string(),
      authorId: z.string(),
      content: z.string().min(1).max(500),
    }))
    .mutation(async ({ input }) => {
      const user = await db.user.findUnique({ where: { clerkId: input.authorId } });
      if (!user) throw new Error("User not found");

      const post = await db.post.findUnique({ where: { id: input.postId } });
      if (!post) throw new Error("Post not found");
      if (post.createdById !== user.id) throw new Error("Not authorized");

      return db.post.update({
        where: { id: input.postId },
        data: { content: input.content },
        include: { createdBy: { select: { id: true, name: true, image: true } } },
      });
    }),
});