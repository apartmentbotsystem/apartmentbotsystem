Backup and Restore

Backup
- Requires pg_dump in PATH
- Uses DATABASE_URL to connect
- Stores SQL dumps in BACKUP_DIR (default ./backups)
- Rotation: deletes files older than 14 days
- Run: tsx scripts/backup.ts

Restore
- Requires psql in PATH
- Uses DATABASE_URL to connect
- Restores from specified SQL file
- Run: tsx scripts/restore.ts <path-to-backup.sql>

Operational Notes
- Schedule daily backups and verify rotation
- Test restore regularly on staging
- Ensure backup and log directories are writable

