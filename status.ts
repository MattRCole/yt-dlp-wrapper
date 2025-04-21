export enum Status {
  Downloading = "downloading",
  Done = "done",
  Unknown = "unknown",
  Error = "error"
}

class StatusKeeper {
  private superSecretObj: { [k: string]: Status }

  constructor() {
    this.superSecretObj = {}
  }

  getStatus(key: string): Status {
    return this.superSecretObj[key] || Status.Unknown
  }
  setStatus(key: string, status: Status) {
    this.superSecretObj[key] = status
  }
}

export const statusKeeper = new StatusKeeper()
