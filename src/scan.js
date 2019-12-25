require('../lib/async')
const db = require('./db')
const fs = require('fs')
const yaml = require('js-yaml')
const axios = require('axios')
const cheerio = require('cheerio')
const Diff = require('diff')

const virtualDOM = async (url) => {
  const result = await axios.get(url)
  return cheerio.load(result.data)
}

const compare = (oldText, newText) => {
  return Diff.diffSentences(oldText, newText)
}

const formatMarkdown = (name, diff) => {
  let output = `*${name}*\n`
  diff.forEach(part => {
    const text = part.value.replace(/([*_])/g, '')
    if (part.removed) {
      output += `*-* ${text}\n`
    } else if (part.added) {
      output += `*+* _${text}_\n`
    } else {
      output += `\n`
    }
  })
  return output
}

const main = async () => {
  await db.connect()

  const file = fs.readFileSync(`${__dirname}/data/offers.yaml`, 'utf8')
  const offers = yaml.safeLoad(file)

  const select = `SELECT body FROM offers WHERE offers.name = $1 ORDER BY timestamp DESC LIMIT 1`
  const insert = `INSERT INTO offers(name, timestamp, body) VALUES($1, $2, $3)`
  await offers.asyncForEach(async (offer) => {
    let oldText = ''
    await db.query(select, [offer.name], (err, result) => {
      if (result.rows.length > 0) {
        oldText = result.rows[0].body
      }
    })
    const $ = await virtualDOM(offer.url)
    const newText = $(offer.selector).text().trim()
    if (oldText != newText) {
      await db.query(insert, [offer.name, Date.now(), newText], () => {})
      const diff = compare(oldText, newText)
      await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_API_TOKEN}/sendMessage`, {
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: formatMarkdown(offer.name, diff),
        parse_mode: 'Markdown'
      })
    }
  })

  db.end()
}

main()
