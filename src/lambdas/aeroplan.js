const db = require('../../src/db')
const axios = require('axios')
const cheerio = require('cheerio')
const moment = require('moment')

const { TELEGRAM_BOT_API_TOKEN, TELEGRAM_CHAT_ID } = process.env

const corsAnywhere = 'https://cors-anywhere.herokuapp.com/'

const portal = 'Aeroplan'

const emojis = {
  telegram: {
    ADD: '\u{1F4A5}',
    REM: '\u{1F480}',
    INC: '\u{2B06}',
    DEC: '\u{2B07}',
  },
  slack: {
    ADD: ':boom:',
    REM: ':skull_and_crossbones:',
    INC: ':arrow_up:',
    DEC: ':arrow_down:',
  },
}

const getEmoji = (bonus, format) => {
  if (!bonus.yesterday) {
    return emojis[format].ADD
  }
  if (!bonus.today) {
    return emojis[format].REM
  }
  if (bonus.today > bonus.yesterday) {
    return emojis[format].INC
  }
  if (bonus.today < bonus.yesterday) {
    return emojis[format].DEC
  }
}

const formatTelegram = (bonus) => {
  const emoji = getEmoji(bonus, 'telegram')
  return `${emoji} ${bonus.today || ''} ${bonus.retailer}`
}

// const formatSlack = (bonus) => {}

const buildMessage = (diff, formatter) => {
  const retailers = diff
    .map((b) => formatter(b))
    .join('\n')
    .trim()
  return `*${portal} portal updates:*\n${retailers}`
}

const sendTelegram = async (diff) => {
  await axios.post(
    `https://api.telegram.org/bot${TELEGRAM_BOT_API_TOKEN}/sendMessage`,
    {
      chat_id: TELEGRAM_CHAT_ID,
      text: buildMessage(diff, formatTelegram),
      parse_mode: 'MarkdownV2',
    }
  )
}

// const sendSlack = async (diff) => {}

const dispatch = async (diff) => {
  if (TELEGRAM_BOT_API_TOKEN && TELEGRAM_CHAT_ID) {
    await sendTelegram(diff)
  }
}

const main = async () => {
  const yesterday = moment()
    .subtract(1, 'days')
    .format('YYYY-MM-DD')
  const today = moment().format('YYYY-MM-DD')

  const existing = await db.models.Bonus.find({ date: today, portal })

  if (existing.length > 0) {
    console.log(
      `Already scraped ${existing.length} items from ${portal} today, skipping.`
    )
    return false
  }

  const bonuses = []
  let more = true
  let pn = 1
  while (more) {
    const result = await axios.get(
      `${corsAnywhere}https://www.aeroplan.com/estore/products.ep`,
      {
        params: {
          cID: 'allretailers',
          pn,
        },
        headers: {
          Accept: 'text/html',
          Origin: 'https://www.aeroplan.com',
        },
      }
    )
    const $ = cheerio.load(result.data)
    $('.lazyloaders-desktop .col-md-3').each(function() {
      const $el = $(this)
      const retailer = $el
        .children('a.retailers-shop-now')[0]
        .attribs.onclick.match(/'', '(.*)', ''/)[1]
        .toUpperCase()
      const multiplier = $el
        .children('p.miles-per')
        .text()
        .match(/^(\d+) /)[1]
      if (bonuses.find((b) => b.retailer === retailer)) {
        more = false
      } else {
        bonuses.push({
          date: today,
          portal,
          retailer,
          multiplier: Number(multiplier),
        })
      }
    })
    pn++
  }

  // Save today's scrape to the database
  await db.models.Bonus.insertMany(bonuses)

  // Compare to yesterday's data and dispatch changes
  const oldBonuses = await db.models.Bonus.find({
    date: yesterday,
    portal,
  })
  const diff = []
  const retailerNames = new Set(
    bonuses.map((b) => b.retailer).concat(oldBonuses.map((b) => b.retailer))
  )
  retailerNames.forEach((retailer) => {
    const oldB = oldBonuses.find((b) => b.retailer === retailer)
    const newB = bonuses.find((b) => b.retailer === retailer)

    const oldM = oldB && oldB.multiplier
    const newM = newB && newB.multiplier

    if (oldM != newM) {
      diff.push({
        retailer,
        yesterday: oldM,
        today: newM,
      })
    }
  })

  if (diff.length > 0) {
    await dispatch(diff.sort((a, b) => b.today - a.today)).catch((e) => {
      console.log(e)
    })
  }

  console.log(
    `Found ${bonuses.length} ${portal} retailers, with ${diff.length} updates.`
  )
}

module.exports = main
