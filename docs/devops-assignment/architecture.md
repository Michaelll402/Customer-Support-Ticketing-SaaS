# Architecture

## Overview

This project is a Customer Support Ticketing SaaS application deployed on Azure using Docker containers, Terraform, and GitHub Actions.

The application has:

- Next.js web frontend
- NestJS API backend
- PostgreSQL database through Prisma ORM
- Docker images stored in Azure Container Registry
- Azure App Service for running the containers
- GitHub Actions for CI/CD

## Cloud Architecture

```text
GitHub Repository
      |
      | push to devops-assignment-azure
      v
GitHub Actions
      |
      | builds Docker images
      | pushes images
      v
Azure Container Registry
      |
      | API image
      | Web image
      v
Azure App Service
      |
      | API connects through DATABASE_URL
      v
Azure Database for PostgreSQL Flexible Server
```
