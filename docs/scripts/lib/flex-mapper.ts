type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

const PRIMITIVE_TYPES: Record<string, JsonObject> = {
  string: { type: "string" },
  integer: { type: "integer" },
  number: { type: "number" },
  boolean: { type: "boolean" },
  url: { type: "string", format: "uri" },
  date: { type: "string", format: "date" },
  datetime: { type: "string", format: "date-time" },
  email: { type: "string", format: "email" },
  uuid: { type: "string", format: "uuid" },
  slug: { type: "string", pattern: "^[a-z]+(-[a-z]+)*$" },
};

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: "Bad request",
  401: "Unauthorized",
  404: "Not found",
  502: "Upstream service error",
};

function stripSuffix(value: string): { base: string; required: boolean } {
  if (value.endsWith("!")) return { base: value.slice(0, -1), required: true };
  if (value.endsWith("?")) return { base: value.slice(0, -1), required: false };
  return { base: value, required: false };
}

function isUpperCase(char: string | undefined): boolean {
  return char !== undefined && char >= "A" && char <= "Z";
}

function isStandardSchema(obj: JsonObject): boolean {
  return "type" in obj || "$ref" in obj || "allOf" in obj || "oneOf" in obj || "anyOf" in obj;
}

export function mapSchemaValue(value: string): JsonObject {
  const { base, required: _ } = stripSuffix(value);

  if (base.startsWith("enum:")) {
    return { type: "string", enum: base.slice(5).split(",") };
  }

  if (base.endsWith("[]")) {
    const itemName = base.slice(0, -2);
    const itemSchema = isUpperCase(itemName[0])
      ? { $ref: `#/components/schemas/${itemName}` }
      : (PRIMITIVE_TYPES[itemName] ?? { type: itemName });
    return { type: "array", items: itemSchema };
  }

  if (PRIMITIVE_TYPES[base]) {
    return { ...PRIMITIVE_TYPES[base] };
  }

  if (isUpperCase(base[0])) {
    return { $ref: `#/components/schemas/${base}` };
  }

  return { type: base };
}

export function mapSchemaObject(obj: JsonObject): JsonObject {
  if (isStandardSchema(obj)) return mapStandardSchema(obj);

  const properties: JsonObject = {};
  const required: string[] = [];
  let allOf: JsonValue[] | undefined;

  Object.entries(obj).forEach(([rawKey, rawValue]) => {
    if (rawKey === "...") {
      allOf ??= [];
      allOf.push({ $ref: `#/components/schemas/${rawValue as string}` });
      return;
    }

    // Determine the clean key and whether it's required/optional
    const keyHasBang = rawKey.endsWith("!");
    const keyHasQuestion = rawKey.endsWith("?");
    const cleanKey = keyHasBang
      ? rawKey.slice(0, -1)
      : keyHasQuestion
        ? rawKey.slice(0, -1)
        : rawKey;

    if (typeof rawValue === "string") {
      const { base, required: valueRequired } = stripSuffix(rawValue);
      const schema = mapSchemaValue(base);
      const isRequired = keyHasBang || (valueRequired && !keyHasQuestion);
      if (isRequired && schema.type === "string" && !schema.minLength) {
        schema.minLength = 1;
      }
      properties[cleanKey] = schema;
      if (isRequired) required.push(cleanKey);
    } else if (rawValue !== null && typeof rawValue === "object" && !Array.isArray(rawValue)) {
      const nested = rawValue as JsonObject;
      properties[cleanKey] = isStandardSchema(nested)
        ? mapStandardSchema(nested)
        : mapSchemaObject(nested);
      if (keyHasBang) required.push(cleanKey);
    } else {
      properties[cleanKey] = rawValue as JsonValue;
    }
  });

  if (allOf) {
    const hasProperties = Object.keys(properties).length > 0;
    if (hasProperties) {
      const member: JsonObject = { type: "object", properties };
      if (required.length > 0) member.required = required as unknown as JsonValue;
      allOf.push(member as unknown as JsonValue);
    }
    return allOf.length === 1
      ? (allOf[0] as JsonObject)
      : ({ allOf } as JsonObject);
  }

  const result: JsonObject = { type: "object" };
  if (required.length > 0) result.required = required as unknown as JsonValue;

  result.properties = properties;
  return result;
}

function mapStandardSchema(obj: JsonObject): JsonObject {
  const result: JsonObject = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (key === "properties" && typeof value === "object" && value !== null && !Array.isArray(value)) {
      const mapped: JsonObject = {};
      Object.entries(value as JsonObject).forEach(([propKey, propValue]) => {
        if (typeof propValue === "string") {
          mapped[propKey] = mapSchemaValue(propValue);
        } else if (typeof propValue === "object" && propValue !== null && !Array.isArray(propValue)) {
          mapped[propKey] = isStandardSchema(propValue as JsonObject)
            ? mapStandardSchema(propValue as JsonObject)
            : mapSchemaObject(propValue as JsonObject);
        } else {
          mapped[propKey] = propValue;
        }
      });
      result[key] = mapped;
    } else if (key === "items" && typeof value === "string") {
      result[key] = mapSchemaValue(value);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = mapStandardSchema(value as JsonObject);
    } else {
      result[key] = value;
    }
  });
  return result;
}

function mapRouteOperation(op: JsonObject): JsonObject {
  const result: JsonObject = { ...op };

  if (typeof result.response === "string") {
    const schemaRef = isUpperCase(result.response[0])
      ? { $ref: `#/components/schemas/${result.response}` }
      : mapSchemaValue(result.response);

    result.responses = {
      "200": {
        description: "Successful response",
        content: { "application/json": { schema: schemaRef } },
      },
    } as unknown as JsonValue;
    delete result.response;
  }

  if (typeof result.body === "string") {
    const schemaRef = isUpperCase(result.body[0])
      ? { $ref: `#/components/schemas/${result.body}` }
      : mapSchemaValue(result.body);

    result.requestBody = {
      required: true,
      content: { "application/json": { schema: schemaRef } },
    } as unknown as JsonValue;
    delete result.body;
  }

  if (Array.isArray(result.errors)) {
    const responses = (result.responses ?? {}) as JsonObject;
    (result.errors as number[]).forEach((code) => {
      const key = String(code);
      if (!responses[key]) {
        responses[key] = { description: ERROR_DESCRIPTIONS[code] ?? `Error ${code}` };
      }
    });
    result.responses = responses;
    delete result.errors;
  }

  return result;
}

export function mapResource(value: JsonValue): JsonValue {
  if (typeof value !== "string") return value;

  const match = value.match(/^(ssm|kms|secret):(.+?)(?::(\w+))?$/);
  if (!match) return value;

  const result: JsonObject = { type: match[1], path: match[2] };
  if (match[3]) result.scope = match[3];
  return result;
}

export function mapIntegration(value: JsonValue): JsonValue {
  if (typeof value !== "string") return value;

  const parts = value.split(":");
  if (parts.length < 2) return value;

  const type = parts[0];
  if (type !== "gateway" && type !== "domain") return value;

  if (parts.length === 3) {
    return { type, target: parts[1], route: parts[2] };
  }

  return { type, route: parts.slice(1).join(":") };
}

export function mapContract(input: JsonObject): JsonObject {
  const result: JsonObject = { ...input };

  if (result.paths && typeof result.paths === "object") {
    const paths: JsonObject = {};
    Object.entries(result.paths as JsonObject).forEach(([path, pathItem]) => {
      if (typeof pathItem !== "object" || pathItem === null || Array.isArray(pathItem)) {
        paths[path] = pathItem;
        return;
      }
      const mapped: JsonObject = {};
      Object.entries(pathItem as JsonObject).forEach(([method, value]) => {
        if (["get", "post", "put", "patch", "delete"].includes(method) && typeof value === "object" && value !== null) {
          mapped[method] = mapRouteOperation(value as JsonObject);
        } else {
          mapped[method] = value;
        }
      });
      paths[path] = mapped;
    });
    result.paths = paths;
  }

  if (result.components && typeof result.components === "object") {
    const components = result.components as JsonObject;
    if (components.schemas && typeof components.schemas === "object") {
      const schemas: JsonObject = {};
      Object.entries(components.schemas as JsonObject).forEach(([name, schema]) => {
        if (typeof schema === "string") {
          schemas[name] = mapSchemaValue(schema);
        } else if (typeof schema === "object" && schema !== null && !Array.isArray(schema)) {
          schemas[name] = isStandardSchema(schema as JsonObject)
            ? mapStandardSchema(schema as JsonObject)
            : mapSchemaObject(schema as JsonObject);
        } else {
          schemas[name] = schema;
        }
      });
      components.schemas = schemas;
    }
    result.components = components;
  }

  return result;
}

export function mapPlatformConfig(input: JsonObject): JsonObject {
  const result: JsonObject = { ...input };

  if (result.common && typeof result.common === "object") {
    const common = { ...(result.common as JsonObject) };
    if (typeof common.timeout === "number") {
      common.function = { timeoutSeconds: common.timeout } as unknown as JsonValue;
      delete common.timeout;
    }
    result.common = common;
  }

  if (result.resources && typeof result.resources === "object") {
    const resources: JsonObject = {};
    Object.entries(result.resources as JsonObject).forEach(([key, value]) => {
      resources[key] = mapResource(value);
    });
    result.resources = resources;
  }

  if (result.integrations && typeof result.integrations === "object") {
    const integrations: JsonObject = {};
    Object.entries(result.integrations as JsonObject).forEach(([key, value]) => {
      integrations[key] = mapIntegration(value);
    });
    result.integrations = integrations;
  }

  return result;
}
