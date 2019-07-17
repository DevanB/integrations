const puppeteer = require('puppeteer-core')
const chrome = require('chrome-aws-lambda')

const isDev = process.env.NOW_REGION === 'dev1'

let page

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

const getScreenshot = async (url, { fullPage = false } = {}) => {
  if (!page) {
    const options = await getOptions()
    const browser = await puppeteer.launch(options)
    page = await browser.newPage()

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
  }

  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(url)
  const file = await page.screenshot({ fullPage })
  return file
}

module.exports = { getScreenshot }
