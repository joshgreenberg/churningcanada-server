require('../../lib/async')
const fs = require('fs')
const yaml = require('js-yaml')
const axios = require('axios')
const cheerio = require('cheerio')
const moment = require('moment')

const stringToSlug = (str) =>
  str
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const virtualDOM = async (offer, page) => {
  const url = offer.url.match(/^REFERRAL_URL_/)
    ? process.env[offer.url]
    : offer.url
  if (offer.click || offer.hover) {
    await page.goto(url)
    if (offer.click) {
      await page.waitForSelector(offer.click, { timeout: 3000 })
      await page.click(offer.click)
    }
    if (offer.hover) {
      await page.waitForSelector(offer.hover, { timeout: 3000 })
      await page.hover(offer.hover)
    }
    const selects =
      typeof offer.select == 'string' ? [offer.select] : offer.select
    selects.forEach((select) => {
      page.waitForSelector(select, { timeout: 3000 })
    })
    return cheerio.load(await page.content())
  } else {
    const result = await axios.get(url)
    return cheerio.load(result.data)
  }
}

const formatTelegram = (offers) => {
  return offers
    .map(({ name }) => {
      const url = `${process.env.CLIENT_URL}/${stringToSlug(name)}`
      return `[${name}](${url})`
    })
    .join('\n')
}

const formatSlack = (offers) => {
  return offers
    .map(({ name }) => {
      const url = `${process.env.CLIENT_URL}/${stringToSlug(name)}`
      return `<${url}|${name}>`
    })
    .join('\n')
}

const buildMessage = (updatedOffers, newOffers, callback) => {
  return [
    updatedOffers.length > 0
      ? `*Updated offers:*\n${callback(updatedOffers)}`
      : null,
    newOffers.length > 0 ? `*Now monitoring:*\n${callback(newOffers)}` : null,
  ]
    .join('\n\n')
    .trim()
}

const sendTelegram = async (updatedOffers, newOffers) => {
  await axios.post(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_API_TOKEN}/sendMessage`,
    {
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: buildMessage(updatedOffers, newOffers, formatTelegram),
      parse_mode: 'Markdown',
    }
  )
}

const sendSlack = async (updatedOffers, newOffers) => {
  await axios.post(process.env.SLACK_WEBHOOK_OFFERS, {
    text: buildMessage(updatedOffers, newOffers, formatSlack),
  })
}

const dispatch = async (updatedOffers, newOffers) => {
  if (process.env.TELEGRAM_BOT_API_TOKEN) {
    await sendTelegram(updatedOffers, newOffers)
  }
  if (process.env.SLACK_WEBHOOK_OFFERS) {
    await sendSlack(updatedOffers, newOffers)
  }
}

const main = async (argv, { page, db }) => {
  const file = fs.readFileSync(
    `${__dirname}/../../src/data/offers.yaml`,
    'utf8'
  )
  const offers = yaml.safeLoad(file)
  const updatedOffers = []
  const newOffers = []
  const oldOffers = await db.models.Offer.find()
  const today = moment().format('YYYY-MM-DD')

  await offers.asyncForEach(async (offer) => {
    if (offer.archive || oldOffers.some((o) => o.date == today)) {
      return
    }

    const oldOffer = oldOffers
      .filter((o) => o.name === offer.name)
      .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))[0]

    const footnotes = []
    try {
      const $ = await virtualDOM(offer, page)
      $('sup')
        .filter(function() {
          return /(\d|\w)+/.test(
            $(this)
              .text()
              .trim()
          )
        })
        .remove()
      $('br')
        .before(' ')
        .remove()

      const select =
        typeof offer.select == 'string' ? offer.select : offer.select.join(', ')

      $(select).each((i, el) => {
        const note = $(el)
          .text()
          .replace(/(?<=\w)\$/g, ' $')
          .replace(/\xa0/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (note) {
          footnotes.push(note)
        }
      })
    } catch (err) {
      // error
      console.log(`[!!!] ${offer.name}: ${err.message}`)
    }

    if (oldOffer && oldOffer.footnotes.join('\n') === footnotes.join('\n')) {
      // unchanged, skip
      console.log(`[   ] ${offer.name}`)
      return
    }

    if (oldOffer) {
      if (footnotes.length === 0) {
        // removed offer
        console.log(`[---] ${offer.name}`)
      } else {
        if (
          oldOffer.footnotes.length === 0 &&
          oldOffer.date ==
            moment(offer.date)
              .subtract(1, 'days')
              .format('YYYY-MM-DD')
        ) {
          await db.models.Offer.deleteOne({
            name: oldOffer.name,
            date: oldOffer.date,
          })
          const olderOffer = oldOffers
            .filter((o) => o.name === offer.name)
            .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))[1]
          if (
            olderOffer &&
            olderOffer.footnotes.join('\n') === footnotes.join('\n')
          ) {
            // revert yesterday's blank, skip
            console.log(`[<<<] ${offer.name}`)
            return
          }
        }
        // updated offer
        console.log(`[***] ${offer.name}`)
      }
      updatedOffers.push(offer)
    } else {
      // new offer
      console.log(`[NEW] ${offer.name}`)
      newOffers.push(offer)
    }

    await db.models.Offer.create({
      name: offer.name,
      date: today,
      footnotes,
    })
  })

  if (argv.dispatch && (updatedOffers.length > 0 || newOffers.length > 0)) {
    await dispatch(
      updatedOffers.sort((a, b) =>
        a.name > b.name ? 1 : a.name < b.name ? -1 : 0
      ),
      newOffers.sort((a, b) => (a.name > b.name ? 1 : a.name < b.name ? -1 : 0))
    )
  }
}

module.exports = main
