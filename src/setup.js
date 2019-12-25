const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database(`${__dirname}/../database.db`)
db.serialize(() => {
  db.run("CREATE TABLE offers (name TEXT, timestamp TEXT, body TEXT)")
})
db.close()
