/**
 * Returns true if any of the given list are truthy, or, if a predicate is given,
 * returns true using the predicate as the decider
 * @param {T[]} l
 * @param {(item: T) => any} [predicate]
 * @template {any} T
 */
const any = (l, predicate) => {
  for (const item of l) {
    if (predicate ? predicate(item) : item) return true
  }
  return false
}

/**
 * @typedef {{
 *  url: string
 *  type: 'video' | 'music',
 *  isList: boolean,
 *  listSaveLocation: 'uploader' | 'channel',
 *  music: {
 *    removeNoneMusic: boolean
 *  },
 *  video: {
 *    includeSubtitles: boolean
 *    removeSponsorSegment: boolean
 *  }
 * }} DownloadOptions
 */

const BASE_URL = `${window.location.protocol}//${window.location.host}`

/** @type {DownloadHandler} */
let downloadHandler

window.onload = () => {
  console.log("hi")
  handleListHiding()
  // downloadHandler = new DownloadHandler(BASE_URL)
  // console.log({ downloadHandler })

  const buttonDownload = document.getElementById("button-download")

  buttonDownload.onclick = async () => {
    buttonDownload.classList.add("disabled")
    const {
      urlInput,
      videoOptions,
      musicOptions,
      mediaType: {
        radioVideo,
      },
      quantityType: {
        radioList
      },
      listOptions
    } = getAllOptionElements()

    const isVideo = radioVideo.checked
    const isList = radioList.checked
    const typeSelector = `${radioVideo.checked ? 'video' : 'music'}${isList ? '-list' : ''}`
    const url = urlInput.value || ""
    const encodedURL = encodeURIComponent(urlInput.value)

    if (!encodedURL.trim().length) {
      console.warn("Empty URL field, aborting. TODO: Add user notification....")
      return
    }

    /** @type {import('../api/src/yt-dl').YouTubeInfo} */
    let response
    try {
      const infoResponse = await fetch(`${BASE_URL}/api/${typeSelector}/info?url=${encodedURL}`)
      if (infoResponse.status === 404) {
        console.warn(`Couldn't find URL, should have user notification. URL: ${url}.`)
        return
      }

      if (infoResponse.status >= 300 || infoResponse.status < 200) {
        const text = await infoResponse.text
        const statusText = infoResponse.statusText
        throw new Error(`Failed with status of ${infoResponse.status}: ${statusText}. Body: ${text}`)
      }

      response = await infoResponse.json()

    } catch (e) {
      console.error(`Could not get video info for ${url}.`, e)
      return
    } finally {
      buttonDownload.classList.remove("disabled")
    }


    const id = isList ? response.playlistId : response.id

    const body = isVideo ? {
      "removeSponsorSegments": videoOptions.checkVideoOptionsSponsor.checked,
      "includeSubtitles": videoOptions.checkVideoOptionsSubtitles.checked,
    } : {
      "removeNonMusicSegments": musicOptions.checkMusicOptionsNonMusic.checked,
    }

    try {
      const downloadRequestResponse = await fetch(
        `${BASE_URL}/api/${typeSelector}/download/${id}`,
        {
          body,
          method: "POST",
          cache: "no-cache",
        },
      )

      if (downloadRequestResponse.status < 200 || downloadRequestResponse.status >= 300) {
        throw new Error(`Failed with status of ${infoResponse.status}: ${statusText}. Body: ${text}`)
      }
    } catch (e) {
      console.error(`Could not successfully submit download request! (need to add user feedback)`, e)
    }
  }
}

const videoMusicLineChanges = {
  "video": {
    "type-selector-legend": "Amd I downloading a Single Video or a Playlist?",
    "radio-type-selector-single-label": "Single Video"
  },
  "music": {
    "type-selector-legend": "Amd I downloading a Single Song or a Playlist?",
    "radio-type-selector-single-label": "Single Song"
  }
}


const getAllOptionElements = () => {
  /** @type {HTMLInputElement} */
  const urlInput = document.getElementById("url-input")
  /** @type {HTMLInputElement} */
  const radioVideo = document.getElementById("radio-video")
  /** @type {HTMLInputElement} */
  const radioMusic = document.getElementById("radio-music")
  /** @type {HTMLInputElement} */
  const radioSingle = document.getElementById("radio-type-selector-single")
  /** @type {HTMLInputElement} */
  const radioList = document.getElementById("radio-type-selector-list")


  const listOptionsFieldSet = document.getElementById("list-options")
  /** @type {HTMLInputElement} */
  const radioListOptionsChannel = document.getElementById("radio-list-options-channel")
  /** @type {HTMLInputElement} */
  const radioListOptionsUploader = document.getElementById("radio-list-options-uploader")

  /** @type {HTMLFieldSetElement} */
  const videoOptionsFieldSet = document.getElementById("video-options")
  /** @type {HTMLInputElement} */
  const checkVideoOptionsSubtitles = document.getElementById("check-video-options-subtitles")
  /** @type {HTMLInputElement} */
  const checkVideoOptionsSponsor = document.getElementById("check-video-options-sponsor")

  /** @type {HTMLFieldSetElement} */
  const musicOptionsFieldSet = document.getElementById("music-options")
  /** @type {HTMLInputElement} */
  const checkMusicOptionsNonMusic = document.getElementById("check-music-options-non-music")

  return {
    urlInput,
    mediaType: {
      radioVideo,
      radioMusic,
    },
    quantityType: {
      radioList,
      radioSingle,
    },
    listOptions: {
      listOptionsFieldSet,
      radioListOptionsChannel,
      radioListOptionsUploader,
    },
    videoOptions: {
      videoOptionsFieldSet,
      checkVideoOptionsSubtitles,
      checkVideoOptionsSponsor,
    },
    musicOptions: {
      musicOptionsFieldSet,
      checkMusicOptionsNonMusic,
    },
  }
}

const handleListHiding = () => {
  const {
    mediaType: {
      radioVideo,
      radioMusic,
    },
    quantityType: {
      radioList,
      radioSingle,
    },
    listOptions: {
      listOptionsFieldSet,
    },
    videoOptions: {
      videoOptionsFieldSet,
    },
    musicOptions: {
      musicOptionsFieldSet,
    }
  } = getAllOptionElements()

  /** @type {(selectedType: 'video' | 'music')} */
  const handleTypeSelection = selectedType => {
    if (selectedType === 'video') {
      console.log("Hiding music...")
      videoOptionsFieldSet.style.display = "block"
      musicOptionsFieldSet.style.display = "none"
    } else {
      console.log("Hiding video...")
      videoOptionsFieldSet.style.display = "none"
      musicOptionsFieldSet.style.display = "block"
    }

    const elementsToChange = videoMusicLineChanges[selectedType]
    Object.entries(elementsToChange).forEach(([id, text]) => {
      /** @type {HTMLElement} */
      const el = document.getElementById(id)
      for (const child of [...el.childNodes]) {
        if (child instanceof Text && (child.textContent || "").trim()) {
          child.replaceWith(new Text(text))
          break
        }
      }
    })
  }

  const typeOnChange = (ev) => {
    if (ev.target.checked) {
      handleTypeSelection(ev.target.value)
    }
  }

  radioMusic.onchange = typeOnChange
  radioVideo.onchange = typeOnChange

  const listOrSingleOnChange = (ev) => {
    if (ev.target.checked) {
      const selected = ev.target.value
      if (selected === "list") {
        listOptionsFieldSet.style.display = "block"
      } else {
        listOptionsFieldSet.style.display = "none"
      }
    }
  }
  radioList.onchange = listOrSingleOnChange
  radioSingle.onchange = listOrSingleOnChange


}

/**
 * @class
 * @constructor
 * @public
 */
// class DownloadHandler {
//   /**
//    * @type {HTMLDivElement}
//    * @private
//    */
//   parentElement
//   /**
//    * @type {string}
//    * @private
//    */
//   baseUrl
//   /**
//    * @type {{
//    *  [key: string]: {
//    *    type: 'video' | 'song' | 'video-list' | 'song-list',
//    *    title: string,
//    *    key: string,
//    *    id: string,
//    *  }
//    * }}
//    * @private
//    */
//   pendingDownloads
//   /**
//    * @type {{ [key: string]: DownloadOptions }}
//    * @private
//    */
//   pendingInfo
//   /**
//    * @type {number | undefined}
//    * @private
//    */
//   intervalHandle

//   /**
//    * @type {number}
//    * @private
//    */
//   refreshRate

//   /**
//    * @type {{ [key: string]: { message: string, title?: string url?: string } }}
//    * @private
//   */
//   errors

//   /**
//    * 
//    * @param {{
//    *  baseUrl: string,
//    *  parentElement: HTMLDivElement,
//    *  refreshRateMS?: number
//    * }} options 
//    */
//   constructor(options) {
//     const {
//       baseUrl,
//       parentElement,
//       refreshRateMS = 250,
//     } = options
//     this.baseUrl = baseUrl
//     this.parentElement = parentElement
//     this.refreshRate = refreshRateMS
//     this.pendingDownloads = {}
//     this.pendingInfo = {}
//     this.errors = {}
//   }

//   loop() {

//   }

//   start() {
//     if (this.intervalHandle) {
//       console.warn("Cannot start the download handler: it's already running")
//       return
//     }
//     /** @type {() => void} */
//     const boundLoop = this.loop.bind(this)
//     this.intervalHandle = setInterval(boundLoop, this.refreshRate);
//   }

//   /** @type {boolean} */
//   get isRunning() {
//     return this.intervalHandle !== undefined
//   }

//   stop() {
//     if (this.intervalHandle === undefined) {
//       console.warn("Download handler isn't running. Can't stop it again...")
//       return
//     }

//     clearInterval(this.intervalHandle)
//     this.intervalHandle = undefined
//   }

//   /**
//    * Technically we could have multiple of the same URL being downloaded....
//    * This is responsible for returning a key that uniquely identifies all of the different types of downloads we could have
//    * 
//    * @param {DownloadOptions} options 
//    * @param {string} id Either the URL or id of the resource
//    */
//   getKey(options, id) {
//     return `${id}:${options.type}:${options.isList ? 'list' : 'single'}${options.isList ? `:${options.listSaveLocation}` : ''}`
//   }

//   /** @type {(response: Response, key: string, retry: number) => void} */
//   handleInfoResponse(response, key, retry = 0) {
//     const downloadOptions = this.pendingInfo[key]
//     this.pendingInfo[key] = undefined

//     if (response.status === 404) {
//       this.errors[key] = { 
//         message: `Could not get info for ${}`
//       }
//     }
//   }

//   handleRemoveError(key) {
//     throw new Error("NOT IMPLEMENTED")
//   }

//   /** @type {(downloadOptions: DownloadOptions) => void} */
//   startDownload(downloadOptions) {
//     const key = this.getKey(downloadOptions, downloadOptions.url)
//     if (this.pendingInfo[key]) {
//       console.warn("We're currently waiting on info for this item.", key)
//       return
//     }
//     if (any(Object.values(this.pendingDownloads), pd => pd.key === key)) {
//       console.warn("We're currently downloading this item...", key)
//       return
//     }
//     if (this.errors[key]) {
//       this.handleRemoveError(key)
//     }

//     const boundHandleInfoResponse = this.handleInfoResponse.bind(this)
//     this.pendingInfo[key] = { ...downloadOptions }
//     const encodedURL = encodeURIComponent(downloadOptions.url)
//     fetch(
//       `${this.baseUrl}/${downloadOptions.type}${downloadOptions.isList ? '-list' : ''}/info?url=${encodedURL}`,
//       {
//       method: "GET"
//     }).then(resp => {
//       boundHandleInfoResponse(resp, key, downloadOptions)
//     })
//   }
// }

