export type VideoId = `VIDdummy${string}type`
export type ListId = `LIDdummy${string}type`

export type YouTubeInfo = {
  id?: VideoId,
  playlistId?: ListId,
  uploader?: string,
  channel?: string,
  duration: number,
  title?: string,
  playlistTitle?: string,
  playlistCount: number
}

export type DownloadInfo = {
  url: string,
  type: "video" | "audio",
  isList: boolean,
}

export type VideoPostOptions = {
    removeSponsorSegments: boolean,
    includeSubtitles: boolean,
  } 
export type MusicPostOptions = {
    removeNonMusicSegments: boolean,
  }

export type ListPostOptions = {
  saveUnderPlaylistName: boolean
}

export type RequireSome<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: T[P]
}
