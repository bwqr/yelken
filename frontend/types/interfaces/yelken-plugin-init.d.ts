export namespace YelkenPluginInit {
  export function register(host: HostInfo): PluginInfo;
}
export interface HostInfo {
  environment: string,
  version: string,
}
export interface PluginInfo {
  name: string,
  events: Array<string>,
}
