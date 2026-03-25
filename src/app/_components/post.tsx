"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

export function LatestPost() {
  const utils = api.useUtils();
  const [content, setContent] = useState("");

  const createPost = api.posts.create.useMutation({
    onSuccess: async () => {
      await utils.posts.invalidate();
      setContent("");
    },
  });

  return (
    <div className="w-full max-w-xs">
      <p>Create a new post 👇</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createPost.mutate({
            content,
            authorId: "temp", // Replace with Clerk user.id in real use
            authorName: null,
            authorImage: null,
          });
        }}
        className="flex flex-col gap-2"
      >
        <input
          type="text"
          placeholder="Write something..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full rounded-full bg-white/10 px-4 py-2 text-white"
        />

        <button
          type="submit"
          className="rounded-full bg-white/10 px-10 py-3 font-semibold transition hover:bg-white/20"
          disabled={createPost.isPending}
        >
          {createPost.isPending ? "Submitting..." : "Submit"}
        </button>
      </form>
    </div>
  );
}