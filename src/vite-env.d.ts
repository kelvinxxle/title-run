/// <reference types="vite/client" />

// Minimal stub for node:fs used only in test files (no @types/node required)
declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function statSync(path: string): { size: number };
  export function readFileSync(path: string, encoding: string): string;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function writeFileSync(path: string, data: string | Buffer): void;
}
