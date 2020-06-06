const cartera = require('../cartera')

const main = async (argv, injected) => {
  const portal = 'AAdvantage'
  const url = 'https://www.aadvantageeshopping.com/b____.htm'
  await cartera(argv, injected, { portal, url })
}

module.exports = main
