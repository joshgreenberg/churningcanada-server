require('../lib/async')
const moment = require('moment')

const main = async () => {
  const db = require('../src/db')
  const offers = await db.models.Offer.find()
  await offers.asyncForEach(async (offer) => {
    offer.date = moment.unix(offer.timestamp).format('YYYY-MM-DD')
    await offer.save()
  })
  await db.models.Offer.updateMany({}, { $unset: { timestamp: 1 } })
  await db.connection.close()
}

main()
