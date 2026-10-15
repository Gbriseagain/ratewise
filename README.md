# Hindsight

Unfiltered reviews from real UK tenants. Live at https://eclectic-starburst-a21356.netlify.app

## How it fits together

- **Website and app**: React, built and hosted by Netlify. Every push to `main` redeploys automatically.
  On the Netlify free plan each production deploy uses 15 of your 300 monthly credits, so batch changes.
- **Database**: Supabase. The full setup is in `supabase/setup.sql`. Run it once in Supabase > SQL Editor.
- **Address finder**: free. postcodes.io checks the postcode, OpenStreetMap lists house numbers and streets,
  and homes already on Hindsight show first. Royal Mail's full list is a paid product.
- **Keep-awake**: `.github/workflows/keep-database-awake.yml` pings Supabase every three days,
  because free Supabase projects pause after seven quiet days.

## Running the site day to day (Supabase > Table Editor)

| Job | Where | What to change |
| --- | --- | --- |
| Hide a review | `reviews` | set `status` to `hidden` |
| Mark a review verified | `reviews` | set `verified` to `true` |
| See who offered proof | `review_private` | method and optional email, never public |
| Handle complaints | `reports` | read the report, then set `status` to `actioned` or `rejected` |

Contact form messages and review reports are also emailed to you through Netlify Forms.
The destination address is set in Netlify (Forms > Form notifications), never in this public code.

Act on every complaint within 48 hours. Under the Defamation (Operators of Websites) Regulations 2013,
that means contacting the reviewer if they left an email, or hiding the review if they did not.
Following that process is what keeps your legal protection as a website operator.

## Editing the questions

All questions live in `src/lib/criteria.js`. If you add or remove a scored question,
update the list of keys at the top of `submit_review` in `supabase/setup.sql` and run it again.

## Local development

```
npm install
npm start
```
