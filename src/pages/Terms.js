import { link } from "../lib/router";

export const TERMS_UPDATED = "16 October 2026";

export default function Terms() {
  return (
    <main className="page">
      <div className="wrap prose" style={{ maxWidth: 760 }}>
        <h1>Terms of use</h1>
        <p className="small" style={{ marginTop: 10 }}>Last updated {TERMS_UPDATED}</p>
        <p style={{ marginTop: 18 }}>
          These terms apply to everyone who reads, writes or replies to reviews on Hindsight. By posting a review or a reply,
          you agree to them. If you only read reviews, the sections on using Hindsight and liability apply to you.
        </p>

        <h2>Who we are</h2>
        <p>
          Hindsight is a free, independent website run by an individual in the United Kingdom. No landlord, letting agent or
          property company pays to appear on it or to change what it shows. You can reach us through the <a href={link("/contact")}>contact form</a>.
        </p>

        <h2>Using Hindsight</h2>
        <ul>
          <li>Reviews are the opinions and experiences of the tenants who wrote them. They are not our views.</li>
          <li>We check reviews for obvious problems, but we cannot confirm every statement in them. A review marked as verified means we have seen evidence that the writer lived at the address.</li>
          <li>Check anything important for yourself before you sign a tenancy. Nothing on Hindsight is legal, financial or surveying advice.</li>
        </ul>

        <h2>Writing a review</h2>
        <p>You can review a home if you rented it and have moved out. Your review must:</p>
        <ul>
          <li>describe your own experience honestly, and make clear what is fact and what is your opinion</li>
          <li>only state facts you believe are true and could back up if asked</li>
          <li>refer to people by their role, such as the landlord or the agent, and never name or identify private individuals</li>
          <li>leave out phone numbers, email addresses, personal addresses and anything else that identifies a person</li>
          <li>contain no abuse, threats, harassment or discrimination</li>
          <li>be written by you, once per tenancy, and not in exchange for payment or any other reward</li>
        </ul>
        <p>
          Landlords, agents and anyone connected to them must not review a property they own or manage, or a competitor's.
          Accusing someone of a crime is a serious matter: if you have reported something to the police or another authority, say so and stick to what happened.
        </p>

        <h2>How we moderate</h2>
        <ul>
          <li>Reviews that mention contact details, names, strong language or serious allegations are held for a person to read before they go live.</li>
          <li>We can refuse, hide or remove any review or reply that breaks these terms, or that we reasonably believe could be unlawful.</li>
          <li>We do not edit what you wrote. If something needs to change, we will hide it and, where you gave us an email, ask you to rewrite it.</li>
        </ul>

        <h2>Right of reply</h2>
        <p>
          Landlords, letting agents and management companies can reply to a review of a property they are responsible for, or reply on their behalf
          with authority to do so. Every reply is read before it is published, and the same rules apply as for reviews. We may ask for evidence of your connection
          to the property using the email address you give us, which is never published.
        </p>

        <h2>Complaints and removal</h2>
        <p>
          Use the Report button on any review, or the <a href={link("/contact")}>contact form</a>. We aim to respond within 48 hours.
          Where a complaint says a review is defamatory, we follow the process set out in the Defamation (Operators of Websites) Regulations 2013,
          which includes passing the complaint to the reviewer where we can reach them. Reviewers can ask us to remove their own review at any time.
        </p>

        <h2>Your content</h2>
        <p>
          You keep ownership of what you write. By posting it, you give Hindsight a free, worldwide, non-exclusive licence to store, display and
          share it on the Hindsight website and app, and to show it when promoting Hindsight. This licence ends when your content is removed,
          except for copies already shared that we cannot control.
        </p>

        <h2>Liability</h2>
        <p>
          We provide Hindsight as it is and do our best to keep it accurate and available, but we cannot promise it will always be either.
          We are not responsible for what reviewers and repliers write, or for decisions made using it. Nothing in these terms limits any
          liability that cannot be limited by law.
        </p>

        <h2>Privacy</h2>
        <p>How we handle personal information is explained in <a href={link("/privacy")}>privacy and complaints</a>.</p>

        <h2>Changes and law</h2>
        <p>
          We may update these terms, and the date at the top shows the latest version. These terms are governed by the law of England and Wales,
          and the courts of England and Wales deal with any dispute.
        </p>
      </div>
    </main>
  );
}
