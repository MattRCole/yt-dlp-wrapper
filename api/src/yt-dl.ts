import { YouTubeInfo, VideoId, ListId, VideoPostOptions, ListPostOptions, MusicPostOptions } from "./types.ts"

class BoolArg {}

const INFO_DELIM = crypto.randomUUID().replaceAll("-", "")
const INFO_NULL = crypto.randomUUID().replaceAll("-", "")

const DEFAULT_VID_ARGS = {
  "-f": `bv*+bestaudio[acodec~='(aac|mp4a.*|mp3.*)']`,
  "--merge-output-format": `mkv`,
  "--add-metadata": new BoolArg(),
} as const

const INCLUDE_SUBTITLES = {
  "--embed-subs": new BoolArg(),
  "--sub-langs": "en.*",
  "--convert-subs": "ass",
}

enum SponsorBlockCategories {
  Sponsor = "sponsor",
  Intro = "intro",
  Outro = "outro",
  SelfPromotion = "selfpromo",
  Preview = "preview",
  Filler = "filler",
  Interaction = "interaction",
  MusicOffTopic = "music_offtopic",
  POIHighlight = "poi_highlight",
  Chapter = "chapter",
  All = "all"
}

const DEFAULT_ARGS = {
  "--restrict-filenames": new BoolArg(),
  "--embed-thumbnail": new BoolArg(),
  "--force-overwrites": new BoolArg(),
}

const SPONSOR_BLOCK_ARGS = {
  "--sponsorblock-remove": SponsorBlockCategories.Sponsor
} as const

const NON_MUSIC_BLOCK_ARGS = {
  "--sponsorblock-remove": SponsorBlockCategories.MusicOffTopic
} as const

const DEFAULT_MUSIC_ARGS = {
  "--extract-audio": new BoolArg(),
  "--audio-format": "mp3",
  "--audio-quality": "0",
}

const SAFETY_ARGS = {
  "--no-exec": new BoolArg(),
}

enum OutputFormats {
  SingleVideo = `%(channel)s/%(title)s.%(ext)s`,
  SingleChannelPlaylist = `%(channel)s/%(playlist)s/%(playlist_autonumber)s - %(title)s.%(ext)s`,
  MultiChannelPlaylist = `playlists/%(playlist)s/%(playlist_autonumber)s - %(title)s.%(ext)s`,
}

class InfoArg {
  public name: string
  public isNumber: boolean
  constructor(options: {
    isNumber?: boolean,
    name: string
  }) {
    const {
      isNumber = false,
      name,
    } = options
    this.name = name
    this.isNumber = isNumber
  }

  public getCmdStr(key: string) {
    const keyStr = `${INFO_DELIM}${key}${INFO_DELIM}`
    if (this.isNumber) {
      return `${keyStr}: %(${this.name}|0)d`
    }
    return `${keyStr}: ${INFO_DELIM}%(${this.name}|${INFO_NULL})s${INFO_DELIM}`
  }
}

const INFO_FORMAT_ARGS = {
  id: new InfoArg({ name: "id" }),
  playlistId: new InfoArg({ name: "playlist_id"}),
  uploader: new InfoArg({ name: "uploader"}),
  channel: new InfoArg({ name: "channel" }),
  duration: new InfoArg({ name: "duration", isNumber: true }),
  title: new InfoArg({ name: "title"}),
  playlistCount: new InfoArg({ name: "playlist_count", isNumber: true }),
  playlistTitle: new InfoArg({ name: "playlist_title" }),
} as const

const makeArgs = (args: {[key: string]: string | BoolArg }): string[] => {
  return Object.entries(args).flatMap(([k, val]) => val instanceof BoolArg ? k : [k, val])
}

export class YouTubeDownloadInvalidIdError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options)
  }
}

export class YouTubeDownload {
  private lastUpdateTime: Date
  private readonly exeName: string
  private readonly videoFolderPath: string
  private readonly musicFolderPath: string
  constructor() {

    const exeName = Deno.env.get("YTDLW_EXE")
    const exePath = Deno.env.get("YTDLW_EXE_PATH")
    const videoFolderPath = Deno.env.get("YTDLW_VIDEO")
    const musicFolderPath = Deno.env.get("YTDLW_MUSIC")

    if (!videoFolderPath || !musicFolderPath) {
      throw new Error(`Either music or video path is not defined! videoPath: ${videoFolderPath}, musicPath: ${musicFolderPath}`)
    }
    if (!exeName) throw new Error(`Cannot determine ytdlp exe name! YTDLW_EXE=${exeName}`)

    this.exeName = exeName
    this.videoFolderPath = videoFolderPath
    this.musicFolderPath = musicFolderPath

    let lastUpdateTime: Date | undefined

    if (exePath) {
      const { mtime } = Deno.statSync(exePath)

      mtime && (lastUpdateTime = mtime)
    }

    this.lastUpdateTime = lastUpdateTime || new Date(2024, 0, 1)

    this.handleUpdate()
  }

  private async handleUpdate(): Promise<void> {
    const now = new Date()
    const secondsDelta = (now.getTime() - this.lastUpdateTime.getTime()) / 1000
    if (secondsDelta > 24*60*60) {
      console.log("Updating exe...")
      const res = await new Deno.Command(this.exeName, { args: ["-U"]}).output()
      if (res.code) {
        console.log("Error with updating!!!")
        console.log("stdout:\n" + new TextDecoder().decode(res.stdout))
        console.log("stderr:\n" + new TextDecoder().decode(res.stderr))
      }
    }
    return
  }

  private static idRegex = /[A-Za-z0-9_-]{11}/
  private static listIdRegex = /[A-Za-z0-9_-]{10,50}/
  /** Validates if we have a video id or not */
  public validateVideoId(id: string): id is VideoId {
    return YouTubeDownload.idRegex.test(id)
  }
  public validateListId(id: string): id is ListId {
    return YouTubeDownload.listIdRegex.test(id)
  }

  public async getInfo(url: string): Promise<YouTubeInfo | undefined> {
    this.handleUpdate()
    const templateStr = `{ ${Object.entries(INFO_FORMAT_ARGS).map(([k, arg]) => arg.getCmdStr(k)).join(", ")} }`
    console.log({ templateStr })
    const cmd = new Deno.Command(this.exeName, { args: [
      "--print",
      templateStr,
      url
    ]})
    const results = await cmd.output()
    const decoder = new TextDecoder()
    const stdout = decoder.decode(results.stdout)
    if (results.code) {
      const stderr = decoder.decode(results.stderr)
      console.error({
        msg: "Potential problem retrieving data.",
        code: results.code,
        stderr,
        stdout,
      })
      return undefined
    }

    // Only return the first response if applicable
    const convertedOut = stdout.replaceAll(`"`, `\\"`).replaceAll(`${INFO_DELIM}${INFO_NULL}${INFO_DELIM}`, "null").replaceAll(INFO_DELIM, '"').split("\n")[0]
    try {
      const parsedOut = JSON.parse(convertedOut)
      return parsedOut 
    } catch (e) {
      console.error({ stdout, convertedOut })
      throw e
    }
  }

  public async downloadVideo(id: VideoId, videoOptions: VideoPostOptions) {
    this.handleUpdate()

    const args = [
      ...makeArgs(DEFAULT_ARGS),
      ...makeArgs(DEFAULT_VID_ARGS),
      ...(videoOptions.removeSponsorSegments? makeArgs(SPONSOR_BLOCK_ARGS) : []),
      ...(videoOptions.includeSubtitles ? makeArgs(INCLUDE_SUBTITLES) : []),
      "-o",
      `${this.videoFolderPath}/${OutputFormats.SingleVideo}`,
      ...makeArgs(SAFETY_ARGS),
      id
    ]
    console.log({ operation: "Download Video", args })
    const cmd = new Deno.Command(this.exeName, { args })
    return await cmd.output()
  }

  public async downloadSong(id: VideoId, musicOptions: MusicPostOptions) {
    this.handleUpdate()

    const args = [
      ...makeArgs(DEFAULT_ARGS),
      ...makeArgs(DEFAULT_MUSIC_ARGS),
      ...(musicOptions.removeNonMusicSegments ? makeArgs(NON_MUSIC_BLOCK_ARGS) : []),
      "-o",
      `${this.musicFolderPath}/${OutputFormats.SingleVideo}`,
      ...makeArgs(SAFETY_ARGS),
      id
    ]
    console.log({ operation: "Download Song", args })
    const cmd = new Deno.Command(this.exeName, { args })
    return await cmd.output()
  }

  public async downloadVideoList(listId: ListId, options: VideoPostOptions & ListPostOptions) {
    this.handleUpdate()
    const outputPath = `${this.videoFolderPath}/${options.saveUnderPlaylistName ? OutputFormats.MultiChannelPlaylist : OutputFormats.SingleChannelPlaylist}`

    const args = [
      ...makeArgs(DEFAULT_ARGS),
      ...makeArgs(DEFAULT_VID_ARGS),
      ...(options.includeSubtitles ? makeArgs(INCLUDE_SUBTITLES) : []),
      ...(options.removeSponsorSegments ? makeArgs(SPONSOR_BLOCK_ARGS) : []),
      ...makeArgs(SAFETY_ARGS),
      "-o",
      outputPath,
      listId
    ]
    console.log({ operation: "Download Video Playlist", args })
    const cmd = new Deno.Command(this.exeName, { args })
    return await cmd.output()
  }

  public async downloadMusicList(listId: ListId, options: MusicPostOptions & ListPostOptions) {
    this.handleUpdate()
    const outputPath = `${this.musicFolderPath}/${options.saveUnderPlaylistName ? OutputFormats.MultiChannelPlaylist : OutputFormats.SingleChannelPlaylist}`

    const args = [
      ...makeArgs(DEFAULT_ARGS),
      ...makeArgs(DEFAULT_MUSIC_ARGS),
      ...(options.removeNonMusicSegments ? makeArgs(NON_MUSIC_BLOCK_ARGS) : []),
      ...makeArgs(SAFETY_ARGS),
      "-o",
      outputPath,
      listId
    ]
    console.log({ operation: "Download Music Playlist", args })
    const cmd = new Deno.Command(this.exeName, { args })
    return await cmd.output()
  }
}
