# GAME-FRIENDS — Scalable, fail-closed CI for future minigames

**Required reading for every coding AI:** [AGENTS.md](../AGENTS.md), this policy, [Map Scale Rules](MAP_SCALE_RULES.md). The objective is to keep test feedback fast as GAME-FRIENDS grows from 15 to 30+ minigames, **without letting tests disappear or failures be ignored**.

## Verified baseline and design

- Serial Browser QA before optimization: 9m55s, [run 42492490388](https://github.com/tanawutmalirum29-ux/GAME-FRIENDS/actions/runs/42492490388).
- Fixed four-way QA: 4m36s, [run 42494415617](https://github.com/tanawutmalirum29-ux/GAME-FRIENDS/actions/runs/42494415617).
- As test count increases, four fixed categories can become unbalanced. The replacement uses a **dynamic weighted matrix**, not a fixed number of categories or a guessed number of future games. Measure each change using actual Actions runtime; no fixed SLA is guaranteed.

### Pipeline

1. **validate** (in parallel with planning): run source-wide auto-discovered JavaScript syntax checks, all existing engine/physics/bot/score/BOARD PARTY Node regressions, and the CI self-tests. World-scale changes still require every supported player count 1–12.
2. **browser-plan**: parse and validate [ci/browser-tests.json](../ci/browser-tests.json), check that every \`tests/*-browser.cjs\` file is explicitly registered, and output a deterministic GitHub Actions JSON matrix using \`scripts/ci-browser-scheduler.cjs --matrix\`. No external API, clock data, or nondeterministic allocation.
3. **browser-qa / shard-NN**: every matrix runner checks out the same commit, installs pinned Playwright, runs its own assigned Chromium and WebKit tasks, and uploads individual screenshots and machine-readable runtimes. Different shards execute concurrently. Errors in any test fail its shard.
4. **browser-gate**: one stable job named **Browser QA / required gate** runs with \`if: always()\`. It **fails** unless both browser planning and the **entire matrix** succeed. Branch protection can require this single stable check as shard count changes. Also require \`validate\` and every other repository workflow; the gate alone is not sufficient for merging.

The manifest currently includes all 17 original browser commands plus the previously standalone Chromium SVG-avatar QA. Keep those checks. The manifest describes each file with \`browsers: { chromium: estimatedSeconds, webkit: estimatedSeconds }\`; Chromium-only exceptions need a written \`chromiumOnlyReason\`.

### Automatic growth without uncontrolled runner cost

The planner expands every file into one task per browser, sorts by estimated runtime, and assigns tasks to the least-loaded shard. It calculates:

\`\`\`
shards = min(maxShards, numberOfTasks,
             max(minShards, ceil(totalEstimatedSeconds / targetSecondsPerShard)))
\`\`\`

The baseline registry config is \`minShards: 2\`, \`targetSecondsPerShard: 145\`, \`maxShards: 8\`. Increasing the test catalog automatically adds shards **up to the cap**; beyond the cap more checks are assigned to existing shards, never silently dropped. Adjust the cap/target in a reviewed PR if waiting time or runner cost justify it. A cap of 8 is a budget limit, not a promise that eight concurrent runners are available.

Runtime weights are estimates; after a PR, inspect the per-shard \`ci-metrics/*.json\` artifacts and update \`estimatedSeconds\` in the manifest when needed. **Do not** use timing estimates to remove or skip slow tests.

### Workflow safety

- All PRs targeting \`main\` must run complete Node and browser QA. Do not use blanket path-based skips or \`continue-on-error\`.
- The \`concurrency\` rule cancels superseded PR attempts, **not** \`main\` push verification.
- Playwright remains pinned to \`1.62.1\`, cache key includes runner OS, architecture, and pinned version. Keep \`playwright install --with-deps chromium webkit\` to retain system dependencies.
- Each runner uses its own filesystem and uploads a unique \`browser-qa-shard-NN\` artifact name, avoiding artifact collisions.
- The runner invokes tests using Node without a shell-command string, limits each individual browser task to five minutes, continues collecting failure results, then exits nonzero if any task fails.
- If \`browser-plan\` fails (missing test, bad JSON, invalid browser, empty task set), the **required gate fails**. Do not treat a skipped browser-qa job as a pass.
- If \`main\` changes after opening the PR, integrate it, rerun on the new head, and merge only once the latest SHA is green.

## Adding another game or a browser regression

1. Implement the engine and its own Node-level simulation tests. Add the game to \`tests/map-scale-regression.cjs\` and \`tests/map-scale-browser.cjs\` where applicable.
2. Add \`tests/<name>-browser.cjs\`. By default support both \`BOARD_BROWSER=chromium\` and \`BOARD_BROWSER=webkit\`. Use \`CHROME_PATH\` from the environment for Chromium. Do not launch external services in browser tests.
3. Add **one registry entry** to \`ci/browser-tests.json\`, with explicit browsers and a conservative estimated runtime per browser. The CI guard fails automatically if a \`*-browser.cjs\` file exists without a registry entry. A deliberately Chromium-only test must justify its limitation in \`chromiumOnlyReason\`.
4. Run locally (in a development environment with Node and browser dependencies):
   \`\`\`sh
   node tests/ci-browser-scheduler.cjs
   node tests/ci-browser-workflow.cjs
   node scripts/ci-browser-scheduler.cjs --plan
   node scripts/check-javascript.cjs
   node tests/map-scale-regression.cjs
   \`\`\`
5. Create a PR. Do not merge before **validate + every generated browser shard + Browser QA / required gate + other required workflows** pass on the final PR head.

Source-wide syntax checks in \`scripts/check-javascript.cjs\` automatically include future \`.js\`, \`.cjs\` and \`.mjs\` files, even if an AI forgets to add the new file to a manually maintained list.

## AI merge and investigation rules

- Check \`AGENTS.md\` and this file **before changing** QA/CI. Preserve \`tests/ci-browser-workflow.cjs\` and \`tests/ci-browser-scheduler.cjs\` guards.
- Use the actual failing shard and test ID from Actions logs, not an assumption based on the suite name. Runtime artifacts tell you which tests are becoming the bottleneck.
- Avoid frequent speculative pushes while browser tests are running; superseded PR jobs will be cancelled and restarted.
- Never bypass CI with a false status, \`continue-on-error\`, or deletion of a slow game test.
- If GitHub branch protection lists former individual \`Browser QA / board-controller\` etc., update the protection rules to require the stable \`Browser QA / required gate\` (and \`validate\`) before relying on the new dynamic matrix. Changing files does not automatically change repository branch-protection settings.
- Results from Chromium/WebKit are browser simulations, not physical-device certification. Report device-only checks separately.
