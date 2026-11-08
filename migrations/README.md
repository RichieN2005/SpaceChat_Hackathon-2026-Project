# Social features migration

`001_social_features.sql` adds `post_votes` and `community_memberships` to the existing PostgreSQL database. It does not update or remove existing users, posts, comments, or communities. The composite primary keys enforce one vote and one membership per user/content pair, and foreign keys clean up these new records when their user/post/community is deleted.

Apply it once to the intended database with the repository root as your working directory and `DATABASE_URL` configured in your shell:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/001_social_features.sql
```

The file uses a transaction and `IF NOT EXISTS` for its new tables/indexes, so it can be rerun. Run it before enabling votes and memberships in production. No live migration is applied by the application, test suite, or frontend build.

Before migration, public feeds, community pages, post/comment writing, and profiles continue to work. Public vote/member values default to zero/false; vote and membership writes return HTTP 503 with `code: "migration_required"`. After migration they persist normally and repeated Join/Leave or vote updates are idempotent.

Deploy the Flask backend and React frontend together after applying the migration. Existing `SECRET_KEY` and `DATABASE_URL` configuration remains required. AstroBot additionally requires a Gemini API key; its absence only affects AI requests.


For the combined community and AstroBot features, apply all additive migrations:
`001_social_features.sql`, `001_votes.sql`, then `20261108_astrobot.sql`.
The two vote migrations share the same compatible composite key; the second also
adds comment votes. Chat remains authenticated and now uses shared PostgreSQL
quotas. Public mentions are processed after successful post/comment creation.
