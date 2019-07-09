const { getStore } = require('../lib/mongo')
const { getToken } = require('../lib/github')
const { getContext, setContext, redirect } = require('../lib/context')

module.exports = async (req, res) => {
  const { code } = req.query

  const { ownerId, next } = getContext(req)

  console.log(`github oauth: exchanging code for token for user ${ownerId}`)

  const githubToken = await getToken(code)

  const store = await getStore()
  await store.updateOne({ ownerId }, { $set: { githubToken } })

  console.log(`github oauth: done, redirecting to ${next}`)

  setContext(res, {})
  redirect(res, next)
}
