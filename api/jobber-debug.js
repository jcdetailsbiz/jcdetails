// Temporary debug endpoint — visit /api/jobber-debug to test the Jobber connection.
// Remove this file once everything is working.
module.exports = async function handler(req, res) {
  const results = {};

  // Step 1: Get access token
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
    const tokenData = await tokenResp.json();
    results.token = tokenData.access_token ? 'OK — got access token' : tokenData;

    if (tokenData.access_token) {
      const token = tokenData.access_token;

      // Step 2: Test clientCreate
      const clientResp = await fetch('https://api.getjobber.com/api/graphql', {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-JOBBER-GRAPHQL-VERSION': '2023-11-15',
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

      // Step 3: If client was created, test requestCreate
      const clientId = results.clientCreate?.data?.clientCreate?.client?.id;
      if (clientId) {
        const reqResp = await fetch('https://api.getjobber.com/api/graphql', {
          method: 'POST',
          headers: {
            Authorization:  `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-JOBBER-GRAPHQL-VERSION': '2023-11-15',
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
