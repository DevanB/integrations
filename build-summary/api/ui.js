const { withUiHook, htm } = require('@zeit/integration-utils')
const { getUser } = require('../lib/github')
const { getStore } = require('../lib/mongo')

module.exports = withUiHook(async ({ payload }) => {
  const store = await getStore()
  const ownerId = payload.team ? payload.team.id : payload.user.id

  const { githubToken } = await store.findOne({ ownerId })

  // if we don't have a github token
  // we invite the user to connect to github
  if (!githubToken) {
    const githubConnectUrl =
      `${process.env.INTEGRATION_URL}/api/github-connect?` +
      require('querystring').stringify({
        ownerId,
        next: payload.installationUrl
      })

    return htm`<Page>
        <P>You need to be connected to Github to use this integration:</P>
        <P><Link href=${githubConnectUrl}>Connect with Github</Link></P>
      </Page>`
  }

  const user = await getUser(githubToken)

  // if we have a github token, everything is fine
  return htm`<Page>
      <P>The integration is correctly setup. User: ${user.login}</P>
    </Page>`
})
