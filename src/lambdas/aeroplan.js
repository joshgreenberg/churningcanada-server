const db = require('../../src/db')
const axios = require('axios')
const cheerio = require('cheerio')
const moment = require('moment')

const portal = 'Aeroplan'

const buildLine = r => {
  if (!r.yesterday) {
    return `:boom: ${r.today} ${r.name}`
  }
  if (!r.today) {
    return `:bomb: ${r.name}`
  }
  if (r.today > r.yesterday) {
    return `:arrow\\_up: ${r.today} ${r.name}`
  }
  if (r.today < r.yesterday) {
    return `:arrow\\_down: ${r.today} ${r.name}`
  }
  return ''
}

const buildMessage = diff => {
  const retailers = diff
    .map(r => buildLine(r))
    .join('\n')
    .trim()

  return `*${portal} portal updates:*\n${retailers}`
}

const dispatch = async diff => {
  if (process.env.TELEGRAM_BOT_API_TOKEN) {
    await axios.post(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_API_TOKEN}/sendMessage`,
      {
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: buildMessage(diff),
        parse_mode: 'Markdown',
      }
    )
  }
  if (process.env.SLACK_WEBHOOK_URL) {
    await axios.post(process.env.SLACK_WEBHOOK_URL, {
      text: buildMessage(diff),
    })
  }
}

const main = async argv => {
  const yesterday = moment()
    .subtract(1, 'days')
    .format('YYYY-MM-DD')
  const today = moment().format('YYYY-MM-DD')

  const existing = await db.models.Retailer.find({date: today, portal})
  if (existing.length > 0) {
    console.log(`Already scraped ${portal} today, skipping.`)
    return false
  }
  console.log('Gathering retailers...')

  const retailers = []
  let more = true
  let pn = 1
  while (more) {
    try {
      const result = await axios.get(
        'https://www.aeroplan.com/estore/products.ep',
        {
          timeout: 5000,
          params: {
            cID: 'allretailers',
            pn,
          },
        }
      )
      console.log(result)
      console.log(`got page ${pn}`)
      const $ = cheerio.load(result.data)
      $('.lazyloaders-desktop .col-md-3').each(function() {
        const $el = $(this)
        const name = $el
          .children('a.retailers-shop-now')[0]
          .attribs.onclick.match(/'', '(.*)', ''/)[1]
          .toUpperCase()
        const multiplier = $el
          .children('p.miles-per')
          .text()
          .match(/^(\d+) /)[1]
        if (retailers.find(r => r.name === name)) {
          more = false
        } else {
          retailers.push({
            date: today,
            portal,
            name,
            multiplier,
          })
        }
      })
      console.log(`${retailers.length} retailers so far`)
    } catch (err) {
      console.log(err)
    }
    pn++
  }
  console.log('done gathering retailers')

  // Save today's scrape to the database

  await db.models.Retailer.insertMany(retailers)
  console.log(`Scraped ${retailers.length} ${portal} retailers.`)

  // Compare to yesterday's data and dispatch changes

  const oldRetailers = await db.models.Retailer.find({
    date: yesterday,
    portal,
  })
  const diff = []

  const names = new Set(
    retailers.map(r => r.name).concat(oldRetailers.map(r => r.name))
  )
  names.forEach(name => {
    const oldR = oldRetailers.find(r => r.name === name)
    const newR = retailers.find(r => r.name === name)

    const oldM = oldR && oldR.multiplier
    const newM = newR && newR.multiplier

    if (oldM != newM) {
      diff.push({
        name,
        yesterday: oldM,
        today: newM,
      })
    }
  })

  if (diff.length > 0 && argv.dispatch) {
    await dispatch(diff.sort((a, b) => b.today - a.today)).catch(e => {
      console.log(e)
    })
  }
}

module.exports = main
