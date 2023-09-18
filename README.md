# @odit/swagger-axios-codegen
A swagger client using axios and typescript

it will always resolve `axios.response.data` or reject `axios.error` with Promise

## Get Started

```
pnpm i -D @odit/swagger-axios-codegen
```

```js

export interface ISwaggerOptions {
  /** service name suffix eg. 'Service' **/
  serviceNameSuffix?: string
  /** enum prefix eg. 'Enum' **/
  enumNamePrefix?: string
  methodNameMode?: 'operationId' | 'path'
  /** path of the generated file eg. './src/service' **/
  outputDir?: string
  /** generated file name eg. 'index.ts' **/
  fileName?: string
  /** path to remote source file eg. 'https://localhost:8080/api/v1/swagger.json' **/
  remoteUrl?: string
  /** path to local source file eg. './swagger.json' **/
  source?: any
  useStaticMethod?: boolean | undefined
  /** client can pass custom headers to the service methods **/
  useCustomerRequestInstance?: boolean | undefined
  /** filter by service name (first tag) or method name using multimatch (https://github.com/sindresorhus/multimatch) **/
  include?: Array<string | IInclude>
  /** include extra types which are not included during the filtering Eg. ["Foo", "Bar"] **/
  includeTypes?: Array<string>
  /** filter urls by following clauses **/
  urlFilters?: Array<string>
  /** custom function to format the output file (default: prettier.format()) **/
  format?: (s: string) => string
  /** match with tsconfig */
  strictNullChecks?: boolean | undefined
  /** definition Class mode */
  modelMode?: 'class' | 'interface'
  /** use class-transformer to transform the results */
  useClassTransformer?: boolean,
  // force the specified swagger or openAPI version,
  openApi?: string | undefined,
  // extend file url. It will be inserted in front of the service method
  extendDefinitionFile?: string | undefined
  // mark generic type
  extendGenericType?: string[] | undefined
  /** split request service.  Can't use with sharedServiceOptions*/
  multipleFileMode?: boolean | undefined
  /** shared service options to multiple service. Can't use with MultipleFileMode */
  sharedServiceOptions?: boolean | undefined
}

const defaultOptions: ISwaggerOptions = {
  serviceNameSuffix: 'Service',
  enumNamePrefix: 'Enum',
  methodNameMode: 'operationId',
  outputDir: './service',
  fileName: 'index.ts',
  useStaticMethod: true,
  useCustomerRequestInstance: false,
  include: [],
  strictNullChecks: true,
  /** definition Class mode ,auto use interface mode to streamlined code*/
  modelMode?: 'interface',
  useClassTransformer: false
}

```

### use local swagger api json

```js 

const { codegen } = require('@odit/swagger-axios-codegen')
codegen({
  methodNameMode: 'operationId',
  source: require('./swagger.json')
})


```

### use remote swagger api json
```js 

const { codegen } = require('@odit/swagger-axios-codegen')
codegen({
  methodNameMode: 'operationId',
  remoteUrl:'You remote Url'
})


```

### use static method

```js
codegen({
    methodNameMode: 'operationId',
    remoteUrl: 'http://localhost:22742/swagger/v1/swagger.json',
    outputDir: '.',
    useStaticMethod: true
});

```

before


```js

import { UserService } from './service'
const userService = new UserService()
await userService.GetAll();

```

after

```js

import { UserService } from './service'

await UserService.GetAll();

```


### use custom axios.instance

```js
import axios from 'axios'
import { serviceOptions } from './service'
const instance = axios.create({
  baseURL: 'https://some-domain.com/api/',
  timeout: 1000,
  headers: {'X-Custom-Header': 'foobar'}
});

serviceOptions.axios = instance

```
