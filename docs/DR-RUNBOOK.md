# Disaster Recovery Runbook

## 1. Restore Database
- Provision a clean PostgreSQL instance.
- Import the latest encrypted backup from `backups/`:
  - Decrypt using the same `BACKUP_ENCRYPTION_KEY`.
  - If using JSON fallback, restore tables via scripts or direct inserts.

## 2. Rebuild Application
- Install dependencies.
- Generate Prisma Client: `npx prisma@5.22.0 generate`.
- Run migrations: `npx prisma@5.22.0 migrate deploy`.

## 3. Verify Integrity
- Run: `npx tsx scripts/integrity-check.ts`.
- Ensure no `MULTIPLE_ACTIVE_VERSION`, `TOTAL_MISMATCH`, `HASH_MISMATCH`.
- If issues found, review `logs/alert-*.log`.

## 4. Read-Only Bring-Up
- Set `SYSTEM_MODE=read-only`.
- Start the app; verify:
  - GET endpoints respond.
  - POST/PATCH/DELETE return `READ_ONLY_MODE`.

## 5. Snapshot Consistency
- For each closed billing month:
  - If missing snapshot: `npx tsx scripts/create-snapshot.ts <year> <month>`.
  - Compare snapshot content with current data for anomalies.

## 6. Session & Role Validation
- Confirm `AUTH_SECRET` is set.
- Test login; ensure role guard blocks mismatched roles.

## 7. Finalize to Normal Mode
- When integrity checks pass, set `SYSTEM_MODE=normal`.
- Re-run smoke tests: login, analytics, documents, payments.

## 8. Post‑Recovery Actions
- Rotate `BACKUP_ENCRYPTION_KEY` if needed.
- Schedule daily `scripts/integrity-check.ts` and `scripts/backup-db.ts`.
