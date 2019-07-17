const { getStore } = require('../lib/mongo')
const puppeteer = require('puppeteer-core')
const chrome = require('chrome-aws-lambda')

const isDev = process.env.NOW_REGION === 'dev1'

const getOptions = async () => {
  if (isDev) {
    return {
      args: [],
      executablePath:
        process.platform === 'win32'
          ? 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
          : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true
    }
  }

  await Promise.all([
    chrome.font('https://interttf-7l5in8j2v.zeit.sh/Inter-Regular.ttf'),
    chrome.font('https://interttf-7l5in8j2v.zeit.sh/Inter-Bold.ttf'),
    chrome.font('https://interttf-7l5in8j2v.zeit.sh/Inter-Medium.ttf')
  ])

  return {
    args: chrome.args,
    executablePath: await chrome.executablePath,
    headless: chrome.headless
  }
}

let pagePromise

const getPage = async () => {
  if (!pagePromise) {
    const newPage = async () => {
      const options = await getOptions()
      const browser = await puppeteer.launch(options)
      const page = browser.newPage()

      // set default fonts
      const client = await page.target().createCDPSession()
      await client.send('Page.enable')
      await client.send('Page.setFontFamilies', {
        fontFamilies: {
          standard: 'Inter',
          fixed: 'Inter',
          sansSerif: 'Inter'
        }
      })

      // accelerate animations
      await client.send('Animation.enable')
      await client.send('Animation.setPlaybackRate', { playbackRate: 20 })

      // set timeout to 15s for `page.goto()`
      page.setDefaultTimeout(15000)

      return page
    }

    pagePromise = newPage()
  }

  return pagePromise
}

const getScreenshot = async (url, { fullPage = false } = {}) => {
  const page = await getPage()

  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(url)
  return page.screenshot({ fullPage })
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
