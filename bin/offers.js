const puppeteer = require('puppeteer')
const yargs = require('yargs')
const argv = yargs.option('dispatch', { type: 'boolean' })

const main = async () => {
  const db = require('../src/db')
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()

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
