const mongoose = require('mongoose')

const Retailer = new mongoose.Schema({
  date: String,
  portal: String,
  name: String,
  multiplier: Number,
})

module.exports = mongoose.model('Retailer', Retailer)
