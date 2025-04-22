import { DownloadInfo } from "./types.ts";

export enum DownloadStatus {
  Downloading = "downloading",
  Done = "done",
  Unknown = "unknown",
  Error = "error",
}

export enum InfoStatus {
  Fetching = "fetching",
  NotFound = "not-found",
  Done = "done",
  Error = "error"
}

export type WSMessage = {
  infoStatuses: { [k: string]: InfoStatus },
  downloadStatuses: { [k: string]: { status: DownloadStatus, info: DownloadInfo }}
}

class StatusKeeper {
  private downloadStatuses: { [k: string]: { status: DownloadStatus, info: DownloadInfo } | undefined }
  private infoStatuses: { [k: string]: InfoStatus | undefined }
  private clients: WebSocket[]

  constructor() {
    this.downloadStatuses = {}
    this.infoStatuses = {}
    this.clients = []
  }

  private getUpdateMessage(): string {
    return JSON.stringify({
      downloadStatuses: Object.entries(this.downloadStatuses).reduce((acc, [k, v]) => ({ ...acc, ...(v === undefined ? {} : { [k]: v })}), {}),
      infoStatuses: Object.entries(this.infoStatuses).reduce((acc, [k, v]) => ({ ...acc, ...(v === undefined ? {} : { [k]: v })}), {}),
    })
  }
  private updateClients() {
  const message = this.getUpdateMessage()
    for (const client of [...this.clients]) {
      if (client.readyState !== client.OPEN) continue

      client.send(message)
    }
  }

  private makeDownloadKey(key: string, info: DownloadInfo) {
    return `${key}:${info.type}:${info.isList ? "list" : "single"}`
  }

  addClient(client: WebSocket) {
    this.clients.push(client)
    const removeClient = () => {
      const index = this.clients.indexOf(client)
      if (index === -1) {
        console.warn("Trying to remove a non-existent client")
        return
      }
      this.clients.splice(index, 1)
    }
    client.addEventListener("close", removeClient)
    client.addEventListener("error", removeClient)
    client.addEventListener("open", () => client.send(this.getUpdateMessage()))
  }

  setInfoStatus(url: string, status: InfoStatus) {
    this.infoStatuses[url] = status

    if (status !== InfoStatus.Fetching) {
      setTimeout(() => {
        if (this.infoStatuses[url] === InfoStatus.Fetching) {
          return
        }

        this.infoStatuses[url] = undefined
      }, 5*60*1000)
    }
    this.updateClients()
  }
  startDownloadStatus(key: string, info: DownloadInfo): string {
    const pKey = this.makeDownloadKey(key, info)

    if (this.downloadStatuses[pKey]) {
      console.warn(`Re-starting download status for ${pKey}`)
    }

    this.downloadStatuses[pKey] = {
      status: DownloadStatus.Downloading,
      info,
    }

    this.updateClients()
    return pKey
  }
  setDownloadStatus(pKey: string, status: DownloadStatus) {
    if (!this.downloadStatuses[pKey]) {
      console.warn(`Cannot set status of unknown pkey: ${pKey}`)
      return
    }

    this.downloadStatuses[pKey].status = status
    this.updateClients()
    if (status === DownloadStatus.Done || status === DownloadStatus.Error) {
      setTimeout(() => {
        const status = this.downloadStatuses[pKey]?.status || DownloadStatus.Unknown
        if ([DownloadStatus.Done, DownloadStatus.Error].includes(status)) {
          this.downloadStatuses[pKey] = undefined
        }
      }, 5*60*1000)
    }
  }
}

export const statusKeeper = new StatusKeeper()
