const { setContext, redirect } = require('../lib/context')

module.exports = async (req, res) => {
  const { ownerId, next } = req.query

  const githubConnectUrl =
    'https://github.com/login/oauth/authorize?' +
    require('querystring').stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      scope: 'repo'
    })

  setContext(res, { ownerId, next })
  redirect(res, githubConnectUrl)
}
