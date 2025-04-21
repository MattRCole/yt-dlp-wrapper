import { DefaultContext, AkoMethod, IAkoRequest, Middleware, Next, AkoResponse } from "./types.ts";

export type Route<Context = DefaultContext> = (request: IAkoRequest, context: Context) => AkoResponse | Promise<AkoResponse>

type route<Context = DefaultContext> = {
  path: string | RegExp,
  fn: Route<Context>,
  methods: AkoMethod[]
}

type AkoPath = string | RegExp

type AkoRouterOptions = {
  basePath?: string,
  /** If this router should automatically handle OPTION requests for any routes under it */
  autoOption?: boolean,
}

export class AkoRouter<Context extends { pathParams?: { [key: string]: string }}> {
  constructor(options: AkoRouterOptions = {}) {
    const {
      basePath,
      autoOption = false
    } = options
    this._routes = []
    this.basePath = basePath
    this.autoOption = autoOption
    this.routers = []
  }

  public readonly basePath?: string
  private _routes: route<Context>[]
  private routers: AkoRouter<Context>[]
  public autoOption: boolean

  public use(path: AkoPath, methods: AkoMethod[], route: Route<Context>): AkoRouter<Context> {
    this._routes.push({ path, methods, fn: route })
    return this
  }

  public get(path: AkoPath, route: Route<Context>): AkoRouter<Context> {
    return this.use(path, [AkoMethod.Get], route)
  }

  public post(path: AkoPath, route: Route<Context>): AkoRouter<Context> {
    return this.use(path, [AkoMethod.Post], route)
  }

  public put(path: AkoPath, route: Route<Context>): AkoRouter<Context> {
    return this.use(path, [AkoMethod.Put], route)
  }

  public delete(path: AkoPath, route: Route<Context>): AkoRouter<Context> {
    return this.use(path, [AkoMethod.Delete], route)
  }

  public patch(path: AkoPath, route: Route<Context>): AkoRouter<Context> {
    return this.use(path, [AkoMethod.Patch], route)
  }

  public head(path: AkoPath, route: Route<Context>): AkoRouter<Context> {
    return this.use(path, [AkoMethod.Head], route)
  }

  public useRouter(router: AkoRouter<Context>): AkoRouter<Context> {
    if (router.basePath === undefined) throw new Error("Cannot use a sub-router without a base-path!")
    this.routers.push(router)
    return this
  }

  private match(routePath: string, path: string | RegExp) {
    if (typeof path === 'string') {
      return routePath === path
    }

    return path.test(routePath)
  }

  private getBody(body?: unknown): string | null {
    if (body === undefined) return null

    if (typeof body === "string") return body

    if (typeof body === "number") return `${body}`
    if (typeof body === "boolean") return `${body}`
    if (typeof body === "function") return `${body.name}`
    return JSON.stringify(body)
  }


  /** Returns the middleware of the current router and all sub-routers for use by an Ako Application, or a different middleware */
  public routes(): Middleware<Context> {
    const subRouters: {
      router: AkoRouter<Context>
      middleware: Middleware<Context>
    }[] = this.routers.map(router => ({ router, middleware: router.routes() }))

    const middleware: Middleware<Context> = async (request: IAkoRequest, ctx: Context, next: Next<Context>) => {
      if (this.basePath && !request.path.startsWith(this.basePath)) return await next()

      const routePath = this.basePath ? request.path.slice(this.basePath.length) : request.path

      for (const { router, middleware } of subRouters) {
        if (router?.basePath?.startsWith(routePath)) return await middleware(request, ctx, next)
      }

      for (const { path, methods, fn } of this._routes) {
        if (methods.includes(request.method) && this.match(routePath, path)) {
          let cx = ctx
          if (path instanceof RegExp) {
            const match = path.exec(routePath)
            if (!match) throw Error("Somehow couldn't get a match???")

            cx = {
              ...ctx,
              pathParams: { ...(match.groups || {}) }
            }
          }
          const res = fn(request, cx)

          const response = res instanceof Promise ? (await res) : res
          
          if (response instanceof Response) return response

          return new Response(this.getBody(response.body), { status: response.status || 200, statusText: response.statusText });
        }
      }
      return await next()
    }
    // middleware._name =  `Router${this.basePath ? ": " + this.basePath : ""}`
    return middleware
  }

}
