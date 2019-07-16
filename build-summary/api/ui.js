const { withUiHook, htm } = require('@zeit/integration-utils')
const { getStore } = require('../lib/mongo')
const getStrategy = require('../lib/strategy')
const qs = require('querystring')

module.exports = withUiHook(async ({ payload }) => {
  const store = await getStore()
  const ownerId = payload.team ? payload.team.id : payload.user.id

  const record = await store.findOne({ ownerId })

  const providers = ['github', 'gitlab']

  const strategies = providers.map(provider => ({
    provider,
    strategy: getStrategy(provider)
  }))

  const connections = await Promise.all(
    strategies.map(async ({ provider, strategy }) => {
      const token = record[provider + 'Token']
      let user
      if (token) {
        const client = strategy.createClient(token)
        user = await strategy.getUser(client)
      }
      return { provider, token, user, strategy }
    })
  )

  const connected = connections.filter(c => c.user)
  const disconnected = connections.filter(c => !c.user)

  const connectUi = ({ provider }) => htm`
    <Box marginTop="15px" justifyContent="center">
      <Link href=${process.env.INTEGRATION_URL +
        '/api/connect?' +
        qs.stringify({ ownerId, next: payload.installationUrl, provider })}>
        <Button>Connect to ${provider}</Button>
      </Link>
    </Box>`

  const card = ({ avatar, username, provider }) => htm`
    <Box display="flex" flexDirection="column" backgroundColor="#fff" border="1px solid #eaeaea" borderRadius="5px" overflow="hidden" maxWidth="400px">
      <Box display="flex" padding="15px" flexDirection="column">
        <Box display="flex" alignItems="center">
          <Box display="flex" borderRadius="50%" height="50px" width="50px" overflow="hidden">
            <Img src=${avatar} width="100%" />
          </Box>
          <Box marginLeft="20px">
            <Box display="flex" fontSize="18px" fontWeight="bold">${username}</Box>
            <Box display="flex" color="#666">${provider}</Box>
          </Box>
        </Box>
      </Box>
    </Box>`

  return htm`<Page>
    ${
      connected.length > 0
        ? htm`<Box marginBottom="10px" fontSize="18px" fontWeight="bold">Connected to the following account:</Box>`
        : htm`<P>You need to connect to Github or Gitlab to enable this integration:</P>`
    }

    ${connected.map(c =>
      card({
        avatar: c.user.avatar_url,
        username: c.user.login,
        provider: c.provider
      })
    )}

    ${disconnected.map(c => connectUi({ provider: c.provider }))}
  </Page>`
})
