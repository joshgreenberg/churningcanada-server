const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const cors = require('cors')
const fs = require('fs')
const yaml = require('js-yaml')
const db = require('./db')

const PORT = process.env.PORT || 3000

const stringToSlug = str => str.replace(/\s+/g, '-').replace(/-+/g, '-')

const file = fs.readFileSync(`${__dirname}/data/offers.yaml`, 'utf8')
const products = yaml.safeLoad(file)
products.sort((a, b) =>
  a.name.toLowerCase() < b.name.toLowerCase()
    ? -1
    : a.name.toLowerCase() > b.name.toLowerCase()
    ? 1
    : 0
)
products.forEach(product => {
  product.slug = stringToSlug(product.name).toLowerCase()
})

app.use(cors())
app.use(bodyParser.json())

app.get('/', async (req, res) => {
  const offers = await db.models.Offer.find()
  res.json(
    products.map(product => ({
      ...product,
      offers: offers
        .sort((a, b) => b.timestamp - a.timestamp)
        .filter(offer => offer.name === product.name),
    }))
  )
})

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})

process.on('SIGTERM', async () => {
  await server.close()
  await db.connection.close(false)
  console.log('Goodbye')
  process.exit(0)
})
