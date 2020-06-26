const cartera = require('./_cartera')

const main = async (argv, injected) => {
  const portal = 'Alaska'
  const url = 'https://www.mileageplanshopping.com/b____.htm'
  await cartera(argv, injected, { portal, url })
}

module.exports = main
