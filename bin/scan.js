const puppeteer = require('puppeteer')
const yargs = require('yargs')
const argv = yargs
  .option('dispatch', { type: 'boolean' })
  .option('offers', { type: 'boolean' })
  .option('allPortals', { type: 'boolean' })
  .option('aeroplan', { type: 'boolean' })
  .option('alaska', { type: 'boolean' })
  .option('american', { type: 'boolean' }).argv

const portals = ['aeroplan', 'alaska', 'american']
if (argv.allPortals) {
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
  if (process.env.NODE_ENV === 'production') {
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      if (['image', 'stylesheet'].includes(request.resourceType())) {
        request.abort()
      } else {
        request.continue()
      }
    })
  }

  const injected = { page, db }

  if (argv.offers) {
    console.log('Scanning offers for updates...')
    try {
      await require('../src/lambdas/offers')(argv, injected)
    } catch (err) {
      console.log(err)
    }
  }

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
