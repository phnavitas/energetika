export function kezel(request: Request, env: { ASSETS: { fetch: (r: Request) => Promise<Response> | Response } }, f?: typeof fetch, gyorsitotar?: Cache | null): Promise<Response>;
declare const _default: { fetch(request: Request, env: unknown): Promise<Response> };
export default _default;
export interface TavhoRendszer { rendszer: string; fnren: number; fren: number; fCO2: number | null; adatEv: number | null }
export function tavhoOldal(html: string): { rendszerek: TavhoRendszer[]; frissitve: string | null };
export const TAVHO_FORRASOK: { szolgaltato: string; telepules: string; url: string }[];
