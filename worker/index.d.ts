export function kezel(request: Request, env: { ASSETS: { fetch: (r: Request) => Promise<Response> | Response } }, f?: typeof fetch, gyorsitotar?: Cache | null): Promise<Response>;
declare const _default: { fetch(request: Request, env: unknown): Promise<Response> };
export default _default;
