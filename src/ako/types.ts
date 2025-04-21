export interface IAkoRequest extends Request {
  readonly path: string;
  readonly host: string;
  readonly searchParams?: URLSearchParams;
  readonly protocol: string;
  readonly port?: number;
  readonly hostname: string;
  readonly method: AkoMethod
}

export interface DefaultContext {
  [key: PropertyKey]: unknown;
}

export type AkoResponse = Response | { body?: unknown, status?: number, statusText?: string }

export type Next<Context = DefaultContext> = (request?: IAkoRequest, ctx?: Context) => Promise<Response | undefined>

export type Middleware<Context = DefaultContext> =  { name?: string } & ((request: IAkoRequest, context: Context, next: Next<Context>,) => Promise<Response | undefined>); 

export type NoOptional<T, Keys extends keyof T = keyof T> = { [K in Keys]: T[K] extends undefined ? never : T }

export enum AkoMethod {
  Get = "GET",
  Post = "POST",
  Put = "PUT",
  Delete = "DELETE",
  Head = "HEAD",
  Connect = "CONNECT",
  Options = "OPTIONS",
  Trace = "TRACE",
  Patch = "PATCH",
}