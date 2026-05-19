# SmartSpend Production Operations

## SLOs

- Auth success rate: >= 99.9% over 30 days.
- Expense write success rate: >= 99.99% over 30 days.
- P0 latency: auth and expense CRUD p95 < 500 ms, p99 < 1500 ms.
- P2/P3 shedding must never block P0 expense CRUD unless `GLOBAL_KILL_SWITCH=true`.

## Emergency Controls

Controls are stored in `ControlFlag` and cached by the API for 5 seconds.

- `GLOBAL_KILL_SWITCH` with `scopeType=global`, `value=true`: blocks all unsafe writes.
- `READ_ONLY_MODE` with `scopeType=global|feature|user`, `value=true`: blocks unsafe writes in scope.
- `DISABLE_FEATURE` with `scopeType=feature`, `scopeId=analytics|imports|receipts|ai`, `value=true`: disables a feature.
- `DEGRADATION_LEVEL` with `scopeType=feature`, `value=L1|L2|L3`: marks degraded mode and emits `X-Degraded-Mode`.

Every block writes a `ControlDecisionLog` record with `requestId`, IP, user agent, path, method, and flag version.

## Auth Breach Runbook

1. Set `GLOBAL_KILL_SWITCH=true` if active exploitation includes writes.
2. Rotate `JWT_SECRET` or increment affected users' `tokenVersion`.
3. For a single user, increment `User.tokenVersion` and disconnect sockets.
4. For all users, bulk increment `tokenVersion` and restart API/worker.
5. Review `AuditLog` and request logs by `requestId`.

## Import Rollback Runbook

1. Identify the bad `ImportBatch._id`.
2. Run `npm run rollback-import -- --batch <id>` from `backend`.
3. Recompute analytics from raw expenses.
4. Confirm the batch status is `rolled_back` and imported expenses are soft-deleted.

## Analytics Mismatch Runbook

1. Treat cached analytics as disposable.
2. Run recompute through `computeAnalyticsFromExpenses(userId)`.
3. Invalidate derived cache for the user.
4. If mismatch persists, inspect raw `Expense` rows and recent `AuditLog` mutations.

## DB Overload Runbook

1. Set `DISABLE_FEATURE` for `analytics`, `imports`, `receipts`, and `ai` in that order.
2. If writes are failing, set scoped `READ_ONLY_MODE` for non-P0 features.
3. Keep auth and expense CRUD online unless DB write latency is unsafe.
4. Scale DB/API only after feature shedding is active.

## Backup And Restore

- Run daily MongoDB backups.
- Run a scheduled restore drill into an isolated database.
- Restore drill must verify user auth rows, expense counts, import batch links, and receipt metadata.
