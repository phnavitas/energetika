/// <reference types="vite/client" />
interface ImportMetaEnv { readonly VITE_SUPABASE_URL?: string; readonly VITE_SUPABASE_KEY?: string; }
interface ImportMeta { readonly env: ImportMetaEnv; }

declare module 'pdfjs-dist/build/pdf.worker.min.mjs' {
  export const WorkerMessageHandler: unknown;
}
