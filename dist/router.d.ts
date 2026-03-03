import * as z from "zod";
import type { InferBodyType, InferQueryType, MiddlewareContext, MiddlewareHandler, RateLimitConfig, ResponseHelper, Route, RouteContext, RouteHandler, RouteHandlerParams, RouterOptions, RouteSchema } from "./types";
export type { InferBodyType, InferQueryType, MiddlewareContext, MiddlewareHandler, RateLimitConfig, ResponseHelper, Route, RouteContext, RouteHandler, RouteHandlerParams, RouteSchema, RouterOptions, };
/**
 * Helper function to create a response schema for multiple status codes
 */
export declare function responseSchema(codes: number[], schema: z.ZodTypeAny): Record<number, z.ZodTypeAny>;
/**
 * Main Router class
 */
export declare class Router {
    routes: Route[];
    middlewares: MiddlewareHandler[];
    private defaultRateLimit?;
    private globalRateLimitStore;
    constructor(options?: RouterOptions);
    add<TBody = undefined, TQuery = undefined, TSchema extends RouteSchema | undefined = undefined>(method: string, path: string, handler: RouteHandler<TBody, TQuery, TSchema>, options?: {
        auth?: boolean;
        rateLimit?: RateLimitConfig | false;
        schema?: RouteSchema;
    }): this;
    private createResponseHelper;
    private wrapHandler;
    private registerMethod;
    get<TSchema extends RouteSchema | undefined = undefined>(path: string, handler: (params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, true>) => Promise<Response> | Response, options: {
        auth: true;
        rateLimit?: RateLimitConfig | false;
        schema?: TSchema;
    }): this;
    get<TSchema extends RouteSchema | undefined = undefined>(path: string, handler: (params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, false>) => Promise<Response> | Response, options?: {
        auth?: false;
        rateLimit?: RateLimitConfig | false;
        schema?: TSchema;
    }): this;
    post<TSchema extends RouteSchema | undefined = undefined>(path: string, handler: (params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, true>) => Promise<Response> | Response, options: {
        auth: true;
        rateLimit?: RateLimitConfig | false;
        schema?: TSchema;
    }): this;
    post<TSchema extends RouteSchema | undefined = undefined>(path: string, handler: (params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, false>) => Promise<Response> | Response, options?: {
        auth?: false;
        rateLimit?: RateLimitConfig | false;
        schema?: TSchema;
    }): this;
    put<TSchema extends RouteSchema | undefined = undefined>(path: string, handler: (params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, true>) => Promise<Response> | Response, options: {
        auth: true;
        rateLimit?: RateLimitConfig | false;
        schema?: TSchema;
    }): this;
    put<TSchema extends RouteSchema | undefined = undefined>(path: string, handler: (params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, false>) => Promise<Response> | Response, options?: {
        auth?: false;
        rateLimit?: RateLimitConfig | false;
        schema?: TSchema;
    }): this;
    delete<TSchema extends RouteSchema | undefined = undefined>(path: string, handler: (params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, true>) => Promise<Response> | Response, options: {
        auth: true;
        rateLimit?: RateLimitConfig | false;
        schema?: TSchema;
    }): this;
    delete<TSchema extends RouteSchema | undefined = undefined>(path: string, handler: (params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, false>) => Promise<Response> | Response, options?: {
        auth?: false;
        rateLimit?: RateLimitConfig | false;
        schema?: TSchema;
    }): this;
    patch<TSchema extends RouteSchema | undefined = undefined>(path: string, handler: (params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, true>) => Promise<Response> | Response, options: {
        auth: true;
        rateLimit?: RateLimitConfig | false;
        schema?: TSchema;
    }): this;
    patch<TSchema extends RouteSchema | undefined = undefined>(path: string, handler: (params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, false>) => Promise<Response> | Response, options?: {
        auth?: false;
        rateLimit?: RateLimitConfig | false;
        schema?: TSchema;
    }): this;
    use(router: Router, prefix?: string): this;
    middleware(handler: MiddlewareHandler): this;
    handle(request: Request, context: RouteContext, jsonResponseFn: (data: unknown, status?: number) => Response): Promise<Response>;
    private executeRouteHandler;
    private checkRateLimit;
    match(request: Request): {
        route: Route;
        params: Record<string, string>;
    } | null;
    private matchPath;
}
/**
 * Create a JSON response
 */
export declare function jsonResponse<T = unknown>(data: T, status?: number): Response;
/**
 * Parse request body as JSON
 */
export declare function parseBody(request: Request): Promise<unknown>;
//# sourceMappingURL=router.d.ts.map