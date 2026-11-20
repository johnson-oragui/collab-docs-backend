# CollabDocs - Business Rules Catalogue

| Document information | Value |
| --- | --- |
| **Version** | 0.1 |
| **Status** | Initial Draft |
| **Purpose** | Establish the business rules, constraints, permissions, and invariants governing CollabDocs before finalizing the domain model, database schema, and API design |

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [User Accounts and Authentication](#2-user-accounts-and-authentication)
3. [Organisation Management](#3-organisation-management)
4. [Document Ownership and Lifecycle](#4-document-ownership-and-lifecycle)
5. [Document Access and Permissions](#5-document-access-and-permissions)
6. [Invitations and Collaboration](#6-invitations-and-collaboration)
7. [Document Collaboration and Real-Time Behaviour](#7-document-collaboration-and-real-time-behaviour)
8. [Cross-Cutting Security and Data Integrity](#8-cross-cutting-security-and-data-integrity)
9. [Outstanding Domain Decisions](#9-outstanding-domain-decisions)
10. [Suggested Next Planning Activities](#10-suggested-next-planning-activities)

---

## 1. Purpose and Scope

CollabDocs is a multi-tenant document collaboration platform built around organisations.

> **Central ownership principle:** Organisations own documents. Users receive access to those documents through organisational membership or explicitly granted document-level permissions.

A user may belong to multiple organisations, and documents created within an organisation belong to that organisation rather than the individual who created them.

This catalogue defines the initial rules governing:

- User accounts and authentication
- Organisations and memberships
- Organisational ownership and administration
- Document ownership and access
- External document collaboration
- Invitations and permission management
- Authentication security and account recovery
- Data isolation and auditability

### Rule Status

| Status | Meaning |
| --- | --- |
| **Confirmed** | Established by an existing product decision |
| **Recommended** | A recommended rule that still requires acceptance |
| **Open** | A decision that requires further discussion |

---

## 2. User Accounts and Authentication

### ACC-001 - Unique User Identity

**Status:** Confirmed

Each user must have a unique account identity.

A user account must not be duplicated merely because the user participates in multiple organisations.

### ACC-002 - Independent Organisation Membership

**Status:** Confirmed

A user may belong to multiple organisations through separate membership relationships.

Membership in one organisation must not automatically grant membership in another.

### ACC-003 - Authentication Before Protected Access

**Status:** Confirmed

Users must be authenticated before accessing protected platform resources.

Publicly accessible resources, if introduced, must have explicitly defined access rules.

### ACC-004 - Refresh Token Validity

**Status:** Confirmed

A refresh token must only be usable while its associated session or token remains valid.

Revoked, expired, or invalidated refresh tokens must not be accepted.

### ACC-005 - Progressive Login Restrictions

**Status:** Confirmed

Repeated unsuccessful login attempts must trigger progressively stricter restrictions.

Restrictions may be applied using account-related and IP-related signals.

### ACC-006 - Account Recovery

**Status:** Confirmed / In Progress

A user subject to account-level login restrictions must have an account recovery mechanism.

Recovery must verify control of the appropriate account recovery channel before restoring access.

### ACC-007 - Security Restriction Expiration

**Status:** Confirmed

Temporary login restrictions must expire according to their configured TTL or recovery policy.

Expired restrictions must not continue blocking authentication.

---

## 3. Organisation Management

### ORG-001 - Organisation as a Tenant Boundary

**Status:** Confirmed

An organisation represents an independent tenant within CollabDocs.

Organisation-owned resources must be scoped to their owning organisation.

### ORG-002 - Multiple Organisation Memberships

**Status:** Confirmed

A user may participate in multiple organisations simultaneously.

Each organisation maintains its own membership records and organisational permissions.

### ORG-003 - Organisation Membership Is Explicit

**Status:** Confirmed

A user must have an explicit membership relationship before receiving ordinary organisation-level access.

Being a document collaborator must not automatically create organisational membership.

### ORG-004 - Organisation-Scoped Roles

**Status:** Confirmed

Organisational roles must be assigned within the context of a specific organisation.

A user's role in one organisation must not determine their role in another.

### ORG-005 - Membership Revocation

**Status:** Confirmed

Removing a user from an organisation must revoke access granted solely through that membership.

The removal must not automatically delete documents or other resources owned by the organisation.

### ORG-006 - Organisation Ownership

**Status:** Confirmed

An organisation has an identifiable owner or equivalent ownership authority.

Ownership determines administrative authority over the organisation, subject to platform-level constraints.

### ORG-007 - Ownership Transfer

**Status:** Confirmed

Organisation ownership must be transferable to another eligible user.

Ownership transfer changes who holds administrative ownership of the organisation. It does not change ownership of the organisation's documents.

### ORG-008 - Ownership Transfer Eligibility

**Status:** Confirmed

A confirmed new owner must satisfy the organisation's membership and account eligibility requirements.

The platform must not transfer ownership to an arbitrary external user without an explicitly defined transfer process.

### ORG-009 - Organisation Deletion

**Status:** Open

The platform must define what happens when an organisation is deleted.

This decision must account for:

- Organisation-owned documents
- Internal members
- External document collaborators
- Pending invitations
- Historical activity
- Audit records
- Retention and recovery requirements

---

## 4. Document Ownership and Lifecycle

### DOC-001 - Organisation Owns Its Documents

**Status:** Confirmed

Every document belongs to exactly one organisation.

The organisation, not the individual creator, is the document's owner.

### DOC-002 - Document Creation Context

**Status:** Confirmed

A document must be created within an organisation context.

A user who wants a separate personal document space must create or use an organisation of their own.

### DOC-003 - Document Ownership Is Immutable by Membership Changes

**Status:** Confirmed

A user's departure from an organisation must not transfer ownership of documents they created.

Documents remain owned by the original organisation.

### DOC-004 - Member Removal Does Not Delete Documents

**Status:** Confirmed

Removing a member from an organisation must not delete documents created by that member.

Document lifecycle must remain independent of an individual member's membership lifecycle.

### DOC-005 - Document Ownership Transfer

**Status:** Confirmed

Transferring organisation ownership must not transfer individual documents to the new owner.

The organisation remains the owner of its documents.

### DOC-006 - Document Organisation Association

**Status:** Confirmed

A document must be associated with one and only one owning organisation.

Moving a document between organisations, if supported, must be an explicit operation with its own authorisation and lifecycle rules.

### DOC-007 - Document Deletion

**Status:** Confirmed

Document deletion must be restricted to users with the appropriate permissions.

The platform must define whether deletion is immediate, soft deletion, recoverable deletion, or subject to retention policies.

### DOC-008 - Historical Document Integrity

**Status:** Confirmed

Changes to organisational membership or permissions must not silently rewrite the historical ownership or creation records of a document.

---

## 5. Document Access and Permissions

### PER-001 - Access Through Organisational Membership

**Status:** Confirmed

A user may access an organisation's documents through their organisational membership and the permissions associated with that membership.

### PER-002 - Explicit External Collaboration

**Status:** Confirmed

A document may be shared with a user who is not a member of the organisation that owns it.

This must be treated as document-level collaboration rather than organisational membership.

### PER-003 - External Access Is Document-Scoped

**Status:** Confirmed

An external collaborator must only receive access to explicitly shared documents.

Document-level access must not grant access to unrelated organisation resources.

### PER-004 - Separate Membership and Document Permission Relationships

**Status:** Confirmed

Organisational membership and document-level collaboration must be represented as separate relationships.

The platform must not use document collaboration as a substitute for organisation membership.

### PER-005 - Explicit Permission Levels

**Status:** Confirmed

Document permissions should distinguish between capabilities such as:

- **Viewer** - read document content
- **Commenter** - read and add comments
- **Editor** - modify document content

The exact permission set and capability boundaries must be defined.

### PER-006 - Permission Enforcement

**Status:** Confirmed

Every protected document operation must verify that the requesting user has the required permission.

Possessing a document identifier must never be sufficient to access or modify the document.

### PER-007 - Permission Revocation

**Status:** Confirmed

Revoking a user's document-level permission must revoke access granted through that permission.

The user must not retain access merely because they previously accepted an invitation.

### PER-008 - Permission Source Resolution

**Status:** Confirmed

The platform must define how permissions from different sources interact.

For example, a user may have document access through organisation membership and also have an explicit document-level permission.

The system must avoid ambiguous or contradictory permission resolution.

### PER-009 - Privileged Organisational Roles

**Status:** Open

The platform must define whether organisation owners and administrators can access every document within their organisation regardless of individual document permissions.

It must also define whether document-level permissions can restrict access for ordinary organisation members.

### PER-010 - External Collaborator Privilege Boundaries

**Status:** Confirmed

External collaborators must not acquire organisation administration capabilities through document access.

They must not be able to manage organisation membership, transfer ownership, or access unrelated organisational resources.

---

## 6. Invitations and Collaboration

### INV-001 - Explicit Document Invitations

**Status:** Confirmed

External collaborators must receive an explicit invitation before gaining document access, unless another explicitly defined sharing mechanism is introduced.

### INV-002 - Invitation Target

**Status:** Confirmed

An invitation must identify its intended recipient and the document to which access is being granted.

### INV-003 - Invitation Acceptance

**Status:** Confirmed

An invitation must be accepted by the intended recipient before the associated external permission becomes active.

### INV-004 - Invitation Expiration

**Status:** Confirmed

Pending invitations should support expiration.

Expired invitations must not be accepted.

### INV-005 - Invitation Revocation

**Status:** Confirmed

The issuing user, or another authorised user, must be able to revoke a pending invitation.

A revoked invitation must no longer grant access.

### INV-006 - Invitation Permission

**Status:** Confirmed

The invitation must specify the permission level being granted.

Acceptance must not grant privileges beyond those specified in the invitation.

### INV-007 - Existing User Invitations

**Status:** Confirmed

The platform must define how invitations behave when the recipient already has a CollabDocs account.

It must also define how an invitation behaves when the recipient already has access to the document.

### INV-008 - Organisation Lifecycle and External Collaborators

**Status:** Confirmed

The platform must define what happens to external collaborators when the owning organisation is suspended, archived, or deleted.

---

## 7. Document Collaboration and Real-Time Behaviour

### COL-001 - Authorised Collaboration

**Status:** Confirmed

Only users with the appropriate document permissions may participate in document collaboration.

### COL-002 - Permission Changes Affect Future Access

**Status:** Confirmed

Permission revocation must prevent subsequent unauthorized document operations.

The platform must also define how active sessions and established real-time connections respond to permission changes.

### COL-003 - Concurrent Editing

**Status:** Confirmed

The platform must define how simultaneous document modifications are handled.

Potential approaches include operational transformation, conflict-free replicated data types, locking, or another concurrency-control strategy.

### COL-004 - Consistent Document State

**Status:** Confirmed

The system must define how document state is persisted and recovered after interruptions, disconnections, or failed synchronisation.

### COL-005 - Collaboration History

**Status:** Confirmed

The platform should preserve sufficient activity information to establish who performed significant document operations and when.

The exact scope of version history and audit history remains to be defined.

---

## 8. Cross-Cutting Security and Data Integrity

### SEC-001 - Tenant Data Isolation

**Status:** Confirmed

A user must not access organisation-owned resources belonging to another organisation without an explicitly authorised access path.

### SEC-002 - Organisation Context Validation

**Status:** Confirmed

Every organisation-scoped operation must validate that the user has an authorised relationship with the target organisation.

### SEC-003 - Document Context Validation

**Status:** Confirmed

Every document operation must validate both the document's owning organisation and the requesting user's effective permissions.

### SEC-004 - No Implicit Privilege Escalation

**Status:** Confirmed

A user must not gain additional privileges merely by creating a document, accepting an invitation, or changing organisational membership.

### SEC-005 - Auditability

**Status:** Confirmed

Significant security-sensitive operations should be auditable.

Examples include:

- Organisation ownership transfers
- Membership changes
- Document permission changes
- Invitation creation and acceptance
- Document deletion
- Administrative actions

### SEC-006 - Historical Record Preservation

**Status:** Confirmed

The platform must preserve relevant historical records when users leave organisations or permissions change.

### SEC-007 - Consistent Authorisation

**Status:** Confirmed

Authorisation rules must be enforced consistently across REST endpoints, WebSocket connections, background jobs, and other access paths.

A permission check on an HTTP endpoint must not be bypassable through a separate communication channel.

---

## 9. Outstanding Domain Decisions

The following questions require explicit decisions before the domain model is considered stable.

| ID | Decision | Why It Matters |
| --- | --- | --- |
| D-001 | What organisational roles exist? | Determines membership permissions |
| D-002 | Can organisation administrators access every document? | Defines administrative authority |
| D-003 | Can ordinary members access all organisation documents by default? | Determines document visibility |
| D-004 | Can documents be moved between organisations? | Affects ownership and data migration |
| D-005 | What happens when an organisation is deleted? | Affects document retention and external access |
| D-006 | Can a document have multiple external collaborators with different permissions? | Determines collaboration permission modelling |
| D-007 | Can external collaborators invite additional collaborators? | Defines delegation boundaries |
| D-008 | Can a document be shared through a public link? | Introduces a different access mechanism and security considerations |
| D-009 | How are conflicting permission sources resolved? | Prevents ambiguous authorisation |
| D-010 | What happens to active WebSocket sessions after permission revocation? | Affects real-time security |
| D-011 | What is the document version-history and recovery policy? | Affects persistence and collaboration architecture |
| D-012 | What happens to documents when an organisation is suspended? | Defines organisation lifecycle behaviour |

---

## 10. Suggested Next Planning Activities

The rules catalogue is the starting point, not the final specification.

### Recommended Planning Sequence

1. **Resolve outstanding domain decisions.** Define organisational roles, document visibility, permission precedence, and lifecycle policies.
2. **Define actors and use cases.** Identify what owners, administrators, members, external collaborators, and unauthenticated visitors can do.
3. **Document workflows.** Map organisation creation, membership invitations, document creation, external sharing, ownership transfer, and document collaboration.
4. **Define invariants.** Identify conditions that must always remain true, regardless of which API or workflow is used.
5. **Build the domain model.** Identify entities, relationships, aggregates, and ownership boundaries.
6. **Design the database schema.** Translate the established domain rules into persistence structures.
7. **Define API and real-time contracts.** Ensure HTTP and WebSocket operations enforce the same business rules.

### Guiding Architectural Principle

CollabDocs should preserve a clear distinction between:

| Concept | Question |
| --- | --- |
| **Ownership** | Who owns a resource? |
| **Membership** | Which organisation does a user belong to? |
| **Permission** | What is a user allowed to do? |
| **Collaboration** | How can multiple authorised users work on a resource? |
| **Identity** | Which user is performing an operation? |

These concepts are related, but they are not interchangeable.

The organisation owns its documents. Membership and explicit permissions determine who can access them. Collaboration mechanisms determine how authorised users interact with those documents.

---

**End of initial catalogue - v0.1**
