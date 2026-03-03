// @bun
// src/cors.ts
function handleCORS(request, allowedOrigins) {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    const headers = {
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Captcha-Response",
      "Access-Control-Allow-Credentials": "true"
    };
    if (origin && allowedOrigins.includes(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
    }
    return new Response(null, { status: 204, headers });
  }
  return null;
}
function addCORSHeaders(response, request, allowedOrigins) {
  const origin = request.headers.get("origin");
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  return response;
}
// src/errors.ts
var ErrorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  OPERATION_NOT_ALLOWED: "OPERATION_NOT_ALLOWED"
};

class AppError extends Error {
  code;
  statusCode;
  details;
  cause;
  constructor(code, message, statusCode, details, cause) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.cause = cause;
  }
}
var apiError = {
  unauthorized: (message = "Authentication required", details) => new AppError(ErrorCodes.UNAUTHORIZED, message, 401, details),
  forbidden: (message = "Access denied", details) => new AppError(ErrorCodes.FORBIDDEN, message, 403, details),
  notFound: (resource = "Resource", details) => new AppError(ErrorCodes.NOT_FOUND, `${resource} not found`, 404, details),
  validation: (message = "Validation failed", details) => new AppError(ErrorCodes.VALIDATION_ERROR, message, 400, details),
  conflict: (message = "Resource conflict", details) => new AppError(ErrorCodes.CONFLICT, message, 409, details),
  rateLimited: (message = "Too many requests", details) => new AppError(ErrorCodes.RATE_LIMITED, message, 429, details),
  internal: (message = "Internal server error", details, cause) => new AppError(ErrorCodes.INTERNAL_ERROR, message, 500, details, cause),
  database: (message = "Database error", details, cause) => new AppError(ErrorCodes.DATABASE_ERROR, message, 500, details, cause)
};
function formatErrorResponse(error) {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        ...error.details ? { details: error.details } : {}
      }
    };
  }
  if (error instanceof Error) {
    return {
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: error.message,
        details: error.stack
      }
    };
  }
  return {
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: "An unexpected error occurred",
      details: String(error)
    }
  };
}
function formatZodError(error) {
  return {
    code: ErrorCodes.VALIDATION_ERROR,
    message: "Validation failed",
    details: error.issues.map((issue) => ({
      path: issue.path.length > 0 ? issue.path.join(".") : "root",
      message: issue.message,
      code: issue.code
    }))
  };
}
function assert(condition, error) {
  if (!condition) {
    throw error;
  }
}
// src/middlewares/index.ts
var {randomUUIDv7 } = globalThis.Bun;
function conditionalMiddleware(condition, middleware) {
  return async (options) => {
    if (condition(options.context)) {
      return middleware(options);
    }
    return options.next();
  };
}
function pathMiddleware(pattern, middleware) {
  return conditionalMiddleware((context) => {
    const url = new URL(context.request.url);
    const pathname = url.pathname;
    if (typeof pattern === "string") {
      return pathname.startsWith(pattern);
    }
    if (pattern instanceof RegExp) {
      return pattern.test(pathname);
    }
    return pattern(pathname);
  }, middleware);
}
function methodMiddleware(methods, middleware) {
  const methodSet = new Set(Array.isArray(methods) ? methods : [methods]);
  return conditionalMiddleware((context) => {
    return methodSet.has(context.request.method.toUpperCase());
  }, middleware);
}
function errorHandlingMiddleware(errorHandler) {
  return async ({ context, next }) => {
    try {
      return await next();
    } catch (error) {
      return await errorHandler(error, context);
    }
  };
}
function responseTransformMiddleware(transform) {
  return async ({ context, next }) => {
    const response = await next();
    return await transform(response, context);
  };
}
function composeMiddleware(...middlewares) {
  return async (options) => {
    let index = 0;
    const next = async () => {
      if (index < middlewares.length) {
        const middleware = middlewares[index++];
        if (!middleware) {
          throw new Error("Middleware is undefined");
        }
        return await middleware({ ...options, next });
      }
      return await options.next();
    };
    return await next();
  };
}
function corsMiddleware(origins = ["*"], options = {}) {
  const {
    allowMethods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders = ["Content-Type", "Authorization", "X-Requested-With"],
    allowCredentials = true,
    maxAge = 86400
  } = options;
  return async ({ context, next }) => {
    const { request, response } = context;
    if (request.method === "OPTIONS") {
      const origin2 = request.headers.get("origin");
      const isAllowedOrigin2 = origins.includes("*") || origin2 && origins.includes(origin2);
      if (!isAllowedOrigin2) {
        return response.error({ error: "CORS not allowed" }, 403);
      }
      const corsHeaders = new Headers({
        "Access-Control-Allow-Origin": origin2 || origins[0] || "*",
        "Access-Control-Allow-Methods": allowMethods.join(", "),
        "Access-Control-Allow-Headers": allowHeaders.join(", "),
        "Access-Control-Max-Age": maxAge.toString(),
        ...allowCredentials && { "Access-Control-Allow-Credentials": "true" }
      });
      const corsResponse = new Response(null, {
        status: 200,
        headers: corsHeaders
      });
      return corsResponse;
    }
    const actualResponse = await next();
    const origin = request.headers.get("origin");
    const isAllowedOrigin = origins.includes("*") || origin && origins.includes(origin);
    if (isAllowedOrigin) {
      const newHeaders = new Headers(actualResponse.headers);
      newHeaders.set("Access-Control-Allow-Origin", origin || origins[0] || "*");
      newHeaders.set("Access-Control-Allow-Methods", allowMethods.join(", "));
      newHeaders.set("Access-Control-Allow-Headers", allowHeaders.join(", "));
      if (allowCredentials) {
        newHeaders.set("Access-Control-Allow-Credentials", "true");
      }
      return new Response(actualResponse.body, {
        status: actualResponse.status,
        statusText: actualResponse.statusText,
        headers: newHeaders
      });
    }
    return actualResponse;
  };
}
function authMiddleware(options = {}) {
  const { requireAuth = true, roles = [], redirectTo } = options;
  return async ({ context, next }) => {
    if (requireAuth && !context.user) {
      if (redirectTo) {
        return context.response.redirect(redirectTo);
      }
      return context.response.error({ error: "Authentication required" }, 401);
    }
    if (roles.length > 0 && (!context.user?.role || !roles.includes(context.user.role))) {
      return context.response.error({ error: "Insufficient permissions" }, 403);
    }
    return next();
  };
}
function correlationMiddleware() {
  return async ({ context, next }) => {
    const requestId = randomUUIDv7();
    const startTime = Date.now();
    context.requestId = requestId;
    context.requestStartTime = startTime;
    const response = await next();
    const duration = Date.now() - startTime;
    const responseClone = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
    responseClone.headers.set("X-Request-ID", requestId);
    responseClone.headers.set("X-Response-Time", `${duration}ms`);
    return responseClone;
  };
}
function requestLoggingMiddleware(options = {}) {
  const { log, includeHeaders = false, excludePaths = [] } = options;
  return async ({ context, next }) => {
    const { request } = context;
    const url = new URL(request.url);
    if (excludePaths.some((path) => url.pathname.startsWith(path))) {
      return next();
    }
    const start = Date.now();
    const timestamp = new Date().toISOString();
    if (log) {
      log("info", `HTTP request: ${request.method} ${url.pathname}`, {
        timestamp,
        method: request.method,
        path: url.pathname,
        user_agent: request.headers.get("user-agent"),
        ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || "unknown",
        request_id: context.requestId,
        ...includeHeaders && { headers: Object.fromEntries(request.headers.entries()) }
      });
    }
    try {
      const response = await next();
      const duration = Date.now() - start;
      if (log) {
        log("info", `HTTP response: ${request.method} ${url.pathname} - ${response.status}`, {
          timestamp: new Date().toISOString(),
          method: request.method,
          path: url.pathname,
          status: response.status,
          duration_ms: duration,
          request_id: context.requestId
        });
      }
      return response;
    } catch (error) {
      const duration = Date.now() - start;
      if (log) {
        log("error", "Request processing error", {
          method: request.method,
          pathname: url.pathname,
          duration_ms: duration,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          request_id: context.requestId
        });
      }
      throw error;
    }
  };
}
// src/openapi/index.ts
import * as z from "zod";
function unwrapForJSONSchema(schema) {
  let current = schema;
  while (true) {
    const def = current._def;
    if (!def) {
      break;
    }
    const typeName = def.typeName;
    if (typeName === "ZodOptional" && def.innerType) {
      current = def.innerType;
    } else if (typeName === "ZodDefault" && def.innerType) {
      current = def.innerType;
    } else if (typeName === "ZodNullable" && def.innerType) {
      current = def.innerType;
    } else if (typeName === "ZodEffects" && def.schema) {
      current = def.schema;
    } else {
      break;
    }
  }
  return current;
}
function generateOperationId(path, method) {
  const pathParts = path.replace(/^\/api\//, "").replace(/\/$/, "").split("/").filter(Boolean);
  const methodCapitalized = method.charAt(0).toUpperCase() + method.slice(1);
  if (pathParts.length === 0) {
    return `${method}Root`;
  }
  const operationId = pathParts.map((part) => {
    const cleanPart = part.replace(/^[:{]|}$/g, "");
    return cleanPart.split(/[-_]/).map((word, idx) => idx === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)).join("");
  }).join("") + methodCapitalized;
  return operationId.charAt(0).toLowerCase() + operationId.slice(1);
}
function getStatusDescription(status) {
  const descriptions = {
    200: "Success",
    201: "Created",
    204: "No Content",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    409: "Conflict",
    429: "Too Many Requests",
    500: "Internal Server Error"
  };
  return descriptions[status] || "Response";
}
async function generateOpenAPISpec(baseUrl, routers, options = {}) {
  const usedOperationIds = new Set;
  const paths = {};
  const components = {};
  if (options.schemaContributors) {
    for (const contributor of options.schemaContributors) {
      try {
        const result = typeof contributor === "function" ? await contributor() : contributor;
        if (result.paths) {
          for (const [path, methods] of Object.entries(result.paths)) {
            const normalizedPath = path.startsWith("/") ? path : `/${path}`;
            if (!paths[normalizedPath]) {
              paths[normalizedPath] = {};
            }
            for (const [method, operation] of Object.entries(methods)) {
              const op = operation;
              let operationId = op.operationId || generateOperationId(normalizedPath, method);
              let suffix = 1;
              const originalOperationId = operationId;
              while (usedOperationIds.has(operationId)) {
                operationId = `${originalOperationId}${suffix}`;
                suffix++;
              }
              op.operationId = operationId;
              usedOperationIds.add(operationId);
              paths[normalizedPath][method] = op;
            }
          }
        }
        if (result.components) {
          for (const [key, value] of Object.entries(result.components)) {
            if (!components[key]) {
              components[key] = {};
            }
            Object.assign(components[key], value);
          }
        }
      } catch {}
    }
  }
  for (const router of routers) {
    for (const route of router.routes) {
      if (!route.schema) {
        continue;
      }
      const openapiPath = route.path.replace(/:([^/]+)/g, "{$1}");
      const method = route.method.toLowerCase();
      if (!paths[openapiPath]) {
        paths[openapiPath] = {};
      }
      let operationId = generateOperationId(openapiPath, method);
      let suffix = 1;
      const originalOperationId = operationId;
      while (usedOperationIds.has(operationId)) {
        operationId = `${originalOperationId}${suffix}`;
        suffix++;
      }
      usedOperationIds.add(operationId);
      const operation = {
        operationId,
        tags: route.schema.tags || [],
        summary: route.schema.summary,
        description: route.schema.description
      };
      const parameters = [];
      if (route.schema.params) {
        const paramSchema = route.schema.params;
        for (const [key, value] of Object.entries(paramSchema.shape)) {
          const zodValue = value;
          const unwrapped = unwrapForJSONSchema(zodValue);
          parameters.push({
            name: key,
            in: "path",
            required: true,
            schema: z.toJSONSchema(unwrapped, { target: "openapi-3.0", unrepresentable: "any" })
          });
        }
      }
      if (route.schema.query) {
        const unwrappedQuery = unwrapForJSONSchema(route.schema.query);
        const querySchema = unwrappedQuery;
        if (querySchema.shape) {
          for (const [key, value] of Object.entries(querySchema.shape)) {
            const zodValue = value;
            const unwrapped = unwrapForJSONSchema(zodValue);
            parameters.push({
              name: key,
              in: "query",
              required: !zodValue.isOptional(),
              schema: z.toJSONSchema(unwrapped, { target: "openapi-3.0", unrepresentable: "any" })
            });
          }
        }
      }
      if (parameters.length > 0) {
        operation.parameters = parameters;
      }
      if (route.schema.body && (method === "post" || method === "put" || method === "patch")) {
        const bodySchema = route.schema.body;
        let unwrappedSchema = bodySchema;
        let isOptional = false;
        if (bodySchema instanceof z.ZodOptional) {
          unwrappedSchema = bodySchema._def.innerType;
          isOptional = true;
        } else if (bodySchema instanceof z.ZodDefault) {
          unwrappedSchema = bodySchema._def.innerType;
          isOptional = true;
        }
        let jsonSchema;
        const fullyUnwrapped = unwrapForJSONSchema(unwrappedSchema);
        if (fullyUnwrapped instanceof z.ZodObject) {
          const properties = {};
          const required = [];
          for (const [key, value] of Object.entries(fullyUnwrapped.shape)) {
            const zodValue = value;
            const fieldUnwrapped = unwrapForJSONSchema(zodValue);
            const fieldSchema = z.toJSONSchema(fieldUnwrapped, {
              target: "openapi-3.0",
              unrepresentable: "any"
            });
            properties[key] = fieldSchema;
            if (!(value instanceof z.ZodOptional || value instanceof z.ZodDefault)) {
              required.push(key);
            }
          }
          jsonSchema = {
            type: "object",
            properties,
            ...required.length > 0 && { required }
          };
        } else {
          jsonSchema = z.toJSONSchema(fullyUnwrapped, {
            target: "openapi-3.0",
            unrepresentable: "any"
          });
        }
        operation.requestBody = {
          required: !isOptional,
          content: {
            "application/json": {
              schema: jsonSchema
            }
          }
        };
      }
      const responses = {};
      if (route.schema.response) {
        for (const [status, schema] of Object.entries(route.schema.response)) {
          const zodSchema = schema;
          const unwrapped = unwrapForJSONSchema(zodSchema);
          const statusCode = Number.parseInt(status, 10);
          if (!Number.isNaN(statusCode)) {
            responses[status] = {
              description: getStatusDescription(statusCode),
              content: {
                "application/json": {
                  schema: z.toJSONSchema(unwrapped, {
                    target: "openapi-3.0",
                    unrepresentable: "any"
                  })
                }
              }
            };
          }
        }
      } else {
        responses["200"] = {
          description: "Success",
          content: {
            "application/json": {
              schema: { type: "object" }
            }
          }
        };
      }
      operation.responses = responses;
      if (route.auth) {
        operation.security = [{ bearerAuth: [] }];
      }
      paths[openapiPath][method] = operation;
    }
  }
  const spec = {
    openapi: "3.1.0",
    info: {
      title: options.title || "API",
      version: options.version || "1.0.0",
      description: options.description
    },
    servers: [
      {
        url: baseUrl,
        description: "API Server"
      }
    ],
    paths,
    components: {
      securitySchemes: options.securitySchemes || {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      },
      ...components.schemas ? { schemas: components.schemas } : {}
    }
  };
  return spec;
}
function createOpenAPIHandler(routers, options = {}) {
  return {
    async getSpec(baseUrl) {
      return generateOpenAPISpec(baseUrl, routers, options);
    },
    async handleSpec(request) {
      const url = new URL(request.url);
      const protocol = url.protocol;
      const baseUrl = `${protocol}//${url.host}/api`;
      const spec = await this.getSpec(baseUrl);
      return new Response(JSON.stringify(spec), {
        headers: { "Content-Type": "application/json" }
      });
    },
    handleDocs(scalarJsUrl = "https://cdn.jsdelivr.net/npm/@scalar/api-reference") {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>API Documentation</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
	<script id="api-reference" data-url="/api/openapi.json"></script>
	<script src="${scalarJsUrl}"></script>
</body>
</html>`;
      return new Response(html, {
        headers: { "Content-Type": "text/html" }
      });
    }
  };
}
// src/rate-limit-store.ts
class InMemoryRateLimitStore {
  store = new Map;
  async zremrangebyscore(key, min, max) {
    const entries = this.store.get(key);
    if (!entries)
      return;
    const filtered = entries.filter((entry) => entry.score < min || entry.score > max);
    this.store.set(key, filtered);
  }
  async zcard(key) {
    const entries = this.store.get(key);
    return entries?.length ?? 0;
  }
  async zadd(key, score, member) {
    const entries = this.store.get(key) ?? [];
    entries.push({ score, member });
    this.store.set(key, entries);
  }
  async expire(key, seconds) {
    setTimeout(() => {
      this.store.delete(key);
    }, seconds * 1000);
  }
  clear() {
    this.store.clear();
  }
}

class RedisRateLimitStore {
  redis;
  constructor(redis) {
    this.redis = redis;
  }
  async zremrangebyscore(key, min, max) {
    await this.redis.zremrangebyscore(key, min, max);
  }
  async zcard(key) {
    return await this.redis.zcard(key);
  }
  async zadd(key, score, member) {
    await this.redis.zadd(key, score, member);
  }
  async expire(key, seconds) {
    await this.redis.expire(key, seconds);
  }
}
function createRedisStore(redis) {
  return new RedisRateLimitStore({
    zremrangebyscore: async (key, min, max) => {
      await redis.zremrangebyscore(key, min, max);
      return;
    },
    zcard: async (key) => {
      return await redis.zcard(key);
    },
    zadd: async (key, score, member) => {
      await redis.zadd(key, score, member);
      return;
    },
    expire: async (key, seconds) => {
      await redis.expire(key, seconds);
      return;
    }
  });
}
// src/router.ts
var {randomUUIDv7: randomUUIDv72 } = globalThis.Bun;
import * as z2 from "zod";
function responseSchema(codes, schema) {
  const result = {};
  for (const code of codes) {
    result[code] = schema;
  }
  return result;
}

class Router {
  routes = [];
  middlewares = [];
  defaultRateLimit;
  globalRateLimitStore = new InMemoryRateLimitStore;
  constructor(options) {
    this.defaultRateLimit = options?.defaultRateLimit;
  }
  add(method, path, handler, options) {
    this.routes.push({
      method: method.toUpperCase(),
      path,
      handler,
      auth: options?.auth,
      rateLimit: options?.rateLimit,
      schema: options?.schema
    });
    return this;
  }
  createResponseHelper(schema, _routePath) {
    return {
      json: (data, status = 200) => {
        let responseData = data;
        if (schema?.response) {
          const statusSchema = schema.response[status] || schema.response[`${status}`];
          if (statusSchema) {
            responseData = statusSchema.parse(data);
          }
        }
        return jsonResponse(responseData, status);
      },
      error: (data, status = 400) => {
        let responseData = data;
        if (schema?.response) {
          const statusSchema = schema.response[status] || schema.response[`${status}`];
          if (statusSchema) {
            responseData = statusSchema.parse(data);
          }
        }
        return jsonResponse(responseData, status);
      },
      redirect: (url, status = 302) => {
        return new Response(null, {
          status,
          headers: { Location: url }
        });
      }
    };
  }
  wrapHandler(handler, schema, _auth) {
    return (params) => {
      return handler({
        ...params,
        response: this.createResponseHelper(schema)
      });
    };
  }
  registerMethod(method, path, handler, options) {
    return this.add(method, path, this.wrapHandler(handler, options?.schema, options?.auth), options);
  }
  get(path, handler, options) {
    return this.registerMethod("GET", path, handler, options);
  }
  post(path, handler, options) {
    return this.registerMethod("POST", path, handler, options);
  }
  put(path, handler, options) {
    return this.registerMethod("PUT", path, handler, options);
  }
  delete(path, handler, options) {
    return this.registerMethod("DELETE", path, handler, options);
  }
  patch(path, handler, options) {
    return this.registerMethod("PATCH", path, handler, options);
  }
  use(router, prefix) {
    for (const route of router.routes) {
      const path = prefix ? `${prefix}${route.path}` : route.path;
      this.add(route.method, path, route.handler, {
        auth: route.auth,
        rateLimit: route.rateLimit,
        schema: route.schema
      });
    }
    return this;
  }
  middleware(handler) {
    this.middlewares.push(handler);
    return this;
  }
  async handle(request, context, jsonResponseFn) {
    const match = this.match(request);
    if (!match) {
      return new Response("Not Found", { status: 404 });
    }
    const { route, params } = match;
    const baseResponseHelper = this.createResponseHelper(undefined);
    const middlewareContext = {
      ...context,
      request,
      params,
      response: baseResponseHelper
    };
    let index = 0;
    const next = async () => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        return await middleware({ context: middlewareContext, next });
      }
      return await this.executeRouteHandler(route, request, params, context, jsonResponseFn);
    };
    return await next();
  }
  async executeRouteHandler(route, request, params, context, jsonResponseFn) {
    if (route.auth && !context.user) {
      return jsonResponseFn({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
    }
    const rateLimitResult = await this.checkRateLimit(route, request);
    if (rateLimitResult) {
      return rateLimitResult;
    }
    if (route.schema?.params) {
      try {
        const validatedParams = route.schema.params.parse(params);
        Object.assign(params, validatedParams);
      } catch (error) {
        if (error instanceof z2.ZodError) {
          return jsonResponseFn({ error: "Invalid parameters", details: error.issues }, 400);
        }
      }
    }
    let query;
    if (route.schema?.query) {
      try {
        const queryObj = Object.fromEntries(new URL(request.url).searchParams.entries());
        query = route.schema.query.parse(queryObj);
      } catch (error) {
        if (error instanceof z2.ZodError) {
          return jsonResponseFn({ error: "Invalid query parameters", details: error.issues }, 400);
        }
      }
    }
    const hasBodySchema = route.schema?.body && (request.method === "POST" || request.method === "PUT" || request.method === "PATCH");
    let body;
    if (hasBodySchema && route.schema?.body) {
      try {
        const contentType = request.headers.get("content-type");
        if (!contentType?.includes("application/json")) {
          return jsonResponseFn({
            error: "Invalid request body",
            details: [
              {
                path: "",
                message: "Content-Type must be application/json",
                code: "custom"
              }
            ]
          }, 400);
        }
        let rawBody;
        try {
          rawBody = await request.json();
        } catch {
          return jsonResponseFn({
            error: "Invalid request body",
            details: [
              {
                path: "",
                message: "Request body must be valid JSON",
                code: "custom"
              }
            ]
          }, 400);
        }
        const parseResult = route.schema.body.safeParse(rawBody);
        if (!parseResult.success) {
          return jsonResponseFn({
            error: "Invalid request body",
            details: parseResult.error.issues.map((issue) => ({
              path: issue.path.length > 0 ? issue.path.join(".") : "root",
              message: issue.message,
              code: issue.code
            }))
          }, 400);
        }
        body = parseResult.data;
      } catch (error) {
        if (error instanceof z2.ZodError) {
          return jsonResponseFn({
            error: "Invalid request body",
            details: error.issues.map((issue) => ({
              path: issue.path.length > 0 ? issue.path.join(".") : "root",
              message: issue.message,
              code: issue.code
            }))
          }, 400);
        }
        return jsonResponseFn({
          error: "Failed to parse request body",
          message: error instanceof Error ? error.message : "Unknown error"
        }, 400);
      }
    }
    const responseHelper = this.createResponseHelper(route.schema, route.path);
    try {
      const hasQuerySchema = !!route.schema?.query;
      if (hasBodySchema) {
        if (route.auth) {
          const handler3 = route.handler;
          const handlerParams3 = {
            request,
            params,
            context,
            body,
            response: responseHelper,
            ...hasQuerySchema && { query }
          };
          const response3 = await handler3(handlerParams3);
          return response3;
        }
        const handler2 = route.handler;
        const handlerParams2 = {
          request,
          params,
          context,
          body,
          response: responseHelper,
          ...hasQuerySchema && { query }
        };
        const response2 = await handler2(handlerParams2);
        return response2;
      }
      if (route.auth) {
        const handler2 = route.handler;
        const handlerParams2 = {
          request,
          params,
          context,
          response: responseHelper,
          ...hasQuerySchema && { query }
        };
        const response2 = await handler2(handlerParams2);
        return response2;
      }
      const handler = route.handler;
      const handlerParams = {
        request,
        params,
        context,
        response: responseHelper,
        ...hasQuerySchema && { query }
      };
      const response = await handler(handlerParams);
      return response;
    } catch (error) {
      const errorResponse = formatErrorResponse(error);
      let statusCode = 500;
      if (error && typeof error === "object" && "statusCode" in error && typeof error.statusCode === "number") {
        statusCode = error.statusCode;
      }
      return jsonResponseFn(errorResponse, statusCode);
    }
  }
  async checkRateLimit(route, request) {
    const url = new URL(request.url);
    let rateLimitConfig = route.rateLimit;
    if (rateLimitConfig === undefined) {
      rateLimitConfig = this.defaultRateLimit;
    }
    if (rateLimitConfig === false) {
      return null;
    }
    if (rateLimitConfig?.skipPaths?.some((path) => url.pathname.startsWith(path))) {
      return null;
    }
    if (!rateLimitConfig) {
      return null;
    }
    const key = rateLimitConfig.keyGenerator ? rateLimitConfig.keyGenerator(request) : `${rateLimitConfig.keyPrefix || "ratelimit"}:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || "unknown"}`;
    const store = rateLimitConfig.store || this.globalRateLimitStore;
    try {
      const now = Date.now();
      const windowStart = now - rateLimitConfig.windowMs;
      await store.zremrangebyscore(key, 0, windowStart);
      const requestCount = await store.zcard(key);
      if (requestCount >= rateLimitConfig.maxRequests) {
        return new Response(JSON.stringify({ error: "Too many requests" }), {
          status: 429,
          headers: { "Content-Type": "application/json" }
        });
      }
      await store.zadd(key, now, `${now}:${randomUUIDv72()}`);
      await store.expire(key, Math.ceil(rateLimitConfig.windowMs / 1000) * 2);
      return null;
    } catch {
      return null;
    }
  }
  match(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method.toUpperCase();
    let bestMatch = null;
    for (const route of this.routes) {
      if (route.method !== method) {
        continue;
      }
      const params = this.matchPath(route.path, pathname);
      if (params === null) {
        continue;
      }
      const paramCount = Object.keys(params).length;
      if (!bestMatch || paramCount < bestMatch.paramCount) {
        bestMatch = { route, params, paramCount };
      }
    }
    return bestMatch ? { route: bestMatch.route, params: bestMatch.params } : null;
  }
  matchPath(pattern, pathname) {
    const patternParts = pattern.split("/").filter(Boolean);
    const pathParts = pathname.split("/").filter(Boolean);
    if (patternParts.length !== pathParts.length) {
      return null;
    }
    const params = {};
    for (let i = 0;i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];
      if (!patternPart || !pathPart) {
        return null;
      }
      if (patternPart.startsWith(":")) {
        const paramName = patternPart.slice(1);
        params[paramName] = decodeURIComponent(pathPart);
      } else if (patternPart !== pathPart) {
        return null;
      }
    }
    return params;
  }
}
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
async function parseBody(request) {
  const contentType = request.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return await request.json();
  }
  return null;
}
export {
  responseTransformMiddleware,
  responseSchema,
  requestLoggingMiddleware,
  pathMiddleware,
  parseBody,
  methodMiddleware,
  jsonResponse,
  handleCORS,
  generateOpenAPISpec,
  formatZodError,
  formatErrorResponse,
  errorHandlingMiddleware,
  createRedisStore,
  createOpenAPIHandler,
  corsMiddleware,
  correlationMiddleware,
  conditionalMiddleware,
  composeMiddleware,
  authMiddleware,
  assert,
  apiError,
  addCORSHeaders,
  Router,
  RedisRateLimitStore,
  InMemoryRateLimitStore,
  ErrorCodes,
  AppError
};

//# debugId=EEEF10C86C49F63564756E2164756E21
//# sourceMappingURL=index.js.map
