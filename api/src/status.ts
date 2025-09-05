import { DownloadInfo } from "./types.ts";

export enum DownloadStatus {
  Fetching = "fetching",
  NotFound = "not-found",
  Downloading = "downloading",
  Done = "done",
  Unknown = "unknown",
  Error = "error",
}

export type StatusMessage = DownloadInfo & {
  id: string,
  author?: string,
  title?: string,
  ytID?: string,
  status: DownloadStatus
}

export type GetSimilarStatusesArgs = Omit<DownloadInfo, 'url'> & {
  ytID: string,
}

export type WSMessage = {
  [k: string]: StatusMessage
}


class StatusKeeper {
  private statuses: { [k: string]: StatusMessage | undefined }
  private clients: WebSocket[]

  constructor() {
    this.statuses = {}
    this.clients = []
  }

  private getUpdateMessage(): string {
    return JSON.stringify(Object.entries(this.statuses).reduce((acc, [k, v]) => ({ ...acc, ...(v === undefined ? {} : { [k]: v })}), {}))
  }

  private updateClients() {
  const message = this.getUpdateMessage()
    for (const client of [...this.clients]) {
      if (client.readyState !== client.OPEN) continue

      client.send(message)
    }
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

  setStatus(id: string, statusMessage: StatusMessage) {
    const existingStatus = this.statuses[id] || {} as StatusMessage
    this.statuses[id] = { ...existingStatus, ...statusMessage }

    const status = statusMessage.status

    const validPendingStatuses = [DownloadStatus.Fetching, DownloadStatus.Downloading]
    
    // If we've downloaded the thing, or we've errored out, clear the status after 5 minutes.
    if (!validPendingStatuses.includes(status)) {
      setTimeout(() => {
        if (this.statuses[id] === undefined || (this.statuses[id].status) === status) {
          return
        }

        this.statuses[id] = undefined
      }, 5*60*1000)
    }
    this.updateClients()
  }

  getSimilarStatuses(searchParams: GetSimilarStatusesArgs, omitId: string | undefined = undefined): StatusMessage[] {
    return Object.values(this.statuses).filter(status => {
      return status !== undefined && status.id !== omitId && status?.ytID === searchParams.ytID && status.isList === searchParams.isList && status.type == searchParams.type
    }).map(s => ({ ...s } as StatusMessage))
  }

  removeStatus(id: string) {
    if (this.statuses[id] !== undefined) this.statuses[id] = undefined
  }
}

export const statusKeeper = new StatusKeeper()
