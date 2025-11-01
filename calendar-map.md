# Availability Calendars by Location

This table summarizes how each supported location is routed when the app fetches availability. Appointment type IDs come from `city-types.json`, while account ownership and scheduling hosts are defined in `location-config.json`. As shown in `api/availability.js`, any account value other than `"parents"` is normalized to use the main Acuity API credentials. 

| Location (label) | Slug | Appointment Type ID | Account configured | Account used for availability | Scheduling host / owner |
| --- | --- | --- | --- | --- | --- |
| Awatukee | awatukee | 76043315 | students | main | app.acuityscheduling.com · owner 23214568 |
| Apache Junction | apache-junction | 50528555 | students | main | app.acuityscheduling.com · owner 23214568 |
| Casa Grande | casa-grande | 70526040 | students | main | app.acuityscheduling.com · owner 23214568 |
| Cave Creek | cave-creek | 63747690 | students | main | app.acuityscheduling.com · owner 23214568 |
| Downtown Phoenix | downtown-phoenix | 50528736 | students | main | app.acuityscheduling.com · owner 23214568 |
| Gilbert | gilbert | 44842749 | students | main | app.acuityscheduling.com · owner 23214568 |
| Mesa | mesa | 44842781 | students | main | app.acuityscheduling.com · owner 23214568 |
| Queen Creek | queen-creek | 50528913 | students | main | app.acuityscheduling.com · owner 23214568 |
| San Tan Valley | san-tan-valley | 50528924 | students | main | app.acuityscheduling.com · owner 23214568 |
| Scottsdale | scottsdale | 53640646 | students | main | app.acuityscheduling.com · owner 23214568 |
| Tempe | tempe | 50528939 | students | main | app.acuityscheduling.com · owner 23214568 |
| Chandler | chandler | 50528663 | main | main | app.acuityscheduling.com · owner 23214568 |
| Buckeye | buckeye | 85088423 | main | main | app.acuityscheduling.com · owner 23214568 (Early Bird URL preset) |
| Tolleson | tolleson | 85088423 | main | main | app.acuityscheduling.com · owner 23214568 (Early Bird URL preset) |
| Laveen | laveen | 85088423 | main | main | app.acuityscheduling.com · owner 23214568 (Early Bird URL preset) |
| Anthem | anthem | 52197630 | main | main | app.acuityscheduling.com · owner 23214568 |
| Glendale | glendale | 50529778 | parents | parents | DeerValleyDrivingSchool.as.me |
| North Phoenix | north-phoenix | 50529846 | parents | parents | DeerValleyDrivingSchool.as.me |
| Peoria | peoria | 50529862 | parents | parents | DeerValleyDrivingSchool.as.me |
| Sun City | sun-city | 50529915 | parents | parents | DeerValleyDrivingSchool.as.me |
| Surprise | surprise | 50529929 | parents | parents | DeerValleyDrivingSchool.as.me |

## Notes

- The `account` column reflects the configuration in `location-config.json`. Because `normalizeAccount` in `api/availability.js` maps anything other than `"parents"` to `"main"`, all “students” and “main” cities share the same main Acuity credentials.
- When a `baseUrl` lacks an explicit appointment type, the API layer appends the appointment type ID from `city-types.json` so that each calendar query stays scoped to the correct catalog.
