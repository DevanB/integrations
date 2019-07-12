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
  }

  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(url)
  const file = await page.screenshot({ fullPage })
  return file
}

module.exports = { getScreenshot }
