const puppeteer = require('puppeteer')
const yargs = require('yargs')
const argv = yargs.option('dispatch', { type: 'boolean' })

const main = async () => {
  const db = require('../src/db')
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36'
  )
  await page.setViewport({
    width: 1920,
    height: 1080,
  })
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
      request.abort()
    } else {
      request.continue()
    }
  })

  const injected = { page, db }

  console.log('Scanning offers for updates...')
  try {
    await require('../src/lambdas/offers')(argv, injected)
  } catch (err) {
    console.log(err)
  }

  await browser.close()
  await db.connection.close()
}

main()
