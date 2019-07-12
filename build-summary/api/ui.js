const { withUiHook, htm } = require('@zeit/integration-utils')
const { createGithubClient, getUser } = require('../lib/github')
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
        <Box>
          <P>You need to connect to Github to enable this integration:</P>
          <Box marginTop="15px" justifyContent="center">
            <Link href=${githubConnectUrl}>
              <Button>Connect to Github</Button>
            </Link>
          </Box>
        </Box>
      </Page>`
  }

  // if we have a github token, everything is fine
  const githubClient = createGithubClient(githubToken)
  const user = await getUser(githubClient)

  const card = ({ avatar, login, service }) => htm`
    <Box display="flex" flexDirection="column" backgroundColor="#fff" border="1px solid #eaeaea" borderRadius="5px" overflow="hidden" maxWidth="400px">
      <Box display="flex" padding="15px" flexDirection="column">
        <Box display="flex" alignItems="center">
          <Box display="flex" borderRadius="50%" height="50px" width="50px" overflow="hidden">
            <Img src=${avatar} width="100%" />
          </Box>
          <Box marginLeft="20px">
            <Box display="flex" fontSize="18px" fontWeight="bold">${login}</Box>
            <Box display="flex" color="#666">${service}</Box>
          </Box>
        </Box>
      </Box>
    </Box>
  `

  return htm`
    <Page>
      <Box marginBottom="10px" fontSize="18px" fontWeight="bold">
        Connected to the following account:
      </Box>
      ${card({ avatar: user.avatar_url, login: user.login, service: 'Github' })}
    </Page>
  `
})
