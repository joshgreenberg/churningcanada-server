require('../lib/async')
const db = require('../src/db')
const fs = require('fs')
const yaml = require('js-yaml')
const axios = require('axios')
const cheerio = require('cheerio')
const puppeteer = require('puppeteer')

const yargs = require('yargs')
const argv = yargs.option('dispatch', {
  type: 'boolean',
}).argv

const stringToSlug = str =>
  str
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const virtualDOM = async (offer, page) => {
  if (offer.click || offer.hover) {
    await page.goto(offer.url)
    if (offer.click) {
      await page.click(offer.click).catch(() => {})
      await page.waitFor(1000)
    }
    if (offer.hover) {
      await page.hover(offer.hover).catch(() => {})
      await page.waitFor(1000)
    }
    return cheerio.load(await page.content())
  } else {
    const result = await axios.get(offer.url)
    return cheerio.load(result.data)
  }
}

const formatTelegram = offers => {
  return offers
    .map(({name}) => {
      const url = `${process.env.CLIENT_URL}/${stringToSlug(name)}`
      return `[${name}](${url})`
    })
    .join('\n')
}

const formatSlack = offers => {
  return offers
    .map(({name}) => {
      const url = `${process.env.CLIENT_URL}/${stringToSlug(name)}`
      return `<${url}|${name}>`
    })
    .join('\n')
}

const sendTelegram = async offers => {
  await axios.post(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_API_TOKEN}/sendMessage`,
    {
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: `*New offers:*\n${formatTelegram(offers)}`,
      parse_mode: 'Markdown',
    }
  )
}

const sendSlack = async offers => {
  await axios.post(process.env.SLACK_WEBHOOK_URL, {
    text: `*New offers:*\n${formatSlack(offers)}`,
  })
}

const dispatch = async offers => {
  if (process.env.TELEGRAM_BOT_API_TOKEN) {
    await sendTelegram(offers)
  }
  if (process.env.SLACK_WEBHOOK_URL) {
    await sendSlack(offers)
  }
}

const main = async () => {
  const browser = await puppeteer.launch({
    args: process.env.PUPPETEER_ARGS.split(' '),
  })
  const page = await browser.newPage()

  const file = fs.readFileSync(`${__dirname}/../src/data/offers.yaml`, 'utf8')
  const offers = yaml.safeLoad(file)
  const updatedOffers = []
  const oldOffers = await db.models.Offer.find()

  await offers.asyncForEach(async offer => {
    const oldOffer = oldOffers
      .filter(o => o.name === offer.name)
      .sort((a, b) => b.timestamp - a.timestamp)[0]

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
      console.log(`[!!!] ${offer.name}: ${err.message}`)
    }

    if (oldOffer && oldOffer.footnotes.join('\n') === footnotes.join('\n')) {
      console.log(`[---] ${offer.name}`)
      return
    }

    if (oldOffer) {
      console.log(`[***] ${offer.name}`)
    } else {
      console.log(`[NEW] ${offer.name}`)
    }

    await db.models.Offer.create({
      name: offer.name,
      timestamp: parseInt(Date.now() / 1000),
      footnotes,
    })

    updatedOffers.push(offer)
  })

  if (updatedOffers.length > 0 && argv.dispatch) {
    await dispatch(
      updatedOffers.sort((a, b) =>
        a.name > b.name ? 1 : a.name < b.name ? -1 : 0
      )
    )
  }

  await browser.close()
  await db.connection.close()
}

main()
