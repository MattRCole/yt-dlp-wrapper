import { AkoRequest } from "./request.ts";
import { IAkoRequest, Middleware, DefaultContext, Next, AkoResponse } from "./types.ts";

export class AkoApplication<Context = DefaultContext> {
  private middleware: Middleware<Context>[];
  constructor() {
    this.middleware = [];
  }

  use(middleware: Middleware<Context>) {
    this.middleware.push(middleware);
    return this;
  }

  listen(options: {
    port?: number;
    hostname?: string;
  } = {}) {
    const {
      port = 5000,
      hostname = "localhost",
    } = options;
    return Deno.serve({
      hostname: hostname,
      port: port,
    }, async (request: Request) => {
      const akoRequest = new AkoRequest(request)
      const ctx: Context = {} as any as Context
      const middlewareFn = this.defaultCompose(this.middleware)
      const defaultResponse = new Response(null, { status: 404, statusText: "Not Found" })
      const response = (await middlewareFn(akoRequest, ctx, () => Promise.resolve(defaultResponse))) || defaultResponse
      return response
    });
  }

  private defaultCompose(middleware: Middleware<Context>[]): Middleware<Context> {
    // Heavily inspired by koa-compose
    const composedMiddleware: Middleware<Context> = async (request, ctx, next) => {
      let req: IAkoRequest = request
      let cx: Context = ctx
      let res: Response | undefined
      // basically just the compose thing
      const dispatchNext = (index: number): Next<Context> => async (_req, _cx) => {
        if (middleware.length <= index) {
            const _res = await next(req, cx)
            res = _res || res
            return res
        }
        const fn = middleware[index]
        req = _req || req
        cx = _cx || cx
        const _res = await fn(req, cx, dispatchNext(index + 1))
        return _res || res
      }
      return await dispatchNext(0)()
    }
    return composedMiddleware
  }
}
