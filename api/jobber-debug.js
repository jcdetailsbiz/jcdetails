module.exports = async function handler(req, res) {
  const results = {};

  // Check env vars are set (don't show values)
  results.envVars = {
    JOBBER_CLIENT_ID:     process.env.JOBBER_CLIENT_ID     ? 'SET' : 'MISSING',
    JOBBER_CLIENT_SECRET: process.env.JOBBER_CLIENT_SECRET ? 'SET' : 'MISSING',
    JOBBER_REFRESH_TOKEN: process.env.JOBBER_REFRESH_TOKEN ? 'SET' : 'MISSING',
  };

  // Step 1: Get access token — show raw response
  try {
    const tokenResp = await fetch('https://api.getjobber.com/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        client_id:     process.env.JOBBER_CLIENT_ID,
        client_secret: process.env.JOBBER_CLIENT_SECRET,
        refresh_token: process.env.JOBBER_REFRESH_TOKEN,
      }),
    });

    const raw = await tokenResp.text();
    results.tokenRawResponse = raw;
    results.tokenStatus = tokenResp.status;

    let tokenData;
    try { tokenData = JSON.parse(raw); } catch (_) { tokenData = null; }

    if (tokenData?.access_token) {
      results.tokenResult = 'OK';
      const token = tokenData.access_token;

      // Step 2: Test clientCreate
      const clientResp = await fetch('https://api.getjobber.com/api/graphql', {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-JOBBER-GRAPHQL-VERSION': '2026-03-10',
        },
        body: JSON.stringify({
          query: `
            mutation ClientCreate($input: ClientCreateInput!) {
              clientCreate(input: $input) {
                client { id }
                userErrors { message path }
              }
            }
          `,
          variables: {
            input: {
              firstName: 'Test',
              lastName:  'User',
              phones: [{ number: '5085550000', primary: true }],
            },
          },
        }),
      });
      results.clientCreate = await clientResp.json();

      const clientId = results.clientCreate?.data?.clientCreate?.client?.id;
      if (clientId) {
        const reqResp = await fetch('https://api.getjobber.com/api/graphql', {
          method: 'POST',
          headers: {
            Authorization:  `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-JOBBER-GRAPHQL-VERSION': '2026-03-10',
          },
          body: JSON.stringify({
            query: `
              mutation RequestCreate($input: RequestCreateInput!) {
                requestCreate(input: $input) {
                  request { id }
                  userErrors { message path }
                }
              }
            `,
            variables: {
              input: {
                clientId,
                title: 'Test Request — Mobile Detailing',
              },
            },
          }),
        });
        results.requestCreate = await reqResp.json();
      }
    }
  } catch (err) {
    results.error = err.message;
  }

  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(results, null, 2));
};
