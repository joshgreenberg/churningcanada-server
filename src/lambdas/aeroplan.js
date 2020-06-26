const axios = require('axios')
const cheerio = require('cheerio')
const moment = require('moment')

const {
  TELEGRAM_BOT_API_TOKEN,
  TELEGRAM_CHAT_ID,
  SLACK_WEBHOOK_URL,
} = process.env

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

const formatSlack = (bonus) => {
  const emoji = getEmoji(bonus, 'slack')
  return `${emoji} ${bonus.today || ''} ${bonus.retailer}`
}

const buildMessage = (diff, formatter) => {
  const retailers = diff
    .map((b) => formatter(b))
    .join('\n')
    .trim()
  return `*${portal} portal updates*\n${retailers}`
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

const sendSlack = async (diff) => {
  await axios.post(SLACK_WEBHOOK_URL, {
    text: buildMessage(diff, formatSlack),
  })
}

const dispatch = async (diff) => {
  if (TELEGRAM_BOT_API_TOKEN && TELEGRAM_CHAT_ID) {
    await sendTelegram(diff)
  }
  if (SLACK_WEBHOOK_URL) {
    await sendSlack(diff)
  }
}

const main = async (argv, { page, db }) => {
  const { date: mostRecent } = await db.models.Bonus.find({ portal })
    .limit(1)
    .sort({ date: -1 })
  const yesterday =
    mostRecent ||
    moment()
      .subtract(2, 'days')
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
  for (let retry = 1; retry <= 3; retry++) {
    let more = true
    let pn = 1
    while (more) {
      await page.goto(
        `https://www.aeroplan.com/estore/all-retailers/callretailers-p${pn}.html`,
        {
          waitUntil: 'domcontentloaded',
        }
      )
      const pageContent = await page.content()
      const $ = cheerio.load(pageContent)
      $('#infinite-categ .col-md-3').each(function() {
        const $el = $(this)
        const retailer = $el
          .children('a.retailers-shop-now')[0]
          .attribs.onclick.match(/'', '(.*)', ''/)[1]
          .toUpperCase()
        const value = $el
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
            value: Number(value),
            type: 'multiplier',
          })
        }
      })
      if (bonuses.length == 0) {
        break
      }
      pn++
    }
    if (bonuses.length > 0) {
      break
    }
  }
  if (bonuses.length == 0) {
    console.log('Error scraping website :(')
    return false
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

    const oldM = oldB && oldB.value
    const newM = newB && newB.value

    if (oldM != newM) {
      diff.push({
        retailer,
        yesterday: oldM,
        today: newM,
      })
    }
  })

  if (diff.length > 0 && argv.dispatch) {
    await dispatch(diff.sort((a, b) => b.today - a.today)).catch((e) => {
      console.log(e)
    })
  }

  console.log(
    `Found ${bonuses.length} ${portal} retailers, with ${diff.length} updates.`
  )
}

module.exports = main
