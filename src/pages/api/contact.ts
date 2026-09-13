export const prerender = false;

import type { APIRoute } from 'astro';

/** Custom-order enquiries. Honeypot + length caps; Turnstile can be layered on later. */
const MAX = { name: 120, email: 200, size: 40, metal: 60, idea: 4000 } as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};

  let data: Record<string, unknown>;
  try {
    data = await request.json();
  } catch {
    return json({ error: 'Malformed request.' }, 400);
  }

  // Honeypot — humans never see this field.
  if (typeof data.company === 'string' && data.company.trim()) return json({ ok: true });

  const str = (k: keyof typeof MAX) =>
    typeof data[k] === 'string' ? (data[k] as string).trim().slice(0, MAX[k]) : '';

  const name = str('name');
  const email = str('email');
  const idea = str('idea');

  if (!name || !email || !idea) return json({ error: 'Please fill in every required field.' }, 400);
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) return json({ error: 'That email looks wrong.' }, 400);

  const apiKey = env.RESEND_API_KEY ?? import.meta.env.RESEND_API_KEY;
  const to = env.ORDER_NOTIFY_EMAIL ?? import.meta.env.ORDER_NOTIFY_EMAIL;
  if (!apiKey || !to) {
    console.warn('contact form received but email is not configured', { name, email });
    return json({ error: 'The form is not connected yet. Please email boldermade@gmail.com.' }, 503);
  }

  const text = [
    'Custom ring request',
    '',
    `Name:   ${name}`,
    `Email:  ${email}`,
    `Size:   ${str('size') || '—'}`,
    `Metal:  ${str('metal') || 'No preference'}`,
    '',
    'Idea:',
    idea,
  ].join('\n');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: 'bolder site <forms@boldermade.ca>',
      to: [to],
      reply_to: email,
      subject: `Custom request — ${name}`,
      text,
    }),
  });

  if (!res.ok) {
    console.error('resend failed', res.status, await res.text());
    return json({ error: 'Could not send right now.' }, 502);
  }
  return json({ ok: true });
};
