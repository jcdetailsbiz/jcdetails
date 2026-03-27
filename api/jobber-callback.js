// Jobber OAuth callback — runs once to exchange the authorization code for tokens.
// After this runs, copy the JOBBER_REFRESH_TOKEN value into your Vercel env vars.
module.exports = async function handler(req, res) {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('<h2>Error: no authorization code received from Jobber.</h2>');
  }

  const resp = await fetch('https://api.getjobber.com/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.JOBBER_CLIENT_ID,
      client_secret: process.env.JOBBER_CLIENT_SECRET,
      redirect_uri: 'https://jcdetails.com/api/jobber-callback',
      code,
    }),
  });

  const data = await resp.json();

  if (!data.refresh_token) {
    return res.status(500).send(`<h2>Error getting tokens</h2><pre>${JSON.stringify(data, null, 2)}</pre>`);
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Jobber Connected</title><style>
      body { font-family: sans-serif; max-width: 600px; margin: 60px auto; padding: 0 24px; }
      code { background: #f0f0f0; padding: 8px 12px; display: block; word-break: break-all; border-radius: 6px; margin: 8px 0 24px; }
    </style></head>
    <body>
      <h2>✅ Jobber Connected!</h2>
      <p>One last step — add this environment variable in your <strong>Vercel project settings</strong>:</p>
      <p><strong>Name:</strong> JOBBER_REFRESH_TOKEN</p>
      <p><strong>Value:</strong></p>
      <code>${data.refresh_token}</code>
      <p>Then redeploy and your quote form will create requests directly in Jobber.</p>
    </body>
    </html>
  `);
};
