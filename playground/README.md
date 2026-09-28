This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Editions

The UI ships six visual editions, cycled with the `ed.` stamp in the title
block (persisted in `localStorage`): **blueprint** (cyanotype drafting, the
default), **wallchart** (vintage parchment), **terminal** (phosphor CRT),
**metro** (transit signage), **atlas** (botanical plates), and **paper**
(a manila survey map: families as districts, models as lots, compositions as
routes, with legend and compass).
Each edition is a `[data-edition="…"]` token block in `app/(classic)/blueprint.css`;
terminal/metro/atlas/paper additionally have bespoke Chart views in
`components/views/chart-*.tsx`.

## Lab: the design bake-off (`/lab`)

Four skins of the same world compete to replace the editions
(spec: `docs/superpowers/specs/2026-09-28-playground-bakeoff-design.md`):
`/lab/paper` (papercraft overworld), `/lab/pixel` (16-bit tile map),
`/lab/hybrid` (paper map + pixel chrome), `/lab/flow` (kawaii dataflow).
`/lab/stub` is the minimal reference wiring.

- Positions come only from `lib/world/` (`buildWorld`, `buildFlow`, `pathToAtom`,
  `ferryRoute`); `npm test` checks its invariants.
- Data: `hooks/use-world.ts` (taxonomy + runs + `/web/evidence`); shared camera,
  URL state, still mode and card model live in `components/lab/shared/`.
- URL params: `zoom=overview|region|node`, `focus=<model>`, `still=1` (freezes
  motion and polling for deterministic screenshots).
- Screenshots: `node scripts/shoot.mjs --skin <skin> --round <n> [--base URL]
  [--typecheck] [--check-only]` → `.lab-shots/<skin>/r<n>/*.jpg` (gitignored);
  `node scripts/board.mjs` builds the comparison board.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
