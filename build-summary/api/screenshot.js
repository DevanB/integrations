const { getStore } = require('../lib/mongo')
const { getScreenshot } = require('../lib/screenshot')

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
    const file = await getScreenshot(screenshot.routeUrl, { fullPage })
    res.setHeader('content-type', 'image/png')
    res.setHeader('cache-control', 'immutable,max-age=31536000')
    return res.status(200).send(file)
  } catch (err) {
    console.log(`failed to screenshot ${screenshot.routeUrl}`)
    console.error(err)
    return res.status(500).send()
  }
}
