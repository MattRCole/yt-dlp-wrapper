export const pipeWhile = <P extends unknown[], T extends unknown = undefined>(...fns: ((...args: any[]) => Promise<[any, boolean]> | [any, boolean])[]): (...args: P) => Promise<[T | undefined, boolean]> => {
  let idx: number = 0
  const toPromise = (arg: Promise<[any, boolean]> | [any, boolean]): Promise<[any, boolean]> => arg instanceof Promise ? arg : Promise.resolve(arg)
  const resolve = ([acc, success]: [unknown, boolean]): Promise<[T | undefined, boolean]> => {
    if (!success) return Promise.resolve([undefined, false])

    idx++
    if (idx < fns.length) return toPromise(fns[idx](acc)).then(resolve)

    return Promise.resolve([acc as T, success])
  }


  return (...args: P) => toPromise(fns[idx](...args)).then(resolve)
}