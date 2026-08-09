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
  id: string;
  author?: string;
  title?: string;
  ytID?: string;
  status: DownloadStatus;
  error?: string;
  part: number;
  percent: number;
};

export type GetSimilarStatusesArgs = Omit<DownloadInfo, "url"> & {
  ytID: string;
};

export type WSMessage = {
  [k: string]: StatusMessage;
};

class StatusKeeper {
  private statuses: { [k: string]: StatusMessage | undefined };
  private clients: WebSocket[];

  constructor() {
    this.statuses = {};
    this.clients = [];
  }

  private getUpdateMessage(): string {
    return JSON.stringify(
      Object.entries(this.statuses).reduce(
        (acc, [k, v]) => ({ ...acc, ...(v === undefined ? {} : { [k]: v }) }),
        {},
      ),
    );
  }

  private updateClients() {
    const message = this.getUpdateMessage();
    for (const client of [...this.clients]) {
      if (client.readyState !== client.OPEN) continue;

      client.send(message);
    }
  }

  addClient(client: WebSocket) {
    this.clients.push(client);
    const timeout = setInterval(() => {
      if (client.readyState == client.OPEN) {
        client.send("ping");
      }
    }, 1000);
    const removeClient = () => {
      const index = this.clients.indexOf(client);
      clearInterval(timeout);
      if (index === -1) {
        console.warn("Trying to remove a non-existent client");
        return;
      }
      this.clients.splice(index, 1);
    };
    client.addEventListener("close", removeClient);
    client.addEventListener("error", removeClient);
    client.addEventListener("open", () => client.send(this.getUpdateMessage()));
    client.addEventListener("message", (e) => {
      if (e.data == "pong") return;
      console.log(`Got message from client:: ${e.data}`);
    });
  }

  setStatus(id: string, statusMessage: StatusMessage) {
    const existingStatus = this.statuses[id] ||
      { part: 0, percent: 0 } as StatusMessage;
    this.statuses[id] = { ...existingStatus, ...statusMessage };

    const status = statusMessage.status;

    const validPendingStatuses = [
      DownloadStatus.Fetching,
      DownloadStatus.Downloading,
    ];

    // If we've downloaded the thing, or we've errored out, clear the status after 5 minutes.
    if (!validPendingStatuses.includes(status)) {
      setTimeout(() => {
        if (
          this.statuses[id] === undefined ||
          validPendingStatuses.includes(this.statuses[id].status)
        ) {
          return;
        }

        this.statuses[id] = undefined;
      }, 5 * 60 * 1000);
    }
    this.updateClients();
  }

  getSimilarStatuses(
    searchParams: GetSimilarStatusesArgs,
    omitId: string | undefined = undefined,
  ): StatusMessage[] {
    return Object.values(this.statuses).filter((status) => {
      return status !== undefined && status.id !== omitId &&
        status?.ytID === searchParams.ytID &&
        status.isList === searchParams.isList &&
        status.type == searchParams.type;
    }).map((s) => ({ ...s } as StatusMessage));
  }

  removeStatus(id: string) {
    if (this.statuses[id] !== undefined) this.statuses[id] = undefined;
  }

  handleDownloadProgress(id: string, partNumber: number, percent: number) {
    const existingStatus = this.statuses[id];
    if (
      !existingStatus || existingStatus.status !== DownloadStatus.Downloading
    ) {
      // Either we couldn't find it, or it's not downloading any more...
      return;
    }

    // if it's less than zero, we're not going to update anything...
    if (percent < 0) return;
    existingStatus.part = partNumber;
    existingStatus.percent = percent;
    this.updateClients();
  }
}

export const statusKeeper = new StatusKeeper();
