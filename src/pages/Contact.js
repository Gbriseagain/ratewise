import { useState } from "react";
import { ChoiceChips, Icon } from "../components/ui";
import { sendForm } from "../lib/notify";
import { link } from "../lib/router";

const TOPICS = ["A review on the site", "My data", "Something else"];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", topic: "", message: "", company: "" });
  const [state, setState] = useState({ sending: false, sent: false, error: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target ? e.target.value : e }));
  const valid = EMAIL_RE.test(form.email.trim()) && form.message.trim().length >= 10;

  const send = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setState({ sending: true, sent: false, error: "" });
    try {
      await sendForm("contact", form);
      setState({ sending: false, sent: true, error: "" });
    } catch (err) {
      setState({ sending: false, sent: false, error: err.message });
    }
  };

  if (state.sent) {
    return (
      <main className="page"><div className="wrap flow" style={{ textAlign: "center" }}>
        <div className="done-burst"><Icon name="check" size={40} stroke={3} /></div>
        <h1 style={{ fontSize: "clamp(1.9rem, 5vw, 2.4rem)", margin: "0 auto" }}>Message sent</h1>
        <p className="muted" style={{ margin: "12px auto 24px" }}>We reply by email, usually within two working days.</p>
        <a className="btn btn-primary" href={link("/")}>Back to Hindsight</a>
      </div></main>
    );
  }

  return (
    <main className="page">
      <div className="wrap flow">
        <h1 style={{ fontSize: "clamp(1.9rem, 5vw, 2.6rem)" }}>Contact Hindsight</h1>
        <p className="muted" style={{ margin: "10px 0 24px" }}>
          Questions, data requests or complaints. To flag a specific review, the Report button on that review is quickest.
        </p>
        <form className="stack" onSubmit={send}>
          <label className="field"><span>Your name (optional)</span>
            <input className="input" value={form.name} onChange={set("name")} autoComplete="name" maxLength={80} /></label>
          <label className="field"><span>Your email</span>
            <input className="input" type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
            <small>So we can reply. Never shown on the site.</small></label>
          <div className="qgroup">
            <p>What is it about?</p>
            <ChoiceChips options={TOPICS} value={form.topic} onChange={set("topic")} />
          </div>
          <label className="field"><span>Message</span>
            <textarea className="input" rows={6} value={form.message} onChange={set("message")} maxLength={4000} required /></label>
          <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.company}
            onChange={set("company")} style={{ position: "absolute", left: "-9999px" }} />
          {state.error && <p className="note bad">{state.error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={!valid || state.sending}>
            {state.sending ? "Sending" : "Send message"}
          </button>
        </form>
      </div>
    </main>
  );
}
