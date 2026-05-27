variable "project_name" {
  description = "Short project name used for Azure resource naming."
  type        = string
  default     = "csticket"
}

variable "location" {
  description = "Azure region for all resources."
  type        = string
  default     = "westeurope"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "dev"
}

variable "postgres_admin_username" {
  description = "PostgreSQL administrator username."
  type        = string
  default     = "pgadminuser"
}

variable "postgres_admin_password" {
  description = "PostgreSQL administrator password."
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT secret used by the API."
  type        = string
  sensitive   = true
}