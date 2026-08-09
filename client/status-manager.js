/** @typedef {import('../api/src/status').WSMessage} WSMessage */
/** @typedef {WSMessage[string]} StatusMessage */

/** @typedef {{ size: number, lineSize: number, color: string, bgColor: string }} LoadingOptions */

/** @type {{ [P in keyof LoadingOptions]: string }} **/
const LOADING_STYLE_OPTIONS = {
  bgColor: "--almost-bg-color",
  color: "--positive-color",
  size: "4rem",
  lineSize: "0.5rem",
}

/** @type {(part: number, percent: number, parent: HTMLElement, loadingOptions: LoadingOptions) => HTMLDivElement} */
const addLoadingElement = (part, percent, parent, loadingOptions) => {
  const {
    size, lineSize, color, bgColor
  } = loadingOptions
  const container = document.createElement("div")
  container.className = "loading"
  const canvas = document.createElement("canvas")
  canvas.className = "loading"
  canvas.width = canvas.height = size
  const spanPart = document.createElement("span")
  spanPart.className = "loading"
  spanPart.textContent = `${part + 1}`
  container.append(spanPart)
  container.append(canvas)
  parent.append(container)
  const ctx = canvas.getContext("2d")
  ctx.translate(size / 2, size / 2)
  ctx.rotate(-Math.PI / 2)

  const drawCircle = (circleColor, width, circlePercent) => {
    const radius = (size - width) / 2
    ctx.beginPath()
    ctx.arc(0, 0, radius, 0, Math.PI * 2 * Math.min(Math.max(0, circlePercent), 1))
    ctx.strokeStyle = circleColor
    ctx.lineCap = 'round'
    ctx.lineWidth = width
    ctx.stroke()
  }
  drawCircle(bgColor, lineSize, 1)
  drawCircle(color, lineSize, percent)
}

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


  /** @type {LoadingOptions} */
  computedLoadingOptions

  constructor(parentElement, baseUrl) {
    this.existingDownloadElements = {}
    // this.existingInfoElements = {}
    this.baseUrl = baseUrl
    const wsUrl = `${this.baseUrl}/api/ws`
    let socket = new WebSocket(wsUrl)
    this.parentElement = parentElement
    this.downloadOrder = []
    socket.addEventListener("message", ev => {
      if (ev.data == "ping") {
        socket.send("pong")
        return
      }
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

    this.recomputeStyles()
    document.addEventListener('resize', this.recomputeStyles.bind(this))
  }

  recomputeStyles() {
    const style = window.getComputedStyle(document.body)
    const fontSize = parseInt(style.fontSize.replace('px', ''))
    /** @type {LoadingOptions} */
    const computed = {
      color: style.getPropertyValue(LOADING_STYLE_OPTIONS.color),
      bgColor: style.getPropertyValue(LOADING_STYLE_OPTIONS.bgColor),
      size: fontSize * parseFloat(LOADING_STYLE_OPTIONS.size.replace('rem', '')),
      lineSize: Math.max(1, fontSize * parseFloat(LOADING_STYLE_OPTIONS.lineSize.replace('rem', ''))),
    }
    this.computedLoadingOptions = computed
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
      ;[...(downloadStatusContainer.childNodes)].forEach(node => downloadStatusContainer.removeChild(node))
    for (const downloadKey of [...this.downloadOrder]) {
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
    const statusText = `${statusMessage.status.charAt(0).toUpperCase() + statusMessage.status.slice(1)}: ${statusMessage.title || statusMessage.url}`
    if (statusMessage.status === "downloading") {
      const container = document.createElement('div')
      container.className = 'downloading-progress-container'
      const textEl = document.createElement('p')
      textEl.className = 'downloading-status-text-desc'
      textEl.innerText = statusText
      downloadStatusText.innerText = ""
      container.appendChild(textEl)
      addLoadingElement(statusMessage.part, statusMessage.percent, container, this.computedLoadingOptions)
      downloadStatusText.parentNode.replaceChild(container, downloadStatusText)
    } else {
      downloadStatusText.innerText = statusText
    }
    element.classList = `download-status-item ${statusMessage.status}`
    return element
  }
}

