require('../lib/async')
const fs = require('fs')
const yaml = require('js-yaml')
const axios = require('axios')
const cheerio = require('cheerio')
const Diff = require('diff')

const sqlite3 = require('sqlite3').verbose()

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
  const db = new sqlite3.Database(`${__dirname}/../database.db`)

  const file = fs.readFileSync(`${__dirname}/data/offers.yaml`, 'utf8')
  const offers = yaml.safeLoad(file)

  const select = `SELECT body FROM offers WHERE offers.name = ? ORDER BY timestamp DESC`
  const insert = `INSERT INTO offers(name, timestamp, body) VALUES(?, ?, ?)`
  await offers.asyncForEach(async (offer) => {
    let oldText = ''
    db.get(select, [offer.name], (err, row) => {
      if (row) {
        oldText = row.body
      }
    })
    const $ = await virtualDOM(offer.url)
    const timestamp = Date.now()
    const newText = $(offer.selector).text().trim()
    if (oldText != newText) {
      db.run(insert, [offer.name, timestamp, newText], () => {})
      const diff = compare(oldText, newText)
      axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_API_TOKEN}/sendMessage`, {
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: formatMarkdown(offer.name, diff),
        parse_mode: 'Markdown'
      })
    }
  })

  db.close()
}

main()
