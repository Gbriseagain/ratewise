// Sends a form to Netlify Forms. Netlify emails each submission to the
// address set in the Netlify dashboard, so no email address ever appears
// in this code or on the website.

export async function sendForm(formName, fields) {
  const body = new URLSearchParams({ "form-name": formName });
  Object.entries(fields).forEach(([k, v]) => body.append(k, v == null ? "" : String(v)));
  const res = await fetch("/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error("Your message could not be sent. Try again in a few minutes.");
}
