import * as fs from 'fs'
import * as path from 'path'
import * as prettier from 'prettier'
import axios from 'axios'
import { pascalCase } from 'scule'
import { ISwaggerOptions, IInclude, IDefinitionClasses, IDefinitionEnums } from './baseInterfaces'
import { ISwaggerSource } from './swaggerInterfaces'
import {
  requestTemplate,
  serviceTemplate,
  enumTemplate,
  interfaceTemplate,
  classTemplate,
  typeTemplate
} from './templates/template'
import { customerServiceHeader, serviceHeader, definitionHeader, disableLint } from './templates/serviceHeader'
import { isOpenApi3, findDeepRefs, setDefinedGenericTypes, getDefinedGenericTypes, trimString } from './utils'
import { requestCodegen, IRequestClass, IRequestMethods } from './requestCodegen'
import { componentsCodegen } from './componentsCodegen'
import { definitionsCodeGen } from './definitionCodegen'

const defaultOptions: ISwaggerOptions = {
  serviceNameSuffix: 'Service',
  enumNamePrefix: 'Enum',
  methodNameMode: 'operationId',
  outputDir: './service',
  fileName: 'index.ts',
  useStaticMethod: true,
  useCustomerRequestInstance: false,
  modelMode: 'interface',
  include: [],
  includeTypes: [],
  strictNullChecks: true,
  useClassTransformer: false,
  extendGenericType: [],
  multipleFileMode: false,
  sharedServiceOptions: false,
  useHeaderParameters: false
}

/** main */
export async function codegen(params: ISwaggerOptions) {
  console.time('finish')
  let err
  let swaggerSource: ISwaggerSource
  setDefinedGenericTypes(params.extendGenericType)
  // 获取接口定义文件
  if (params.remoteUrl) {
    const { data: swaggerJson } = await axios({ url: params.remoteUrl, responseType: 'text' })
    if (Object.prototype.toString.call(swaggerJson) === '[object String]') {
      fs.writeFileSync('./cache_swagger.json', swaggerJson)
      swaggerSource = require(path.resolve('./cache_swagger.json'))
    } else {
      swaggerSource = <ISwaggerSource>swaggerJson
    }
  } else if (params.source) {
    swaggerSource = <ISwaggerSource>params.source
  } else {
    throw new Error('remoteUrl or source must have a value')
  }

  const options: ISwaggerOptions = {
    ...defaultOptions,
    ...params
  }
  let apiSource = ''

  let serviceHeaderSource = options.useCustomerRequestInstance ? customerServiceHeader(options) : serviceHeader(options)
  if (options.sharedServiceOptions) {
    writeFile(options.outputDir || '', 'serviceOptions.ts' || '', await format(serviceHeaderSource, options))
    apiSource += `import { IRequestOptions, IRequestConfig, getConfigs, axios } from "./serviceOptions";`
  } else {
    apiSource += serviceHeaderSource
  }
  // 改为到处basePath 可以让 多文件模式使用
  apiSource += `export const basePath = '${trimString(swaggerSource.basePath, '/', 'right')}'`
  apiSource += definitionHeader(options.extendDefinitionFile)

  // 判断是否是openApi3.0或者swagger3.0
  const isV3 = isOpenApi3(params.openApi || swaggerSource.openapi || swaggerSource.swagger)

  // TODO: use filter plugin
  // 根据url过滤
  let paths = swaggerSource.paths
  if (options.urlFilters?.length > 0) {
    paths = {}
    Object.keys(swaggerSource.paths).forEach((path) => {
      if (options.urlFilters.some((urlFilter) => urlFilter.indexOf(path) > -1)) {
        paths[path] = swaggerSource.paths[path]
      }
    })
  }

  let requestClass = requestCodegen(paths, isV3, options)
  // let requestClasses = Object.entries(requestCodegen(swaggerSource.paths, isV3, options))

  const { models, enums } = isV3
    ? componentsCodegen(swaggerSource.components)
    : definitionsCodeGen(swaggerSource.definitions)

  let _allModel = Object.values(models)
  let _allEnum = Object.values(enums)
  // TODO: next next next time
  if (options.multipleFileMode) {
    // if (true) {
    Object.entries(requestCodegen(swaggerSource.paths, isV3, options)).forEach(async ([className, requests]) => {
      let text = ''
      let allImport: string[] = []
      requests.forEach((req) => {
        const reqName = options.methodNameMode == 'operationId' ? req.operationId : req.name
        if ('register' === reqName) {
          console.log(
            'req.requestSchema.parsedParameters.imports',
            JSON.stringify(req.requestSchema.parsedParameters.imports)
          )
        }
        text += requestTemplate(reqName, req.requestSchema, options)
        let imports = findDeepRefs(req.requestSchema.parsedParameters.imports, _allModel, _allEnum)
        allImport = allImport.concat(imports)
      })

      // unique import
      const uniqueImports: string[] = []
      allImport.push(
        ...getDefinedGenericTypes(),
        'IRequestOptions',
        'IRequestConfig',
        'getConfigs',
        'axios',
        'basePath'
      )
      for (const item of allImport) {
        if (!uniqueImports.includes(item)) uniqueImports.push(item)
      }
      console.log(disableLint())

      text = disableLint() + text
      text = serviceTemplate(className + options.serviceNameSuffix, text, uniqueImports)
      writeFile(options.outputDir || '', className + 'Service.ts', await format(text, options))
    })

    let defsString = ''

    Object.values(models).forEach((item) => {
      const text =
        params.modelMode === 'interface'
          ? interfaceTemplate(item.value.name, item.value.props, [], params.strictNullChecks)
          : classTemplate(
              item.value.name,
              item.value.props,
              [],
              params.strictNullChecks,
              options.useClassTransformer,
              options.generateValidationModel
            )
      // const fileDir = path.join(options.outputDir || '', 'definitions')
      // writeFile(fileDir, item.name + '.ts', format(text, options))
      defsString += text
    })

    Object.values(enums).forEach((item) => {
      // const text = item.value ? enumTemplate(item.value.name, item.value.enumProps, 'Enum') : item.content || ''

      let text = ''
      if (item.value) {
        if (item.value.type == 'string') {
          text = enumTemplate(item.value.name, item.value.enumProps, options.enumNamePrefix)
        } else {
          text = typeTemplate(item.value.name, item.value.enumProps, options.enumNamePrefix)
        }
      } else {
        text = item.content || ''
      }
      defsString += text
    })

    defsString = apiSource + defsString
    writeFile(options.outputDir || '', 'index.defs.ts', await format(defsString, options))
  } else {
    codegenAll(apiSource, options, requestClass, models, enums)
  }
  if (fs.existsSync('./cache_swagger.json')) {
    fs.unlinkSync('./cache_swagger.json')
  }
  console.timeEnd('finish')
  if (err) {
    throw err
  }
}

/** codegenAll */
async function codegenAll(
  apiSource: string,
  options: ISwaggerOptions,
  requestClass: IRequestClass,
  models: IDefinitionClasses,
  enums: IDefinitionEnums
) {
  let requestClasses = Object.entries(requestClass)
  // 常规入口
  try {
    // 处理接口
    requestClasses.forEach(([className, requests]) => {
      let text = ''
      requests.forEach((req) => {
        const reqName = options.methodNameMode == 'operationId' ? req.operationId : req.name
        text += requestTemplate(reqName, req.requestSchema, options)
      })
      text = serviceTemplate(className + options.serviceNameSuffix, text)
      apiSource += text
    })

    // 处理类和枚举

    Object.values(models).forEach((item) => {
      const text =
        options.modelMode === 'interface'
          ? interfaceTemplate(item.value.name, item.value.props, [], options.strictNullChecks)
          : classTemplate(
              item.value.name,
              item.value.props,
              [],
              options.strictNullChecks,
              options.useClassTransformer,
              options.generateValidationModel
            )
      apiSource += text
    })

    Object.values(enums).forEach((item) => {
      let text = ''
      if (item.value) {
        if (item.value.type == 'string') {
          text = enumTemplate(item.value.name, item.value.enumProps, options.enumNamePrefix)
        } else {
          text = typeTemplate(item.value.name, item.value.enumProps, options.enumNamePrefix)
        }
      } else {
        text = item.content || ''
      }
      apiSource += text
    })
    // console.log(disableLint());

    apiSource = disableLint() + apiSource
    writeFile(options.outputDir || '', options.fileName || '', await format(apiSource, options))
  } catch (error) {
    console.log('error', error)
    throw error
  }
}

function writeFile(fileDir: string, name: string, data: any) {
  if (!fs.existsSync(fileDir)) {
    fs.mkdirSync(fileDir)
  }
  const filename = path.join(fileDir, name)
  // console.log('filename', filename)
  fs.writeFileSync(filename, data)
}

async function format(text: string, options: ISwaggerOptions) {
  if (options.format) {
    // console.log('use custom formatter')
    return options.format(text)
  }
  // console.log('use default formatter')
  return await prettier.format(text, {
    printWidth: 120,
    tabWidth: 2,
    parser: 'typescript',
    trailingComma: 'none',
    jsxBracketSameLine: false,
    semi: true,
    singleQuote: true
  })
  // return text
}
