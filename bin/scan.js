const yargs = require('yargs')
const argv = yargs
  .option('dispatch', { type: 'boolean' })
  .option('offers', { type: 'boolean' })
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

  if (argv.offers) {
    console.log('Scanning offers for updates...')
    try {
      await require('../src/lambdas/offers')(argv)
    } catch (err) {
      console.log(err)
    }
  }

  if (argv.aeroplan) {
    console.log('Scanning Aeroplan for updates...')
    try {
      await require('../src/lambdas/aeroplan')(argv)
    } catch (err) {
      console.log(err)
    }
  }

  if (argv.alaska) {
    console.log('Scanning Alaska for updates...')
    try {
      await require('../src/lambdas/alaska')(argv)
    } catch (err) {
      console.log(err)
    }
  }

  if (argv.american) {
    console.log('Scanning AAdvantage for updates...')
    try {
      await require('../src/lambdas/american')(argv)
    } catch (err) {
      console.log(err)
    }
  }

  await db.connection.close()
}

main()
