# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the DevEvent Next.js App Router project. The following changes were made:

- **`instrumentation-client.ts`** (new) — Initializes posthog-js using the Next.js 15.3+ instrumentation API. Configured with a reverse proxy (`/ingest`), exception capturing, and debug mode in development.
- **`next.config.ts`** (updated) — Added rewrites to proxy PostHog ingestion and static asset requests through the Next.js server, improving ad-blocker bypass rates.
- **`components/ExploreBtn.tsx`** (updated) — Added `posthog.capture('explore_button_clicked')` in the button's click handler.
- **`components/EventCard.tsx`** (updated) — Converted to a client component and added `posthog.capture('event_card_clicked', {...})` with `event_title`, `event_slug`, `event_location`, and `event_date` properties so you can see which events attract the most interest.
- **`.env.local`** (new) — PostHog public token and host stored as environment variables.

| Event name | Description | File |
|---|---|---|
| `explore_button_clicked` | User clicks the Explore button on the homepage to scroll down to the events section. | `components/ExploreBtn.tsx` |
| `event_card_clicked` | User clicks on a featured event card to view its detail page. | `components/EventCard.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/479702/dashboard/1741045)
- [Explore button clicks over time](https://us.posthog.com/project/479702/insights/MgZOLPlc)
- [Event card clicks over time](https://us.posthog.com/project/479702/insights/DNQbEre3)
- [Most popular events clicked](https://us.posthog.com/project/479702/insights/x0dMFZ2P)
- [Unique users engaging with events](https://us.posthog.com/project/479702/insights/aFf59E46)
- [Explore-to-event-click conversion](https://us.posthog.com/project/479702/insights/fB5mta5I)

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` and any onboarding scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
