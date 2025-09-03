import { AkoApplication } from "./ako/application.ts";
import { AkoRouter } from "./ako/router.ts";
import { staticAssetRouter } from "./static-assets.ts";
import { DownloadStatus, InfoStatus, statusKeeper } from "./status.ts";
import { DownloadInfo, ListPostOptions, MusicPostOptions, VideoPostOptions } from "./types.ts";
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

app.use(async (request, _, next) => {
  // if it's not an upgrade request, we're not handling it.
  if (request.headers.get("upgrade") !== "websocket") {
    // console.log(request.headers)
    return await next()
  }

  const { socket, response: socketResponse } = Deno.upgradeWebSocket(request.ogRequest)
  statusKeeper.addClient(socket)
  return socketResponse
})


const youtubeDownloader = new YouTubeDownload()

router.get("/url/info", async (request) => {
  const encodedUrl = request.searchParams?.get("url")
  if (!encodedUrl) {
    return {
      status: 400,
      body: "Missing URL",
    }
  }
  const url = decodeURIComponent(encodedUrl)

  statusKeeper.setInfoStatus(url, InfoStatus.Fetching)
  try {
    const maybeInfo = await youtubeDownloader.getInfo(url)

    if (!maybeInfo) {
      statusKeeper.setInfoStatus(url, InfoStatus.NotFound)
      return { status: 404, statusText: "Video not found", body: "Video not found"}
    }
    statusKeeper.setInfoStatus(url, InfoStatus.Done)

    return {status: 200, statusText: "success", body: maybeInfo }
  } catch (e) {
    console.error(e)
    const message = e instanceof Error ? e.message : "Unknown Error"

    statusKeeper.setInfoStatus(url, InfoStatus.Error)
    return {status: 500, statusText: message}
  }
})

router.post(/\/video\/download\/(?<videoId>[A-Za-z0-9_-]{11})\/?$/, (_, ctx) => {
  const body = ctx?.body as DownloadInfo & VideoPostOptions | undefined | null
  const videoId = ctx?.pathParams?.videoId

  if (!videoId) return { status: 400, statusText: "No video provided", body: "No video provided"}
  if (!body) return { status: 400, statusText: "Missing Options", body: "Missing Options"}

  if (!youtubeDownloader.validateVideoId(videoId)) return { status: 400, statusText: "Invalid VideoID", body: "Invalid VideoID"}

  const statusKey = statusKeeper.startDownloadStatus(videoId, {
    author: body?.author || "Unknown Channel/Uploader",
    id: videoId,
    isList: false,
    title: body?.title || "Unknown Video",
    type: "video"
  })
  youtubeDownloader.downloadVideo(videoId, body)
    .then(() => statusKeeper.setDownloadStatus(statusKey, DownloadStatus.Done))
    .catch(() => statusKeeper.setDownloadStatus(statusKey, DownloadStatus.Error))

  return {
    status: 200,
    statusText: "Download started",
    body: "Download started",
  }
})

router.post(/\/video-list\/download\/(?<listId>[A-Za-z0-9_-]+)\/?$/, (_, ctx) => {
  const body = ctx?.body as DownloadInfo & VideoPostOptions & ListPostOptions | undefined | null
  const listId = ctx?.pathParams?.listId

  if (!listId) return { status: 400, statusText: "No video provided", body: "No video provided"}
  if (!body) return { status: 400, statusText: "Missing Options", body: "Missing Options"}

  if (!youtubeDownloader.validateListId(listId)) return { status: 400, statusText: "Invalid ListID", body: "Invalid ListID"}

  const statusKey = statusKeeper.startDownloadStatus(listId, {
    author: body?.author || "Unknown Channel/Uploader",
    id: listId,
    isList: true,
    title: body?.title || "Unknown Playlist",
    type: "video"
  })
  youtubeDownloader.downloadVideoList(listId, body)
    .then(() => statusKeeper.setDownloadStatus(statusKey, DownloadStatus.Done))
    .catch(() => statusKeeper.setDownloadStatus(statusKey, DownloadStatus.Error))

  return {
    status: 200,
    statusText: "Download started",
    body: "Download started",
  }
})

router.post(/\/music\/download\/(?<videoId>[A-Za-z0-9_-]{11})\/?$/, (_, ctx) => {
  const body = ctx?.body as DownloadInfo & MusicPostOptions | undefined | null
  const videoId = ctx?.pathParams?.videoId

  if (!videoId) return { status: 400, statusText: "No video provided", body: "No video provided"}
  if (!body) return { status: 400, statusText: "Missing Options", body: "Missing Options"}

  if (!youtubeDownloader.validateVideoId(videoId)) return { status: 400, statusText: "Invalid VideoID", body: "Invalid VideoID"}

  const statusKey = statusKeeper.startDownloadStatus(videoId, {
    author: body?.author || "Unknown Channel/Uploader",
    id: videoId,
    isList: false,
    title: body?.title || "Unknown Video",
    type: "video"
  })
  youtubeDownloader.downloadSong(videoId, body)
    .then(() => statusKeeper.setDownloadStatus(statusKey, DownloadStatus.Done))
    .catch(() => statusKeeper.setDownloadStatus(statusKey, DownloadStatus.Error))

  return {
    status: 200,
    statusText: "Download started",
    body: "Download started",
  }
})

router.post(/\/video-list\/download\/(?<listId>[A-Za-z0-9_-]+)\/?$/, (_, ctx) => {
  const body = ctx?.body as DownloadInfo & VideoPostOptions & ListPostOptions | undefined | null
  const listId = ctx?.pathParams?.listId

  if (!listId) return { status: 400, statusText: "No video provided", body: "No video provided"}
  if (!body) return { status: 400, statusText: "Missing Options", body: "Missing Options"}

  if (!youtubeDownloader.validateListId(listId)) return { status: 400, statusText: "Invalid ListID", body: "Invalid ListID"}

  const statusKey = statusKeeper.startDownloadStatus(listId, {
    author: body?.author || "Unknown Channel/Uploader",
    id: listId,
    isList: true,
    title: body?.title || "Unknown Playlist",
    type: "video"
  })
  youtubeDownloader.downloadVideoList(listId, body)
    .then(() => statusKeeper.setDownloadStatus(statusKey, DownloadStatus.Done))
    .catch(() => statusKeeper.setDownloadStatus(statusKey, DownloadStatus.Error))

  return {
    status: 200,
    statusText: "Download started",
    body: "Download started",
  }
})

router.post(/\/music-list\/download\/(?<listId>[A-Za-z0-9_-]+)\/?$/, (_, ctx) => {
  const body = ctx?.body as DownloadInfo & MusicPostOptions & ListPostOptions | undefined | null
  const listId = ctx?.pathParams?.listId

  if (!listId) return { status: 400, statusText: "No video provided", body: "No video provided"}
  if (!body) return { status: 400, statusText: "Missing Options", body: "Missing Options"}

  if (!youtubeDownloader.validateListId(listId)) return { status: 400, statusText: "Invalid ListID", body: "Invalid ListID"}

  const statusKey = statusKeeper.startDownloadStatus(listId, {
    author: body?.author || "Unknown Channel/Uploader",
    id: listId,
    isList: true,
    title: body?.title || "Unknown Video",
    type: "video"
  })
  youtubeDownloader.downloadMusicList(listId, body)
    .then(() => statusKeeper.setDownloadStatus(statusKey, DownloadStatus.Done))
    .catch(() => statusKeeper.setDownloadStatus(statusKey, DownloadStatus.Error))

  return {
    status: 200,
    statusText: "Download started",
    body: "Download started",
  }
})

const hostAddr = Deno.env.get("YTDLW_HOSTADDR")

// TODO: Actually verify env values
if ([null, undefined].includes(hostAddr as unknown as null | undefined)) {
  throw new Error("Missing host address")
}

app.use(router.routes())
// Intentionally put after the API routes since it has a broader match criteria
app.use(staticAssetRouter.routes())

app.listen({ port: parseInt(Deno.env.get("YTDLW_PORT") || ""), hostname: hostAddr })

