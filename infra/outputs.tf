output "resource_group_name" {
  description = "Created Azure Resource Group name."
  value       = azurerm_resource_group.main.name
}

output "container_registry_name" {
  description = "Created Azure Container Registry name."
  value       = azurerm_container_registry.main.name
}

output "container_registry_login_server" {
  description = "Azure Container Registry login server."
  value       = azurerm_container_registry.main.login_server
}

output "api_url" {
  description = "API App Service URL."
  value       = "https://${azurerm_linux_web_app.api.default_hostname}"
}

output "swagger_url" {
  description = "Swagger API documentation URL."
  value       = "https://${azurerm_linux_web_app.api.default_hostname}/api"
}

output "web_url" {
  description = "Frontend App Service URL."
  value       = "https://${azurerm_linux_web_app.web.default_hostname}"
}

output "postgres_server_fqdn" {
  description = "PostgreSQL Flexible Server hostname."
  value       = azurerm_postgresql_flexible_server.main.fqdn
}