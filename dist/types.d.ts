import type * as z from "zod";
/**
 * Storage interface for rate limiting.
 * Implement this to use different backends (Redis, in-memory, etc.)
 */
export interface RateLimitStore {
    /**
     * Remove entries older than the given timestamp
     */
    zremrangebyscore(key: string, min: number, max: number): Promise<void>;
    /**
     * Get the number of entries in the sorted set
     */
    zcard(key: string): Promise<number>;
    /**
     * Add an entry to the sorted set
     */
    zadd(key: string, score: number, member: string): Promise<void>;
    /**
     * Set expiration on a key
     */
    expire(key: string, seconds: number): Promise<void>;
}
/**
 * Rate limit configuration
 */
export type RateLimitConfig = {
    windowMs: number;
    maxRequests: number;
    skipPaths?: string[];
    keyPrefix?: string;
    /** Custom storage backend. If not provided, uses in-memory storage */
    store?: RateLimitStore;
    /** Custom key generator. Defaults to IP-based key */
    keyGenerator?: (request: Request) => string;
};
/**
 * Context passed to route handlers and middleware
 */
export type RouteContext<TAuth extends boolean = false> = {
    user: TAuth extends true ? {
        id: string;
        email: string;
        name: string;
        role?: string;
    } : {
        id: string;
        email: string;
        name: string;
        role?: string;
    } | undefined;
    session?: {
        id: string;
    };
    isAdmin: boolean;
    requestId: string;
    requestStartTime: number;
    businessContext?: Record<string, unknown>;
};
/**
 * Extended context for middleware handlers
 */
export type MiddlewareContext = RouteContext & {
    request: Request;
    params: Record<string, string>;
    response: ResponseHelper<undefined>;
};
/**
 * Middleware handler function
 */
export type MiddlewareHandler = (options: {
    context: MiddlewareContext;
    next: () => Promise<Response>;
}) => Promise<Response> | Response;
export type ResponseSchema = Record<number | string, z.ZodTypeAny>;
/**
 * Schema definition for a route
 */
export type RouteSchema = {
    params?: z.ZodTypeAny;
    query?: z.ZodTypeAny;
    body?: z.ZodTypeAny;
    response?: ResponseSchema;
    summary?: string;
    description?: string;
    tags?: string[];
};
type BaseHandlerParams<TSchema extends RouteSchema | undefined, TAuth extends boolean> = {
    request: Request;
    params: Record<string, string>;
    context: RouteContext<TAuth>;
    response: ResponseHelper<TSchema>;
};
type WithBody<T> = T extends undefined ? unknown : {
    body: T;
};
type WithQuery<T> = T extends undefined ? unknown : {
    query: T;
};
/**
 * Parameters passed to route handlers
 */
export type RouteHandlerParams<TBody = undefined, TQuery = undefined, TSchema extends RouteSchema | undefined = undefined, TAuth extends boolean = false> = BaseHandlerParams<TSchema, TAuth> & WithBody<TBody> & WithQuery<TQuery>;
/**
 * Route handler function
 */
export type RouteHandler<TBody = undefined, TQuery = undefined, TSchema extends RouteSchema | undefined = undefined, TAuth extends boolean = false> = (params: RouteHandlerParams<TBody, TQuery, TSchema, TAuth>) => Promise<Response> | Response;
export type InferBodyType<TSchema extends RouteSchema | undefined> = TSchema extends {
    body: z.ZodTypeAny;
} ? z.infer<TSchema["body"]> : undefined;
export type InferQueryType<TSchema extends RouteSchema | undefined> = TSchema extends {
    query: z.ZodTypeAny;
} ? z.infer<TSchema["query"]> : undefined;
type InferResponseCode<TSchema extends RouteSchema | undefined, TCode extends number | string> = TSchema extends {
    response: ResponseSchema;
} ? TSchema["response"][TCode] extends z.ZodTypeAny ? z.infer<TSchema["response"][TCode]> : TSchema["response"][`${TCode}`] extends z.ZodTypeAny ? z.infer<TSchema["response"][`${TCode}`]> : unknown : unknown;
export type InferResponseType<TSchema extends RouteSchema | undefined> = InferResponseCode<TSchema, 200>;
type Has201<TSchema extends RouteSchema | undefined> = TSchema extends {
    response: ResponseSchema;
} ? TSchema["response"][201] extends z.ZodTypeAny ? true : TSchema["response"]["201"] extends z.ZodTypeAny ? true : false : false;
export type InferSuccessResponseType<TSchema extends RouteSchema | undefined> = Has201<TSchema> extends true ? InferResponseCode<TSchema, 201> : InferResponseCode<TSchema, 200>;
export type InferErrorResponseType<TSchema extends RouteSchema | undefined, TStatus extends 400 | 401 | 403 | 404 | 429 | 500> = InferResponseCode<TSchema, TStatus>;
/**
 * Response helper for creating JSON responses with type safety
 */
export type ResponseHelper<TSchema extends RouteSchema | undefined> = {
    json: <TStatus extends 200 | 201 = 200>(data: TStatus extends 201 ? InferSuccessResponseType<TSchema> : InferResponseType<TSchema>, status?: TStatus) => Response;
    error: <TStatus extends 400 | 401 | 403 | 404 | 429 | 500 = 400>(data: InferErrorResponseType<TSchema, TStatus>, status?: TStatus) => Response;
    redirect: (url: string, status?: 301 | 302) => Response;
};
/**
 * Route definition
 */
export type Route<TBody = undefined> = {
    method: string;
    path: string;
    handler: RouteHandler<TBody>;
    auth?: boolean;
    rateLimit?: RateLimitConfig | false;
    schema?: RouteSchema;
};
/**
 * Options for creating a router
 */
export type RouterOptions = {
    /** Default rate limit configuration applied to all routes */
    defaultRateLimit?: RateLimitConfig | false;
};
/**
 * OpenAPI specification structure
 */
export interface OpenAPISpec {
    openapi: string;
    info: {
        title: string;
        version: string;
        description?: string;
    };
    servers: Array<{
        url: string;
        description?: string;
    }>;
    paths: Record<string, Record<string, unknown>>;
    components?: {
        schemas?: Record<string, unknown>;
        securitySchemes?: Record<string, unknown>;
    };
}
/**
 * Custom OpenAPI schema contributor
 * Allows extending the generated OpenAPI spec with custom paths and components
 */
export type OpenAPISchemaContributor = () => Promise<{
    paths?: Record<string, Record<string, unknown>>;
    components?: Record<string, unknown>;
}> | {
    paths?: Record<string, Record<string, unknown>>;
    components?: Record<string, unknown>;
};
/**
 * Options for OpenAPI generation
 */
export type OpenAPIOptions = {
    /** API title */
    title?: string;
    /** API version */
    version?: string;
    /** API description */
    description?: string;
    /** Custom schema contributors (e.g., better-auth schemas) */
    schemaContributors?: OpenAPISchemaContributor[];
    /** Security schemes to include */
    securitySchemes?: Record<string, unknown>;
};
export {};
//# sourceMappingURL=types.d.ts.map