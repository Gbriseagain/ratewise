import { ShareInvite } from "./Home";
import { CONTACT_EMAIL } from "../config";
import { CRITERIA, GROUPS } from "../lib/criteria";
import { link } from "../lib/router";

export function About() {
  return (
    <main className="page">
      <div className="wrap prose" style={{ maxWidth: 760 }}>
        <h1>Renting in the UK is a gamble. Hindsight shortens the odds.</h1>
        <p style={{ marginTop: 18 }}>
          Listings show a home on its best day. Nobody mentions the mould behind the wardrobe, the boiler that dies every February,
          or the agent who takes six weeks to reply. The people who know are the tenants who lived there, so Hindsight asks them.
        </p>
        <p>
          It is free and independent. No landlord or agent pays to be listed, and nobody can pay to remove a review.
        </p>

        <h2>What tenants score</h2>
        {Object.entries(GROUPS).map(([g, meta]) => (
          <div key={g} style={{ marginTop: 16 }}>
            <p><strong>{meta.label}</strong></p>
            <div className="chips" style={{ marginTop: 8 }}>
              {CRITERIA.filter((c) => c.group === g).map((c) => <span key={c.key} className="tag">{c.icon} {c.label}</span>)}
            </div>
          </div>
        ))}
        <p style={{ marginTop: 16 }}>
          Every review also records the set-up: heating type, furniture, white goods, water billing, who handled repairs,
          decorating and guest rules, flooding, whether the deposit came back, and any energy upgrades made during the tenancy.
        </p>

        <h2>The rules</h2>
        <ul>
          <li><strong>Only after moving out.</strong> Reviews open once your tenancy has ended, so nobody writes in fear of their landlord.</li>
          <li><strong>Low scores need a reason.</strong> Any score of 3 or below needs a written explanation. That is what makes a score useful.</li>
          <li><strong>Tenants confirm they lived there.</strong> Each reviewer declares how they could prove it. Reviews show as verified once we have checked a bill or council tax letter.</li>
          <li><strong>Anyone can report a review.</strong> Landlords and agents included. We look at every report within 48 hours.</li>
        </ul>

        <h2>Energy upgrades</h2>
        <p>
          Privately rented homes in England and Wales must reach EPC C by 1 October 2030. Many homes will be insulated,
          re-glazed or given new heating before then. Hindsight asks tenants whether those upgrades made a real difference,
          so the next person knows if a better certificate means a warmer home.
        </p>

        <div className="row" style={{ marginTop: 28 }}>
          <a className="btn btn-primary" href={link("/review")}>Leave a review</a>
          <a className="btn btn-ghost" href={link("/search")}>Search homes</a>
        </div>
        <ShareInvite />
      </div>
    </main>
  );
}

export function Privacy() {
  return (
    <main className="page">
      <div className="wrap prose" style={{ maxWidth: 760 }}>
        <h1>Privacy and complaints</h1>
        <p style={{ marginTop: 18 }}>This page explains what Hindsight collects, why, and how to complain about a review.</p>

        <h2>What we collect</h2>
        <ul>
          <li><strong>Published with your review:</strong> the name or initials you give, the months you moved in and out, your scores, comments and answers about the home.</li>
          <li><strong>Kept private:</strong> how you said you could prove you lived there, and your email address if you chose to give one.</li>
          <li><strong>On your device only:</strong> an unfinished review and your colour theme, so you can pick up where you left off.</li>
        </ul>
        <p>We do not use advertising trackers and we do not sell data.</p>

        <h2>Why</h2>
        <p>
          Publishing reviews helps other renters make informed decisions, which is the legitimate interest Hindsight relies on.
          Your email is optional and only used to verify your review or reply to your report.
        </p>

        <h2>Who processes it</h2>
        <p>
          Reviews are stored securely with Supabase. Postcodes are checked with postcodes.io and address
          suggestions come from OpenStreetMap; those services see the postcode you type, nothing else.
        </p>

        <h2>Your rights</h2>
        <p>
          You can ask for your review to be removed, or for a copy of what we hold about you, at any time.
          {CONTACT_EMAIL ? <> Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</> : " Use the Report button on your review and say it is yours."}
          {" "}You can also complain to the Information Commissioner's Office at ico.org.uk.
        </p>

        <h2>Complaints about a review</h2>
        <p>
          Every review has a Report button. Tell us what is wrong and, if you want a reply, leave an email.
          We look at every report within 48 hours. Reviews that break the rules are hidden; the rest stay up and we tell you why.
        </p>
        <p>Reviews must describe the writer's own experience, must not name or expose private individuals, and must not be abusive.</p>
      </div>
    </main>
  );
}
