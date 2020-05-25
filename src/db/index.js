const mongoose = require('mongoose')

const db = mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
})

require('./Offer')
require('./Retailer')

module.exports = mongoose
