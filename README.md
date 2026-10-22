# Hindsight

Unfiltered reviews from real UK tenants. Live at https://hindsight-reviews.netlify.app

## How it fits together

- **Website and app**: React, built and hosted by Netlify. Every push to `main` redeploys automatically.
  On the Netlify free plan each production deploy uses 15 of your 300 monthly credits, so batch changes.
- **Database**: Supabase. The full setup is in `supabase/setup.sql`. Run it once in Supabase > SQL Editor.
- **Address finder**: free. postcodes.io checks the postcode, OpenStreetMap lists house numbers and streets,
  and homes already on Hindsight show first. Royal Mail's full list is a paid product.
- **Keep-awake**: `.github/workflows/keep-database-awake.yml` pings Supabase every three days,
  because free Supabase projects pause after seven quiet days.

## Running the site day to day

**Claude is the reviewer.** A scheduled task runs twice a day (about 7:54 and 17:54 UK time). It reads every new review,
landlord reply and report through the Supabase connection, using only the functions in `hs_private`
(`review_queue`, `decide_review`, `decide_reply`, `decide_report`). Clear cases are decided; anything legally
risky or borderline is hidden or flagged for the owner. Every decision is logged in `hs_private.moderation_log`.
The run's summary is emailed to the owner. Claude never sees email addresses or proof of address.

The owner's private admin link (`/admin#k=...`, kept out of this public code) shows:

- **Reviews for you to decide.** Held reviews, and anything Claude escalated or flagged, with Claude's note.
- **Proof to check.** Photos or PDFs reviewers sent. Verify gives the Verified tenant badge; either button erases the file.
- **Landlord and agent replies, and reports.** Decide within 48 hours.
- **What Claude decided.** Every decision with its reason, and a button to undo it.

Email alerts arrive through Netlify Forms (forms: `contact`, `review-report`, `new-review`, `new-reply`).
Set the destination in Netlify > Forms > Form notifications.

If the admin link is ever lost or leaked, replace its hash in the `admin_keys` table.

### Rules the site enforces

- Scores of 1 or 2 need a written reason. 3 and above do not.
- Every reviewer must confirm they lived at the address (`lived_there`). Proof is optional and earns the badge.
- Proof files live in `hs_private.evidence`, are only readable through the admin key, and are erased once checked
  or after 30 days.

## Search engines

Pages use normal addresses (`/property/<id>/<readable-name>`). `/sitemap.xml` is generated live by the
`sitemap` Supabase Edge Function (proxied in `netlify.toml`), so new homes are listed for Google automatically.

## Doing the same jobs in Supabase (Table Editor)

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
