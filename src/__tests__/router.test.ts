import { beforeEach, describe, expect, test } from "bun:test";
import { z } from "zod";
import { jsonResponse, parseBody, Router, responseSchema } from "../router";

function createMockRequest(url: string, method = "GET", body?: unknown): Request {
	const init: RequestInit = { method };
	if (body !== undefined) {
		init.body = JSON.stringify(body);
		init.headers = { "Content-Type": "application/json" };
	}
	return new Request(url, init);
}

function createMockContext() {
	return {
		user: undefined,
		isAdmin: false,
		requestId: "test-request-id",
		requestStartTime: Date.now(),
	};
}

describe("Router", () => {
	let router: Router;

	beforeEach(() => {
		router = new Router();
	});

	describe("basic routing", () => {
		test("should match simple GET route", async () => {
			router.get("/hello", ({ response }) => response.json({ message: "Hello" }));

			const request = createMockRequest("http://localhost/hello");
			const result = await router.handle(request, createMockContext(), jsonResponse);

			expect(result.status).toBe(200);
			const body = await result.json();
			expect(body).toEqual({ message: "Hello" });
		});

		test("should return 404 for unmatched route", async () => {
			router.get("/hello", ({ response }) => response.json({ message: "Hello" }));

			const request = createMockRequest("http://localhost/unknown");
			const result = await router.handle(request, createMockContext(), jsonResponse);

			expect(result.status).toBe(404);
		});

		test("should match different HTTP methods", async () => {
			router.get("/resource", ({ response }) => response.json({ method: "GET" }));
			router.post("/resource", ({ response }) => response.json({ method: "POST" }));
			router.put("/resource", ({ response }) => response.json({ method: "PUT" }));
			router.delete("/resource", ({ response }) => response.json({ method: "DELETE" }));
			router.patch("/resource", ({ response }) => response.json({ method: "PATCH" }));

			for (const method of ["GET", "POST", "PUT", "DELETE", "PATCH"]) {
				const request = createMockRequest("http://localhost/resource", method);
				const result = await router.handle(request, createMockContext(), jsonResponse);
				const body = (await result.json()) as { method: string };
				expect(body.method).toBe(method);
			}
		});
	});

	describe("path parameters", () => {
		test("should extract path params", async () => {
			router.get("/users/:id", ({ params, response }) => response.json({ id: params.id }));

			const request = createMockRequest("http://localhost/users/123");
			const result = await router.handle(request, createMockContext(), jsonResponse);
			const body = (await result.json()) as { id: string };

			expect(body.id).toBe("123");
		});

		test("should extract multiple path params", async () => {
			router.get("/users/:userId/posts/:postId", ({ params, response }) =>
				response.json({ userId: params.userId, postId: params.postId }),
			);

			const request = createMockRequest("http://localhost/users/user1/posts/post2");
			const result = await router.handle(request, createMockContext(), jsonResponse);
			const body = (await result.json()) as { userId: string; postId: string };

			expect(body.userId).toBe("user1");
			expect(body.postId).toBe("post2");
		});

		test("should decode URL-encoded params", async () => {
			router.get("/search/:query", ({ params, response }) => response.json({ query: params.query }));

			const request = createMockRequest("http://localhost/search/hello%20world");
			const result = await router.handle(request, createMockContext(), jsonResponse);
			const body = (await result.json()) as { query: string };

			expect(body.query).toBe("hello world");
		});
	});

	describe("query parameters", () => {
		test("should parse query params with schema", async () => {
			const schema = {
				query: z.object({
					page: z.coerce.number().default(1),
					limit: z.coerce.number().default(10),
				}),
			};

			router.get("/items", ({ query, response }) => response.json({ page: query?.page, limit: query?.limit }), {
				schema,
			});

			const request = createMockRequest("http://localhost/items?page=2&limit=20");
			const result = await router.handle(request, createMockContext(), jsonResponse);
			const body = (await result.json()) as { page: number; limit: number };

			expect(body.page).toBe(2);
			expect(body.limit).toBe(20);
		});

		test("should reject invalid query params", async () => {
			const schema = {
				query: z.object({
					email: z.string().email(),
				}),
			};

			router.get("/validate", ({ response }) => response.json({ ok: true }), { schema });

			const request = createMockRequest("http://localhost/validate?email=invalid");
			const result = await router.handle(request, createMockContext(), jsonResponse);

			expect(result.status).toBe(400);
		});
	});

	describe("body validation", () => {
		test("should parse and validate JSON body", async () => {
			const schema = {
				body: z.object({
					name: z.string(),
					age: z.number(),
				}),
			};

			router.post("/users", ({ body, response }) => response.json({ name: (body as { name: string }).name }), {
				schema,
			});

			const request = createMockRequest("http://localhost/users", "POST", { name: "John", age: 30 });
			const result = await router.handle(request, createMockContext(), jsonResponse);
			const body = (await result.json()) as { name: string };

			expect(result.status).toBe(200);
			expect(body.name).toBe("John");
		});

		test("should reject invalid body", async () => {
			const schema = {
				body: z.object({
					email: z.string().email(),
				}),
			};

			router.post("/users", ({ response }) => response.json({ ok: true }), { schema });

			const request = createMockRequest("http://localhost/users", "POST", { email: "invalid" });
			const result = await router.handle(request, createMockContext(), jsonResponse);

			expect(result.status).toBe(400);
		});

		test("should reject missing Content-Type header for body", async () => {
			const schema = {
				body: z.object({ name: z.string() }),
			};

			router.post("/users", ({ response }) => response.json({ ok: true }), { schema });

			const request = new Request("http://localhost/users", {
				method: "POST",
				body: JSON.stringify({ name: "John" }),
			});

			const result = await router.handle(request, createMockContext(), jsonResponse);

			expect(result.status).toBe(400);
		});

		test("should reject malformed JSON", async () => {
			const schema = {
				body: z.object({ name: z.string() }),
			};

			router.post("/users", ({ response }) => response.json({ ok: true }), { schema });

			const request = new Request("http://localhost/users", {
				method: "POST",
				body: "not valid json",
				headers: { "Content-Type": "application/json" },
			});

			const result = await router.handle(request, createMockContext(), jsonResponse);

			expect(result.status).toBe(400);
		});
	});

	describe("authentication", () => {
		test("should allow access to non-auth routes without user", async () => {
			router.get("/public", ({ response }) => response.json({ public: true }));

			const request = createMockRequest("http://localhost/public");
			const result = await router.handle(request, createMockContext(), jsonResponse);

			expect(result.status).toBe(200);
		});

		test("should reject unauthenticated requests to auth routes", async () => {
			router.get("/protected", ({ response }) => response.json({ protected: true }), { auth: true });

			const request = createMockRequest("http://localhost/protected");
			const result = await router.handle(request, createMockContext(), jsonResponse);

			expect(result.status).toBe(401);
		});

		test("should allow authenticated requests to auth routes", async () => {
			router.get("/protected", ({ response }) => response.json({ protected: true }), { auth: true });

			const request = createMockRequest("http://localhost/protected");
			const context = {
				...createMockContext(),
				user: { id: "1", email: "test@example.com", name: "Test" },
			};
			const result = await router.handle(request, context, jsonResponse);

			expect(result.status).toBe(200);
		});
	});

	describe("response helper", () => {
		test("should create JSON response with status", async () => {
			router.post("/create", ({ response }) => response.json({ created: true }, 201));

			const request = createMockRequest("http://localhost/create", "POST");
			const result = await router.handle(request, createMockContext(), jsonResponse);

			expect(result.status).toBe(201);
		});

		test("should create error response", async () => {
			router.get("/error", ({ response }) => response.error({ code: "TEST_ERROR", message: "Test error" }, 400));

			const request = createMockRequest("http://localhost/error");
			const result = await router.handle(request, createMockContext(), jsonResponse);

			expect(result.status).toBe(400);
		});

		test("should create redirect response", async () => {
			router.get("/redirect", ({ response }) => response.redirect("/new-location", 302));

			const request = createMockRequest("http://localhost/redirect");
			const result = await router.handle(request, createMockContext(), jsonResponse);

			expect(result.status).toBe(302);
			expect(result.headers.get("Location")).toBe("/new-location");
		});
	});

	describe("middleware", () => {
		test("should execute middleware in order", async () => {
			const order: string[] = [];

			router.middleware(async ({ next }) => {
				order.push("before1");
				const response = await next();
				order.push("after1");
				return response;
			});

			router.middleware(async ({ next }) => {
				order.push("before2");
				const response = await next();
				order.push("after2");
				return response;
			});

			router.get("/test", ({ response }) => {
				order.push("handler");
				return response.json({ ok: true });
			});

			const request = createMockRequest("http://localhost/test");
			await router.handle(request, createMockContext(), jsonResponse);

			expect(order).toEqual(["before1", "before2", "handler", "after2", "after1"]);
		});

		test("should allow middleware to short-circuit", async () => {
			router.middleware(async ({ context }) => {
				return context.response.error({ blocked: true }, 403);
			});

			router.get("/test", ({ response }) => response.json({ ok: true }));

			const request = createMockRequest("http://localhost/test");
			const result = await router.handle(request, createMockContext(), jsonResponse);

			expect(result.status).toBe(403);
		});
	});

	describe("router composition", () => {
		test("should mount sub-router with prefix", async () => {
			const apiRouter = new Router();
			apiRouter.get("/users", ({ response }) => response.json({ users: [] }));
			apiRouter.get("/users/:id", ({ params, response }) => response.json({ id: params.id }));

			router.use(apiRouter, "/api");

			const request = createMockRequest("http://localhost/api/users/123");
			const result = await router.handle(request, createMockContext(), jsonResponse);
			const body = (await result.json()) as { id: string };

			expect(body.id).toBe("123");
		});
	});

	describe("route matching priority", () => {
		test("should prefer more specific routes over parameterized ones", async () => {
			router.get("/users/me", ({ response }) => response.json({ special: "me" }));
			router.get("/users/:id", ({ params, response }) => response.json({ id: params.id }));

			const request = createMockRequest("http://localhost/users/me");
			const result = await router.handle(request, createMockContext(), jsonResponse);
			const body = (await result.json()) as { special?: string; id?: string };

			expect(body.special).toBe("me");
		});
	});
});

describe("jsonResponse helper", () => {
	test("should create JSON response with default status 200", () => {
		const response = jsonResponse({ message: "ok" });

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/json");
	});

	test("should create JSON response with custom status", () => {
		const response = jsonResponse({ created: true }, 201);

		expect(response.status).toBe(201);
	});
});

describe("responseSchema helper", () => {
	test("should create response schema for multiple status codes", () => {
		const schema = responseSchema([200, 201], z.object({ id: z.string() }));

		expect(schema[200]).toBeDefined();
		expect(schema[201]).toBeDefined();
		expect(schema[202]).toBeUndefined();
	});
});

describe("parseBody", () => {
	test("should parse JSON body with application/json content-type", async () => {
		const request = new Request("http://localhost/test", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "test" }),
		});

		const body = await parseBody(request);
		expect(body).toEqual({ name: "test" });
	});

	test("should return null for non-JSON content-type", async () => {
		const request = new Request("http://localhost/test", {
			method: "POST",
			headers: { "Content-Type": "text/plain" },
			body: "plain text",
		});

		const body = await parseBody(request);
		expect(body).toBeNull();
	});

	test("should return null for missing content-type", async () => {
		const request = new Request("http://localhost/test", {
			method: "POST",
			body: "data",
		});

		const body = await parseBody(request);
		expect(body).toBeNull();
	});

	test("should parse JSON with charset in content-type", async () => {
		const request = new Request("http://localhost/test", {
			method: "POST",
			headers: { "Content-Type": "application/json; charset=utf-8" },
			body: JSON.stringify({ key: "value" }),
		});

		const body = await parseBody(request);
		expect(body).toEqual({ key: "value" });
	});
});

// ============================================================================
// Cache Tests
// ============================================================================

function createInMemoryCacheStore() {
	const store = new Map<string, string>();
	return {
		get: async (key: string) => store.get(key) ?? null,
		set: async (key: string, value: string, _options?: { ttl?: number }) => {
			store.set(key, value);
		},
		del: async (key: string) => {
			store.delete(key);
		},
		delByPattern: async (pattern: string) => {
			const glob = new RegExp("^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
			for (const key of store.keys()) {
				if (glob.test(key)) {
					store.delete(key);
				}
			}
		},
		_keys: () => Array.from(store.keys()),
	};
}

function createCachedRouter() {
	const cacheStore = createInMemoryCacheStore();
	const router = new Router({
		cache: { store: cacheStore, keyPrefix: "test:" },
	});
	return { router, cacheStore };
}

describe("router caching", () => {
	test("should cache GET response and serve from cache on second call", async () => {
		let callCount = 0;
		const { router, cacheStore } = createCachedRouter();

		router.get(
			"/items",
			() => {
				callCount++;
				return jsonResponse({ data: "value" });
			},
			{ cache: { key: "items", ttl: 60 } },
		);

		const req1 = createMockRequest("http://localhost/items");
		const res1 = await router.handle(req1, createMockContext(), jsonResponse);
		expect(await res1.json()).toEqual({ data: "value" });
		expect(callCount).toBe(1);

		const req2 = createMockRequest("http://localhost/items");
		const res2 = await router.handle(req2, createMockContext(), jsonResponse);
		expect(await res2.json()).toEqual({ data: "value" });
		expect(callCount).toBe(1); // Handler not called again

		expect(res2.headers.get("Cache-Control")).toBe("public, max-age=60, stale-while-revalidate=600");
	});

	test("should not cache POST responses", async () => {
		const { router, cacheStore } = createCachedRouter();
		let callCount = 0;

		router.post(
			"/items",
			() => {
				callCount++;
				return jsonResponse({ created: true }, 201);
			},
			{ cache: { key: "items", ttl: 60 } },
		);

		const req1 = createMockRequest("http://localhost/items", "POST", { name: "test" });
		await router.handle(req1, createMockContext(), jsonResponse);
		expect(callCount).toBe(1);
		expect(cacheStore._keys().length).toBe(0); // Not cached
	});

	test("should bust cache on POST with bustCache", async () => {
		const { router, cacheStore } = createCachedRouter();

		router.get(
			"/items",
			() => jsonResponse({ data: "original" }),
			{ cache: { key: "items", ttl: 60 } },
		);

		router.post(
			"/items",
			() => jsonResponse({ created: true }, 201),
			{ bustCache: ["items"] },
		);

		// Populate cache
		const req1 = createMockRequest("http://localhost/items");
		await router.handle(req1, createMockContext(), jsonResponse);

		// Bust cache
		const req2 = createMockRequest("http://localhost/items", "POST", { name: "test" });
		await router.handle(req2, createMockContext(), jsonResponse);

		// Cache should be empty
		expect(cacheStore._keys().length).toBe(0);
	});

	test("should include query params in cache key", async () => {
		let callCount = 0;
		const { router } = createCachedRouter();

		router.get(
			"/items",
			({ query }) => {
				callCount++;
				return jsonResponse({ page: query?.page });
			},
			{
				cache: { key: "items", ttl: 60, varyByQuery: ["page"] },
				schema: { query: z.object({ page: z.coerce.number().default(1) }) },
			},
		);

		const res1 = await router.handle(
			createMockRequest("http://localhost/items?page=1"),
			createMockContext(),
			jsonResponse,
		);
		expect((await res1.json()) as { page: number }).toEqual({ page: 1 });
		expect(callCount).toBe(1);

		// Different page = different cache entry, handler should be called
		const res2 = await router.handle(
			createMockRequest("http://localhost/items?page=2"),
			createMockContext(),
			jsonResponse,
		);
		expect((await res2.json()) as { page: number }).toEqual({ page: 2 });
		expect(callCount).toBe(2);

		// Same page again = cache hit
		const res3 = await router.handle(
			createMockRequest("http://localhost/items?page=1"),
			createMockContext(),
			jsonResponse,
		);
		expect((await res3.json()) as { page: number }).toEqual({ page: 1 });
		expect(callCount).toBe(2);
	});

	test("should vary cache by user by default", async () => {
		let callCount = 0;
		const { router } = createCachedRouter();

		router.get(
			"/items",
			() => {
				callCount++;
				return jsonResponse({ data: "value" });
			},
			{ cache: { key: "items", ttl: 60 } },
		);

		const ctx1 = { ...createMockContext(), user: { id: "userA", email: "a@test.com", name: "A" } };
		const ctx2 = { ...createMockContext(), user: { id: "userB", email: "b@test.com", name: "B" } };

		await router.handle(createMockRequest("http://localhost/items"), ctx1, jsonResponse);
		expect(callCount).toBe(1);

		// Different user = cache miss
		await router.handle(createMockRequest("http://localhost/items"), ctx2, jsonResponse);
		expect(callCount).toBe(2);

		// Same user again = cache hit
		await router.handle(createMockRequest("http://localhost/items"), ctx1, jsonResponse);
		expect(callCount).toBe(2);
	});

	test("should not vary by user when varyByUser is false", async () => {
		let callCount = 0;
		const { router } = createCachedRouter();

		router.get(
			"/items",
			() => {
				callCount++;
				return jsonResponse({ data: "value" });
			},
			{ cache: { key: "items", ttl: 60, varyByUser: false } },
		);

		const ctx1 = { ...createMockContext(), user: { id: "userA", email: "a@test.com", name: "A" } };
		const ctx2 = { ...createMockContext(), user: { id: "userB", email: "b@test.com", name: "B" } };

		await router.handle(createMockRequest("http://localhost/items"), ctx1, jsonResponse);
		expect(callCount).toBe(1);

		// Different user but varyByUser=false = cache hit
		await router.handle(createMockRequest("http://localhost/items"), ctx2, jsonResponse);
		expect(callCount).toBe(1);
	});

	test("should include path params in cache key", async () => {
		let callCount = 0;
		const { router } = createCachedRouter();

		router.get(
			"/items/:id",
			() => {
				callCount++;
				return jsonResponse({ data: "value" });
			},
			{ cache: { key: "item:{id}", ttl: 60, varyByUser: false } },
		);

		await router.handle(createMockRequest("http://localhost/items/1"), createMockContext(), jsonResponse);
		expect(callCount).toBe(1);

		// Different ID = different cache entry
		await router.handle(createMockRequest("http://localhost/items/2"), createMockContext(), jsonResponse);
		expect(callCount).toBe(2);

		// Same ID again = cache hit
		await router.handle(createMockRequest("http://localhost/items/1"), createMockContext(), jsonResponse);
		expect(callCount).toBe(2);
	});

	test("should not cache non-2xx responses", async () => {
		const { router, cacheStore } = createCachedRouter();

		router.get(
			"/items",
			() => jsonResponse({ error: "not found" }, 404),
			{ cache: { key: "items", ttl: 60 } },
		);

		await router.handle(createMockRequest("http://localhost/items"), createMockContext(), jsonResponse);
		expect(cacheStore._keys().length).toBe(0);
	});

	test("should set Cache-Control headers on cached GET responses", async () => {
		const { router } = createCachedRouter();

		router.get(
			"/items",
			() => jsonResponse({ data: "value" }),
			{ cache: { key: "items", ttl: 30, swr: 600 } },
		);

		const res = await router.handle(
			createMockRequest("http://localhost/items"),
			createMockContext(),
			jsonResponse,
		);
		expect(res.headers.get("Cache-Control")).toBe("public, max-age=30, stale-while-revalidate=600");
	});

	test("should bust specific path-param-based cache keys", async () => {
		const { router, cacheStore } = createCachedRouter();

		router.get(
			"/items/:id",
			() => jsonResponse({ data: "original" }),
			{ cache: { key: "item:{id}", ttl: 300, varyByUser: false } },
		);

		router.put(
			"/items/:id",
			() => jsonResponse({ updated: true }),
			{ bustCache: ["item:{id}"], auth: true },
		);

		// Cache both item:1 and item:2
		await router.handle(createMockRequest("http://localhost/items/1"), createMockContext(), jsonResponse);
		await router.handle(createMockRequest("http://localhost/items/2"), createMockContext(), jsonResponse);
		expect(cacheStore._keys().length).toBe(2);

		// Bust only item:1
		const ctx = { ...createMockContext(), user: { id: "user", email: "u@test.com", name: "U" } };
		await router.handle(createMockRequest("http://localhost/items/1", "PUT"), ctx, jsonResponse);

		// Only item:1 cache should be gone
		const keys = cacheStore._keys();
		expect(keys.length).toBe(1);
		expect(keys[0]).toContain("item:2");
	});

	test("should default varyByUser to true", async () => {
		let callCount = 0;
		const { router } = createCachedRouter();

		router.get(
			"/items",
			() => {
				callCount++;
				return jsonResponse({ data: "value" });
			},
			{ cache: { key: "items", ttl: 60 } },
		);

		const anonCtx = createMockContext();
		await router.handle(createMockRequest("http://localhost/items"), anonCtx, jsonResponse);
		expect(callCount).toBe(1);

		// Logged-in user = cache miss
		const userCtx = { ...createMockContext(), user: { id: "userX", email: "x@test.com", name: "X" } };
		await router.handle(createMockRequest("http://localhost/items"), userCtx, jsonResponse);
		expect(callCount).toBe(2);

		// Anonymous again = cache hit (shared among anonymous)
		await router.handle(createMockRequest("http://localhost/items"), anonCtx, jsonResponse);
		expect(callCount).toBe(2);
	});
});
