# MICA Pose Pool
## A digital scheduling system designed to match faculty class model requests with art models at the Maryland Institute College of Art.
### User Guide
[MICA Pose Pool User Guide on Canva](https://www.canva.com/design/DAHPXhXSuNE/x2qeQt2NWfoLInpNj33LdQ/view)

---

## Technical Stack

- **Backend:** Ruby on Rails 8 (API mode)
- **Frontend:** React, Tailwind CSS / modern component architecture
- **Database:** PostgreSQL with composite query indexing
- **Authentication:** OmniAuth (OAuth 2.0 session handling) & BCrypt
- **Testing:** RSpec / Minitest, automated endpoint validation

---

## Core Architecture & Data Model

The application resolves scheduling conflicts through an interconnected relational schema:

```
[Users] (Roles: Student, Model, Faculty, Admin, Superuser)
   │
   ├──< [RequestSeries] ──< [FacultyRequests]
   │                              │
   └──< [ArtModelAvailabilities]  │
                │                 │
                └───> [Gigs] <────┘
                        │
                        └── (Confirmed by Admin/User)
```

### Database Optimization & Integrity
- **Composite Indexing:** Leveraged `idx_availability_lookup` on `[:user_id, :starts_at, :ends_at]` within the `art_model_availabilities` table to optimize range queries when cross-referencing model availability windows against class times.
- **Relational Integrity:** Implemented cascading and foreign-key constraints across multi-tier assignments (`gigs` referencing both `faculty_requests` and `art_model_availabilities`, with audit tracking via `confirmed_by_id`).
- **Recurring Series Mapping:** Implemented parent `request_series` records that programmatically generate discrete `faculty_requests` across semester dates.

---

## Role-Based Access Control (RBAC)

The platform enforces 4 distinct access tiers:
1. **Art Models:** Submit and manage availability blocks, review tentative bookings, and cancel scheduled sessions.
2. **Faculty:** Submit recurring or one-off class session requests (`request_series`), defining model criteria, room assignments, and course specs.
3. **Department Administrators:** Resolve unassigned or flagged requests (`needs_attention`), confirm matching gigs, and manage booking logistics.
4. **Superusers:** Audit campus-wide operations, promote user privileges, and configure global system roles.

---

## Key API Endpoints

### Authentication & Permissions
- `GET /auth/:provider/callback` – OAuth session verification
- `POST /select_role` – Onboarding role initialization
- `POST /users/:id/promote` – Tier escalation to administrative role
- `POST /users/:id/promote_to_superuser` – Escalation to root platform privileges

### Booking Engine & Scheduling
- `GET /request_series/available_for_model` – Returns filtered open class requests matching model parameters
- `POST /request_series/:id/release_remaining` – Releases unfilled recurring slots back to general availability
- `POST /art_model_availabilities/:id/cancel` – Cancels availability blocks and cascades status updates to linked gigs
- `POST /gigs` – Matches and confirms model assignments to active faculty requests

---

## Business Logic & Validation

- **Conflict Prevention:** Automated status checks across `gigs` and `art_model_availabilities` prevent overlapping time allocations for individual models.
- **Exception Handling:** Flags unfulfilled or edge-case requests with `needs_attention: true` for administrative triage.
- **Session Lifecycle:** Managed multi-state lifecycles for both availability (`open`, `confirmed`, `canceled`) and request queues.
