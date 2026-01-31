# MeetMerge — Plan (checklist)

1. Read the refinement doc and extract MVP scope and constraints.
2. Define core user stories: host creates poll, guests vote, host locks.
3. Decide architecture: Angular SPA + optional .NET backend; demo mode via localStorage.
4. Define data model: Poll, Slot, Votes, Lock state.
5. Define API surface for backend (create/get/vote/lock) and abuse controls.
6. Design UX flows (mobile-first): create screen, guest vote screen (single page), host results + lock.
7. Add timezone clarity: show local time and timezone label.
8. Implement Angular app skeleton, routing, and shared components.
9. Implement demo persistence (URL + localStorage) when API not configured.
10. Implement backend (.NET 8 minimal API + SQLite) for multi-user persistence.
11. Add Dockerfiles + docker-compose for local run.
12. Add ICS generation + calendar deep links (Google) after lock.
13. Add accessibility basics: keyboard nav, ARIA labels, large tap targets.
14. Add templates (dinner/workout/boardgames) as quick-start presets.
15. Add landing page copy (marketing hook + share moment).
16. Add GitHub Actions workflow for GitHub Pages deployment.
17. Verify build, run unit smoke tests, and ensure SPA works on Pages base-href.
18. Create public GitHub repo, push code, enable Pages via Actions, wait for deploy.
19. Update shipped-ideas cron state file.
20. Write README with live URL, features, local dev instructions, and backend notes.

## Cycles

- **V1 (MVP):** Create poll (3–7 slots), share link, vote yes/maybe/no, host locks winner.
- **V2 (Delight):** Templates, results view that’s screenshot-worthy, basic heatmap.
- **V3 (Utility):** ICS download + Google Calendar deep link, spam/rate limiting notes, stronger timezone labeling.
