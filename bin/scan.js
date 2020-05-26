const yargs = require('yargs')
const argv = yargs
  .option('dispatch', {type: 'boolean'})
  .option('offers', {type: 'boolean'})
  .option('aeroplan', {type: 'boolean'}).argv

const main = async () => {
  const db = require('../src/db')

  if (argv.offers) {
    console.log('Scanning offers for updates...')
    await require('../src/lambdas/offers')(argv)
  }

  if (argv.aeroplan) {
    console.log('Scanning Aeroplan for updates...')
    await require('../src/lambdas/aeroplan')(argv)
  }

  await db.connection.close()
}

main()
