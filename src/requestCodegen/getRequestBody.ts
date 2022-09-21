import { IRequestBody } from "../swaggerInterfaces";
import { isNullOrUndefined } from "util";
import { refClassName } from "../utils";

export function getRequestBody(requestBody: IRequestBody) {
  // 如果是空则直接反回
  if (!requestBody.content) return

  let imports: string[] = []
  let bodyType = ''

  const allContent = Object.keys(requestBody.content)
  // 默认去application/json的定义，如果取不到则直接取第一个
  let reqBody = requestBody.content["application/json"]
  // console.log("reqBody 1:", !reqBody);
  if (!reqBody) {
    reqBody = requestBody.content[allContent[0]]
  }
  // console.log("reqBody 2:", reqBody);

  if (reqBody == null) {
    return { imports, bodyType }
  }

  if (reqBody.schema) {
    if (reqBody.schema.items) {
      bodyType = refClassName(reqBody.schema.items.$ref)
      if (reqBody.schema.type && reqBody.schema.type === 'array') {
        bodyType += '[]'
      }
    } else if (reqBody.schema.$ref) {
      bodyType = refClassName(reqBody.schema.$ref)
      // console.log('propType', refClassName(p.schema.$ref))
    }
    //TODO: Only temp fix (needs recursion to be perfect)
    else if (reqBody.schema.oneOf) {
      bodyType = reqBody.schema.oneOf.reduce((p, c) => `${p} | ${refClassName(c.$ref)}`, "").substring(3);
    }
    else if (reqBody.schema.anyOf) {
      bodyType = reqBody.schema.anyOf.reduce((p, c) => `${p} | ${refClassName(c.$ref)}`, "").substring(3);
    }
    if (bodyType) {
      imports.push(bodyType)
      bodyType = `
      /** requestBody */
      body?:${bodyType},`
    }

  }
  // console.log("reqbody imports", imports);

  return { imports, bodyType }
}