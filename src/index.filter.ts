import * as fs from 'fs'
import * as path from 'path'
import prettier from 'prettier'
import { pascalCase } from 'scule'
import { ISwaggerOptions, IInclude, IDefinitionClasses, IDefinitionEnums } from './baseInterfaces'
import {
  requestTemplate,
  serviceTemplate,
  enumTemplate,
  interfaceTemplate,
  classTemplate,
  typeTemplate
} from './templates/template'
import { customerServiceHeader, serviceHeader } from './templates/serviceHeader'
import { isOpenApi3, findDeepRefs, setDefinedGenericTypes } from './utils'
import { requestCodegen, IRequestClass, IRequestMethods } from './requestCodegen'

function writeFile(fileDir: string, name: string, data: any) {
  if (!fs.existsSync(fileDir)) {
    fs.mkdirSync(fileDir)
  }
  const filename = path.join(fileDir, name)
  console.log('filename', filename)
  fs.writeFileSync(filename, data)
}

function format(text: string, options: ISwaggerOptions) {
  if (options.format) {
    // console.log('use custom formatter')
    return options.format(text)
  }
  // console.log('use default formatter')
  return prettier.format(text, {
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
