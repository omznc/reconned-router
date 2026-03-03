/**
 * Standardized error handling utilities for consistent error responses
 */
import type { ZodError } from "zod";
/**
 * Predefined error types for common scenarios
 */
export declare const ErrorCodes: {
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly TOKEN_EXPIRED: "TOKEN_EXPIRED";
    readonly INVALID_CREDENTIALS: "INVALID_CREDENTIALS";
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly INVALID_INPUT: "INVALID_INPUT";
    readonly MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly CONFLICT: "CONFLICT";
    readonly ALREADY_EXISTS: "ALREADY_EXISTS";
    readonly RATE_LIMITED: "RATE_LIMITED";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
    readonly DATABASE_ERROR: "DATABASE_ERROR";
    readonly EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR";
    readonly BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION";
    readonly INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS";
    readonly OPERATION_NOT_ALLOWED: "OPERATION_NOT_ALLOWED";
};
export type ErrorCode = keyof typeof ErrorCodes;
/**
 * Create standardized error objects
 */
export declare class AppError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly details?: unknown;
    readonly cause?: unknown;
    constructor(code: string, message: string, statusCode: number, details?: unknown, cause?: unknown);
}
/**
 * Factory functions for common errors
 */
export declare const apiError: {
    unauthorized: (message?: string, details?: unknown) => AppError;
    forbidden: (message?: string, details?: unknown) => AppError;
    notFound: (resource?: string, details?: unknown) => AppError;
    validation: (message?: string, details?: unknown) => AppError;
    conflict: (message?: string, details?: unknown) => AppError;
    rateLimited: (message?: string, details?: unknown) => AppError;
    internal: (message?: string, details?: unknown, cause?: unknown) => AppError;
    database: (message?: string, details?: unknown, cause?: unknown) => AppError;
};
/**
 * Error response formatter
 */
export declare function formatErrorResponse(error: unknown): {
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
};
/**
 * Validation error formatter for Zod errors
 */
export declare function formatZodError(error: ZodError): {
    code: string;
    message: string;
    details: Array<{
        path: string;
        message: string;
        code: string;
    }>;
};
/**
 * Assert utility for preconditions
 */
export declare function assert(condition: boolean, error: AppError): asserts condition;
//# sourceMappingURL=errors.d.ts.map