resource "random_string" "suffix" {
  length  = 6
  upper   = false
  special = false
}

locals {
  name_prefix = "${var.project_name}-${var.environment}-${random_string.suffix.result}"

api_image = "customer-support-api:latest"
web_image = "customer-support-web:latest"

  database_name = "customer_support"
}

resource "azurerm_resource_group" "main" {
  name     = "rg-${local.name_prefix}"
  location = var.location
}

resource "azurerm_container_registry" "main" {
  name                = replace("acr${var.project_name}${var.environment}${random_string.suffix.result}", "-", "")
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = true
}

resource "azurerm_service_plan" "main" {
  name                = "asp-${local.name_prefix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = "B1"
}

resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "psql-${local.name_prefix}"
  resource_group_name    = azurerm_resource_group.main.name
  location               = azurerm_resource_group.main.location
  version                = "16"
  administrator_login    = var.postgres_admin_username
  administrator_password = var.postgres_admin_password
  storage_mb             = 32768
  sku_name               = "B_Standard_B1ms"
  zone                   = "1"

  backup_retention_days         = 7
  geo_redundant_backup_enabled  = false
  public_network_access_enabled = true
}

resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = local.database_name
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  name             = "allow-azure-services"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

resource "azurerm_linux_web_app" "api" {
  name                = "app-api-${local.name_prefix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  service_plan_id     = azurerm_service_plan.main.id

  https_only = true

  site_config {
    always_on = false

    application_stack {
      docker_image_name        = local.api_image
      docker_registry_url      = "https://${azurerm_container_registry.main.login_server}"
      docker_registry_username = azurerm_container_registry.main.admin_username
      docker_registry_password = azurerm_container_registry.main.admin_password
    }
  }

  app_settings = {
    WEBSITES_PORT = "4000"

    NODE_ENV                     = "production"
    API_HOST                     = "0.0.0.0"
    API_PORT                     = "4000"
    SWAGGER_PATH                 = "api"
    AUTH_COOKIE_NAME             = "access_token"
    JWT_SECRET                   = var.jwt_secret
    JWT_ACCESS_TOKEN_TTL_SECONDS = "28800"
    WEB_APP_ORIGIN               = "https://app-web-${local.name_prefix}.azurewebsites.net"

    DATABASE_URL = "postgresql://${var.postgres_admin_username}:${var.postgres_admin_password}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${local.database_name}?sslmode=require&schema=public"
  }

  depends_on = [
    azurerm_container_registry.main,
    azurerm_postgresql_flexible_server_database.main,
    azurerm_postgresql_flexible_server_firewall_rule.azure_services
  ]
}

resource "azurerm_linux_web_app" "web" {
  name                = "app-web-${local.name_prefix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  service_plan_id     = azurerm_service_plan.main.id

  https_only = true

  site_config {
    always_on = false

    application_stack {
      docker_image_name        = local.web_image
      docker_registry_url      = "https://${azurerm_container_registry.main.login_server}"
      docker_registry_username = azurerm_container_registry.main.admin_username
      docker_registry_password = azurerm_container_registry.main.admin_password
    }
  }

  app_settings = {
    WEBSITES_PORT = "3000"


    NODE_ENV                 = "production"
    NEXT_TELEMETRY_DISABLED  = "1"
    NEXT_PUBLIC_API_BASE_URL = "https://app-api-${local.name_prefix}.azurewebsites.net"
  }

  depends_on = [
    azurerm_container_registry.main,
    azurerm_linux_web_app.api
  ]
}