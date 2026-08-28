Rahalati v3.2.5

IMPORTANT
Upload ALL contents to the repository ROOT and preserve paths.
The release MUST appear exactly as:
  /releases/v3.2.5/

Changes:
- "Change image" now sends the current image as an exclusion and retries for a genuinely different cover.
- Destination image search prefers landmarks / historic center / travel imagery; optional Pexels support.
- Place recommendations now route to the official Tripadvisor Terra integration and rank by traveler rating.
- No OpenStreetMap fallback is presented as a Tripadvisor rating.
- Owner-only Sources tab lets the owner save Tripadvisor Terra and optional Pexels API keys server-side.
- API keys are not stored in GitHub/client JavaScript.

Tripadvisor Terra is an external service and requires its official API key before Tripadvisor results can load.
