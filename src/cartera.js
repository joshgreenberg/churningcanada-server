const axios = require('axios')
const cheerio = require('cheerio')
const moment = require('moment')

const {
  TELEGRAM_BOT_API_TOKEN,
  TELEGRAM_CHAT_ID,
  SLACK_WEBHOOK_URL,
} = process.env

const main = async (argv, { page, db }, { portal, url }) => {
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
    const retailer = bonus.retailer.replace(/(\.|-|\+|!)/g, '\\$1')
    return `${emoji} ${bonus.today || ''} ${retailer}`
  }

  const formatSlack = (bonus) => {
    const emoji = getEmoji(bonus, 'slack')
    return `${emoji} ${bonus.today || ''} ${bonus.retailer}`
  }

  const buildMessage = (diff, formatter) => {
    const lines = [`*${portal} portal updates:*`]

    const fixedDiff = diff.filter((d) => d.type === 'fixed')
    const multiDiff = diff.filter((d) => d.type === 'multiplier')

    const fixedRetailers = fixedDiff
      .map((b) => formatter(b))
      .join('\n')
      .trim()

    const multiRetailers = multiDiff
      .map((b) => formatter(b))
      .join('\n')
      .trim()

    if (fixedRetailers.length > 0) {
      lines.push('_Fixed bonuses:_')
      lines.push(fixedRetailers)
      lines.push(' ')
    }

    if (multiRetailers.length > 0) {
      lines.push('_Multipliers:_')
      lines.push(multiRetailers)
    }

    return lines.join('\n')
  }

  const sendTelegram = async (diff) => {
    const text = buildMessage(diff, formatTelegram)
    const urlsafeText =
      text.length > 4096 ? text.slice(0, 4000) + '\n\\.\\.\\.' : text
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_API_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: urlsafeText,
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

  await page.goto(url)
  await page.waitForSelector('.mn_jumpList.mn_active')
  let $ = cheerio.load(await page.content())
  while ($('.mn_jumpList.mn_active .mn_disabled').length > 0) {
    await page.waitFor(1000)
    $ = cheerio.load(await page.content())
  }

  $('.mn_groupsWrap.mn_active .mn_groupLists li').each((i, el) => {
    const $el = $(el)
    const retailer = $el.find('.mn_merchName').text()
    const valueString = (
      $el.find('.mn_elevationNewValue').text() ||
      $el.find('.mn_rebateValueWithCurrency').text()
    ).trim()
    if (valueString) {
      const [value, typeString] = valueString.split(' ')
      const type = typeString.includes('$') ? 'multiplier' : 'fixed'

      bonuses.push({
        date: today,
        portal,
        retailer,
        value: Number(value),
        type,
      })
    }
  })

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

    const oldV = oldB && oldB.value
    const newV = newB && newB.value

    if (oldV != newV) {
      diff.push({
        retailer,
        yesterday: oldV,
        today: newV,
        type: (oldB && oldB.type) || (newB && newB.type),
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
