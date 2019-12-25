const db = require('./db')

const main = async () => {
  await db.connect()
  await db.query("CREATE TABLE offers (id serial PRIMARY KEY, name TEXT, timestamp TEXT, body TEXT)")
  await db.end()
}

main()
