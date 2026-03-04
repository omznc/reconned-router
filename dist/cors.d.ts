/**
 * CORS utilities for handling Cross-Origin Resource Sharing
 */
/**
 * Handle CORS preflight requests
 * Returns a response for OPTIONS requests, null otherwise
 */
export declare function handleCORS(request: Request, allowedOrigins: string[]): Response | null;
/**
 * Add CORS headers to a response
 */
export declare function addCORSHeaders(response: Response, request: Request, allowedOrigins: string[]): Response;
//# sourceMappingURL=cors.d.ts.map