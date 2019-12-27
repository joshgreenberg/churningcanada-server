const db = require('./db')

const main = async () => {
  try {
    await db.connect()
    await db.query("CREATE TABLE offers (id serial PRIMARY KEY, name TEXT, timestamp TEXT, summary TEXT, footnotes TEXT)")
    await db.end()
  } catch (e) {
    console.log(e)
  }
}

main()
