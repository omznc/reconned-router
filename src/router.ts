import { randomUUIDv7 } from "bun";
import * as z from "zod";
import { formatErrorResponse } from "./errors";
import { InMemoryRateLimitStore } from "./rate-limit-store";
import type {
	InferBodyType,
	InferQueryType,
	MiddlewareContext,
	MiddlewareHandler,
	RateLimitConfig,
	ResponseHelper,
	Route,
	RouteContext,
	RouteHandler,
	RouteHandlerParams,
	RouterOptions,
	RouteSchema,
} from "./types";

export type {
	InferBodyType,
	InferQueryType,
	MiddlewareContext,
	MiddlewareHandler,
	RateLimitConfig,
	ResponseHelper,
	Route,
	RouteContext,
	RouteHandler,
	RouteHandlerParams,
	RouteSchema,
	RouterOptions,
};

/**
 * Helper function to create a response schema for multiple status codes
 */
export function responseSchema(codes: number[], schema: z.ZodTypeAny): Record<number, z.ZodTypeAny> {
	const result: Record<number, z.ZodTypeAny> = {};
	for (const code of codes) {
		result[code] = schema;
	}
	return result;
}

/**
 * Main Router class
 */
export class Router {
	public routes: Route[] = [];
	public middlewares: MiddlewareHandler[] = [];
	private defaultRateLimit?: RateLimitConfig | false;
	private globalRateLimitStore = new InMemoryRateLimitStore();

	constructor(options?: RouterOptions) {
		this.defaultRateLimit = options?.defaultRateLimit;
	}

	add<TBody = undefined, TQuery = undefined, TSchema extends RouteSchema | undefined = undefined>(
		method: string,
		path: string,
		handler: RouteHandler<TBody, TQuery, TSchema>,
		options?: { auth?: boolean; rateLimit?: RateLimitConfig | false; schema?: RouteSchema },
	) {
		this.routes.push({
			method: method.toUpperCase(),
			path,
			handler: handler as RouteHandler<TBody>,
			auth: options?.auth,
			rateLimit: options?.rateLimit,
			schema: options?.schema,
		} as Route);
		return this;
	}

	private createResponseHelper<TSchema extends RouteSchema | undefined>(
		schema?: TSchema,
		_routePath?: string,
	): ResponseHelper<TSchema> {
		return {
			json: <TStatus extends 200 | 201 = 200>(data: unknown, status: TStatus = 200 as TStatus): Response => {
				let responseData: unknown = data;

				if (schema?.response) {
					const statusSchema = schema.response[status] || schema.response[`${status}`];
					if (statusSchema) {
						responseData = statusSchema.parse(data);
					}
				}

				return jsonResponse(responseData, status);
			},
			error: <TStatus extends 400 | 401 | 403 | 404 | 429 | 500 = 400>(
				data: unknown,
				status: TStatus = 400 as TStatus,
			): Response => {
				let responseData: unknown = data;
				if (schema?.response) {
					const statusSchema = schema.response[status] || schema.response[`${status}`];
					if (statusSchema) {
						responseData = statusSchema.parse(data);
					}
				}
				return jsonResponse(responseData, status);
			},
			redirect: (url: string, status: 301 | 302 = 302): Response => {
				return new Response(null, {
					status,
					headers: { Location: url },
				});
			},
		};
	}

	private wrapHandler<TSchema extends RouteSchema | undefined, TAuth extends boolean>(
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, TAuth>,
		) => Promise<Response> | Response,
		schema?: TSchema,
		_auth?: boolean,
	): RouteHandler<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, TAuth> {
		return (params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, TAuth>) => {
			return handler({
				...params,
				response: this.createResponseHelper(schema),
			});
		};
	}

	private registerMethod<TSchema extends RouteSchema | undefined = undefined>(
		method: string,
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, true>,
		) => Promise<Response> | Response,
		options?: { auth?: true; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	private registerMethod<TSchema extends RouteSchema | undefined = undefined>(
		method: string,
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, false>,
		) => Promise<Response> | Response,
		options?: { auth?: false; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	private registerMethod<TSchema extends RouteSchema | undefined = undefined>(
		method: string,
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, boolean>,
		) => Promise<Response> | Response,
		options?: { auth?: boolean; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	private registerMethod<TSchema extends RouteSchema | undefined = undefined>(
		method: string,
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, boolean>,
		) => Promise<Response> | Response,
		options?: { auth?: boolean; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this {
		return this.add(
			method,
			path,
			this.wrapHandler(handler, options?.schema, options?.auth) as RouteHandler<
				InferBodyType<TSchema>,
				InferQueryType<TSchema>,
				TSchema,
				boolean
			>,
			options,
		);
	}

	get<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, true>,
		) => Promise<Response> | Response,
		options: { auth: true; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	get<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, false>,
		) => Promise<Response> | Response,
		options?: { auth?: false; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	get<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, boolean>,
		) => Promise<Response> | Response,
		options?: { auth?: boolean; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this {
		return this.registerMethod("GET", path, handler, options);
	}

	post<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, true>,
		) => Promise<Response> | Response,
		options: { auth: true; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	post<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, false>,
		) => Promise<Response> | Response,
		options?: { auth?: false; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	post<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, boolean>,
		) => Promise<Response> | Response,
		options?: { auth?: boolean; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this {
		return this.registerMethod("POST", path, handler, options);
	}

	put<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, true>,
		) => Promise<Response> | Response,
		options: { auth: true; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	put<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, false>,
		) => Promise<Response> | Response,
		options?: { auth?: false; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	put<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, boolean>,
		) => Promise<Response> | Response,
		options?: { auth?: boolean; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this {
		return this.registerMethod("PUT", path, handler, options);
	}

	delete<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, true>,
		) => Promise<Response> | Response,
		options: { auth: true; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	delete<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, false>,
		) => Promise<Response> | Response,
		options?: { auth?: false; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	delete<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, boolean>,
		) => Promise<Response> | Response,
		options?: { auth?: boolean; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this {
		return this.registerMethod("DELETE", path, handler, options);
	}

	patch<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, true>,
		) => Promise<Response> | Response,
		options: { auth: true; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	patch<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, false>,
		) => Promise<Response> | Response,
		options?: { auth?: false; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	patch<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, boolean>,
		) => Promise<Response> | Response,
		options?: { auth?: boolean; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this {
		return this.registerMethod("PATCH", path, handler, options);
	}

	use(router: Router, prefix?: string): this {
		for (const route of router.routes) {
			const path = prefix ? `${prefix}${route.path}` : route.path;
			this.add(route.method, path, route.handler, {
				auth: route.auth,
				rateLimit: route.rateLimit,
				schema: route.schema,
			});
		}
		// Note: Middlewares are not copied to avoid applying them globally
		// Each router should manage its own middleware scope
		return this;
	}

	middleware(handler: MiddlewareHandler): this {
		this.middlewares.push(handler);
		return this;
	}

	async handle(
		request: Request,
		context: RouteContext,
		jsonResponseFn: (data: unknown, status?: number) => Response,
	): Promise<Response> {
		const match = this.match(request);
		if (!match) {
			return new Response("Not Found", { status: 404 });
		}

		const { route, params } = match;

		const baseResponseHelper = this.createResponseHelper(undefined);

		const middlewareContext: MiddlewareContext = {
			...context,
			request,
			params,
			response: baseResponseHelper,
		};

		let index = 0;
		const next = async (): Promise<Response> => {
			if (index < this.middlewares.length) {
				const middleware = this.middlewares[index++];
				return await (middleware as MiddlewareHandler)({ context: middlewareContext, next });
			}

			return await this.executeRouteHandler(route, request, params, context, jsonResponseFn);
		};

		return await next();
	}

	private async executeRouteHandler(
		route: Route,
		request: Request,
		params: Record<string, string>,
		context: RouteContext,
		jsonResponseFn: (data: unknown, status?: number) => Response,
	): Promise<Response> {
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
				if (error instanceof z.ZodError) {
					return jsonResponseFn({ error: "Invalid parameters", details: error.issues }, 400);
				}
			}
		}

		let query: unknown;
		if (route.schema?.query) {
			try {
				const queryObj = Object.fromEntries(new URL(request.url).searchParams.entries());
				query = route.schema.query.parse(queryObj);
			} catch (error) {
				if (error instanceof z.ZodError) {
					return jsonResponseFn({ error: "Invalid query parameters", details: error.issues }, 400);
				}
			}
		}

		const hasBodySchema =
			route.schema?.body && (request.method === "POST" || request.method === "PUT" || request.method === "PATCH");

		let body: unknown;
		if (hasBodySchema && route.schema?.body) {
			try {
				const contentType = request.headers.get("content-type");
				if (!contentType?.includes("application/json")) {
					return jsonResponseFn(
						{
							error: "Invalid request body",
							details: [
								{
									path: "",
									message: "Content-Type must be application/json",
									code: "custom",
								},
							],
						},
						400,
					);
				}

				let rawBody: unknown;
				try {
					rawBody = await request.json();
				} catch {
					return jsonResponseFn(
						{
							error: "Invalid request body",
							details: [
								{
									path: "",
									message: "Request body must be valid JSON",
									code: "custom",
								},
							],
						},
						400,
					);
				}

				const parseResult = route.schema.body.safeParse(rawBody);
				if (!parseResult.success) {
					return jsonResponseFn(
						{
							error: "Invalid request body",
							details: parseResult.error.issues.map((issue) => ({
								path: issue.path.length > 0 ? issue.path.join(".") : "root",
								message: issue.message,
								code: issue.code,
							})),
						},
						400,
					);
				}
				body = parseResult.data;
			} catch (error) {
				if (error instanceof z.ZodError) {
					return jsonResponseFn(
						{
							error: "Invalid request body",
							details: error.issues.map((issue) => ({
								path: issue.path.length > 0 ? issue.path.join(".") : "root",
								message: issue.message,
								code: issue.code,
							})),
						},
						400,
					);
				}
				return jsonResponseFn(
					{
						error: "Failed to parse request body",
						message: error instanceof Error ? error.message : "Unknown error",
					},
					400,
				);
			}
		}

		const responseHelper = this.createResponseHelper(route.schema, route.path);
		try {
			const hasQuerySchema = !!route.schema?.query;
			if (hasBodySchema) {
				if (route.auth) {
					const handler = route.handler as unknown as RouteHandler<
						unknown,
						unknown,
						typeof route.schema,
						true
					>;
					const handlerParams = {
						request,
						params,
						context: context as unknown as RouteContext<true>,
						body: body,
						response: responseHelper,
						...(hasQuerySchema && { query: query }),
					} as RouteHandlerParams<unknown, unknown, typeof route.schema, true>;
					const response = await handler(handlerParams);
					return response;
				}
				const handler = route.handler as unknown as RouteHandler<unknown, unknown, typeof route.schema, false>;
				const handlerParams = {
					request,
					params,
					context: context as unknown as RouteContext<false>,
					body: body,
					response: responseHelper,
					...(hasQuerySchema && { query: query }),
				} as RouteHandlerParams<unknown, unknown, typeof route.schema, false>;
				const response = await handler(handlerParams);
				return response;
			}
			if (route.auth) {
				const handler = route.handler as unknown as RouteHandler<undefined, unknown, typeof route.schema, true>;
				const handlerParams = {
					request,
					params,
					context: context as unknown as RouteContext<true>,
					response: responseHelper,
					...(hasQuerySchema && { query: query }),
				} as RouteHandlerParams<undefined, unknown, typeof route.schema, true>;
				const response = await handler(handlerParams);
				return response;
			}
			const handler = route.handler as unknown as RouteHandler<undefined, unknown, typeof route.schema, false>;
			const handlerParams = {
				request,
				params,
				context: context as unknown as RouteContext<false>,
				response: responseHelper,
				...(hasQuerySchema && { query: query }),
			} as RouteHandlerParams<undefined, unknown, typeof route.schema, false>;
			const response = await handler(handlerParams);
			return response;
		} catch (error) {
			const errorResponse = formatErrorResponse(error);

			let statusCode = 500;
			if (
				error &&
				typeof error === "object" &&
				"statusCode" in error &&
				typeof (error as { statusCode: unknown }).statusCode === "number"
			) {
				statusCode = (error as { statusCode: number }).statusCode;
			}

			return jsonResponseFn(errorResponse, statusCode);
		}
	}

	private async checkRateLimit(route: Route, request: Request): Promise<Response | null> {
		const url = new URL(request.url);

		let rateLimitConfig: RateLimitConfig | false | undefined = route.rateLimit;

		// If route doesn't specify, use default
		if (rateLimitConfig === undefined) {
			rateLimitConfig = this.defaultRateLimit;
		}

		if (rateLimitConfig === false) {
			return null;
		}

		if (rateLimitConfig?.skipPaths?.some((path) => url.pathname.startsWith(path))) {
			return null;
		}

		// If no rate limit configured, no rate limiting
		if (!rateLimitConfig) {
			return null;
		}

		const key = rateLimitConfig.keyGenerator
			? rateLimitConfig.keyGenerator(request)
			: `${rateLimitConfig.keyPrefix || "ratelimit"}:${
					request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
					request.headers.get("x-real-ip") ||
					request.headers.get("cf-connecting-ip") ||
					"unknown"
				}`;

		const store = rateLimitConfig.store || this.globalRateLimitStore;

		try {
			const now = Date.now();
			const windowStart = now - rateLimitConfig.windowMs;

			await store.zremrangebyscore(key, 0, windowStart);
			const requestCount = await store.zcard(key);

			if (requestCount >= rateLimitConfig.maxRequests) {
				return new Response(JSON.stringify({ error: "Too many requests" }), {
					status: 429,
					headers: { "Content-Type": "application/json" },
				});
			}

			await store.zadd(key, now, `${now}:${randomUUIDv7()}`);
			await store.expire(key, Math.ceil(rateLimitConfig.windowMs / 1000) * 2);

			return null; // No rate limit hit
		} catch {
			// On error, allow the request through
			return null;
		}
	}

	match(request: Request): { route: Route; params: Record<string, string> } | null {
		const url = new URL(request.url);
		const pathname = url.pathname;
		const method = request.method.toUpperCase();

		let bestMatch: { route: Route; params: Record<string, string>; paramCount: number } | null = null;

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

	private matchPath(pattern: string, pathname: string): Record<string, string> | null {
		const patternParts = pattern.split("/").filter(Boolean);
		const pathParts = pathname.split("/").filter(Boolean);

		if (patternParts.length !== pathParts.length) {
			return null;
		}

		const params: Record<string, string> = {};

		for (let i = 0; i < patternParts.length; i++) {
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

/**
 * Create a JSON response
 */
export function jsonResponse<T = unknown>(data: T, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json",
		},
	});
}

/**
 * Parse request body as JSON
 */
export async function parseBody(request: Request): Promise<unknown> {
	const contentType = request.headers.get("content-type");
	if (contentType?.includes("application/json")) {
		return await request.json();
	}
	return null;
}
