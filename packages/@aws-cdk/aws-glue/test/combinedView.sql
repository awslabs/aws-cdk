SELECT
  *
, "$path" "file" 
FROM
  ${sourceTable}
WHERE ("concat"("year", "month", "day", "hour") >= "date_format"("date_trunc"('hour', ((current_timestamp - INTERVAL  '15' MINUTE) - INTERVAL  '1' HOUR)), '%Y%m%d%H'))
UNION ALL SELECT
  *
, "$path" "file"
FROM
  ${targetTable}
WHERE ("concat"("year", "month", "day", "hour") < "date_format"("date_trunc"('hour', ((current_timestamp - INTERVAL  '15' MINUTE) - INTERVAL  '1' HOUR)), '%Y%m%d%H'))
