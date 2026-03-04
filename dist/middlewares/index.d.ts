/**
 * Generic middleware utilities for the router
 */
import type { MiddlewareContext, MiddlewareHandler } from "../types";
/**
 * Create conditional middleware that only applies when condition is met
 */
export declare function conditionalMiddleware(condition: (context: MiddlewareContext) => boolean, middleware: MiddlewareHandler): MiddlewareHandler;
/**
 * Create path-based conditional middleware
 */
export declare function pathMiddleware(pattern: string | RegExp | ((pathname: string) => boolean), middleware: MiddlewareHandler): MiddlewareHandler;
/**
 * Create method-based conditional middleware
 */
export declare function methodMiddleware(methods: string | string[], middleware: MiddlewareHandler): MiddlewareHandler;
/**
 * Create error handling middleware
 */
export declare function errorHandlingMiddleware(errorHandler: (error: unknown, context: MiddlewareContext) => Response | Promise<Response>): MiddlewareHandler;
/**
 * Create response transformation middleware
 */
export declare function responseTransformMiddleware(transform: (response: Response, context: MiddlewareContext) => Response | Promise<Response>): MiddlewareHandler;
/**
 * Compose multiple middleware handlers into one
 */
export declare function composeMiddleware(...middlewares: MiddlewareHandler[]): MiddlewareHandler;
/**
 * Create CORS middleware with configurable options
 */
export declare function corsMiddleware(origins?: string[], options?: {
    allowMethods?: string[];
    allowHeaders?: string[];
    allowCredentials?: boolean;
    maxAge?: number;
}): MiddlewareHandler;
/**
 * Create authentication middleware with role checking
 */
export declare function authMiddleware(options?: {
    requireAuth?: boolean;
    roles?: string[];
    redirectTo?: string;
}): MiddlewareHandler;
/**
 * Correlation middleware that adds request ID and timing
 */
export declare function correlationMiddleware(): MiddlewareHandler;
/**
 * Request logging middleware with configurable options
 */
export declare function requestLoggingMiddleware(options?: {
    log?: (level: string, message: string, data: Record<string, unknown>) => void;
    includeHeaders?: boolean;
    excludePaths?: string[];
}): MiddlewareHandler;
//# sourceMappingURL=index.d.ts.map