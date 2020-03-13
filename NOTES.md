# Notes

## Export database

`heroku pg:psql`
`\COPY offers TO '~/Desktop/offers.csv' WITH (FORMAT csv, DELIMITER ',', HEADER true);`
