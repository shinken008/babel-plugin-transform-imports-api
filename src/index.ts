
import { types as Types, PluginObj } from 'babel__core'
import transformImport from './transformImport'
import { ConvertPluginPass as PluginPass, packagesApis } from './types'

// 标识没有没有默认导出的包
const noDefault = '__noDefault'

const plugin = function (babel: {
  types: typeof Types;
}): PluginObj {
  const t = babel.types

  // 需要一个数据格式管理 package 信息，这些变量需要在每个 program 里重置
  /**
   *
    packagesApis: new Map([
      ['packageName1', new Set(['api'])],
      ['packageName2', new Set(['api'])],
    ]),
  */
  let packagesApis: packagesApis = new Map()
  let invokedApis: Map<string, string> = new Map()
  const packageInvokedApis: Map<string, typeof invokedApis> = new Map()
  const packageNeedDefault: Map<string, boolean> = new Map()
  // packageName 和 defaultName 的映射
  const packageNames: Map<string, string> = new Map()
  const packageIsApiImported: Map<string, boolean> = new Map()

  return {
    name: 'babel-plugin-transform-taro-api',
    visitor: {
      ImportDeclaration (ast) {
        const packageName = ast.node.source.value

        const apis = packagesApis.get(packageName)
        if (!apis) { return }

        ast.node.specifiers.forEach(node => {
          if (t.isImportDefaultSpecifier(node)) {
            packageNeedDefault.set(packageName, true)
            packageNames.set(packageName, node.local.name)

          } else if (t.isImportSpecifier(node)) {
            // @ts-ignore
            const propertyName = node.imported.name
            if (apis.has(propertyName)) { // 记录api名字
              ast.scope.rename(node.local.name)
              if (!packageInvokedApis.get(packageName)) {
                packageInvokedApis.set(packageName, new Map())
              }
              invokedApis = packageInvokedApis.get(packageName) || new Map()
              invokedApis.set(propertyName, node.local.name)
            } else { // 如果是未实现的api 改成Taro.xxx
              packageNeedDefault.set(packageName, true)
              if (!packageNames.get(packageName)) {
                // 假如没有默认导出，不进行马上替换
                packageNames.set(packageName, noDefault)
              }
            }
          }
        })
      },
      MemberExpression (ast) {
        const [packageName] = Array.from(packageNames.entries())// @ts-ignore
                                    .find(([, packageDefaultName]) => packageDefaultName === ast.node.object.name) || []
        if (!packageName) { return }
        const apis = packagesApis.get(packageName)
        if (!apis) { return }

        let invokedApis = packageInvokedApis.get(packageName)
        if (!invokedApis) {
          invokedApis = new Map()
          packageInvokedApis.set(packageName, invokedApis)
        } 

        /* 处理Taro.xxx */
        const property = ast.node.property
        let propertyName: string | null = null
        let propName = 'name'

        // 兼容一下 Taro['xxx']
        if (t.isStringLiteral(property)) {
          propName = 'value'
        }
        propertyName = property[propName]

        if (!propertyName) return

        // 同一api使用多次, 读取变量名
        if (apis.has(propertyName)) {
          const parentNode = ast.parent
          const isAssignment = t.isAssignmentExpression(parentNode) && parentNode.left === ast.node

          if (!isAssignment) {
            let identifier: Types.Identifier
            if (invokedApis.has(propertyName)) {
              identifier = t.identifier(invokedApis.get(propertyName)!)
            } else {
              const newPropertyName = ast.scope.generateUid(propertyName)
              invokedApis.set(propertyName, newPropertyName)
              /* 未绑定作用域 */
              identifier = t.identifier(newPropertyName)
            }
            ast.replaceWith(identifier)
          }
        } else {
          packageNeedDefault.set(packageName, true)
        }
      },
      Program: {
        enter(ast, state: PluginPass) {
          if (!state.opts) { return }
          packagesApis = state.opts.packagesApis
          packageInvokedApis.clear()
          packageNeedDefault.clear()
          packageNames.clear()
          packageIsApiImported.clear()
        },
        exit(ast, state: PluginPass) {
          if (!state.opts) { return }

          ast.traverse({
            ImportDeclaration (ast) {
              const packageName = ast.node.source.value
              if (!packageNames.get(packageName)) { return }

              const apis = packagesApis.get(packageName)
              if (!apis) { return }

              // 未实现 api 没有默认导出的
              ast.node.specifiers.forEach(node => {
                if (t.isImportSpecifier(node)) {
                  
                  if (packageNames.get(packageName) === noDefault) {
                    // 假如到最后都没有默认导出，则生成一个唯一的 iden
                    const defaultIden = ast.scope.generateUid(packageName)
                    packageNames.set(packageName, defaultIden)
                  }
                  // @ts-ignore
                  const propertyName = node.imported.name
                  // 如果未实现的 api，不去更改 Taro.api 这种引用
                  if (apis.has(propertyName)) {
                    return
                  }

                  const iden = t.identifier(packageNames.get(packageName) || '')
                  packageNeedDefault.set(packageName, true)

                  const localName = node.local.name
                  const binding = ast.scope.getBinding(localName)
                  binding && binding.referencePaths.forEach(reference => {
                    reference.replaceWith(
                      t.memberExpression(
                        iden,
                        t.identifier(propertyName)
                      )
                    )
                  })
                }
              })

              // 调用了配置的 api，重复引入包会被删除
              if (packageIsApiImported.get(packageName)) { return ast.remove() }
              packageIsApiImported.set(packageName, true)

              const invokedApis = packageInvokedApis.get(packageName) || new Map()
              const namedImports = Array.from(invokedApis.entries()).map(([imported, local]) => t.importSpecifier(t.identifier(local), t.identifier(imported)))
              if (packageNeedDefault.get(packageName)) {
                const defaultImport = t.importDefaultSpecifier(t.identifier(packageNames.get(packageName) || ''))
                ast.node.specifiers = [
                  defaultImport,
                  ...namedImports
                ]
                packageNeedDefault.set(packageName, false)
              } else {
                ast.node.specifiers = namedImports
              }
            },
          })

          // usePackgesImport 是否对 import member 进行处理
          // 这个包 fork 的是 https://bitbucket.org/amctheatres/babel-transform-imports/src/master/index.js 仓库
          // 以下是修改后 opt 配置
          /**
            usePackgesImport: false, // 开关是否使用 packagesImport
            packagesImport: {
              'my-library': {
                transform: (importName, matches) => `my-library/etc/${importName.toUpperCase()}`,
                preventFullImport: true,
              },
              'date-fns': {
                transform: importName => `date-fns/${camelCase(importName)}`,
                preventFullImport: true,
              },
            }
           */
          if (state.opts.usePackgesImport) {
            ast.traverse({
              ImportDeclaration(ast) {
                transformImport(ast, state, babel.types)
              },
            })
          }
        }
      }
    }
  }
}
export default plugin
