Rahalati v3.2.6

Upload ALL contents to repository root, preserving paths.
Release path must be:
  /releases/v3.2.6/

Changes:
- Weather no longer shows "unavailable": short forecast -> ECMWF seasonal -> 10-year historical climate -> rare emergency seasonal fallback.
- Arabic-city geocoding is handled server-side using Nominatim + Open-Meteo + Wikipedia coordinate fallbacks.
- Place recommendations moved from Tripadvisor to Foursquare Places.
- Foursquare search is sorted by RATING for selected categories and POPULARITY for broad discovery.
- Images remain independent: official website OG image / Wikimedia; Pexels remains optional for destination covers.
- Owner Sources tab now configures Foursquare + optional Pexels.
- Foursquare's free API allowance is limited; this build minimizes calls (one search per recommendation request).
