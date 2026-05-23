# Aurisk Veil v1

**Aurisk Veil** is a post-build asset and path obfuscator for static web builds.

It takes a build directory such as `dist/`, recursively renames files/directories, rewrites references inside HTML/CSS/JS/JSON/WebManifest files, and writes the result to a separate output directory.

> This is not real security. It is friction: it hides semantic filenames, removes public sourcemaps, and makes casual inspection harder while preserving app behavior.

## V1 scope

Works best with:

- Vite / React / vanilla static builds
- HTML references: `src`, `href`, `poster`, `content`, `srcset`
- CSS references: `url(...)`, `@import`
- JS references: static imports, dynamic imports with string literal, `new URL(...)`, obvious path-like strings such as `fetch('/data/app.json')`
- JSON and `manifest.webmanifest` path values
- Absolute asset paths such as `/assets/main.js`
- Relative asset paths such as `./assets/main.js`
- Simple aliases configured manually
- Sourcemap deletion
- Private mapping/report generation

Not recommended yet for:

- Next.js SSR/server builds
- Dynamic route expressions like `` `/assets/${name}.json` ``
- Runtime-generated paths without a manifest strategy
- Rewriting sourcemaps
- In-place obfuscation

## Install

```bash
npm install
npm run build
npm link
```

Then run:

```bash
aurisk veil ./dist --out ./dist.veil --min 8 --max 14
```

Or without linking:

```bash
npm run dev -- veil ./examples/dist --out ./examples/dist.veil --min 8 --max 12 --yes
```

## Commands

```bash
aurisk init
```

Creates `aurisk.veil.yml`.

```bash
aurisk scan ./dist
```

Runs a dry scan.

```bash
aurisk veil ./dist --out ./dist.veil
```

Creates an obfuscated copy.

## Config

See `aurisk.veil.example.yml`.

## Important deployment note

Aurisk Veil writes private files to `.aurisk/` by default:

- `.aurisk/aurisk-map.json`
- `.aurisk/aurisk-report.json`

Do **not** publish `.aurisk/` to production. The map reveals original names.

## Suggested V2 features

- Babel AST rewriting instead of regex heuristics
- PostCSS AST rewriting instead of CSS regex
- HTML parser instead of HTML regex
- Runtime asset manifest for dynamic paths
- Framework adapters: Vite, Next static export, Astro, SvelteKit
- Verification crawler that opens `index.html` and checks every local URL exists
# aurisk_veil
