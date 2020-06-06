const cartera = require('../cartera')

const main = async (argv) => {
  const portal = 'AAdvantage'
  const url = 'https://www.aadvantageeshopping.com/b____.htm'
  await cartera(argv, portal, url)
}

module.exports = main
