# Infrastructure

## Infrastructure as Code

The infrastructure is defined in the `infra/` directory using Terraform.

Important files:

- `providers.tf` configures the AzureRM and Random providers.
- `variables.tf` defines configurable values such as project name, region, PostgreSQL credentials, and JWT secret.
- `main.tf` defines the Azure infrastructure.
- `outputs.tf` prints useful deployment URLs and resource names.
- `terraform.tfvars.example` shows the required local variable format without real secrets.

## Provisioning Commands

From the `infra/` directory:

```bash
terraform init
terraform fmt
terraform validate
terraform plan
terraform apply
```
