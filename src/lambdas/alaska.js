const cartera = require('../cartera')

const main = async () => {
  const portal = 'Alaska'
  const url = 'https://www.mileageplanshopping.com/b____.htm'
  await cartera(portal, url)
}

module.exports = main
