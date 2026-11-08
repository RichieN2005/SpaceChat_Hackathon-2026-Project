-- Apply manually after the existing users, posts, subreddits, and comments tables.
-- This migration is additive and does not modify existing forum content.
BEGIN;

CREATE TABLE IF NOT EXISTS public.post_votes (
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    post_id BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS post_votes_post_id_idx ON public.post_votes(post_id);

CREATE TABLE IF NOT EXISTS public.community_memberships (
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    subreddit_id BIGINT NOT NULL REFERENCES public.subreddits(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, subreddit_id)
);
CREATE INDEX IF NOT EXISTS community_memberships_subreddit_id_idx
    ON public.community_memberships(subreddit_id);

COMMIT;
