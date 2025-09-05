import { AkoRouter, AkoContext } from "./ako/router.ts";

export const staticAssetRouter = new AkoRouter<AkoContext<{ requestId: string }>>()
const returnStaticAsset = async (path: string, mime: string) => {

  const asset = await Deno.readFile(path)
  return new Response(asset, {
    headers: {
      "Content-Type": mime,
      "X-Powered-By": "AKO",
    },
    status: 200,
    statusText: "success",
  })
}

const getMimeType = (assetPath: string) => {
  if (assetPath.endsWith('.mjs') || assetPath.endsWith('.js')) return "application/javascript; charset=UTF-8"
  if (assetPath.endsWith(".html")) return "text/html; charset=UTF-8"
  if (assetPath.endsWith(".css")) return "text/css; charset=UTF-8"
  if (assetPath.endsWith(".ico")) return "image/vnd.microsoft.icon"
  if (assetPath.endsWith(".png")) return "image/png"

  throw new Error(`Unknown mimetype for asset: ${assetPath}`)
}

staticAssetRouter.get(/(?<assetName>.*?.(js|mjs|html|css|ico)$)/, async (_, { pathParams = {} }) => {
  const { assetName } = pathParams
  console.log("trying for static assets...", `assetName='${assetName}'`)

  if (!assetName) return { status: 404, statusText: "Not Found" }
  if (assetName.includes("../")) return { status: 400, statusText: "Not Found" }

  const assetPath = `../client/${assetName}`
  const statResult = await Deno.stat(assetPath)
  if (!statResult.isFile) return { status: 404, statusText: "NotFound"}

  const mimeType = getMimeType(assetPath)

  return await returnStaticAsset(assetPath, mimeType)
})

staticAssetRouter.get(/\/?/, () => {
  // handle requests for "/" or "" which means index.html
  return returnStaticAsset("../client/index.html", "text/html; charset=UTF-8")
})
