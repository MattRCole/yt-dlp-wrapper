class BoolArg {}

const INFO_DELIM = crypto.randomUUID().replaceAll("-", "")
const INFO_NULL = crypto.randomUUID().replaceAll("-", "")

const DEFAULT_VID_ARGS = {
  "-f": `bv*+bestaudio[acodec~='(aac|mp4a.*|mp3.*)']`,
  "--merge-output-format": `mkv`,
  "--embed-subs": new BoolArg(),
  "--embed-thumbnail": new BoolArg(),
  "--add-metadata": new BoolArg(),
  "--force-overwrites": new BoolArg(),
  "--sub-langs": "en.*"
} as const

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
  "--restrict-filenames": new BoolArg()
}

const SPONSOR_BLOCK_ARGS = {
  "--sponsorblock-remove": SponsorBlockCategories.Sponsor
} as const

const DEFAULT_MUSIC_ARGS = {

}

enum OutputFormats {
  SingleVideo = `%(channel)s/%(title)s.%(ext)s`,
  SingleChannelPlaylist = `%(channel)s/%(playlist)s/%(playlist_autonumber)s - %(title)s.%(ext)s`,
  MultiChannelPlaylist = `%(uploader)s/%(playlist)s/%(playlist_autonumber)s - %(title)s.%(ext)s`,
}

type VideoId = `VIDdummy${string}type`
type ListId = `LIDdummy${string}type`

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

type YouTubeInfo = {
  id?: VideoId,
  playlistId?: ListId,
  uploader?: string,
  channel?: string,
  duration: number,
  title?: string,
  playlistTitle?: string,
  playlistCount: number

}

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
  constructor() {
    const exeName = Deno.env.get("YTDLW_EXE")
    const exePath = Deno.env.get("YTDLW_EXE_PATH")
    if (!exeName) throw new Error(`Cannot determine ytdlp exe name! YTDLW_EXE=${exeName}`)

    this.exeName = exeName

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
  /** Validates if we have a video id or not */
  public validateVideoId(id: string): id is VideoId {
    return YouTubeDownload.idRegex.test(id)
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
    if (results.code) return undefined

    const stdout = new TextDecoder().decode(results.stdout)
    const convertedOut = stdout.replaceAll(`"`, `\\"`).replaceAll(`${INFO_DELIM}${INFO_NULL}${INFO_DELIM}`, "null").replaceAll(INFO_DELIM, '"')
    const parsedOut = JSON.parse(convertedOut)
    return parsedOut 
  }

  public async downloadVideo(id: VideoId) {
    this.handleUpdate()

    const args = [
      ...makeArgs(DEFAULT_ARGS),
      ...makeArgs(DEFAULT_VID_ARGS),
      ...makeArgs(SPONSOR_BLOCK_ARGS),
      "-o",
      OutputFormats.SingleVideo,
      id
    ]
    console.log({ operation: "Download Video", args })
    const cmd = new Deno.Command(this.exeName, { args })
    return await cmd.output()
  }

  public async downloadList(listId: ListId) {
    this.handleUpdate()

    const args = [
      // TODO: finish this function
    ]
  }
}
