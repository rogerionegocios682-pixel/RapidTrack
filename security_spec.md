# Security Specification: Delivery OS (Herculano Gestor)

## 1. Data Invariants
1. A user can only access and modify documents belonging to their own `tenantId`.
2. Role hierarchy:
   - `admin`: Full access to tenant configuration, users, couriers (motoboys), partner stores, rates, dispatch orders, shift closings, and audit logs.
   - `operator`: Can create/update dispatch orders, shift closings, and couriers, but cannot modify tenant-level core admin settings or change user permissions.
   - `viewer`: Read-only access to tenant reports, orders, and dashboard.
3. Once a ShiftClosing is created, it is strictly immutable and cannot be deleted or modified.
4. Orders associated with a closed shift (`shiftClosingId != null`) cannot have their core rates modified.
5. All operations must have valid tenantId and authentic timestamps.

## 2. The Dirty Dozen Payloads (Negative Tests)
1. User from Tenant A tries to read couriers belonging to Tenant B -> DENIED.
2. User from Tenant A tries to create an order with `tenantId: "tenant_B"` -> DENIED.
3. Unauthenticated request attempts to list `/orders` -> DENIED.
4. Operator attempts to elevate role to `admin` in `/users/{userId}` -> DENIED.
5. Operator tries to delete a ShiftClosing record -> DENIED.
6. Viewer role tries to create a new delivery order -> DENIED.
7. User tries to inject a 2MB payload or unknown field into a rate document -> DENIED.
8. Attacker attempts to update an order after shift has been closed to change `rate` -> DENIED.
9. Attacker attempts to overwrite company settings of another tenant -> DENIED.
10. Unauthenticated client tries to read audit logs -> DENIED.
11. Malformed order without required fields (e.g. missing `orderNumber`, `rate`, `motoboyId`) -> DENIED.
12. Attempt to list all tenants across the SaaS platform without authentication or cross-tenant -> DENIED.
