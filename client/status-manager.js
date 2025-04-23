/** @typedef {import('../api/src/status').WSMessage} WSMessage */

export class WSHandler {
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
  /**
   * @type {string}
   * @readonly
   */
  baseUrl

  constructor(parentElement, baseUrl) {
    this.existingDownloadElements = {}
    this.existingInfoElements = {}
    this.baseUrl = baseUrl
    const wsUrl = `${this.baseUrl}/api/ws`
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

