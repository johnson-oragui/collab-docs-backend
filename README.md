# Collab Docs Backend

A NestJS-based backend service for the Collab Docs platform. The codebase is organized around a multi-tenant access model: users, organisations, memberships, roles, permissions, and API keys are all modeled in the database and exposed through a TypeScript API layer.

This repository currently focuses on the system foundation and authentication/authorization layer rather than a complete real-time document editor implementation. The backend exposes Swagger documentation, JWT-based access control, and a PostgreSQL/TypeORM data model designed to support collaborative documentation workflows.

## What this service provides

- User registration and profile retrieval
- JWT authentication and request-scoped user guards
- Organisation creation and ownership tracking
- Membership invitations, suspension history, and role assignment
- Permission-based access control using structured enums
- API key support for organisation-level integrations
- Global logging, validation, centralized exception handling, and request ID propagation
- Swagger/OpenAPI docs for the HTTP API

## Tech stack

- NestJS 11
- TypeScript
- TypeORM
- PostgreSQL
- JWT + Argon2 password hashing
- Swagger / OpenAPI
- Jest + Supertest for testing
- Winston for logging
- Socket.IO support is present in dependencies, though the current API surface is centered on REST and auth/identity foundations

## Project structure

```text
.
├── src/
│   ├── app.controller.ts
│   ├── app.module.ts
│   ├── app.service.ts
│   ├── auth/
│   │   └── auth.controller.ts
│   ├── commons/
│   │   ├── dtos/
│   │   ├── guards/
│   │   ├── http/
│   │   ├── logger/
│   │   ├── middlewares/
│   │   └── storage/
│   ├── config/
│   │   └── env.validation.ts
│   ├── database/
│   │   ├── base.entity.ts
│   │   ├── database.enums.ts
│   │   ├── database.module.ts
│   │   ├── data-source.ts
│   │   ├── migrations/
│   │   └── naming.strategy.ts
│   ├── jwt-service/
│   │   ├── current-user-decorator.ts
│   │   ├── jwt.auth.guard.ts
│   │   ├── jwt.module.ts
│   │   └── jwt.service.ts
│   ├── organisation-api-key/
│   ├── organisation-memberships/
│   ├── organisation-ownership-history/
│   ├── organisations/
│   ├── org_membership_invitation/
│   ├── org_membership_suspension_histories/
│   ├── password/
│   ├── permissions/
│   ├── profile/
│   ├── roles/
│   ├── user/
│   └── main.ts
├── .env.sample
├── .env
├── eslint.config.mjs
├── jest.config.js
├── nest-cli.json
├── package.json
├── LICENSE
└── README.md
```

## Domain model

The backend is structured around a permissioned organisational model:

- UserEntity: stores login identity, profile relationship, and organisation memberships/API keys.
- OrganisationEntity: represents a tenant or workspace with owner tracking and historical ownership records.
- OrganisationMembershipEntity: join model between users and organisations, including role and status.
- RoleEntity: contains application- or organisation-scoped roles such as `APP_SUPER_ADMIN`, `ORG_ADMIN`, and `ORG_MEMBER`.
- PermissionEntity: enforces a fixed permission vocabulary like `document:create`, `organisation:update`, `role:read`, and related membership permissions.
- ProfileEntity: captures user profile metadata.
- OrganisationApiKeyEntity: supports service-to-service or integration authentication for an organisation.

## Authentication and authorization

The codebase includes custom JWT infrastructure and guards:

- `CustomJwtService` issues/validates access tokens.
- `CustomJwtAuthGuard` protects routes and resolves the current authenticated user.
- `CurrentUser` decorator exposes the user payload from the request context.
- `UserAgentGuard` is registered globally through `APP_GUARD`.
- `PasswordService` uses Argon2 for hashing and verification.

## API surface

The currently implemented HTTP endpoints are minimal but intentional:

- `GET /` — health/root endpoint returning a hello message
- `POST /api/v1/auth/signup` — creates a new user account
- `GET /api/v1/users/me` — returns the authenticated user profile (JWT protected)
- Swagger UI: `/api/docs`

## Environment configuration

Copy the sample environment file and set the database and JWT values before running the app:

```bash
cp .env.sample .env
```

Required values include:

- `PORT`
- `NODE_ENV`
- `TEST`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `TEST_DB_NAME`
- `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_EXPIRY`
- `AUTH_COOKIE_NAME`, `AUTH_REFRESH_COOKIE_NAME`

The validation layer in `src/config/env.validation.ts` ensures these variables are present and valid before the application boots.

## Getting started

### Install dependencies

```bash
npm install
```

### Development mode

```bash
npm run start:dev
```

The app listens on the configured port (`7005` by default) and exposes the Swagger UI at:

```text
http://localhost:7005/api/docs
```

### Production build

```bash
npm run build
npm run start:prod
```

### Run tests

```bash
npm test
```

## Scripts

This project includes the common NestJS scripts:

- `npm run build` — compile the TypeScript project
- `npm run start` — run the app in normal mode
- `npm run start:dev` — watch mode for local development
- `npm run start:debug` — debug mode with watcher
- `npm run test` — run the Jest suite
- `npm run lint` — ESLint with autofix
- `npm run migration:generate` / `npm run migration:run` — TypeORM migration workflows

## Observations from the codebase

The repository is a strong backend foundation for a collaborative docs platform, with a clean NestJS module layout and a solid RBAC model. At the time of this review, the code is centered on identity, organisation management, and access control rather than live document editing or collaborative document sync mechanics.

## License

This project is licensed under the MIT License.