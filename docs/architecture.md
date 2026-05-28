# Architecture

## Application Overview

The project is a Customer Support Ticketing SaaS application.

It contains:

- A Next.js frontend located in `apps/web`
- A NestJS backend API located in `apps/api`
- Shared packages in `packages/`
- PostgreSQL database access through Prisma ORM

The deployed system uses separate containers for the frontend and backend.

## Cloud Architecture

```text
GitHub Repository
      |
      | push to devops-assignment-azure
      v
GitHub Actions
      |
      | build Docker images
      | push images
      v
Azure Container Registry
      |
      | API image
      | Web image
      v
Azure App Service
      |
      | API uses DATABASE_URL
      v
Azure Database for PostgreSQL Flexible Server