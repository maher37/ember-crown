# The Ember Crown

A personal browser RPG built on D&D 5e (2014) rules, set in the southern Greypeak Mountains of the Forgotten Realms. It's built with Claude Code.

- **Play:** https://maher37.github.io/ember-crown/ (live after Milestone M0 is merged and GitHub Pages is turned on)
- **Design docs:** [`docs/`](docs/)
- **Build plan:** [`docs/BUILD_ROADMAP.md`](docs/BUILD_ROADMAP.md)
- **Instructions for Claude Code:** [`CLAUDE.md`](CLAUDE.md)

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Local dev server |
| `npm test` | Unit tests (Vitest) |
| `npm run e2e` | Browser smoke tests (Playwright) |
| `npm run build` | Production build into `dist/` |
| `npm run validate-data` | Check every JSON file in `src/data/` against its zod schema, and the links between files |
| `npm run verify-list` | Rebuild `docs/Data_Verify_Checklist.md` (data still to check against the books) |
| `npm run lint` / `npm run format` | ESLint / Prettier |

Every push to `main` runs the tests and deploys to GitHub Pages (`.github/workflows/deploy.yml`).

This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC, licensed under the Creative Commons Attribution 4.0 International License. Personal, non-commercial fan project; not affiliated with Wizards of the Coast.
