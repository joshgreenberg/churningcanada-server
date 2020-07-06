const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const cors = require('cors')
const fs = require('fs')
const yaml = require('js-yaml')
const db = require('./db')

const PORT = process.env.PORT || 3000

const stringToSlug = (str) => str.replace(/[&\s]+/g, '-').replace(/-+/g, '-')

const file = fs.readFileSync(`${__dirname}/data/offers.yaml`, 'utf8')
const products = yaml.safeLoad(file)
products.sort((a, b) =>
  a.name.toLowerCase() < b.name.toLowerCase()
    ? -1
    : a.name.toLowerCase() > b.name.toLowerCase()
    ? 1
    : 0
)
products.forEach((product) => {
  product.slug = stringToSlug(product.name).toLowerCase()
})

app.use(
  cors({
    origin: process.env.CLIENT_URL,
  })
)
app.use(bodyParser.json())

app.get('/offers', async (req, res) => {
  const allOffers = await db.models.Offer.find()
  const offers = allOffers
    .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
    .reduce((acc, cur) => {
      if (!acc.some((o) => o.name === cur.name)) {
        acc.push(cur)
      }
      return acc
    }, [])
  res.json(
    products
      .map((product) => {
        const offer = offers.find((o) => o.name === product.name)
        if (offer) {
          return {
            name: product.name,
            url: product.url,
            slug: product.slug,
            date: offer.date,
            expired: offer.footnotes.length == 0,
          }
        } else {
          return null
        }
      })
      .filter((p) => p)
  )
})

app.get('/offers/:slug', async (req, res) => {
  const slug = req.params.slug
  const product = products.find((p) => p.slug === slug)
  if (product) {
    const offers = await db.models.Offer.find({ name: product.name }).sort({
      date: -1,
    })
    res.json(offers)
  } else {
    res.send(404)
  }
})

app.get('/r/:slug', async (req, res) => {
  const card = req.params.slug.replace(/-/g, '_').toUpperCase()
  const url = process.env[`REFERRAL_URL_${card}`]
  res.redirect(url)
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
