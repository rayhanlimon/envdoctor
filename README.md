# envdoctor

Zero-dependency checker for `.env` files and environment-variable usage.

`envdoctor check` validates your `.env` against the code that reads it and against `.env.example`, so missing keys fail fast in CI instead of at 2am in production.

## The problem

Every project with a `.env` file drifts: someone adds `process.env.STRIPE_KEY` in code but forgets `.env.example`, someone duplicates a key, someone commits a real secret. Existing dotenv linters check file syntax but don't answer the real question — **does my env match what my code actually uses?**

## What it does

- Parses `.env` / `.env.example` (quotes, `export` prefix, inline comments, duplicate detection)
- Scans JS/TS, Python, Go, shell, Docker and Compose files for env references (`process.env.X`, `import.meta.env`, `Deno.env.get`, `os.getenv`, `$VAR`, `${VAR}`)
- Reports **missing-in-env**, **used-but-undefined**, **duplicates**, **empty values**, **example drift**, **unquoted spaces**, **key-format** hints
- Detects likely **real secrets** (known token patterns + entropy) without ever printing values
- Warns when `.env` files are **tracked by git** or missing from `.gitignore`
- `init` generates a redacted `.env.example` from `.env` keys
- Human and `--json` output, `--strict` mode for CI

## Install

Requires Node 18+. No dependencies.

```sh
npm install -g envdoctor
# or run from source:
git clone https://github.com/<you>/envdoctor && cd envdoctor
node bin/envdoctor.js check /path/to/project
```

## Usage

```sh
# check current project (.env + .env.example auto-detected, code scanned)
envdoctor check

# check another directory, JSON output for CI
envdoctor check --json /path/to/project

# fail on warnings too
envdoctor check --strict

# skip parts
envdoctor check --no-scan --no-git-check --no-secret-scan

# exempt keys from unused warnings
envdoctor check --allow-unused PORT,HOST

# generate .env.example from .env (values redacted)
envdoctor init
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | clean (warnings allowed unless `--strict`) |
| 1 | errors found (or warnings with `--strict`) |
| 2 | usage / file-read error |

### Example output

```
envdoctor: 3 finding(s) — 2 error(s), 1 warning(s), 0 info
  env: /app/.env
  example: /app/.env.example
  [ERROR  ] used-but-undefined: "STRIPE_KEY" is used in code (src/pay.js) but not defined in .env.
  [ERROR  ] missing-in-env: "DATABASE_URL" is documented in .env.example but missing from .env.
  [WARNING] undocumented-key: "DEBUG_FLAG" exists in .env but is not documented in .env.example.
```

## Rules

| Rule | Level | Meaning |
|------|-------|---------|
| `duplicate-key` | error | key defined twice (last wins at runtime) |
| `invalid-line` | error | line is not valid `KEY=VALUE` |
| `missing-in-env` | error | key in `.env.example` but absent from `.env` |
| `used-but-undefined` | error | key referenced in code but absent from `.env` |
| `possible-secret` | error | value matches a known secret pattern |
| `env-committed` | error | a `.env` file is tracked by git |
| `empty-value` | warning | value is empty |
| `undocumented-key` | warning | key in `.env` but not in `.env.example` |
| `high-entropy-secret` | warning | sensitive-named key with random-looking value |
| `gitignore-missing-env` | warning | `.gitignore` doesn't ignore `.env` |
| `trailing-whitespace` | warning | value has trailing spaces |
| `unquoted-spaces` | warning | value has spaces but no quotes |
| `unused-key` | info | defined but never referenced (only without `.env.example`) |
| `key-format` | info | key isn't `UPPER_SNAKE_CASE` |

## GitHub Action

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with: { node-version: 20 }
- run: npx envdoctor check --strict
```

## Security notes

- envdoctor **never prints secret values** — findings reference key names and reasons only.
- `--no-secret-scan` disables token/entropy detection if you scan files with fixture secrets.
- The git safety check is advisory; verify `git ls-files` yourself before pushing.

## Limitations

- Static scan only: dynamic access like `process.env[req.query.k]` is not resolved (by design — that's a finding-free zone, not a false negative to chase).
- Shell scan only counts `UPPER_CASE`-style names to avoid `$x` loop variables; lowercase shell vars are ignored.
- One `.env` + one `.env.example` per run; multi-environment setups (`base`/`override` merge) are a roadmap item.
- No auto-fix yet — `init` only scaffolds `.env.example`.

## Roadmap

- [ ] Multi-file layering (`.env` + `.env.local` merge order)
- [ ] `--fix` for safe auto-fixes (trailing whitespace, quoting)
- [ ] SARIF output for GitHub code scanning
- [ ] Pre-commit hook recipe

## Development

```sh
npm test   # node --test test/*.test.js (15 tests, zero deps)
```

## License

MIT — see [LICENSE](LICENSE).
