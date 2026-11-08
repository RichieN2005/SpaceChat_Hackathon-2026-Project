# SpaceChat — Hackathon 2026

## SpaceChat social platform

SpaceChat now opens on a public forum backed by the Flask API and the existing PostgreSQL data. Visitors can browse without an account. The feed and post details use actual API records with no seeded fallback posts or replies; loading, empty, and failed-request states reflect the API response. Run `npm run dev` and open `http://localhost:5173/`; `npm run build` creates the production frontend in `dist/`.

Routes:

- `/` is the public feed, with title/body search, community filters, Newest, Top, and Most discussed sorting, voting, and Load more pagination. Search, community, and sort are retained in the URL.
- `/posts/:postId` shows a public post and threaded comments. Signed-in users can comment, reply, and vote; authors can edit or delete their own content. Deleting a parent comment preserves its replies with a deletion marker. Deleting a post removes its discussion after confirmation.
- `/submit` creates a text post in an existing community. `/posts/:postId/edit` edits an author's post. Both require login and return users to the created/updated post.
- `/communities` searches public communities; `/communities?view=joined` is the signed-in user's **Your communities** view, with a count, search, and links to their joined communities. It is linked from the forum navigation and signed-in landing page, and joined cards carry a **Joined** badge. `/communities/:communityId` shows details and recent posts, with Join/Leave controls for signed-in users.
- `/users/:userId` is a public profile with the user's posts and account creation date. Users can edit their own bio.
- `/astrobot` connects signed-in users to the existing Gemini-powered AstroBot, clearly labeled as AI. Each submitted message is an independent question; the UI's current chat history is not persisted or sent as context.
- `/landing` retains the red moon marketing page, lunar auth transitions, how-it-works section, and project story. `/about` is another route to that page. Its forum calls to action open the real feed.
- `/home` redirects to `/` for older links.
- `/login` and `/signup` retain their separate lunar surface pages. Authenticated visitors to these routes return to the feed or their intended post.

Browsing remains public. Every write is authorized on the Flask server, and authorship comes from the signed session, not a client-supplied user ID. Post titles are limited to 300 characters, post bodies to 20,000, comments to 10,000, and bios/AI messages to 2,000. Images, comment voting, and community creation/moderation UI are outside this iteration. The generated moon asset and its generation prompt are documented in `public/images/README.md`.

Signed-in visitors to `/landing` see up to six popular communities in place of the sample community preview, with login/signup controls hidden. Popularity is the number of public posts, using `GET /api/subreddits?sort=popular&limit=6`; each community opens its filtered feed at `/?community=<id>`. The section handles loading, empty results, and errors with retry. Community responses preserve their original fields and add post/member counts plus the viewer's membership state. Popular-community reads do not require the social migration; membership writes do.

Page structure:

- `src/app/app.jsx` defines the public feed, post detail, marketing, and auth routes.
- `src/pages/HomePage.jsx` loads the public feed, communities, filters, and additional pages.
- `src/pages/PostPage.jsx` loads a post and its comments, including independent retry states.
- `src/pages/PostEditorPage.jsx` contains the separate create/edit forms.
- `src/pages/CommunitiesPage.jsx`, `CommunityPage.jsx`, `ProfilePage.jsx`, and `AstroBotPage.jsx` contain discovery, membership, profiles, and AI chat.
- `src/components/forum/Discussion.jsx` handles comment/reply/edit/delete flows, while `VoteButtons.jsx` handles post votes.
- `src/components/forum/ForumLayout.jsx` and `PostCard.jsx` share the forum navigation, search, account links, and post cards.
- `src/lib/forum.js` reads posts, comments, and communities from the API and formats their display data.
- `src/pages/LandingPage.jsx` contains the marketing page and lunar transitions.
- `src/pages/LoginPage.jsx` and `src/pages/SignupPage.jsx` connect the separate `/login` and `/signup` pages to the Flask auth API.
- `src/components/auth/AuthProvider.jsx` restores the server session and shares authentication state; `AuthRoutes.jsx` keeps the auth forms guest-only without gating public browsing.
- `src/lib/auth.js` sends same-origin, cookie-authenticated API requests and translates API failures into form feedback.
- `src/lib/authNavigation.js` preserves validated feed/post return destinations across login and signup.
- `src/components/auth/AuthLayout.jsx` shares the enlarged lunar surface background and auth page layout.
- `src/components/landing/PlanetTransition.jsx` animates into the lunar surface when opening auth from marketing and zooms back out when returning. Lunar visitors return to the marketing moon with the Back to orbit button, logo, or browser Back. Reduced-motion users navigate immediately.
- `src/components/auth/useOrbitReturn.js` detects returns from auth pages, including browser Back, and restores focus to the corresponding planet marker after the zoom out.
- `src/components/landing/visuals.jsx` contains the reusable logo, icons, starfield, moon scene, and small planets.
- `src/components/landing/effects.css` contains only decorative texture backgrounds.
- `src/index.css` configures Tailwind theme tokens, animations, and base styles. Layout, typography, colors, responsive behavior, and component states use Tailwind utility classes in JSX.

The moon's Log in and Sign up markers and the forum's account links open the corresponding auth page. Login accepts an email address or username. Signup registers the callsign as `username`, then redirects to login with account-created feedback; registration does not create a session. After manual login, the user returns to their intended feed/post URL, or `/` by default. That destination survives switching between login and signup. The auth Back button returns forum visitors to their conversation and lunar visitors to the marketing moon. The forum header includes logout for signed-in users.

Authentication uses Flask's signed session cookie, restored through `GET /api/auth/me` on page load. Credentials and authentication flags are not stored in local/session storage. Forms show validation, loading states, and API errors. `POST /api/auth/logout` clears the server session. The Vercel rewrite forwards nested `/api/*` routes to Render.

For local forum data and authentication, run both the frontend and Flask API. Vite defaults to the Flask server at `http://127.0.0.1:5000`. If port 5000 is occupied (common on macOS), use two terminals:

```bash
.venv/bin/python -m flask --app app run --port 5001
```

```bash
API_PROXY_TARGET=http://127.0.0.1:5001 npm run dev
```

The Flask process needs the existing `SECRET_KEY` and `DATABASE_URL` configuration. A failed session check does not block the public feed, post details, marketing page, or auth forms. Forum requests show their own loading, empty, and error states; failed login/signup requests show errors on their forms. The Gemini client is initialized lazily when AI chat is requested, so a missing AI API key does not block startup or public forum/auth endpoints.

The existing users, subreddits, posts, and comments tables were confirmed by a read-only schema audit. Voting and membership additionally require [migrations/001_social_features.sql](migrations/001_social_features.sql); follow [the migration instructions](migrations/README.md) for each target database. The migration was applied and its new tables verified in the currently configured database during implementation, without changing existing forum content. The application never runs migrations automatically. Public reads fall back to zero vote/member counts before migration; voting and joining return a service-unavailable error until their tables exist. Deploy the frontend and Flask backend changes together. The existing Vercel configuration forwards `/api/*` requests to Render and serves the React app for direct frontend-route visits. Set `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) on Render for AstroBot; AI provider failures return a generic service error and do not prevent startup.

Run `npm test` for frontend client/navigation tests, `npm run test:auth` for the auth subset, and `.venv/bin/python -m unittest discover -s tests -v` for backend tests. These checks use isolated mocks and never access the project database.

For AstroBot troubleshooting, check the backend's Render Environment for `GEMINI_API_KEY` or `GOOGLE_API_KEY` (the application gives `GEMINI_API_KEY` precedence when both exist). Optional `GEMINI_MODEL` selects the model; its default is `gemini-3.1-flash-lite`. After a failed request, Render logs record an `AstroBot` line with a safe upstream HTTP code/category: authentication, permission, model/resource, quota/rate limit, or provider availability. Keys, prompts, and raw provider exceptions are not logged. The UI distinguishes quota limits, unavailable models, timeouts, and server failures. A successful model metadata lookup does not verify generation quota or a different deployment's environment.

## Historical scaffold notes

The remaining sections document the earlier scaffold and planned architecture. Their references to sample Home/About pages, empty source files, missing database integration, and unconfigured tests are historical; the implementation and commands above describe the current app.

## Technology stack

| Layer | Technology | Role |
| --- | --- | --- |
| Frontend | React 19 | Builds interactive UI components. |
| Frontend routing | React Router 8 | Maps browser URLs to React pages. |
| Frontend build/dev server | Vite 8 | Runs local development server and builds the frontend for production. |
| Styling | Tailwind CSS 4 | Utility-first CSS; the Vite integration exists, but the CSS import is not yet added. |
| Backend | Python + Flask | Intended API, request validation, and application/business logic. |
| Database driver | Psycopg 3 (`psycopg[binary]`) | Intended PostgreSQL connection and SQL execution from Python. |
| Database | TigerData (PostgreSQL) | External database service; connection code is not yet written. |
| Configuration | `python-dotenv` | Can load backend secrets/configuration from a local `.env` file. |
| Production Python server | Gunicorn | Intended to run the Flask app on a Linux host. |
| Hosting | Vultr (planned) | Expected production host; deployment is not currently configured in this repository. |

**Package-version note:** `package.json` uses version ranges, and `package-lock.json` records the resolved versions. Use `npm ci` for a reproducible install. This snapshot's React Router package requires **Node.js 22.22.0 or newer**, so use Node 22.22+ (or a newer compatible LTS version).

## Current implementation status

| Area | Status |
| --- | --- |
| React entry point and mounting | Implemented (`src/main.jsx`) |
| React Router | Implemented with `/` and `/about` sample pages |
| Vite local development server | Configured on port `5173` |
| Development proxy to Flask | Configured: `/api` → `http://127.0.0.1:5000` |
| Tailwind Vite plugin | Configured |
| Tailwind stylesheet import | **Not yet implemented** (`src/index.css` is empty) |
| Flask application/routes | **Not yet implemented** (`app.py` is empty) |
| PostgreSQL connection/queries | **Not yet implemented** (`database.py` is empty) |
| Application-specific features | **Not yet implemented** in this snapshot |
| Automated tests | **Not yet configured** (`npm test` is a placeholder that exits with an error) |
| Production server/deployment | **Not yet configured** |

## Repository structure

```text
SpaceChat_Hackathon-2026-Project-main/
├── .gitignore             # Excludes secrets, dependencies, build files, and caches
├── README.md              # Developer onboarding and project documentation
├── app.py                 # Reserved for the Flask application (currently empty)
├── database.py            # Reserved for PostgreSQL access (currently empty)
├── index.html             # HTML entry point; provides the root element for React
├── package.json           # Frontend dependencies and npm scripts
├── package-lock.json      # Resolved npm dependency tree
├── requirements.txt       # Python backend dependencies
├── vite.config.js         # Vite, React/Tailwind plugins, and /api dev proxy
└── src/
    ├── main.jsx           # Creates the React root and BrowserRouter
    ├── index.css          # Main stylesheet (currently empty)
    └── app/
        └── app.jsx        # React App component and sample routes
```

**Important:** Paths and filenames are case-sensitive on many deployment environments. The component file is currently `src/app/app.jsx` (lowercase), and `src/main.jsx` imports it using that exact spelling.

## Prerequisites

Install the following before starting:

- **Git** — to clone and collaborate on the repository.
- **Node.js 22.22.0+** and **npm** — for the React/Vite frontend (see package-version note above).
- **Python 3.11+ recommended** and **pip** — for the Flask backend.
- **Access to a TigerData PostgreSQL database** — needed once the database integration is implemented; **not needed to view the current sample React pages**.

Check your local versions:

```bash
node --version
npm --version
python --version
```

On some systems, the Python command is `python3` instead of `python`.

## Getting started: frontend

Run these commands **from the repository root** (the directory containing `package.json`):

```bash
# Install the exact dependencies recorded in package-lock.json.
npm ci

# Start the Vite development server.
npm run dev
```

Open **http://localhost:5173/** in your browser. You should see the sample Home page. Open **http://localhost:5173/about** for the sample About page.

Other available npm commands:

| Command | Action |
| --- | --- |
| `npm run dev` | Starts Vite's local development server. |
| `npm run build` | Creates a production frontend build in `dist/`. |
| `npm run preview` | Serves the built frontend locally for preview; it is **not** a production server. |
| `npm test` | **Not functional yet**; currently the default npm placeholder. |

**Tailwind setup remaining:** The plugin is already registered in `vite.config.js`, but `src/index.css` is blank. Add the following line to that file when enabling Tailwind styling:

```css
@import "tailwindcss";
```

Until then, Tailwind utility classes in `src/app/app.jsx` will not produce their expected styles.

## Getting started: backend (scaffold only)

The Python dependencies are already listed in `requirements.txt`:

```text
Flask
psycopg[binary]
python-dotenv
gunicorn
```

Create a virtual environment and install the dependencies from the **repository root**.

**macOS / Linux:**

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

**Windows PowerShell:**

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

**Backend implementation is still required:** `app.py` contains no Flask application yet, so running `python app.py`, `flask run`, or Gunicorn will not start a functional project API in the current snapshot. Once `app.py` defines a Flask application object named `app` and the required routes, the development server can be started using a command such as:

```bash
# Future command, after the Flask application is implemented:
flask --app app run --debug --port 5000
```

A sensible first endpoint is `GET /api/health`, returning a small JSON response to confirm the API is reachable. A separate database health check can later verify database connectivity.

## Environment variables and secrets

The project ignores `.env` and `.env.*` files by default, while allowing `.env.example` to be tracked. **No `.env.example` file is included in this snapshot.** When the backend starts using environment variables, developers can create a local `.env` at the repository root.

For example, the future backend may use the following **illustrative placeholders**:

```dotenv
# Example only — replace these with the values supplied to your team.
DATABASE_URL=postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE?sslmode=require
SECRET_KEY=replace-with-a-unique-secret
```

These variable names are **proposed conventions, not variables currently read by the app**. The Flask and database code must be implemented to load and use them.

Security guidelines:

- **Never commit real `.env` files, credentials, API keys, or database URLs containing passwords.**
- Share secrets using an approved private team channel or secret manager, not pull requests or issue comments.
- Keep database credentials in Flask/server-side configuration. **Do not put secrets in React code or `VITE_*` variables**: Vite-exposed values can be included in the browser bundle.
- Use the TLS/SSL settings supplied by TigerData, such as `sslmode=require` when applicable.
- If a secret has been committed or shared publicly, rotate it; deleting the file from the current commit does not erase historical exposure.

## How the frontend and backend fit together

React Router and Flask routing serve different purposes:

- **React Router** handles browser navigation, such as `/` and `/about`, and determines which React component is rendered.
- **Flask** will handle API endpoints, such as `/api/health` or future application-specific API requests. Flask will validate requests, run backend logic, talk to TigerData via Psycopg, and return JSON responses.
- **Vite** is the frontend development server. Its proxy forwards requests beginning with `/api` to the expected Flask server on port `5000`.

Intended local request flow:

```text
Browser (http://localhost:5173)
       │
       ├── GET /about ──────────> Vite serves React ──> React Router renders About
       │
       └── GET /api/... ────────> Vite development proxy
                                        │
                                        ▼
                               Flask (127.0.0.1:5000)
                                        │
                                        ▼
                               Psycopg → TigerData
                                        │
                                        ▼
                               JSON response to React
```

The Flask/API/database portion of this diagram is **the intended design**, not currently operational code.

From React, use same-origin relative URLs when calling the backend:

```javascript
// Example for a future endpoint, once it exists.
const response = await fetch("/api/health");
if (!response.ok) throw new Error("API request failed");
const data = await response.json();
```

This allows Vite to handle the proxy during development and makes it easier to use a reverse proxy in production without hardcoding `localhost` or exposing database connection details.

## Database access (planned / not yet implemented)

TigerData uses PostgreSQL, so the Python backend can connect through **Psycopg 3**. No TigerData-specific Python package is needed for standard PostgreSQL connections.

The intended responsibilities are:

1. `database.py`: read server-side connection settings; create/manage database connections and execute parameterized SQL queries (or expose helper functions for this).
2. `app.py`: define Flask API routes and call the database layer as required.
3. React components: request application data from Flask, **not** from TigerData directly.

Use parameterized SQL when handling user input; never concatenate raw input into SQL statements. In production, think about connection management, timeouts, and database access permissions as the API grows.

The base database schema is managed separately. The vote tables are supplied in `migrations/001_votes.sql`; see the community votes setup instructions below.

## Deployment direction: Vultr (planned)

The project is expected to run on **Vultr**, with TigerData hosted separately. The following describes a possible production design; **the repository does not yet contain Nginx/systemd configuration or a deployed API**:

```text
Public browser
     │ HTTPS
     ▼
Nginx on Vultr
     ├── /            → serves built React files from dist/
     └── /api/...     → forwards to Gunicorn on localhost
                              │
                              ▼
                           Flask API
                              │
                              ▼
                        TigerData (PostgreSQL)
```

A typical deployment sequence, **once backend implementation exists**, would be:

1. Install the supported Node.js and Python versions on the server.
2. Run `npm ci` and `npm run build` to generate `dist/`.
3. Install Python dependencies in a virtual environment.
4. Store production environment variables securely on the server.
5. Run Flask with Gunicorn (for example, `gunicorn --bind 127.0.0.1:8000 app:app`, **only after** `app.py` contains `app = Flask(__name__)` or another compatible application object).
6. Manage the Gunicorn process with a service manager such as `systemd`.
7. Configure Nginx to serve the React build, reverse-proxy `/api/` to Gunicorn, and enable HTTPS.
8. Configure an SPA fallback to `index.html` for frontend routes, so directly visiting `/about` does not return a server-side 404. Keep `/api/` excluded from that fallback.

Gunicorn is a Python package in `requirements.txt`; Nginx and systemd are system-level services and do **not** belong in that file. Docker is not required for this architecture.

## Contributing and team workflow

1. Pull the latest changes from the team's shared branch before starting new work.
2. Develop on a feature branch rather than committing unfinished work directly to `main`.
3. Keep frontend work within `src/` and backend/API/database changes within the corresponding Python files until the team agrees on a new directory structure.
4. Add or update documentation when introducing a new environment variable, dependency, route, database table, or setup step.
5. Run `npm run build` before opening a frontend pull request. Add test commands here once the team configures a test runner.
6. Open a pull request, describe what changed and how it was tested, and request review before merging.

Please avoid committing generated `dist/`, `node_modules/`, Python virtual environments, cache files, or secrets; `.gitignore` already excludes these.

## Troubleshooting

**`npm ci` fails with an unsupported Node version**  
Check `node --version`; the lockfile's React Router version requires Node 22.22.0 or newer. Switch to a compatible Node version and retry.

**React loads, but Tailwind classes do not change the appearance**  
The CSS entry file is currently empty. Add `@import "tailwindcss";` to `src/index.css`.

**React pages load, but a request to `/api/...` fails**  
The Vite proxy expects a Flask server on `127.0.0.1:5000`. That server and its routes have not been implemented yet, so failures are expected until backend development is complete.

**`npm test` fails immediately**  
The test script is still the default placeholder. No frontend test framework has been configured.

**Direct navigation to a frontend route works locally but 404s after deployment**  
Configure the production web server to serve React's `index.html` for client-side routes. API routes must continue to be proxied to Flask instead.

**Database connection fails after implementation**  
Check the server-side connection URL, network access rules, database credentials, and TigerData's required TLS settings. Do not paste full credentials into logs or issue reports.

---

**Documentation scope:** This README describes the code and configuration present in the uploaded project snapshot and clearly identifies proposed future behavior. Update it as features and deployment steps become real.


## Community votes and sorting

Apply `migrations/001_votes.sql` to the existing PostgreSQL database before running
this version (for example, `psql "$DATABASE_URL" -f migrations/001_votes.sql`).
It adds one vote per user per post/comment, with cascading cleanup and values
restricted to up or down. Applying the migration again is safe.

`PUT /api/posts/:id/vote` and `PUT /api/comments/:id/vote` require login and accept
`{"value": 1}`, `{"value": -1}`, or `{"value": 0}` to clear a vote. Responses include
separate `upvotes`, `downvotes`, net `score`, and `user_vote`.
`GET /api/posts?subreddit_id=ID&sort=newest|top|discussed` sorts by creation time,
net vote score, or comment count, with newest first for ties. Comments sort by
upvotes descending, then creation time descending.

The landing community list loads from `/api/subreddits`; if no communities are
available, labeled session-only previews remain available. Real communities use
the API for posts, replies, and votes. Run API regression checks with
`.venv/Scripts/python.exe -m unittest discover -s tests`.


## AstroBot integration

AstroBot is merged into the existing Flask app and React community dialog.
The chat dock works on all pages. Open a real community post and use
**Ask in this thread** to publish an explicit `@AstroBot` comment, or mention
`@AstroBot` in a new post/comment or add the mention while editing one. Mentions
are case insensitive. Each post/comment can trigger one reply; editing it again
does not generate duplicate replies. Replies are saved as comments and labeled
**AI bot**. The dialog refreshes in place; it does not reload the page.
Sample communities remain session-only previews and cannot publish AI mentions.

Before starting the updated backend:

1. Install `requirements.txt` (now includes `google-genai`).
2. Apply `migrations/001_votes.sql` if not already applied, then
   `migrations/20261108_astrobot.sql` to the existing database.
3. Configure backend-only `GEMINI_API_KEY` (or `GOOGLE_API_KEY`), `DATABASE_URL`,
   and `SECRET_KEY`. `GEMINI_MODEL` defaults to `gemini-3.1-flash-lite`.

Optional backend settings: `ASTROBOT_CHAT_LIMIT_15M=10`,
`ASTROBOT_CHAT_LIMIT_DAILY=250`, `ASTROBOT_MENTION_LIMIT_15M=8`,
`ASTROBOT_MENTION_LIMIT_DAILY=100`, and `ASTROBOT_RATE_SECRET` (defaults to
`SECRET_KEY`). Daily limits are global; 15-minute limits are per logged-in user
or observed client IP. Counters are shared in PostgreSQL across workers.

`POST /api/ai/chat` accepts `{"message":"..."}` (up to 1600 characters).
It returns `sender`, `is_ai`, and `response`, or a safe 400/429/502/503 error.
`GET /api/ai/mentions/post/:id` and `/api/ai/mentions/comment/:id` report mention
status. Create and edit responses include `X-AstroBot-Status` when a mention is requested.
AI failures preserve the human post/comment. Mention generation runs synchronously
with a 20-second provider timeout and one reservation per source; failed mentions
are not retried automatically. Allow for generation time in server timeouts.
Chat answers default to under 170 words with a 512-token output cap to reduce
generation time. Actual latency still depends on the provider and backend hosting.

The AstroBot migration adds `users.is_bot`, an AI account, quota counters, and
mention reservations. It preserves existing accounts; an existing username/email
collision must be resolved before the bot can save replies. No database migration,
provider request, deployment, or push is performed by merging these files.


### Combined forum/AstroBot merge

The main `/api/ai/chat` route uses the authenticated `api/aiService` blueprint,
accepts up to 2,000 characters, and enforces the shared AstroBot database quotas.
The AstroBot integration registers mention status and creation hooks without
registering a second chat endpoint. Its dock supports the full `/posts/:id` pages;
public replies refresh the discussion without navigating away. Apply all migrations
in the order documented in `migrations/README.md` before enabling the full feature set.


### AstroBot diagnostics and error messages

Run `.venv/Scripts/python.exe scripts/check_astrobot.py` for read-only configuration
and schema checks. Add `--models` to list models available to the configured key;
`--probe` sends one small, real generation request and may consume provider quota.
The helper redacts configured secrets from diagnostics.

The default model is `gemini-3.1-flash-lite`; override it with backend `GEMINI_MODEL`.
Direct chat and public mentions share the same bounded Gemini client. Automatic
provider retries are disabled. Responses distinguish daily AI quota exhaustion,
short-term rate/usage limits, unavailable models, incorrect configuration,
timeouts, empty answers, and unavailable request-limit storage. `Retry-After` uses
the actual reset time when supplied by the provider or the application limiter.
An exhausted provider quota must reset or be increased in the Gemini project
before real chat and mention generation can succeed.


### Updating the deployed AstroBot API key

Set `GEMINI_API_KEY` on the Flask service in Render, then choose **Save and deploy**
or **Save, rebuild, and deploy** and wait for that deploy to become live. **Save only**
does not activate the new environment, and a plain service restart retains the
previous deployment's environment. See [Render environment variables](https://render.com/docs/configure-environment-variables)
and [Render restarts](https://render.com/docs/deploys#restarting-a-service).

The React/Vercel frontend calls `/api/ai/chat` through its existing proxy and needs
no Gemini API key. Never add the key to `VITE_*` variables or browser code.
A new API key in the same Google project does not reset that project's quota:
[Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) are per project.
The application's PostgreSQL request limits also remain independent of API keys.

Both chat interfaces share a 30-second browser request deadline, preserve unsent
text on failure, and retain backend quota/error categories and retry times. A
non-JSON hosting/proxy error is described as a server failure instead of being
mistaken for an invalid key or a confirmed exhausted quota. Deploy the updated
frontend to activate this handling on the hosted site.


### Render model update for AstroBot

The default is now `gemini-3.1-flash-lite`, verified with a real successful generation
request during troubleshooting. On the Render Flask service, set:

```text
GEMINI_MODEL=gemini-3.1-flash-lite
```

Choose **Save and deploy** (or rebuild and deploy when also deploying code changes).
An existing `GEMINI_MODEL=gemini-3.8-flash` setting overrides the code default and must
be changed explicitly. Keep `GEMINI_API_KEY` on Render; no frontend key is needed.
Model quotas depend on the configured Google project, so a successful local test
establishes that these local credentials work, not that every deployed project has
an available allowance. The app does not automatically cycle models on quota errors.
The diagnostic and runtime now share the same model configuration; to test a
particular model without changing the environment, use
`python scripts/check_astrobot.py --model gemini-3.1-flash-lite --probe`.
