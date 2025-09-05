import { AkoApplication } from "./ako/application.ts";
import { AkoContext, AkoRouter } from "./ako/router.ts";
import { staticAssetRouter } from "./static-assets.ts";
import { DownloadStatus, statusKeeper, StatusMessage } from "./status.ts";
import { DownloadInfo, ListPostOptions, MusicPostOptions, RequireSome, VideoPostOptions, YouTubeInfo } from "./types.ts";
import { pipeWhile } from "./util.ts"
import { YouTubeDownload } from "./yt-dl.ts"

type AppContext = AkoContext<{ body?: unknown, requestId: string }>
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
    return await next()
  }

  const { socket, response: socketResponse } = Deno.upgradeWebSocket(request.ogRequest)
  statusKeeper.addClient(socket)
  return socketResponse
})

app.use(async (_, ctx, next) => {
  ctx.requestId = crypto.randomUUID()

  return await next()
})


const youtubeDownloader = new YouTubeDownload()

const addYtInfoToStatus = (
  info: YouTubeInfo,
  options: { isPlaylist?: boolean, usePlaylistTitleAsAuthor?: boolean } = {},
): Pick<StatusMessage, 'author' | 'title' | 'ytID'> => {
  const {
    isPlaylist = false,
    usePlaylistTitleAsAuthor = false
  } = options

  return {
    author: usePlaylistTitleAsAuthor ? info.playlistTitle : info.channel,
    title: isPlaylist ? info.playlistTitle : info.title,
    ytID: isPlaylist ? info.playlistId : info.id
  }
}

const shouldAbortDownload = (currentStatus: StatusMessage): boolean => {
  const { ytID } = currentStatus
  if (ytID === undefined) return false


  const similarStatuses = statusKeeper.getSimilarStatuses({ ...currentStatus, ytID }, currentStatus.id)

  const [statusesStillDownloading, notDownloading] = similarStatuses.reduce(([sd, nd], fullStatus) => {
    if (fullStatus.status === DownloadStatus.Downloading) {
      return [[...sd, fullStatus], nd]
    } else {
      return [sd, [...nd, fullStatus]]
    }
  }, [[], []] as [StatusMessage[], StatusMessage[]])
  const shouldAbort = statusesStillDownloading.length > 0

  if (!shouldAbort) {
    notDownloading.forEach(({ id }) => statusKeeper.removeStatus(id))
  }

  return shouldAbort
}

const baseDownloadRequestPipe = <T extends DownloadInfo>(body: T, requestId: string, baseStatus: Omit<StatusMessage, 'status'>): () => Promise<[RequireSome<YouTubeInfo, 'id' | 'playlistId'> | undefined, boolean]> => {
  return pipeWhile<[], RequireSome<YouTubeInfo, 'id' | 'playlistId'>>(
    () => {
      statusKeeper.setStatus(requestId, {
        ...baseStatus,
        status: DownloadStatus.Fetching,
      })

      return [undefined, true]
    },
    () => youtubeDownloader.getInfo(body.url).then(res => {
      if (!res) {
        statusKeeper.setStatus(requestId, {
          ...baseStatus,
          status: DownloadStatus.NotFound,
        })
        return [undefined, false]
      }

      else return [res, true]
    }),
    (info: YouTubeInfo) => {
      if (!(baseStatus.isList ? info.playlistId : info.id)) {
        statusKeeper.setStatus(requestId, {
          ...baseStatus,
          ...addYtInfoToStatus(info),
          status: DownloadStatus.NotFound,
        })
        return [undefined, false]
      }
      return [info, true]
    }
  )
}

router.post("/video/download", (_, ctx) => {
  const body = ctx?.body as DownloadInfo & VideoPostOptions | undefined | null
  if (!body) return { status: 400, statusText: "Missing Options", body: "Missing Options"}

  const { requestId } = ctx

  const baseStatus: Omit<StatusMessage, 'status'> = {
    id: requestId,
    isList: false,
    type: "video",
    url: body.url
  } as const


  const pipe = pipeWhile<[], undefined>(
    baseDownloadRequestPipe(body, requestId, baseStatus),
    (info: RequireSome<YouTubeInfo, 'id'>) => {
      const currentStatus = {
        ...baseStatus,
        author: info.channel,
        title: info.title,
        ytID: info.id,
        status: DownloadStatus.Downloading,
      }

      if (shouldAbortDownload(currentStatus)) {
        statusKeeper.removeStatus(requestId)
        return [undefined, false]
      }


      statusKeeper.setStatus(requestId, currentStatus)

      return youtubeDownloader.downloadVideo(info.id, body).then(() => [info, true])
    },
    (info: YouTubeInfo) => {
      statusKeeper.setStatus(requestId, {
        ...baseStatus,
        ...addYtInfoToStatus(info),
        status: DownloadStatus.Done,
      })
      return [undefined, true]
    }
  )

  pipe().catch(e => {
    statusKeeper.setStatus(requestId, {
      ...baseStatus,
      status: DownloadStatus.Error
    })

    console.error(e)
  })

  return {
    status: 200,
    statusText: "Download request registered",
    body: "Download request registered",
  }
})

router.post("/video-list/download", (_, ctx) => {
  const body = ctx?.body as DownloadInfo & VideoPostOptions & ListPostOptions | undefined | null

  if (!body) return { status: 400, statusText: "Missing Options", body: "Missing Options"}

  const { requestId } = ctx

  const baseStatus: Omit<StatusMessage, 'status'> = {
    id: requestId,
    isList: true,
    type: "video",
    url: body.url
  } as const

  const infoToStatusOpts: Parameters<typeof addYtInfoToStatus>[1] = {
    isPlaylist: true,
    usePlaylistTitleAsAuthor: body.saveUnderPlaylistName
  }


  const pipe = pipeWhile(
    baseDownloadRequestPipe(body, requestId, baseStatus),
    (info: RequireSome<YouTubeInfo, 'playlistId'>) => {
      const currentStatus = {
        ...baseStatus,
        ...addYtInfoToStatus(info, infoToStatusOpts),
        status: DownloadStatus.Downloading
      }
      if (shouldAbortDownload(currentStatus)) {
        statusKeeper.removeStatus(requestId)
        return [undefined, false]
      }

      statusKeeper.setStatus(requestId, currentStatus)

      return youtubeDownloader.downloadVideoList(info.playlistId, body).then(() => [info, true])
    },
    (info: YouTubeInfo) => {
      statusKeeper.setStatus(requestId, {
        ...baseStatus,
        ...addYtInfoToStatus(info, infoToStatusOpts),
        status: DownloadStatus.Done
      })

      return [undefined, true]
    }
  )

  pipe().catch(e => {
    console.error(e)

    statusKeeper.setStatus(requestId, {
      ...baseStatus,
      status: DownloadStatus.Error,
    })
  })
  return {
    status: 200,
    statusText: "Download requested",
    body: "Download requested",
  }
})

router.post("/music/download", (_, ctx) => {
  const body = ctx?.body as DownloadInfo & MusicPostOptions | undefined | null

  if (!body) return { status: 400, statusText: "Missing Options", body: "Missing Options"}

  const { requestId } = ctx

  const baseStatus: Omit<StatusMessage, 'status'> = {
    id: requestId,
    isList: false,
    type: "audio",
    url: body.url
  } as const

  const pipe = pipeWhile<[], undefined>(
    baseDownloadRequestPipe(body, requestId, baseStatus),
    (info: RequireSome<YouTubeInfo, 'id'>) => {
      const currentStatus = {
        ...baseStatus,
        author: info.channel,
        title: info.title,
        ytID: info.id,
        status: DownloadStatus.Downloading,
      }

      if (shouldAbortDownload(currentStatus)) {
        statusKeeper.removeStatus(requestId)
        return [undefined, false]
      }

      statusKeeper.setStatus(requestId, {
        ...baseStatus,
        ...addYtInfoToStatus(info),
        status: DownloadStatus.Downloading,
      })

      return youtubeDownloader.downloadSong(info.id, body).then(() => [info, true])
    },
    (info: YouTubeInfo) => {
      statusKeeper.setStatus(requestId, {
        ...baseStatus,
        ...addYtInfoToStatus(info),
        status: DownloadStatus.Done
      })

      return [undefined, true]
    }
  )

  pipe().catch(e => {
    console.error(e)
    statusKeeper.setStatus(requestId, {
      ...baseStatus,
      status: DownloadStatus.Error
    })
  })

  return {
    status: 200,
    statusText: "Download requested",
    body: "Download requested",
  }
})

router.post("/music-list/download", (_, ctx) => {
  const body = ctx?.body as DownloadInfo & MusicPostOptions & ListPostOptions | undefined | null

  if (!body) return { status: 400, statusText: "Missing Options", body: "Missing Options"}

  const { requestId } = ctx

  const addYtInfoOpts = { isPlaylist: true, usePlaylistTitleAsAuthor: body.saveUnderPlaylistName }

  const baseStatus: Omit<StatusMessage, 'status'> = {
    id: requestId,
    isList: true,
    type: "audio",
    url: body.url
  } as const

  const pipe = pipeWhile<[], undefined>(
    baseDownloadRequestPipe(body, requestId, baseStatus),
    (info: RequireSome<YouTubeInfo, 'playlistId'>) => {
      const currentStatus = {
        ...baseStatus,
        author: info.channel,
        title: info.title,
        ytID: info.id,
        status: DownloadStatus.Downloading,
      }

      if (shouldAbortDownload(currentStatus)) {
        statusKeeper.removeStatus(requestId)
        return [undefined, false]
      }

      statusKeeper.setStatus(requestId, {
        ...baseStatus,
        ...addYtInfoToStatus(info, addYtInfoOpts),
        status: DownloadStatus.Downloading,
      })

      return youtubeDownloader.downloadMusicList(info.playlistId, body).then(() => [info, true])
    },
    (info: YouTubeInfo) => {
      statusKeeper.setStatus(requestId, {
        ...baseStatus,
        ...addYtInfoToStatus(info, addYtInfoOpts),
        status: DownloadStatus.Done
      })

      return [undefined, true]
    }
  )

  pipe().catch(e => {
    console.error(e)
    statusKeeper.setStatus(requestId, {
      ...baseStatus,
      status: DownloadStatus.Error
    })
  })

  return {
    status: 200,
    statusText: "Download requested",
    body: "Download requested",
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

