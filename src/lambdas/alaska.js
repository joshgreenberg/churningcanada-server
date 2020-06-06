const cartera = require('../cartera')

const main = async (argv) => {
  const portal = 'Alaska'
  const url = 'https://www.mileageplanshopping.com/b____.htm'
  await cartera(argv, portal, url)
}

module.exports = main
