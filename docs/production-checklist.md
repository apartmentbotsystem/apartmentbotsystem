Production Readiness Checklist

- Environment
  - DATABASE_URL set and reachable
  - BACKUP_DIR configured and writable (defaults to ./backups)
  - LOG_DIR configured and writable (defaults to ./logs)
  - APP_VERSION set (used by /api/health)
- Backups
  - Run scripts/backup.ts on cron (daily)
  - Verify backups rotate after 14 days
  - Test scripts/restore.ts against staging before prod
- Monitoring
  - /api/health returns status, db, uptime, version
  - Rate limiting enabled for all API routes
  - File logger generating logs/app.log and rotates >10MB
- Security
  - Admin endpoints require x-admin-id and x-admin-role headers in production
  - RBAC enforced in services via requireRole
- Operations
  - CSV exports available under /api/export/*
  - Audit logs recorded for all export operations
  - Idempotency guards enabled for critical operations

