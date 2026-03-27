// One-time setup: visit /api/jobber-setup to authorize your Jobber account.
// After authorizing, Jobber redirects to /api/jobber-callback with your tokens.
module.exports = function handler(req, res) {
  const params = new URLSearchParams({
    client_id: process.env.JOBBER_CLIENT_ID,
    redirect_uri: 'https://jcdetails.com/api/jobber-callback',
    response_type: 'code',
  });
  res.redirect(302, `https://api.getjobber.com/api/oauth/authorize?${params}`);
};
