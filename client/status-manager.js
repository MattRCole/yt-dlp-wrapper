/** @typedef {import('../api/src/status').WSMessage} WSMessage */
/** @typedef {WSMessage[string]} StatusMessage */

export class WSHandler {
  /**
   * @type {{[key: string]: HTMLDivElement}}
   * @private
   */
  existingDownloadElements
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
  /**
   * @type {string}
   * @readonly
   */
  baseUrl

  constructor(parentElement, baseUrl) {
    this.existingDownloadElements = {}
    // this.existingInfoElements = {}
    this.baseUrl = baseUrl
    const wsUrl = `${this.baseUrl}/api/ws`
    let socket = new WebSocket(wsUrl)
    this.parentElement = parentElement
    socket.addEventListener("message", ev => {
      /** @type {WSMessage} */
      const statusData = JSON.parse(ev.data)
      this.downloadOrder = this.rectifyLists(this.downloadOrder, Object.keys(statusData))
      // this.infoOrder = this.rectifyLists(this.infoOrder, Object.keys(statusData.infoStatuses))
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
    console.log(JSON.stringify({ statusData, downloadOrder: this.downloadOrder }))

    const downloadStatuses = statusData

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

  /** @type {(element: HTMLDivElement, statusMessage: StatusMessage) => HTMLDivElement} */
  updateDownloadElement(element, statusMessage) {
    /** @type {HTMLLegendElement} */
    const downloadStatusLegend = element.getElementsByClassName("download-status-legend")[0]
    /** @type {HTMLParagraphElement} */
    const downloadStatusText = element.getElementsByClassName("download-status-text")[0]

    const statusPrefix = (statusMessage.isList ? "📋" : "") + (statusMessage.type === "video" ? "🎥" : "🎶")
    downloadStatusLegend.innerText = `${statusPrefix} ${statusMessage.author || "Unknown Author"}`
    downloadStatusText.innerText = `${statusMessage.status.charAt(0).toUpperCase()+statusMessage.status.slice(1)}: ${statusMessage.title || statusMessage.url}`
    element.classList = `download-status-item ${statusMessage.status}`
    return element
  }
}

