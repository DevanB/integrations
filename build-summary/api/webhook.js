const { getStore } = require('../lib/mongo')
const nanoid = require('nanoid')
const { createComment } = require('../lib/comment')
const { upsertComment, createGithubClient, getPulls } = require('../lib/github')

module.exports = async (req, res) => {
  const event = req.body

  console.log('received event:', event)

  const { type, ownerId, payload } = event

  if (type !== 'deployment-ready') {
    console.log(`ignoring event: type is ${event.type}`)
    return res.send()
  }

  const isGithub = !!event.payload.deployment.meta.githubDeployment

  if (!isGithub) {
    console.log(`ignoring event: not a github deployment`)
    return res.send()
  }

  const {
    githubCommitOrg: org,
    githubCommitRepo: repo,
    githubCommitSha: sha
  } = payload.deployment.meta
  console.log('deployment ready', { ownerId, repo, org, sha })

  // retrieve github token
  const store = await getStore()
  const { githubToken } = await store.findOne({ ownerId })

  if (!githubToken) {
    console.log(`ignoring event: ${ownerId} does not have a github token`)
    return res.send()
  }

  // get pulls associated to commit
  const githubClient = createGithubClient(githubToken)
  const [pull] = await getPulls(githubClient, { org, repo, sha })

  if (!pull) {
    console.log(`ignoring event: no PR associated with commit ${sha}`)
    return res.send()
  }

  const diff = await getDiff(githubClient, {
    org,
    repo,
    base: pull.base.ref,
    head: sha
  })

  const dir = 'pages'
  const url = `https://${payload.deployment.url}`

  const routes = diff
    .filter(f => f.startsWith(dir))
    .map(f => f.slice(dir.length).replace(/\.[a-z]+$/, ''))
    .map(route => ({ route, routeUrl: `${url}${route}` }))

  if (routes.length === 0) {
    console.log(`ignoring event: no changed page`)
    return res.send()
  }

  console.log('creating screenshots...')
  const max = 6
  const screenshots = routes.slice(0, max).map(route => {
    const screenshotId = nanoid()
    return {
      screenshotId,
      screenshotUrl: `${process.env.INTEGRATION_URL}/api/screenshot?screenshotId=${screenshotId}`,
      ...route
    }
  })
  await store.insertMany(screenshots)

  console.log('writing PR comment...')
  const comment = createComment({
    sha,
    url,
    screenshots,
    rest: routes.slice(max)
  })
  await upsertComment(githubClient, { org, repo, pull, body: comment })

  return res.send()
}
