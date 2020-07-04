const mongoose = require('mongoose')

const Offer = new mongoose.Schema({
  name: String,
  date: String,
  timestamp: Number,
  footnotes: [String],
})

module.exports = mongoose.model('Offer', Offer)
