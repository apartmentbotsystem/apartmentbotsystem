CSV Export Policy

Endpoints
- /api/export/billing?year=&month=
- /api/export/payments
- /api/export/audit

Access Control
- Require x-admin-role header: ADMIN or ACCOUNTANT
- Require x-admin-id in production

Behavior
- Streams CSV with text/csv content type
- Paginates in chunks of 1000 to avoid memory pressure
- Adds Content-Disposition with timestamped filename
- Writes audit log entries for each export
- Writes to file logs/app.log with start and completion

Data Fields
- Billing: id, roomNumber, year, month, amount, adjustments, penalty, status, dueDate, updatedAt
- Payments: id, amount, bankRef, occurredAt, matched
- Audit: id, action, entityType, entityId, createdAt, data

