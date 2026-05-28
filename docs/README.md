# DevOps and Cloud Engineering Assignment Documentation

## Project Summary

This project is a Customer Support Ticketing SaaS application deployed to Microsoft Azure using Docker, Terraform, Azure App Service, Azure Container Registry, Azure Database for PostgreSQL, and GitHub Actions.

The application consists of:

- A Next.js web frontend
- A NestJS backend API
- A PostgreSQL database accessed through Prisma ORM
- Dockerized API and Web applications
- Azure infrastructure provisioned with Terraform
- CI/CD automation through GitHub Actions

## Live Deployment

- Web application: `https://app-web-csticket-dev-wf87dv.azurewebsites.net`
- API health endpoint: `https://app-api-csticket-dev-wf87dv.azurewebsites.net/health`
- Swagger API documentation: `https://app-api-csticket-dev-wf87dv.azurewebsites.net/api`

## Documentation Files

| File | Purpose |
|---|---|
| `architecture.md` | Explains the application and cloud architecture. |
| `infrastructure.md` | Explains Terraform and the Azure resources. |
| `cicd.md` | Explains the GitHub Actions CI/CD pipeline. |
| `tradeoffs.md` | Explains the engineering choices and alternatives. |

## DevOps Files in the Repository

| File/Folder | Purpose |
|---|---|
| `Dockerfile.api` | Builds the NestJS API Docker image. |
| `Dockerfile.web` | Builds the Next.js frontend Docker image. |
| `.dockerignore` | Prevents local dependencies, secrets, and unnecessary files from entering Docker images. |
| `infra/` | Terraform Infrastructure as Code configuration. |
| `.github/workflows/deploy-azure.yml` | GitHub Actions deployment workflow. |

## High-Level Deployment Flow

```text
Developer pushes code
        |
        v
GitHub Actions workflow starts
        |
        v
Docker images are built for API and Web
        |
        v
Images are pushed to Azure Container Registry
        |
        v
Azure App Service pulls and runs the containers
        |
        v
API connects to Azure PostgreSQL