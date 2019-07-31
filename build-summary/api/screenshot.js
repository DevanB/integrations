const { getStore } = require('../lib/mongo')
const mql = require('@microlink/mql')

const getScreenshot = async (url, opts = {}) => {
  const { response, data } = await mql(url, {
    width: 1280,
    height: 800,
    screenshot: true,
    ...opts
  })

  return {
    screenshotUrl: data.screenshot.url,
    headers: response.headers
  }
}

module.exports = async (req, res) => {
  const { screenshotId } = req.query
  const fullPage = ['true', '1', 'yes', 'oui', 'ja'].includes(
    req.query.fullPage
  )

  const store = await getStore()
  const screenshot = await store.findOne({ screenshotId })

  if (!screenshot) {
    console.log(`screenshot does not exists ${screenshotId}`)
    return res.status(400).send()
  }

  try {
    const { screenshotUrl, headers } = await getScreenshot(
      screenshot.routeUrl,
      { fullPage }
    )
    res.setHeader('cache-control', headers['cache-control'])
    return mql.stream(screenshotUrl).pipe(res)
  } catch (err) {
    console.log(`failed to screenshot ${screenshot.routeUrl}`)
    console.error(err)
    return res.status(500).send()
  }
}
