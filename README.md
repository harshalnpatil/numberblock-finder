# Numberblock Finder

Kid-friendly web app to search for **Numberblocks** character images (wiki scrape, composition, SVG, and AI generation) and download them.

**Stack:** React 18 · Vite · TypeScript · Tailwind CSS · shadcn-ui · Supabase (edge functions + storage)

**Docs:** [Changelog](docs/CHANGELOG.md) · [Product backlog](docs/product_backlog.md)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (or use [nvm](https://github.com/nvm-sh/nvm))
- npm (comes with Node)

Optional: [Bun](https://bun.sh/) if you prefer `bun install` / `bun run` (this repo includes a `bun.lock`).

## Setup

```powershell
cd numberblock-finder
npm install
```

### Environment

Create a `.env` in the project root (same folder as `package.json`) with your Supabase client settings. The app expects the usual Vite variables, for example:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
```

Configure edge functions and secrets in the Supabase project as needed for scraping, AI, and image proxying.

## Scripts

| Command | Description |
| --------| ------------ |
| `npm run dev` | Dev server (see `vite.config.ts`; default port **8080**) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:coverage` | Vitest with coverage report (`coverage/` + terminal summary) |
| `npm run test:e2e` | E2E smoke tests (Playwright; starts a dev server on port **5199** so it does not collide with `npm run dev` on 8080) |

First-time Playwright browsers (if needed):

```powershell
npx playwright install chromium
```

## License

This project is licensed under the **GNU General Public License v3.0 or later** (GPL-3.0-or-later). See [LICENSE](LICENSE).
