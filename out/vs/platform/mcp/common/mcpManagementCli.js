var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { IConfigurationService } from "../../configuration/common/configuration.js";
let McpManagementCli = class {
  constructor(_logger, _userConfigurationService) {
    this._logger = _logger;
    this._userConfigurationService = _userConfigurationService;
  }
  async addMcpDefinitions(definitions) {
    const configs = definitions.map((config) => this.validateConfiguration(config));
    await this.updateMcpInConfig(this._userConfigurationService, configs);
    this._logger.info(`Added MCP servers: ${configs.map((c) => c.name).join(", ")}`);
  }
  async updateMcpInConfig(service, configs) {
    const mcp = service.getValue("mcp") || { servers: {} };
    mcp.servers ??= {};
    for (const config of configs) {
      mcp.servers[config.name] = config.config;
    }
    await service.updateValue("mcp", mcp);
  }
  validateConfiguration(config) {
    let parsed;
    try {
      parsed = JSON.parse(config);
    } catch (e) {
      throw new InvalidMcpOperationError(`Invalid JSON '${config}': ${e}`);
    }
    if (!parsed.name) {
      throw new InvalidMcpOperationError(`Missing name property in ${config}`);
    }
    if (!("command" in parsed) && !("url" in parsed)) {
      throw new InvalidMcpOperationError(`Missing command or URL property in ${config}`);
    }
    const { name, ...rest } = parsed;
    return { name, config: rest };
  }
};
McpManagementCli = __decorateClass([
  __decorateParam(1, IConfigurationService)
], McpManagementCli);
class InvalidMcpOperationError extends Error {
  constructor(message) {
    super(message);
    this.stack = message;
  }
}
export {
  McpManagementCli
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9tY3AvY29tbW9uL21jcE1hbmFnZW1lbnRDbGkudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dnZXIgfSBmcm9tICcuLi8uLi9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJTWNwQ29uZmlndXJhdGlvbiwgSU1jcENvbmZpZ3VyYXRpb25TU0UsIElNY3BDb25maWd1cmF0aW9uU3RkaW8sIE1jcENvbmZpZ3VyYXRpb25TZXJ2ZXIgfSBmcm9tICcuL21jcFBsYXRmb3JtVHlwZXMuanMnO1xuXG50eXBlIFZhbGlkYXRlZENvbmZpZyA9IHsgbmFtZTogc3RyaW5nOyBjb25maWc6IElNY3BDb25maWd1cmF0aW9uU3RkaW8gfCBJTWNwQ29uZmlndXJhdGlvblNTRSB9O1xuXG5leHBvcnQgY2xhc3MgTWNwTWFuYWdlbWVudENsaSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xvZ2dlcjogSUxvZ2dlcixcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3VzZXJDb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHQpIHsgfVxuXG5cdGFzeW5jIGFkZE1jcERlZmluaXRpb25zKFxuXHRcdGRlZmluaXRpb25zOiBzdHJpbmdbXSxcblx0KSB7XG5cdFx0Y29uc3QgY29uZmlncyA9IGRlZmluaXRpb25zLm1hcCgoY29uZmlnKSA9PiB0aGlzLnZhbGlkYXRlQ29uZmlndXJhdGlvbihjb25maWcpKTtcblx0XHRhd2FpdCB0aGlzLnVwZGF0ZU1jcEluQ29uZmlnKHRoaXMuX3VzZXJDb25maWd1cmF0aW9uU2VydmljZSwgY29uZmlncyk7XG5cdFx0dGhpcy5fbG9nZ2VyLmluZm8oYEFkZGVkIE1DUCBzZXJ2ZXJzOiAke2NvbmZpZ3MubWFwKGMgPT4gYy5uYW1lKS5qb2luKCcsICcpfWApO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVNY3BJbkNvbmZpZyhzZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsIGNvbmZpZ3M6IFZhbGlkYXRlZENvbmZpZ1tdKSB7XG5cdFx0Y29uc3QgbWNwID0gc2VydmljZS5nZXRWYWx1ZTxJTWNwQ29uZmlndXJhdGlvbj4oJ21jcCcpIHx8IHsgc2VydmVyczoge30gfTtcblx0XHRtY3Auc2VydmVycyA/Pz0ge307XG5cblx0XHRmb3IgKGNvbnN0IGNvbmZpZyBvZiBjb25maWdzKSB7XG5cdFx0XHRtY3Auc2VydmVyc1tjb25maWcubmFtZV0gPSBjb25maWcuY29uZmlnO1xuXHRcdH1cblxuXHRcdGF3YWl0IHNlcnZpY2UudXBkYXRlVmFsdWUoJ21jcCcsIG1jcCk7XG5cdH1cblxuXHRwcml2YXRlIHZhbGlkYXRlQ29uZmlndXJhdGlvbihjb25maWc6IHN0cmluZyk6IFZhbGlkYXRlZENvbmZpZyB7XG5cdFx0bGV0IHBhcnNlZDogTWNwQ29uZmlndXJhdGlvblNlcnZlciAmIHsgbmFtZTogc3RyaW5nIH07XG5cdFx0dHJ5IHtcblx0XHRcdHBhcnNlZCA9IEpTT04ucGFyc2UoY29uZmlnKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aHJvdyBuZXcgSW52YWxpZE1jcE9wZXJhdGlvbkVycm9yKGBJbnZhbGlkIEpTT04gJyR7Y29uZmlnfSc6ICR7ZX1gKTtcblx0XHR9XG5cblx0XHRpZiAoIXBhcnNlZC5uYW1lKSB7XG5cdFx0XHR0aHJvdyBuZXcgSW52YWxpZE1jcE9wZXJhdGlvbkVycm9yKGBNaXNzaW5nIG5hbWUgcHJvcGVydHkgaW4gJHtjb25maWd9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKCEoJ2NvbW1hbmQnIGluIHBhcnNlZCkgJiYgISgndXJsJyBpbiBwYXJzZWQpKSB7XG5cdFx0XHR0aHJvdyBuZXcgSW52YWxpZE1jcE9wZXJhdGlvbkVycm9yKGBNaXNzaW5nIGNvbW1hbmQgb3IgVVJMIHByb3BlcnR5IGluICR7Y29uZmlnfWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgbmFtZSwgLi4ucmVzdCB9ID0gcGFyc2VkO1xuXHRcdHJldHVybiB7IG5hbWUsIGNvbmZpZzogcmVzdCBhcyBJTWNwQ29uZmlndXJhdGlvblN0ZGlvIHwgSU1jcENvbmZpZ3VyYXRpb25TU0UgfTtcblx0fVxufVxuXG5jbGFzcyBJbnZhbGlkTWNwT3BlcmF0aW9uRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG5cdGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZykge1xuXHRcdHN1cGVyKG1lc3NhZ2UpO1xuXHRcdHRoaXMuc3RhY2sgPSBtZXNzYWdlO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsNkJBQTZCO0FBTS9CLElBQU0sbUJBQU4sTUFBdUI7QUFBQSxFQUM3QixZQUNrQixTQUN1QiwyQkFDdkM7QUFGZ0I7QUFDdUI7QUFBQSxFQUNyQztBQUFBLEVBRUosTUFBTSxrQkFDTCxhQUNDO0FBQ0QsVUFBTSxVQUFVLFlBQVksSUFBSSxDQUFDLFdBQVcsS0FBSyxzQkFBc0IsTUFBTSxDQUFDO0FBQzlFLFVBQU0sS0FBSyxrQkFBa0IsS0FBSywyQkFBMkIsT0FBTztBQUNwRSxTQUFLLFFBQVEsS0FBSyxzQkFBc0IsUUFBUSxJQUFJLE9BQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxJQUFJLENBQUMsRUFBRTtBQUFBLEVBQzlFO0FBQUEsRUFFQSxNQUFjLGtCQUFrQixTQUFnQyxTQUE0QjtBQUMzRixVQUFNLE1BQU0sUUFBUSxTQUE0QixLQUFLLEtBQUssRUFBRSxTQUFTLENBQUMsRUFBRTtBQUN4RSxRQUFJLFlBQVksQ0FBQztBQUVqQixlQUFXLFVBQVUsU0FBUztBQUM3QixVQUFJLFFBQVEsT0FBTyxJQUFJLElBQUksT0FBTztBQUFBLElBQ25DO0FBRUEsVUFBTSxRQUFRLFlBQVksT0FBTyxHQUFHO0FBQUEsRUFDckM7QUFBQSxFQUVRLHNCQUFzQixRQUFpQztBQUM5RCxRQUFJO0FBQ0osUUFBSTtBQUNILGVBQVMsS0FBSyxNQUFNLE1BQU07QUFBQSxJQUMzQixTQUFTLEdBQUc7QUFDWCxZQUFNLElBQUkseUJBQXlCLGlCQUFpQixNQUFNLE1BQU0sQ0FBQyxFQUFFO0FBQUEsSUFDcEU7QUFFQSxRQUFJLENBQUMsT0FBTyxNQUFNO0FBQ2pCLFlBQU0sSUFBSSx5QkFBeUIsNEJBQTRCLE1BQU0sRUFBRTtBQUFBLElBQ3hFO0FBRUEsUUFBSSxFQUFFLGFBQWEsV0FBVyxFQUFFLFNBQVMsU0FBUztBQUNqRCxZQUFNLElBQUkseUJBQXlCLHNDQUFzQyxNQUFNLEVBQUU7QUFBQSxJQUNsRjtBQUVBLFVBQU0sRUFBRSxNQUFNLEdBQUcsS0FBSyxJQUFJO0FBQzFCLFdBQU8sRUFBRSxNQUFNLFFBQVEsS0FBc0Q7QUFBQSxFQUM5RTtBQUNEO0FBNUNhLG1CQUFOO0FBQUEsRUFHSjtBQUFBLEdBSFU7QUE4Q2IsTUFBTSxpQ0FBaUMsTUFBTTtBQUFBLEVBQzVDLFlBQVksU0FBaUI7QUFDNUIsVUFBTSxPQUFPO0FBQ2IsU0FBSyxRQUFRO0FBQUEsRUFDZDtBQUNEOyIsCiAgIm5hbWVzIjogW10KfQo=
