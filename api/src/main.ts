import { AkoApplication } from "./ako/application.ts";
import { AkoRouter } from "./ako/router.ts";
import { Status, statusKeeper } from "./status.ts";
import { YouTubeDownload } from "./yt-dl.ts"

type AppContext = { body?: unknown, pathParams?: {[key: string]: string } }
const router = new AkoRouter<AppContext>({ basePath: "/api"})
const app = new AkoApplication<AppContext>()


app.use(async (request, ctx, next) => {
  if (request.headers.get("Content-type") !== "application/json") {
    return await next()
  }

  const body = await request.json()

  return await next(request, { ...ctx, body })
})

app.use(async (request, ctx, next) => {
  console.log({
    type: "request",
    method: request.method,
    path: request.path,
    url: request.url,
    searchParams: request?.searchParams?.toString(),
    ctx,
  })

  const res: Response | undefined = await next()
  let status: number | undefined = 404
  let statusText: string | undefined = undefined
  if (res !== undefined) {
    status = res.status
    statusText = res.statusText
  }


  console.log({
    type: "response",
    method: request.method,
    status,
    path: request.path,
    statusText,
    url: request.url,
    ctx,
  })

  return res
})

const returnStaticAsset = async (path: string, mime: string) => {
  const asset = await Deno.readTextFile(path)
  return new Response(asset, {
    headers: {
      "Content-Type": mime,
      "X-Powered-By": "AKO",
    },
    status: 200,
    statusText: "success",
  })
}

// For dev purposes only
app.use(async (request, _ctx, next) => {
  if (['/index.html', "/", ""].includes(request.path)) {
    return await returnStaticAsset("../client/index.html", "text/html; charset=utf-8")
  }
  if (request.path === "/index.js") {
    return await returnStaticAsset("../client/index.js", "application/javascript; charset=UTF-8")
  }

  return await next()
})

const youtubeDownloader = new YouTubeDownload()

router.get("/video/info", async (request) => {
  const encodedUrl = request.searchParams?.get("url")
  if (!encodedUrl) {
    return {
      status: 400,
      body: "Missing URL",
    }
  }


  const url = decodeURIComponent(encodedUrl)
  const maybeInfo = await youtubeDownloader.getInfo(url)

  if (!maybeInfo) return { status: 404, statusText: "Video not found", body: "Video not found"}

  return {status: 200, statusText: "success", body: maybeInfo }
})

router.post(/\/video\/download\/(?<videoId>[A-Za-z0-9_-]{11})\/?$/, (_, ctx) => {

  const videoId = ctx?.pathParams?.videoId

  if (!videoId) return { status: 400, statusText: "No video provided", body: "No video provided"}

  if (!youtubeDownloader.validateVideoId(videoId)) return { status: 400, statusText: "Invalid VideoID", body: "Invalid VideoID"}

  statusKeeper.setStatus(videoId, Status.Downloading)
  youtubeDownloader.downloadVideo(videoId).then(() => statusKeeper.setStatus(videoId, Status.Done)).catch(() => statusKeeper.setStatus(videoId, Status.Error))

  return {
    status: 200,
    statusText: "Download started",
    body: "Download started",
  }
})

router.get(/\/video\/status\/(?<videoId>[A-Za-z0-9_-]{11})\/?$/, (_, ctx) => {
  const videoId = ctx?.pathParams?.videoId

  console.log({ videoId })

  if (!videoId || !youtubeDownloader.validateVideoId(videoId)) return { status: 400 }


  return {
    status: 200,
    body: { status: statusKeeper.getStatus(videoId) }
  }
})



app.use(router.routes())
app.listen({ port: 5010, hostname: "127.0.0.1" })
