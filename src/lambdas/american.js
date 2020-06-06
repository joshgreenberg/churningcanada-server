const cartera = require('../cartera')

const main = async () => {
  const portal = 'AAdvantage'
  const url = 'https://www.aadvantageeshopping.com/b____.htm'
  await cartera(portal, url)
}

module.exports = main
