# Infrastructure

## Infrastructure as Code

The infrastructure is defined using Terraform in the `infra/` directory.

Terraform is used because the assignment requires Infrastructure as Code and because it allows the Azure environment to be recreated and destroyed reliably.

## Terraform Files

| File | Purpose |
|---|---|
| `providers.tf` | Configures Terraform providers. |
| `variables.tf` | Defines configurable values. |
| `main.tf` | Defines the Azure resources. |
| `outputs.tf` | Prints useful deployment outputs. |
| `terraform.tfvars.example` | Shows required variables without real secrets. |

## Provisioning Commands

From the `infra/` directory:

```bash
terraform init
terraform fmt
terraform validate
terraform plan
terraform apply