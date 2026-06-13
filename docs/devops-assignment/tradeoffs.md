# Engineering Trade-offs

## Why Docker?

Docker was used because it gives a reproducible deployment unit.

Benefits:

- Same application package can run locally and in Azure.
- CI/CD can build the exact image that will be deployed.
- Runtime dependencies are controlled inside the image.
- The app is portable between environments.

Docker is not strictly required for Azure deployment, but it is a strong fit for this assignment because the teacher may ask why a particular deployment method was chosen.

## Why Azure App Service for Containers?

Azure App Service for Containers was chosen instead of a VM or Kubernetes.

Benefits:

- Simpler than managing a virtual machine.
- No need to patch or maintain the operating system manually.
- Supports custom Docker containers.
- Easier and cheaper than Kubernetes for a small web application.
- Good fit for a student cloud-native deployment.

## Why not a VM?

A VM would work, but it would require more manual operations:

- Installing Node.js manually
- Installing database clients manually
- Configuring reverse proxy manually
- Managing OS updates and security patches
- More manual deployment work

This project focuses on cloud-native deployment and automation, so a managed PaaS service is better.

## Why not Kubernetes?

Kubernetes is powerful, but it is overkill for this project.

Reasons:

- Higher complexity
- More expensive
- More resources to manage
- More difficult live demo
- The app only needs two web containers and one managed database

Azure App Service gives enough container support without the operational overhead of AKS.

## Why Azure Database for PostgreSQL?

Azure Database for PostgreSQL Flexible Server was used because it is a managed DBaaS solution.

Benefits:

- Managed database service
- No need to run PostgreSQL inside a container or VM
- Closer to real cloud practice
- Easier backup, maintenance, and security model
- Matches the teacher recommendation to use a managed DB in Azure

## Why not local database only?

A local database is useful for development, but the final deployed app uses Azure PostgreSQL.

Local development:

```text
Docker Compose PostgreSQL
```
