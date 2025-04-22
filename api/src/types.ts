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
  id: string,
  type: "video" | "audio",
  isList: boolean,
  title: string,
  author: string,
}

export type VideoPostOptions = {
    removeSponsorSegments: boolean,
    includeSubtitles: boolean,
  } 
export type MusicPostOptions = {
    removeNonMusicSegments: boolean,
  }

export type ListPostOptions = {
  saveUnderUploaderName: boolean
}
