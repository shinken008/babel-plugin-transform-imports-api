import { PluginPass } from 'babel__core'

export type packagesApis = Map<string, Set<string>>
export interface PluginOptions {
  packagesApis: packagesApis,
  usePackgesImport?: boolean, // 开关是否使用 packagesImport
  packagesImport?: {
    [key: string]: any
  }
}

export interface ConvertPluginPass extends PluginPass {
  opts: PluginOptions | undefined | false
}