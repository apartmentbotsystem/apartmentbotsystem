Incident Response Playbook

1. Detection
- Monitor logs/app.log and /api/health for anomalies
- Check rate limit blocks and spikes

2. Triage
- Identify affected services and endpoints
- Confirm database connectivity via /api/health (db)

3. Mitigation
- If DB outage: failover per infrastructure SOP
- Temporarily reduce traffic or increase limits if safe
- Communicate status to stakeholders

4. Remediation
- Review recent deployments and configuration changes
- Inspect logs/app.log rotated files for errors
- Examine audit trail via /api/export/audit

5. Recovery
- Restore from backups if data loss occurred:
  - tsx scripts/restore.ts <backup-file.sql>
- Validate application via health checks and smoke tests

6. Postmortem
- Document root cause, timeline, and action items
- Update runbooks and automation

