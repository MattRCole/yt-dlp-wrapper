import { TextLineStream } from "@std/streams";

import {
  ListId,
  ListPostOptions,
  MusicPostOptions,
  VideoId,
  VideoPostOptions,
  YouTubeInfo,
} from "./types.ts";

class BoolArg {}

const INFO_DELIM = crypto.randomUUID().replaceAll("-", "");
const INFO_NULL = crypto.randomUUID().replaceAll("-", "");

const DEFAULT_VID_ARGS = {
  "--merge-output-format": `mkv`,
  "--add-metadata": new BoolArg(),
} as const;

const INCLUDE_SUBTITLES = {
  "--embed-subs": new BoolArg(),
  "--sub-langs": "en.*",
  "--convert-subs": "ass",
};

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
  All = "all",
}

const getPotExtractorArgs = (
  baseUrl: string,
): { [k: string]: string | BoolArg } => {
  return { "--extractor-args": `youtubepot-bgutilhttp:base_url=${baseUrl}` };
};

const DEFAULT_ARGS = {
  "--restrict-filenames": new BoolArg(),
  "--embed-thumbnail": new BoolArg(),
  "--force-overwrites": new BoolArg(),
};

const DEFAULT_PROGRESS_ARGS = {
  "--quiet": new BoolArg(),
  "--newline": new BoolArg(),
  "--progress": new BoolArg(),
  "--progress-delta": "1",
  "--progress-template":
    "%(info.id)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s",
};

const SPONSOR_BLOCK_ARGS = {
  "--sponsorblock-remove": SponsorBlockCategories.Sponsor,
} as const;

const NON_MUSIC_BLOCK_ARGS = {
  "--sponsorblock-remove": SponsorBlockCategories.MusicOffTopic,
} as const;

const DEFAULT_MUSIC_ARGS = {
  "--extract-audio": new BoolArg(),
  "--audio-format": "mp3",
  "--audio-quality": "0",
  "--embed-metadata": new BoolArg(),
};

const SAFETY_ARGS = {
  "--no-exec": new BoolArg(),
};

enum OutputFormats {
  SingleVideo = `%(channel)s/%(title)s.%(ext)s`,
  SingleChannelPlaylist =
    `%(channel)s/%(playlist)s/%(playlist_autonumber)s - %(title)s.%(ext)s`,
  MultiChannelPlaylist =
    `playlists/%(playlist)s/%(playlist_autonumber)s - %(title)s.%(ext)s`,
}

class InfoArg {
  public name: string;
  public isNumber: boolean;
  constructor(options: {
    isNumber?: boolean;
    name: string;
  }) {
    const {
      isNumber = false,
      name,
    } = options;
    this.name = name;
    this.isNumber = isNumber;
  }

  public getCmdStr(key: string) {
    const keyStr = `${INFO_DELIM}${key}${INFO_DELIM}`;
    if (this.isNumber) {
      return `${keyStr}: %(${this.name}|0)d`;
    }
    return `${keyStr}: ${INFO_DELIM}%(${this.name}|${INFO_NULL})s${INFO_DELIM}`;
  }
}

const INFO_FORMAT_ARGS = {
  id: new InfoArg({ name: "id" }),
  playlistId: new InfoArg({ name: "playlist_id" }),
  uploader: new InfoArg({ name: "uploader" }),
  channel: new InfoArg({ name: "channel" }),
  duration: new InfoArg({ name: "duration", isNumber: true }),
  title: new InfoArg({ name: "title" }),
  playlistCount: new InfoArg({ name: "playlist_count", isNumber: true }),
  playlistTitle: new InfoArg({ name: "playlist_title" }),
} as const;

const makeArgs = (args: { [key: string]: string | BoolArg }): string[] => {
  return Object.entries(args).flatMap(([k, val]) =>
    val instanceof BoolArg ? k : [k, val]
  );
};

export class YouTubeDownloadInvalidIdError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
  }
}

// This is meant to work with formatted progress updates piped via `TextLineStream`.
// See DEFAULT_PROGRESS_ARGS for the expected template
const handleStatusUpdateParsing = async (
  callback: (partIdx: number, percent) => void,
  stream: ReadableStream<string>,
  isList: boolean,
) => {
  let idx = -1;
  let prev = "|||||";
  for await (const line of stream) {
    const [id, downloadedBytesS, totalBytesS] = line.trim().split("|");
    const marker = isList ? id : totalBytesS;
    if (prev != marker) {
      idx += 1;
      prev = marker;
    }
    const [downloadedBytes, totalBytes] = [
      parseInt(downloadedBytesS),
      parseInt(totalBytesS),
    ];

    if (
      Number.isNaN(downloadedBytes) || Number.isNaN(totalBytes) ||
      totalBytes === 0
    ) {
      callback(idx, -1);
      continue;
    }

    callback(idx, downloadedBytes / totalBytes);
  }
};

export class YouTubeDownload {
  private lastUpdateTime: Date;
  private readonly exeName: string;
  private readonly videoFolderPath: string;
  private readonly musicFolderPath: string;
  private readonly extractorArgs: { [k: string]: string | BoolArg };
  constructor() {
    const exeName = Deno.env.get("YTDLW_EXE");
    const exePath = Deno.env.get("YTDLW_EXE_PATH");
    const videoFolderPath = Deno.env.get("YTDLW_VIDEO");
    const musicFolderPath = Deno.env.get("YTDLW_MUSIC");
    const potServer = Deno.env.get("YTDLW_POT");

    if (!videoFolderPath || !musicFolderPath) {
      throw new Error(
        `Either music or video path is not defined! videoPath: ${videoFolderPath}, musicPath: ${musicFolderPath}`,
      );
    }
    if (!exeName) {
      throw new Error(`Cannot determine ytdlp exe name! YTDLW_EXE=${exeName}`);
    }

    if (!potServer) {
      console.warn(
        "Warning: No PoToken arguments were passed. Extension will not be used.",
      );
    }

    this.exeName = exeName;
    this.videoFolderPath = videoFolderPath;
    this.musicFolderPath = musicFolderPath;
    this.extractorArgs = potServer ? getPotExtractorArgs(potServer) : {};

    let lastUpdateTime: Date | undefined;

    if (exePath) {
      const { mtime } = Deno.statSync(exePath);

      mtime && (lastUpdateTime = mtime);
    }

    this.lastUpdateTime = lastUpdateTime || new Date(2024, 0, 1);

    this.handleUpdate();
  }

  private async handleUpdate(): Promise<void> {
    const now = new Date();
    const secondsDelta = (now.getTime() - this.lastUpdateTime.getTime()) / 1000;
    if (secondsDelta > 24 * 60 * 60) {
      console.log("Updating exe...");
      const res = await new Deno.Command(this.exeName, { args: ["-U"] })
        .output();
      if (res.code) {
        console.log("Error with updating!!!");
        console.log("stdout:\n" + new TextDecoder().decode(res.stdout));
        console.log("stderr:\n" + new TextDecoder().decode(res.stderr));
      }
    }
    return;
  }

  private static idRegex = /[A-Za-z0-9_-]{11}/;
  private static listIdRegex = /[A-Za-z0-9_-]{10,50}/;

  private async handleCommand(
    command: Deno.Command,
    progressCallback: (partIdx: number, progress: number) => void,
    isList: boolean,
  ): Promise<[boolean, string]> {
    const process = command.spawn();
    const stdoutStream = process.stdout.pipeThrough(new TextDecoderStream())
      .pipeThrough(new TextLineStream());
    const [stdErrOut, status, ..._] = await Promise.all([
      process.stderr.text(),
      process.status,
      // set and forget really...
      handleStatusUpdateParsing(progressCallback, stdoutStream, isList),
    ]);
    return [status.success, stdErrOut];
  }
  /** Validates if we have a video id or not */
  public validateVideoId(id: string): id is VideoId {
    return YouTubeDownload.idRegex.test(id);
  }
  public validateListId(id: string): id is ListId {
    return YouTubeDownload.listIdRegex.test(id);
  }

  public async getInfo(url: string): Promise<YouTubeInfo | undefined> {
    this.handleUpdate();
    const templateStr = `{ ${
      Object.entries(INFO_FORMAT_ARGS).map(([k, arg]) => arg.getCmdStr(k)).join(
        ", ",
      )
    } }`;
    console.log({ templateStr });
    const cmd = new Deno.Command(this.exeName, {
      args: [
        ...makeArgs(this.extractorArgs),
        "--print",
        templateStr,
        url,
      ],
    });
    const results = await cmd.output();
    const decoder = new TextDecoder();
    const stdout = decoder.decode(results.stdout);
    if (results.code) {
      const stderr = decoder.decode(results.stderr);
      console.error({
        msg: "Potential problem retrieving data.",
        code: results.code,
        stderr,
        stdout,
      });
      return undefined;
    }

    // Only return the first response if applicable
    const convertedOut = stdout.replaceAll(`"`, `\\"`).replaceAll(
      `${INFO_DELIM}${INFO_NULL}${INFO_DELIM}`,
      "null",
    ).replaceAll(INFO_DELIM, '"').split("\n")[0];
    try {
      const parsedOut = JSON.parse(convertedOut);
      return parsedOut;
    } catch (e) {
      console.error({ stdout, convertedOut });
      throw e;
    }
  }

  public async downloadVideo(
    id: VideoId,
    videoOptions: VideoPostOptions,
    onProgress: (part: number, percent: number) => void,
  ) {
    this.handleUpdate();

    const args = [
      ...makeArgs(DEFAULT_ARGS),
      ...makeArgs(DEFAULT_VID_ARGS),
      ...(videoOptions.removeSponsorSegments
        ? makeArgs(SPONSOR_BLOCK_ARGS)
        : []),
      ...(videoOptions.includeSubtitles ? makeArgs(INCLUDE_SUBTITLES) : []),
      "-o",
      `${this.videoFolderPath}/${OutputFormats.SingleVideo}`,
      ...makeArgs(SAFETY_ARGS),
      ...makeArgs(DEFAULT_PROGRESS_ARGS),
      ...makeArgs(this.extractorArgs),
      id,
    ];
    console.log({ operation: "Download Video", args });
    const cmd = new Deno.Command(this.exeName, {
      args,
      stdout: "piped",
      stderr: "piped",
    });
    return await this.handleCommand(cmd, onProgress, false);
  }

  public async downloadSong(
    id: VideoId,
    musicOptions: MusicPostOptions,
    onProgress: (part: number, percent: number) => void,
  ) {
    this.handleUpdate();

    const args = [
      ...makeArgs(DEFAULT_ARGS),
      ...makeArgs(DEFAULT_MUSIC_ARGS),
      ...(musicOptions.removeNonMusicSegments
        ? makeArgs(NON_MUSIC_BLOCK_ARGS)
        : []),
      "-o",
      `${this.musicFolderPath}/${OutputFormats.SingleVideo}`,
      ...makeArgs(SAFETY_ARGS),
      ...makeArgs(DEFAULT_PROGRESS_ARGS),
      ...makeArgs(this.extractorArgs),
      id,
    ];
    console.log({ operation: "Download Song", args });
    const cmd = new Deno.Command(this.exeName, {
      args,
      stdout: "piped",
      stderr: "piped",
    });
    return await this.handleCommand(cmd, onProgress, false);
  }

  public async downloadVideoList(
    listId: ListId,
    options: VideoPostOptions & ListPostOptions,
    onProgress: (part: number, percent: number) => void,
  ) {
    this.handleUpdate();
    const outputPath = `${this.videoFolderPath}/${
      options.saveUnderPlaylistName
        ? OutputFormats.MultiChannelPlaylist
        : OutputFormats.SingleChannelPlaylist
    }`;

    const args = [
      ...makeArgs(DEFAULT_ARGS),
      ...makeArgs(DEFAULT_VID_ARGS),
      ...(options.includeSubtitles ? makeArgs(INCLUDE_SUBTITLES) : []),
      ...(options.removeSponsorSegments ? makeArgs(SPONSOR_BLOCK_ARGS) : []),
      ...makeArgs(SAFETY_ARGS),
      ...makeArgs(DEFAULT_PROGRESS_ARGS),
      ...makeArgs(this.extractorArgs),
      "-o",
      outputPath,
      listId,
    ];
    console.log({ operation: "Download Video Playlist", args });
    const cmd = new Deno.Command(this.exeName, {
      args,
      stdout: "piped",
      stderr: "piped",
    });
    return await this.handleCommand(cmd, onProgress, true);
  }

  public async downloadMusicList(
    listId: ListId,
    options: MusicPostOptions & ListPostOptions,
    onProgress: (part: number, percent: number) => void,
  ) {
    this.handleUpdate();
    const outputPath = `${this.musicFolderPath}/${
      options.saveUnderPlaylistName
        ? OutputFormats.MultiChannelPlaylist
        : OutputFormats.SingleChannelPlaylist
    }`;

    const args = [
      ...makeArgs(DEFAULT_ARGS),
      ...makeArgs(DEFAULT_MUSIC_ARGS),
      ...(options.removeNonMusicSegments ? makeArgs(NON_MUSIC_BLOCK_ARGS) : []),
      ...makeArgs(SAFETY_ARGS),
      ...makeArgs(DEFAULT_PROGRESS_ARGS),
      "-o",
      outputPath,
      ...makeArgs(this.extractorArgs),
      listId,
    ];
    console.log({ operation: "Download Music Playlist", args });
    const cmd = new Deno.Command(this.exeName, {
      args,
      stdout: "piped",
      stderr: "piped",
    });
    return await this.handleCommand(cmd, onProgress, true);
  }
}
