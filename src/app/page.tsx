"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "react-hot-toast";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import Head from "next/head";

import { SignInButton, SignOutButton, useUser } from "@clerk/nextjs";

import { api } from "~/trpc/react";
import type { PostWithUser } from "~/server/api/routers/posts";

dayjs.extend(relativeTime);

const MAX_CHARS = 500;

// -------------------- Types --------------------
type PaginatedPosts = {
  posts: PostWithUser[];
  nextCursor?: string;
};

// -------------------- Skeleton --------------------
const PostSkeleton = () => (
  <div className="flex gap-3 p-4 border-b border-slate-700/60 animate-pulse">
    <div className="h-10 w-10 rounded-full bg-slate-700 shrink-0" />
    <div className="flex flex-col gap-2 flex-1">
      <div className="h-3 w-32 rounded bg-slate-700" />
      <div className="h-3 w-full rounded bg-slate-700/60" />
      <div className="h-3 w-2/3 rounded bg-slate-700/40" />
    </div>
  </div>
);

const LoadingSkeleton = () => (
  <div>
    {Array.from({ length: 6 }).map((_, i) => <PostSkeleton key={i} />)}
  </div>
);

// -------------------- Empty State --------------------
const EmptyFeed = () => (
  <div className="flex flex-col items-center gap-3 py-20 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    </div>
    <p className="font-semibold text-slate-300">No posts yet</p>
    <p className="text-sm text-slate-500">Be the first to say something!</p>
  </div>
);

// -------------------- Create Post --------------------
const CreatePostWizard = () => {
  const { user } = useUser();
  const [content, setContent] = useState("");
  const ctx = api.useContext();
  const remaining = MAX_CHARS - content.length;
  const isOverLimit = remaining < 0;

  const { mutate, status } = api.posts.create.useMutation({
    onMutate: async (newPost) => {
      await ctx.posts.infinite.cancel();
      const previousData = ctx.posts.infinite.getInfiniteData({ limit: 10 });

      ctx.posts.infinite.setInfiniteData({ limit: 10 }, (oldData) => {
        if (!oldData) return oldData;

        const tempPost: PostWithUser = {
          id: "temp-" + Date.now(),
          content: newPost.content,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdById: user!.id,
          createdBy: {
            id: user!.id,
            name: newPost.authorName,
            image: newPost.authorImage,
          },
        };

        return {
          ...oldData,
          pages: oldData.pages.map((page, idx) =>
            idx === 0 ? { ...page, posts: [tempPost, ...page.posts] } : page
          ),
        };
      });

      return { previousData };
    },
    onError: (_err, _newPost, context) => {
      toast.error("Failed to post!");
      if (context?.previousData) {
        ctx.posts.infinite.setInfiniteData({ limit: 10 }, () => context.previousData);
      }
    },
    onSuccess: async () => {
      setContent("");
      toast.success("Posted!");
      await ctx.posts.infinite.invalidate();
    },
  });

  const handleSubmit = () => {
    if (!content.trim() || isOverLimit || status === "pending") return;
    mutate({
      content,
      authorId: user!.id,
      authorName: user!.fullName,
      authorImage: user!.imageUrl,
    });
  };

  if (!user) return null;

  return (
    <div className="flex gap-3 w-full items-start">
      <Image
        src={user.imageUrl ?? ""}
        alt={user.fullName ?? ""}
        className="h-10 w-10 rounded-full ring-2 ring-violet-500/40 shrink-0 mt-1"
        width={40}
        height={40}
      />
      <div className="flex flex-col gap-2 flex-1">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          rows={2}
          className="bg-slate-800 w-full outline-none rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:ring-2 focus:ring-violet-500/50 transition resize-none"
          placeholder="What's on your mind? (Enter to post)"
        />
        <div className="flex items-center justify-between">
          <span className={`text-xs ${isOverLimit ? "text-red-400" : remaining <= 50 ? "text-yellow-400" : "text-slate-500"}`}>
            {remaining} characters remaining
          </span>
          <button
            onClick={handleSubmit}
            disabled={status === "pending" || !content.trim() || isOverLimit}
            className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === "pending" ? "Posting..." : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------- Like Button --------------------
const LikeButton = ({ postId: _postId }: { postId: string }) => {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);

  const handleLike = () => {
    setLiked((prev) => !prev);
    setCount((prev) => (liked ? prev - 1 : prev + 1));
  };

  return (
    <button
      onClick={handleLike}
      className={`flex items-center gap-1.5 text-xs transition-all group ${liked ? "text-pink-400" : "text-slate-500 hover:text-pink-400"}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={`h-4 w-4 transition-transform group-active:scale-125 ${liked ? "fill-pink-400" : "fill-none"}`}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
      <span>{count > 0 ? count : ""}</span>
    </button>
  );
};

// -------------------- Post View --------------------
const PostView = ({ id, content, createdAt, createdBy }: PostWithUser) => {
  const { user } = useUser();
  const ctx = api.useContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  const { mutate: deletePost, status: deleteStatus } = api.posts.delete.useMutation({
    onSuccess: () => {
      toast.success("Post deleted!");
      void ctx.posts.infinite.invalidate();
    },
    onError: () => toast.error("Failed to delete post."),
  });

  const { mutate: editPost, status: editStatus } = api.posts.edit.useMutation({
    onSuccess: () => {
      toast.success("Post updated!");
      setIsEditing(false);
      void ctx.posts.infinite.invalidate();
    },
    onError: () => toast.error("Failed to update post."),
  });

  return (
    <div className="flex p-4 border-b border-slate-700/60 gap-3 hover:bg-slate-800/30 transition group">
      {createdBy.image ? (
        <Image
          src={createdBy.image}
          alt={createdBy.name ?? "Unknown"}
          className="h-10 w-10 rounded-full ring-2 ring-slate-700 shrink-0"
          width={40}
          height={40}
        />
      ) : (
        <div className="h-10 w-10 rounded-full ring-2 ring-slate-700 shrink-0 bg-violet-600 flex items-center justify-center text-white text-sm font-bold">
          {createdBy.name?.[0]?.toUpperCase() ?? "?"}
        </div>
      )}

      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200 text-sm">
              @{createdBy.name ?? "Unknown"}
            </span>
            <span className="text-xs text-slate-500">{dayjs(createdAt).fromNow()}</span>
          </div>

          {user && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  setEditContent(content);
                  setIsEditing(true);
                }}
                className="rounded-lg p-1.5 text-slate-500 hover:text-violet-400 hover:bg-slate-700 transition"
                title="Edit"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => {
                  if (confirm("Delete this post?")) {
                    deletePost({ postId: id, authorId: user.id });
                  }
                }}
                disabled={deleteStatus === "pending"}
                className="rounded-lg p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 transition disabled:opacity-40"
                title="Delete"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="flex flex-col gap-2 mt-1">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={2}
              className="bg-slate-700 w-full outline-none rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-violet-500/50 transition resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => editPost({ postId: id, authorId: user!.id, content: editContent })}
                disabled={editStatus === "pending" || !editContent.trim()}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40 transition"
              >
                {editStatus === "pending" ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <span className="text-slate-300 text-sm break-words leading-relaxed">{content}</span>
        )}

        <div className="mt-1">
          <LikeButton postId={id} />
        </div>
      </div>
    </div>
  );
};

// -------------------- Sign In Page --------------------
const SignInScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
    <div className="flex flex-col items-center gap-8 rounded-2xl border border-slate-700 bg-slate-800/60 px-12 py-14 shadow-2xl backdrop-blur-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">Welcome</h1>
        <p className="text-sm text-slate-400">Sign in to join the conversation</p>
      </div>
      <SignInButton mode="modal">
        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-3 font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-indigo-500 active:scale-95">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
          Sign in to continue
        </button>
      </SignInButton>
      <p className="text-xs text-slate-500">Powered by Clerk · Built with T3</p>
    </div>
  </div>
);

// -------------------- Main Page --------------------
export default function Home() {
  const { user, isSignedIn } = useUser();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.posts.infinite.useInfiniteQuery(
      { limit: 10 },
      {
        getNextPageParam: (lastPage: PaginatedPosts) => lastPage.nextCursor,
        enabled: !!user,
      }
    );

  if (!isSignedIn) return <SignInScreen />;
  if (isLoading) return (
    <main className="flex min-h-screen justify-center bg-slate-900">
      <div className="h-full w-full border-x border-slate-700 md:max-w-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700 bg-slate-900/80 px-4 py-3 backdrop-blur-sm">
          <h1 className="font-bold text-white text-lg">Feed</h1>
        </div>
        <LoadingSkeleton />
      </div>
    </main>
  );

  const allPosts = data?.pages.flatMap((page) => page.posts) ?? [];

  return (
    <>
      <Head>
        <title>Feed</title>
      </Head>

      <main className="flex min-h-screen justify-center bg-slate-900">
        <div className="h-full w-full border-x border-slate-700 md:max-w-2xl">

          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700 bg-slate-900/80 px-4 py-3 backdrop-blur-sm">
            <h1 className="font-bold text-white text-lg">Feed</h1>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5">
                <Image
                  src={user.imageUrl ?? ""}
                  alt={user.fullName ?? ""}
                  className="h-5 w-5 rounded-full"
                  width={20}
                  height={20}
                />
                <span className="text-xs text-slate-300 font-medium">{user.fullName}</span>
              </div>
              <SignOutButton>
                <button className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-slate-500 hover:text-slate-200">
                  Sign out
                </button>
              </SignOutButton>
            </div>
          </div>

          {/* Compose */}
          <div className="border-b border-slate-700 p-4">
            <CreatePostWizard />
          </div>

          {/* Posts */}
          <div>
            {allPosts.length === 0 ? (
              <EmptyFeed />
            ) : (
              allPosts.map((post: PostWithUser) => (
                <PostView key={post.id} {...post} />
              ))
            )}

            {hasNextPage && (
              <div className="flex justify-center p-4">
                <button
                  onClick={() => fetchNextPage()}
                  className="rounded-xl border border-slate-700 px-6 py-2 text-sm font-medium text-slate-400 transition hover:border-violet-500 hover:text-violet-400"
                >
                  {isFetchingNextPage ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </div>

        </div>
      </main>
    </>
  );
}

// "use client";

// import { useState } from "react";
// import Image from "next/image";
// import { toast } from "react-hot-toast";
// import dayjs from "dayjs";
// import relativeTime from "dayjs/plugin/relativeTime";
// import Head from "next/head";

// import { SignInButton, SignOutButton, useUser } from "@clerk/nextjs";
// import LoadingPage from "./_components/loading";

// import { api } from "~/trpc/react";
// import type { InfiniteData } from "@tanstack/react-query";
// import type { PostWithUser } from "~/server/api/routers/posts";

// dayjs.extend(relativeTime);

// // -------------------- Types --------------------
// type PaginatedPosts = {
//   posts: PostWithUser[];
//   nextCursor?: string;
// };

// // -------------------- Components --------------------
// const CreatePostWizard = () => {
//   const { user } = useUser();
//   const [content, setContent] = useState("");
//   const ctx = api.useContext();

//   const { mutate, status } = api.posts.create.useMutation({
//     onMutate: async (newPost) => {
//       await ctx.posts.infinite.cancel();

//       // Use getInfiniteData/setInfiniteData for correctly-typed infinite query access
//       const previousData = ctx.posts.infinite.getInfiniteData({ limit: 10 });

//       ctx.posts.infinite.setInfiniteData({ limit: 10 }, (oldData) => {
//         if (!oldData) return oldData;

//         return {
//           ...oldData,
//           pages: oldData.pages.map((page, index) =>
//             index === 0
//               ? {
//                   ...page,
//                   posts: [
//                     {
//                       id: "temp-" + Date.now(),
//                       content: newPost.content,
//                       createdAt: new Date(),
//                       createdBy: { id: newPost.authorId, name: "You", image: null },
//                     },
//                     ...page.posts,
//                   ],
//                 }
//               : page
//           ),
//         };
//       });

//       return { previousData };
//     },
//     onError: (err, _newPost, context) => {
//       toast.error("Failed to create post!");
//       if (context?.previousData) {
//         ctx.posts.infinite.setInfiniteData({ limit: 10 }, () => context.previousData);
//       }
//     },
//     onSuccess: () => {
//       setContent("");
//       toast.success("Created post!");
//     },
//   });

//   if (!user) return null;

//   return (
//     <div className="flex gap-3 w-full">
//       <Image
//         src={user.imageUrl ?? ""}
//         alt={user.fullName ?? ""}
//         className="h-14 w-14 rounded-full"
//         width={56}
//         height={56}
//       />
//       <input
//         value={content}
//         onChange={(e) => setContent(e.target.value)}
//         className="bg-transparent grow outline-none"
//         placeholder="Type something here..."
//       />
//       <button
//         onClick={() => mutate({ content, authorId: user.id })}
//         disabled={status === "pending"}
//         className="btn"
//       >
//         {status === "pending" ? "Creating..." : "Create"}
//       </button>
//     </div>
//   );
// };

// const PostView = ({ content, createdAt, createdBy }: PostWithUser) => (
//   <div className="flex p-4 border-b border-slate-400 gap-3">
//     <Image
//       src={createdBy.image ?? ""}
//       alt={createdBy.name ?? "Unknown"}
//       className="h-14 w-14 rounded-full"
//       width={56}
//       height={56}
//     />
//     <div className="flex flex-col">
//       <div className="flex font-bold gap-2">
//         <span>@{createdBy.name ?? "Unknown"}</span>
//         <span className="font-thin">{dayjs(createdAt).fromNow()}</span>
//       </div>
//       <span>{content}</span>
//     </div>
//   </div>
// );

// // -------------------- Main Page --------------------
// export default function Home() {
//   const { user, isSignedIn } = useUser();

//   const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
//     api.posts.infinite.useInfiniteQuery(
//       { limit: 10 },
//       {
//         getNextPageParam: (lastPage: PaginatedPosts) => lastPage.nextCursor,
//         enabled: !!user,
//       }
//     );

//   if (!isSignedIn)
//     return (
//       <div className="flex justify-center">
//         <SignInButton />
//       </div>
//     );

//   if (isLoading) return <LoadingPage />;

//   return (
//     <>
//       <Head>
//         <title>T3 App</title>
//       </Head>
//       <main className="flex h-screen justify-center">
//         <div className="h-full w-full border-x border-slate-400 md:max-w-2xl">
//           <div className="p-4">
//             <SignOutButton />
//           </div>
//           <div className="border-b p-4">
//             <CreatePostWizard />
//           </div>
//           <div>
//             {data?.pages.map((page: PaginatedPosts) =>
//               page.posts.map((post: PostWithUser) => (
//                 <PostView key={post.id} {...post} />
//               ))
//             )}
//             {hasNextPage && (
//               <button onClick={() => fetchNextPage()} className="btn m-4">
//                 {isFetchingNextPage ? "Loading..." : "Load more"}
//               </button>
//             )}
//           </div>
//         </div>
//       </main>
//     </>
//   );
// }

// "use client";

// import { useState } from "react";
// import Image from "next/image";
// import { toast } from "react-hot-toast";
// import dayjs from "dayjs";
// import relativeTime from "dayjs/plugin/relativeTime";
// import Head from "next/head";

// import { SignInButton, SignOutButton, useUser } from "@clerk/nextjs";
// import LoadingPage from "./_components/loading";

// import { api } from "~/trpc/react";
// import type { InfiniteData } from "@tanstack/react-query";
// import type { PostWithUser } from "~/server/api/routers/posts";

// dayjs.extend(relativeTime);

// // -------------------- Types --------------------

// type PaginatedPosts = {
//   posts: PostWithUser[];
//   nextCursor?: string;
// };

// // -------------------- Utils --------------------
// const fetchMorePosts = (data: InfiniteData<PaginatedPosts> | undefined): PostWithUser[] => {
//   if (!data) return [];
//   return data.pages.flatMap((page) => page.posts);
// };

// // -------------------- Components --------------------
// const CreatePostWizard = () => {
//   const { user } = useUser();
//   const [content, setContent] = useState("");
//   const ctx = api.useContext();

//   const { mutate, status } = api.posts.create.useMutation({
//     onMutate: async (newPost) => {
//       await ctx.posts.infinite.cancel();
//       const previousData = ctx.posts.infinite.getData({ limit: 10 });
//       if (!previousData) return { previousData };

//      ctx.posts.infinite.setData({ limit: 10 }, (oldData) => {
//   // Cast oldData safely
//   const data = oldData as InfiniteData<PaginatedPosts> | undefined;
//   if (!data) return oldData;

//   return {
//     ...data,
//     pages: data.pages.map((page, index) =>
//       index === 0
//         ? {
//             ...page,
//             posts: [
//               {
//                 id: "temp-" + Date.now(),
//                 content: newPost.content,
//                 createdAt: new Date(),
//                 createdBy: { id: newPost.authorId, name: "You", image: null },
//               },
//               ...page.posts,
//             ],
//           }
//         : page
//     ),
//     pageParams: data.pageParams,
//   };
// });

//       return { previousData };
//     },
//     onError: (err, newPost, context) => {
//       toast.error("Failed to create post!");
//       if (context?.previousData) ctx.posts.infinite.setData({ limit: 10 }, context.previousData);
//     },
//     onSuccess: () => {
//       setContent("");
//       toast.success("Created post!");
//     },
//   });

//   if (!user) return null;

//   return (
//     <div className="flex gap-3 w-full">
//       <Image
//         src={user.imageUrl ?? ""}
//         alt={user.fullName ?? ""}
//         className="h-14 w-14 rounded-full"
//         width={56}
//         height={56}
//       />

//       <input
//         value={content}
//         onChange={(e) => setContent(e.target.value)}
//         className="bg-transparent grow outline-none"
//         placeholder="Type something here..."
//       />

//       <button onClick={() => mutate({ content, authorId: user.id })} disabled={status === "pending"} className="btn">
//         {status === "pending" ? "Creating..." : "Create"}
//       </button>
//     </div>
//   );
// };

// const PostView = ({ content, createdAt, createdBy }: PostWithUser) => (
//   <div className="flex p-4 border-b border-slate-400 gap-3">
//     <Image
//       src={createdBy.image ?? ""}
//       alt={createdBy.name ?? "Unknown"}
//       className="h-14 w-14 rounded-full"
//       width={56}
//       height={56}
//     />
//     <div className="flex flex-col">
//       <div className="flex font-bold gap-2">
//         <span>@{createdBy.name ?? "Unknown"}</span>
//         <span className="font-thin">{dayjs(createdAt).fromNow()}</span>
//       </div>
//       <span>{content}</span>
//     </div>
//   </div>
// );

// // -------------------- Main Page --------------------
// export default function Home() {
//   const { user, isSignedIn } = useUser();

//   const {
//     data,
//     isLoading,
//     fetchNextPage,
//     hasNextPage,
//     isFetchingNextPage,
//   } = api.posts.infinite.useInfiniteQuery(
//     { limit: 10 },
//     {
//       getNextPageParam: (lastPage: PaginatedPosts) => lastPage.nextCursor,
//       enabled: !!user,
//     }
//   );

//   if (!isSignedIn)
//     return (
//       <div className="flex justify-center">
//         <SignInButton />
//       </div>
//     );

//   if (isLoading) return <LoadingPage />;

//   return (
//     <>
//       <Head>
//         <title>T3 App</title>
//       </Head>

//       <main className="flex h-screen justify-center">
//         <div className="h-full w-full border-x border-slate-400 md:max-w-2xl">
//           <div className="p-4">
//             <SignOutButton />
//           </div>

//           <div className="border-b p-4">
//             <CreatePostWizard />
//           </div>

//           <div>
//             {data?.pages.map((page: PaginatedPosts, pageIndex: number) =>
//               page.posts.map((post: PostWithUser) => <PostView key={post.id} {...post} />)
//             )}

//             {hasNextPage && (
//               <button onClick={() => fetchNextPage()} className="btn m-4">
//                 {isFetchingNextPage ? "Loading..." : "Load more"}
//               </button>
//             )}
//           </div>
//         </div>
//       </main>
//     </>
//   );
// }

// ctx.posts.infinite.setData({ limit: 10 }, (oldData) => {
//   // If no data, just return undefined
//   if (!oldData) return undefined;

//   // Cast oldData as InfiniteData<PaginatedPosts>
//   const data = oldData as InfiniteData<PaginatedPosts>;

//   // Example: add a new post to the first page
//   const newPost = { id: "123", title: "Hello", content: "World", createdBy: { name: "Kabelo" } };

//   return {
//     ...data,
//     pages: data.pages.map((page, idx) => {
//       if (idx === 0) {
//         return {
//           ...page,
//           posts: [newPost, ...page.posts], // prepend new post
//         };
//       }
//       return page;
//     }),
//   };
// });
