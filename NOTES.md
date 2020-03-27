# Notes

## Export database

`heroku pg:psql`
`\COPY offers TO '~/Desktop/offers.csv' WITH (FORMAT csv, DELIMITER ',', HEADER true);`
`\COPY (SELECT row_to_json(offer_data) FROM (SELECT * FROM offers) offer_data) TO '~/Desktop/offers.json';`

## TODO

- [x] BMO
- [x] HSBC
- [ ] double check Alaska/MBNA
- [x] National
- [x] RBC Avion promos: create a blank entry for dead links
- [x] RBC business cards
- [x] Scotia Passport
- [ ] TD formatting and numbering: APP, APVI, APVIP, CB, PT
- [x] TD FCT, BizTrav
- [x] aeroplan.td.com
- [x] Tangerine public offer
