const mongoose = require('mongoose')

const Bonus = new mongoose.Schema({
  date: String,
  portal: String,
  retailer: String,
  value: Number,
  baseValue: Number,
  type: String,
})

module.exports = mongoose.model('Bonus', Bonus, 'bonuses')
