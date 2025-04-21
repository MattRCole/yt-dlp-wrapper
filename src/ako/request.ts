import { AkoMethod, IAkoRequest } from "./types.ts";

class UNSET {}

export class AkoRequest implements IAkoRequest {
  private request: Request
  readonly path: string;
  readonly searchParams?: URLSearchParams
  readonly host: string;
  readonly protocol: string;
  readonly port?: number;
  readonly hostname: string;

  // private _arrayBuffer: (() => Promise<ArrayBuffer>) | UNSET = new UNSET()
  arrayBuffer(): Promise<ArrayBuffer> {
    return this.request.arrayBuffer()
  }
  // private _blob: Promise<Blob> | UNSET = new UNSET()
  blob(): Promise<Blob> {
    return this.request.blob()
  }

  // private _bytes: Promise<Uint8Array> | UNSET = new UNSET()
  bytes(): Promise<Uint8Array> {
    return this.request.bytes()
  }

  // private _clone: AkoRequest | UNSET = new UNSET()
  clone(): AkoRequest {
    const cloneRequest = this.request.clone()
    return new AkoRequest(cloneRequest)
  }

  // private _formData: Promise<FormData> | UNSET = new UNSET()
  formData(): Promise<FormData> {
    return this.request.formData()
  }

  // private _json: Promise<any> | UNSET = new UNSET()
  json(): Promise<any> {
    return this.request.json()
  }

  // private _text: Promise<string> | UNSET = new UNSET()
  text(): Promise<string> {
    return this.request.text()
  }

  // private _body: ReadableStream<Uint8Array<ArrayBufferLike>> | UNSET = new UNSET()
  get body() {
    return this.request.body
  }

  // private _bodyUsed: boolean | UNSET = new UNSET()
  get bodyUsed(): boolean {
    return this.request.bodyUsed
  }

  // private _cache: RequestCache | UNSET = new UNSET()
  get cache(): RequestCache {
    return this.request.cache
  }

  // private _credentials: RequestCredentials | UNSET = new UNSET()
  get credentials(): RequestCredentials {
    return this.request.credentials
  }

  // private _destination: RequestDestination | UNSET = new UNSET()
  get destination(): RequestDestination {
    return this.request.destination
  }

  // private _headers: Headers | UNSET = new UNSET()
  get headers(): Headers {
    return this.request.headers
  }

  // private _integrity: string | UNSET = new UNSET()
  get integrity(): string {
    return this.request.integrity
  }

  // private _isHistoryNavigation: boolean | UNSET = new UNSET()
  get isHistoryNavigation(): boolean {
    return this.request.isHistoryNavigation
  }

  // private _isReloadNavigation: boolean | UNSET = new UNSET()
  get isReloadNavigation(): boolean {
    return this.request.isReloadNavigation
  }

  // private _keepalive: boolean | UNSET = new UNSET()
  get keepalive(): boolean {
    return this.request.keepalive
  }

  // private _method: string | UNSET = new UNSET()
  get method(): AkoMethod {
    return this.request.method.toUpperCase() as AkoMethod
  }

  // private _mode: RequestMode | UNSET = new UNSET()
  get mode(): RequestMode {
    return this.request.mode
  }

  // private _redirect: RequestRedirect | UNSET = new UNSET()
  get redirect(): RequestRedirect {
    return this.request.redirect
  }

  // private _referrer: string | UNSET = new UNSET()
  get referrer(): string {
    return this.request.referrer
  }

  // private _referrerPolicy: ReferrerPolicy | UNSET = new UNSET()
  get referrerPolicy(): ReferrerPolicy {
    return this.request.referrerPolicy
  }

  // private _signal: AbortSignal | UNSET = new UNSET()
  get signal(): AbortSignal {
    return this.request.signal
  }

  // private _url: string | UNSET = new UNSET()
  get url(): string {
    return this.request.url
  }

  constructor(request: Request) {
    this.request = request
    const url = new URL(request.url);
    // this.searchParams = url.searchParams;
    this.path = url.pathname;
    this.host = url.host;
    this.protocol = url.protocol;
    const searchStr = request.url.split("?").at(-1)
    this.searchParams = request.url.includes("?") && searchStr?.length ? new URLSearchParams(searchStr) : undefined
    this.hostname = url.hostname;
    if (!url.port) {  // readonly searchParams: URLSearchParams
      this.port = this.protocol === "https:"
        ? 443
        : this.protocol === "http"
        ? 80
        : undefined;
    } else {
      this.port = parseInt(url.port, 10);
    }
  }
}
