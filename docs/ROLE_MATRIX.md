# Role Matrix

This matrix documents each service entry point and the roles allowed to invoke them. It reflects the current code (guards via assertAuthenticated + requireRole).

## Billing
- listBillingRecords: ADMIN, ACCOUNTANT
- patchBillingRecords: ADMIN, ACCOUNTANT
- closeBillingMonth: ADMIN, ACCOUNTANT
- ensureBillingMonth: internal, no auth
- ensureFloor: internal, no auth
- ensureRoom: internal, no auth
- upsertBillingRecord: internal, no auth

## Billing Months
- listMonthsSummary: ADMIN, ACCOUNTANT, MANAGER

## Payments
- listPayments: ADMIN, ACCOUNTANT
- createPayment: ADMIN, ACCOUNTANT
- importPayment: ADMIN, ACCOUNTANT
- matchPayment: ADMIN, ACCOUNTANT
- revertMatch: ADMIN, ACCOUNTANT

## Penalty
- run: ADMIN
- runWithAudit: ADMIN

## Templates
- listTemplates: ADMIN, MANAGER
- getTemplateMeta: ADMIN, MANAGER
- renameTemplate: ADMIN, MANAGER
- uploadOrUpdateTemplate: ADMIN, MANAGER
- replaceTemplate: ADMIN, MANAGER

## Documents
- listDocuments: ADMIN, MANAGER, ACCOUNTANT, STAFF
- generateDocument: ADMIN, MANAGER
- sendDocument: ADMIN, MANAGER, STAFF
- getDocumentFile: ADMIN, MANAGER, ACCOUNTANT, STAFF

## Tickets
- listTickets: ADMIN, STAFF, MANAGER
- createTicket: ADMIN, STAFF, MANAGER
- getTicket: ADMIN, STAFF, MANAGER
- updateStatus: ADMIN, STAFF, MANAGER
- addMessage: ADMIN, STAFF, MANAGER

## Conversations
- listConversations: ADMIN, STAFF, MANAGER
- listMessages: ADMIN, STAFF, MANAGER
- addMessage: ADMIN, STAFF, MANAGER

## Line Bindings
- createBinding: ADMIN, STAFF
- approveBinding: ADMIN, STAFF

## Placeholders
- listPlaceholders: ADMIN, MANAGER, ACCOUNTANT, STAFF

## Analytics
- getSummary: ADMIN, MANAGER

