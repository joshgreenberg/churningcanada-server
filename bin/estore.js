const puppeteer = require('puppeteer')
const yargs = require('yargs')
const argv = yargs
  .option('dispatch', { type: 'boolean' })
  .option('all', { type: 'boolean' })
  .option('aeroplan', { type: 'boolean' })
  .option('alaska', { type: 'boolean' })
  .option('american', { type: 'boolean' }).argv

const portals = ['aeroplan', 'alaska', 'american']
if (argv.all) {
  portals.forEach((portal) => {
    argv[portal] = true
  })
}

const main = async () => {
  const db = require('../src/db')
  const browser = await puppeteer.launch({
    args: [
      '--ignore-certificate-errors',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-dv-shm-usage',
      '--single-process',
    ],
  })
  const page = await browser.newPage()
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36'
  )
  await page.setViewport({
    width: 1200,
    height: 900,
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

  if (argv.aeroplan) {
    console.log('Scanning Aeroplan for updates...')
    try {
      await require('../src/lambdas/aeroplan')(argv, injected)
    } catch (err) {
      console.log(err)
    }
  }

  if (argv.alaska) {
    console.log('Scanning Alaska for updates...')
    try {
      await require('../src/lambdas/alaska')(argv, injected)
    } catch (err) {
      console.log(err)
    }
  }

  if (argv.american) {
    console.log('Scanning AAdvantage for updates...')
    try {
      await require('../src/lambdas/american')(argv, injected)
    } catch (err) {
      console.log(err)
    }
  }

  await browser.close()
  await db.connection.close()
}

main()
