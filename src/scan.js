require('../lib/async')
const db = require('./db')
const fs = require('fs')
const yaml = require('js-yaml')
const axios = require('axios')
const cheerio = require('cheerio')
const puppeteer = require('puppeteer')
const Diff = require('diff')

const virtualDOM = async (offer, page) => {
  if (offer.clickSelector) {
    await page.goto(offer.url)
    await page.click(offer.clickSelector)
    return cheerio.load(await page.content())
  } else {
    const result = await axios.get(offer.url)
    return cheerio.load(result.data)
  }
}

const extractSummary = ($, selectors) => {
  let output = ''
  selectors.forEach(selector => {
    const $selector = $(selector)
    $selector.find('sup').remove()
    $selector.find('.subScript').remove()
    const extractedText = $selector.text().trim()
    if (extractedText) {
      output += extractedText.replace(/(\s\s+)/g, "\n")
    }
  })
  return output
}

const formatTelegram = (offer, diff) => {
  let output = `*${offer.name}*\n`
  diff.forEach(part => {
    const text = part.value.replace(/([*_])/g, '')
    if (part.removed) {
      output += `*-* ${text}\n`
    } else if (part.added) {
      output += `*+* _${text}_\n`
    } else if (part.count > 0) {
      output += `\n`
    }
  })
  output += `[View offer](${offer.url})`
  return output
}

const formatSlack = (offer, diff) => {
  let output = `*${offer.name}*\n`
  diff.forEach(part => {
    const texts = part.value.replace(/([*_])/g, '').split(`\n`)
    if (part.removed) {
      texts.forEach(text => {
        output += `~${text}~\n`
      })
    } else if (part.added) {
      texts.forEach(text => {
        output += `_${text}_\n`
      })
    } else if (part.count > 0) {
      output += `\n`
    }
  })
  output += `<${offer.url}|View offer>`
  return output
}

const sendTelegram = async (offer, diff) => {
  await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_API_TOKEN}/sendMessage`, {
    chat_id: process.env.TELEGRAM_CHAT_ID,
    text: formatTelegram(offer, diff),
    parse_mode: 'Markdown'
  })
}

const sendSlack = async (offer, diff) => {
  await axios.post(process.env.SLACK_WEBHOOK_URL, {
    text: formatSlack(offer, diff)
  })
}

const dispatch = async (offer, diff) => {
  // await sendTelegram(offer, diff)
  await sendSlack(offer, diff)
}

const main = async () => {
  await db.connect()
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  const file = fs.readFileSync(`${__dirname}/data/offers.yaml`, 'utf8')
  const offers = yaml.safeLoad(file)

  const select = `SELECT summary, footnotes FROM offers WHERE offers.name = $1 ORDER BY timestamp DESC LIMIT 1`
  const insert = `INSERT INTO offers(name, timestamp, summary, footnotes) VALUES($1, $2, $3, $4)`
  await offers.asyncForEach(async (offer) => {
    let oldFootnotes = ''
    let oldSummary = ''
    let newFootnotes = ''
    let newSummary = ''
    await db.query(select, [offer.name], (err, result) => {
      if (result.rows.length > 0) {
        oldSummary = result.rows[0].summary
        oldFootnotes = result.rows[0].footnotes
      }
    })

    const $ = await virtualDOM(offer, page)
    if (offer.footnotesSelector) {
      const footnotes = []
      $(offer.footnotesSelector).each((i, el) => {
        footnotes.push($(el).text().trim())
      })
      newFootnotes = footnotes.join("\n")
    }

    if (newFootnotes === '') {
      const selectors = offer.selectors || [offer.selector].filter(x => x)
      newSummary = extractSummary($, selectors)
    } else if (oldFootnotes != newFootnotes) {
      const selectors = offer.selectors || [offer.selector].filter(x => x)
      newSummary = extractSummary($, selectors)
    }

    if (oldFootnotes != newFootnotes || (newFootnotes === '' && oldSummary != newSummary)) {
      await db.query(insert, [offer.name, Date.now(), newSummary, newFootnotes])
      const diffPreview = Diff.diffSentences(oldSummary, newSummary)
      await dispatch(offer, diffPreview)
    }
  })

  await browser.close()
  await db.end()
}

main()
