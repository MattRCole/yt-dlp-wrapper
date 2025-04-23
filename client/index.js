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

let wsHandler

window.onload = () => {
  console.log("hi")
  handleListHiding()
  // downloadHandler = new DownloadHandler(BASE_URL)
  // console.log({ downloadHandler })

  const buttonDownload = document.getElementById("button-download")

  buttonDownload.onclick = handleDownload(buttonDownload)

  wsHandler = new WSHandler(document.getElementById("general-status-container"))
}

/** @type {(buttonDownload: HTMLInputElement) => (() => Promise<void>)} */
const handleDownload = buttonDownload => async () => {
  buttonDownload.disabled = true
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
  const encodedURL = encodeURIComponent(url)

  if (!encodedURL.trim().length) {
    console.warn("Empty URL field, aborting. TODO: Add user notification....")
    return
  }

  /** @type {import('../api/src/types').YouTubeInfo} */
  let response
  try {
    const infoResponse = await fetch(`${BASE_URL}/api/url/info?url=${encodedURL}`)
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
    buttonDownload.disabled = false
    buttonDownload.classList.remove("disabled")
  }


  const id = isList ? response.playlistId : response.id

  const baseBody = {
    id,
    type: isVideo ? "video" : "audio",
    isList,
    title: isList ? response.playlistTitle : response.title,
    author: !isList ? response.channel : listOptions.radioListOptionsChannel.checked ? response.channel : response.uploader,
  }
  const mediaOptions = isVideo ? {
    "removeSponsorSegments": videoOptions.checkVideoOptionsSponsor.checked,
    "includeSubtitles": videoOptions.checkVideoOptionsSubtitles.checked,
  } : {
    "removeNonMusicSegments": musicOptions.checkMusicOptionsNonMusic.checked,
  }

  const listBodyOptions = !isList ? {} : {
    "saveUnderUploaderName": listOptions.radioListOptionsChannel.checked
  }



  try {
    const downloadRequestResponse = await fetch(
      `${BASE_URL}/api/${typeSelector}/download/${id}`,
      {
        body: JSON.stringify({ ...mediaOptions, ...baseBody, ...listBodyOptions, }),
        method: "POST",
        cache: "no-cache",
        headers: { "Content-Type": "application/json" }
      },
    )

    if (downloadRequestResponse.status < 200 || downloadRequestResponse.status >= 300) {
      throw new Error(`Failed with status of ${infoResponse.status}: ${statusText}. Body: ${text}`)
    }
  } catch (e) {
    console.error(`Could not successfully submit download request! (need to add user feedback)`, e)
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

/** @typedef {import('../api/src/status').WSMessage} WSMessage */

class WSHandler {
  /**
   * @type {{[key: string]: HTMLDivElement}}
   * @private
   */
  existingInfoElements
  /**
   * @type {{[key: string]: HTMLDivElement}}
   * @private
   */
  existingDownloadElements
  /**
   * @type {string[]}
   * @private
   */
  infoOrder
  /**
   * @type {string[]}
   * @private
   */
  downloadOrder
  /**
   * @type {HTMLDivElement}
   * @private
   */
  parentElement

  constructor(parentElement) {
    this.existingDownloadElements = {}
    this.existingInfoElements = {}
    const wsUrl = `${BASE_URL}/api/ws`
    let socket = new WebSocket(wsUrl)
    this.parentElement = parentElement
    socket.addEventListener("message", ev => {
      /** @type {WSMessage} */
      const statusData = JSON.parse(ev.data)
      this.downloadOrder = this.rectifyLists(this.downloadOrder, Object.keys(statusData.downloadStatuses))
      this.infoOrder = this.rectifyLists(this.infoOrder, Object.keys(statusData.infoStatuses))
      this.updateElements(statusData)
    })
    socket.addEventListener("close", ev => {
      setTimeout(() => {
        // Retry
        socket = new WebSocket(wsUrl)
      }, 100)
    })
  }

  rectifyLists(myList, newList) {
    return [...newList].sort((a, b) => {
      const aIndex = myList.indexOf(a)
      const bIndex = myList.indexOf(b)
      if ((aIndex === -1) ^ (bIndex === -1)) {
        return aIndex === -1 ? -1 : 1
      }

      // Either they both exist in the list, so we'll keep existing order
      // or they both don't, in which case we'll return a 0 which is acceptable
      return aIndex - bIndex
    })
  }
  /** @type {(statusData: WSMessage) => void} */
  updateElements(statusData) {
    console.log(JSON.stringify({ statusData, downloadOrder: this.downloadOrder, infoOrder: this.infoOrder }))
    const { downloadStatuses, infoStatuses } = statusData

    /** @type {HTMLDivElement} */
    const infoStatusContainer = this.parentElement.getElementsByClassName("info-status-container")[0]
    // const infoStatusContainer = this.parentElement.getElementById("info-status-container")
    const oldInfoKeys = Object.keys(this.existingInfoElements)
    ; [...(infoStatusContainer.childNodes)].forEach(node => infoStatusContainer.removeChild(node))

    for(const infoKey of [...this.infoOrder]) {
      console.log(infoKey)
      const oldInfoKeyIndex = oldInfoKeys.indexOf(infoKey)
      const infoStatus = infoStatuses[infoKey]
      if (oldInfoKeyIndex >= 0) {
        oldInfoKeys.splice(oldInfoKeyIndex, 1)
      }

      const infoElement = this.existingInfoElements[infoKey] || document.createElement("div")

      infoElement.innerText = `${infoStatus.charAt(0).toUpperCase() + infoStatus.slice(1)}: ${infoKey}`
      infoElement.classList = `info-status-item ${infoStatus}`
      infoStatusContainer.append(infoElement)
    }

    oldInfoKeys.forEach(key => delete this.existingInfoElements[key])

    const oldDownloadKeys = Object.keys(this.existingDownloadElements)
    /** @type {HTMLDivElement} */
    const downloadStatusContainer = this.parentElement.getElementsByClassName("download-status-container")[0]
    ; [...(downloadStatusContainer.childNodes)].forEach(node => downloadStatusContainer.removeChild(node))
    for(const downloadKey of [...this.downloadOrder]) {
      const oldDownloadKeyIndex = oldDownloadKeys.indexOf(downloadKey)

      if (oldDownloadKeyIndex >= 0) {
        oldDownloadKeys.splice(oldDownloadKeyIndex, 1)
      }

      const info = downloadStatuses[downloadKey]
      const element = this.existingDownloadElements[downloadKey] || this.initializeDownloadElement()
      this.updateDownloadElement(element, info)
      downloadStatusContainer.appendChild(element)
    }
    // Remove elements that we're no longer tracking
    oldDownloadKeys.forEach(key => { delete this.downloadOrder[key] })
  }

  /**
   * Returns an empty element
   * @type {(info: WSMessage['downloadStatuses'][string]) => HTMLDivElement}
   */
  initializeDownloadElement() {
    /** @type {HTMLDivElement} */
    const templateDownloadStatusItem = document.getElementById("template-download-status-item")

    /** @type {HTMLDivElement} */
    const downloadStatusItem = templateDownloadStatusItem.cloneNode(true)
    // Don't want to manipulate anything other than this duplicate div
    downloadStatusItem.removeAttribute("id")
    // Unhide the element
    downloadStatusItem.style.display = "block"

    return downloadStatusItem
  }

  /** @type {(element: HTMLDivElement, info: WSMessage['downloadStatuses'][string]) => HTMLDivElement} */
  updateDownloadElement(element, { status, info }) {
    /** @type {HTMLLegendElement} */
    const downloadStatusLegend = element.getElementsByClassName("download-status-legend")[0]
    /** @type {HTMLParagraphElement} */
    const downloadStatusText = element.getElementsByClassName("download-status-text")[0]

    const statusPrefix = (info.isList ? "📋" : "") + (info.type === "video" ? "🎥" : "🎶")
    downloadStatusLegend.innerText = `${statusPrefix} ${info.author}`
    downloadStatusText.innerText = `${status.charAt(0).toUpperCase()+status.slice(1)}: ${info.title}`
    element.classList = `download-status-item ${status}`
    return element
  }
}
