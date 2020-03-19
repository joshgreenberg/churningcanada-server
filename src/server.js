const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const cors = require('cors')
const fs = require('fs')
const yaml = require('js-yaml')
const db = require('./db')
db.connect()

const PORT = 3000

const stringToSlug = str => str.replace(/\s+/g, '-').replace(/-+/g, '-')

const file = fs.readFileSync(`${__dirname}/data/offers.yaml`, 'utf8')
const products = yaml.safeLoad(file)
products.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
products.forEach(product => {
  product.slug = stringToSlug(product.name).toLowerCase()
})

app.use(cors())
app.use(bodyParser.json())

app.get('/', async (req, res) => {
  const {rows: offers} = await db.query(
    'SELECT * FROM offers ORDER BY timestamp DESC'
  )
  res.json(
    products.map(product => ({
      ...product,
      offers: offers.filter(offer => offer.name === product.name),
    }))
  )
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
