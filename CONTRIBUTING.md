# Contributing

Trasgo currently has three main surfaces:

- `Rust native core`: fast-path commands such as `hello`, `ask`, `load`, `route`, `prove`, `tokens`, and `optimize`
- `Node control plane`: top-level shell, demos, quickstart, machine runs, HTTP bridge, and runtime orchestration
- `Mobile wrapper`: Expo-based thin client in `mobile/trasgo-mobile` that consumes the local HTTP bridge

## First run

```bash
npm ci
npm run quickstart
npm test
# Run full formal verification (requires local/cloud runtimes)
trasgo verify --all
```

For native status:

```bash
npm run native:status
npm run native:build
```

For the HTTP bridge used by mobile shells:

```bash
npm run serve:http
```

## Repo map

- `rust/trasgo`: Rust native runtime and exact token science
- `src/trasgo`: Node shell, runtime control plane, demos, HTTP service
- `scripts/trasgo-launch.cjs`: launcher that routes native vs Node commands
- `mobile/trasgo-mobile`: Expo wrapper for iOS and Android

## Expectations

- Do not revert unrelated local edits in a dirty worktree.
- Prefer adding tests or smoke coverage when you add a public command.
- Keep mobile wrappers thin; shared behavior should live in the CLI/bridge rather than in app-specific logic.
