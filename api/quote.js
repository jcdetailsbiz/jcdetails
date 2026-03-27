// Handles quote form submissions:
// 1. Creates client + request in Jobber
// 2. Sends email to jcdetailsbiz@gmail.com + text to Verizon gateway
// 3. Redirects customer to /quote/thanks/
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.redirect(303, '/quote/');
  }

  const body = req.body || {};
  const firstName = (body['First Name'] || '').trim();
  const lastName  = (body['Last Name']  || '').trim();
  const phone     = (body['Phone']      || '').trim();
  const service   = (body['Service']    || '').trim();

  // Submit to Jobber (non-blocking — customer still reaches thanks page on failure)
  try {
    const token    = await getAccessToken();
    const clientId = await createClient(token, firstName, lastName, phone);
    await createRequest(token, clientId, service, firstName, lastName, phone);
  } catch (err) {
    console.error('Jobber submission error:', err.message);
  }

  // Email + SMS notification
  try {
    await fetch('https://formsubmit.co/ajax/jcdetailsbiz@gmail.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        'First Name': firstName,
        'Last Name':  lastName,
        'Phone':      phone,
        'Service':    service,
        '_subject':   'New Quote Request — JC Details LLC',
        '_cc':        '5082697667@vtext.com',
      }),
    });
  } catch (err) {
    console.error('Email/SMS notification error:', err.message);
  }

  res.redirect(303, '/quote/thanks/');
};

// ── Jobber helpers ────────────────────────────────────────────────────────────

async function getAccessToken() {
  // Read refresh token from KV (auto-updates on each use), fall back to env var
  const refreshToken = await kvGet('jobber_refresh_token') || process.env.JOBBER_REFRESH_TOKEN;

  const resp = await fetch('https://api.getjobber.com/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     process.env.JOBBER_CLIENT_ID,
      client_secret: process.env.JOBBER_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error(JSON.stringify(data));

  // Store the new rotated refresh token so the next call works
  if (data.refresh_token) await kvSet('jobber_refresh_token', data.refresh_token);

  return data.access_token;
}

// ── Vercel KV helpers (REST API, no package needed) ───────────────────────────

async function kvGet(key) {
  try {
    const resp = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    });
    const data = await resp.json();
    return data.result || null;
  } catch (_) { return null; }
}

async function kvSet(key, value) {
  try {
    await fetch(`${process.env.KV_REST_API_URL}/set/${key}/${encodeURIComponent(value)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    });
  } catch (_) {}
}

async function gql(token, query, variables) {
  const resp = await fetch('https://api.getjobber.com/api/graphql', {
    method: 'POST',
    headers: {
      Authorization:              `Bearer ${token}`,
      'Content-Type':             'application/json',
      'X-JOBBER-GRAPHQL-VERSION': '2024-05-15',
    },
    body: JSON.stringify({ query, variables }),
  });
  return resp.json();
}

async function createClient(token, firstName, lastName, phone) {
  const result = await gql(token, `
    mutation ClientCreate($input: ClientCreateInput!) {
      clientCreate(input: $input) {
        client { id }
        userErrors { message path }
      }
    }
  `, {
    input: {
      firstName,
      lastName,
      phones: [{ number: phone, primary: true }],
    },
  });

  const errors = result?.data?.clientCreate?.userErrors;
  if (errors?.length) throw new Error(JSON.stringify(errors));

  const client = result?.data?.clientCreate?.client;
  if (!client) throw new Error('No client returned: ' + JSON.stringify(result));
  return client.id;
}

async function createRequest(token, clientId, service, firstName, lastName, phone) {
  const result = await gql(token, `
    mutation RequestCreate($input: RequestCreateInput!) {
      requestCreate(input: $input) {
        request { id }
        userErrors { message path }
      }
    }
  `, {
    input: {
      clientId,
      title:   service,
      message: `Service: ${service}\nName: ${firstName} ${lastName}\nPhone: ${phone}`,
    },
  });

  const errors = result?.data?.requestCreate?.userErrors;
  if (errors?.length) throw new Error(JSON.stringify(errors));
}
