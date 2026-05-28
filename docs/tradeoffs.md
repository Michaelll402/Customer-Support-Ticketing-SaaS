# Engineering Trade-offs

## Why Docker?

Docker was used because it provides a reproducible application package.

Benefits:

- The API and Web applications are packaged with their runtime dependencies.
- The same image can be tested locally, pushed to a registry, and deployed in Azure.
- CI/CD becomes clear: build image, push image, deploy image.
- Deployment does not depend on manually installing Node.js on a server.

Docker is not only temporary. Docker Compose is used locally for development dependencies, but Docker images are the real deployment artifacts used in Azure.

## Local Docker vs Azure Containers

Docker was used in two ways:

### Local Development

Docker Compose was used locally to run services such as PostgreSQL, Redis, and MinIO.

This helped test the app before cloud deployment.

### Cloud Deployment

Azure App Service for Containers runs the API and Web Docker images in the cloud.

Azure does not use Docker Desktop. Azure has a managed container runtime that pulls images from Azure Container Registry and runs them.

## Why Azure App Service for Containers?

Azure App Service for Containers was chosen because it supports Docker containers without requiring Kubernetes.

Benefits:

- Managed hosting platform
- Easy container deployment
- Less operational work than virtual machines
- Cheaper and simpler than Kubernetes for this app size
- Supports environment variables and app settings
- Works well with Azure Container Registry

## Why Not a Virtual Machine?

A virtual machine would work, but it would require more manual server management.

With a VM, I would need to manually manage:

- Operating system updates
- Node.js installation
- Process management
- Reverse proxy configuration
- SSL/TLS setup
- Deployment scripts
- Database connection configuration

Azure App Service reduces this operational work.

## Why Not Kubernetes?

Kubernetes is powerful, but it would be too complex for this project.

Reasons:

- Higher cost
- More resources to manage
- More complicated networking
- More difficult live demo
- Not necessary for two web containers and one managed database

For this assignment, Azure App Service for Containers gives enough cloud-native container deployment without the overhead of AKS.

## Why Azure Database for PostgreSQL?

Azure Database for PostgreSQL Flexible Server was used because it is a managed DBaaS solution.

Benefits:

- Azure manages the database server.
- No need to run PostgreSQL manually in a VM.
- No need to run the cloud database inside a Docker container.
- More realistic production-style architecture.
- Easier maintenance and security model.

## Why Not Run PostgreSQL in Docker in Azure?

Running PostgreSQL in Docker would be possible for local testing, but it is not the best cloud approach.

A database container would require managing:

- Persistent storage
- Backups
- Updates
- Database availability
- Recovery

Using Azure PostgreSQL is more cloud-native and better matches real production practice.

## Why Terraform?

Terraform was used because the assignment requires Infrastructure as Code.

Benefits:

- Infrastructure is version-controlled.
- Azure resources can be recreated with `terraform apply`.
- Resources can be removed with `terraform destroy`.
- The deployment is repeatable.
- It documents the cloud architecture as code.

## Why GitHub Actions?

GitHub Actions was used because the code is hosted in GitHub and it provides a simple CI/CD solution.

Benefits:

- Runs automatically on push
- Builds Docker images
- Pushes images to Azure Container Registry
- Updates Azure App Services
- Keeps deployment steps automated and repeatable

## Why Random Suffixes?

Some Azure resource names must be globally unique, especially Azure Container Registry names and App Service names.

A random suffix prevents name collisions and allows the infrastructure to be recreated without manually changing names.

## Cost Control

The project uses small Azure resources to control student credit usage:

- Basic Azure Container Registry
- B1 Linux App Service Plan
- Burstable PostgreSQL Flexible Server SKU

After grading, the infrastructure can be removed with:

```bash
terraform destroy