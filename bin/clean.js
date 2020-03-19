// Delete all database entries older than 3 months, except the most recent one for each offer

const db = require('../src/db')

const main = async () => {
  await db.connect()
  const cutoff = Date.now() / 1000 - 60 * 60 * 24 * 90
  const recent = (
    await db.query(`
    SELECT name, max(timestamp) FROM offers GROUP BY name ORDER BY name ASC
  `)
  ).rows.map(row => row.max)
  await db.query(`
    DELETE FROM offers
    WHERE timestamp < ${cutoff}
    AND timestamp NOT IN (${recent})
  `)
  db.end()
}

main()
