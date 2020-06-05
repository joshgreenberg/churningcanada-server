const mongoose = require('mongoose')

const Bonus = new mongoose.Schema({
  date: String,
  portal: String,
  retailer: String,
  multiplier: Number,
})

module.exports = mongoose.model('Bonus', Bonus, 'bonuses')
