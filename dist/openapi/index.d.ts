import type { Router } from "../router";
import type { OpenAPIOptions, OpenAPISpec } from "../types";
export declare function generateOpenAPISpec(baseUrl: string, routers: Router[], options?: OpenAPIOptions): Promise<OpenAPISpec>;
export declare function createOpenAPIHandler(routers: Router[], options?: OpenAPIOptions): {
    getSpec(baseUrl: string): Promise<OpenAPISpec>;
    handleSpec(request: Request): Promise<Response>;
    handleDocs(scalarJsUrl?: string): Response;
};
//# sourceMappingURL=index.d.ts.map