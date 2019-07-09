const { getStore } = require('../lib/mongo')
const fetch = require('../lib/fetch')
const nanoid = require('nanoid')
const { createComment } = require('../lib/comment')
const { upsertComment, createGithubClient } = require('../lib/github')

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
  const resPulls = await fetch(
    `https://api.github.com/repos/${org}/${repo}/commits/${sha}/pulls`,
    {
      headers: {
        authorization: `token ${githubToken}`,
        accept: 'application/vnd.github.groot-preview+json'
      }
    }
  )
  const jsonPulls = await resPulls.json()

  if (!resPulls.ok) {
    console.log('fetching pulls failed', jsonPulls)
    return res.status(500).send()
  }

  const [pull] = jsonPulls

  if (!pull) {
    console.log(`ignoring event: no PR associated with commit ${sha}`)
    return res.send()
  }

  const diffPath = `${pull.base.ref}...${sha}`
  const resDiff = await fetch(
    `https://api.github.com/repos/${org}/${repo}/compare/${diffPath}`,
    { headers: { authorization: `token ${githubToken}` } }
  )
  const diff = await resDiff.json()

  if (!resDiff.ok) {
    console.log('fetching diff failed', diff)
    return res.status(500).send()
  }

  const dir = 'pages'
  const url = `https://${payload.deployment.url}`

  const routes = diff.files
    .map(file => file.filename)
    .filter(f => f.startsWith(dir))
    .map(f => f.slice(dir.length).replace(/\.[a-z]+$/, ''))
    .map(route => ({ route, routeUrl: `${url}${route}` }))

  if (routes.length === 0) {
    console.log(`ignoring event: no changed page`)
    return res.send()
  }

  console.log('routes modified', routes)

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
  console.log('screenshots', screenshots)

  console.log('writing PR comment...')
  const comment = createComment({
    sha,
    url,
    screenshots,
    rest: routes.slice(max)
  })
  const githubClient = createGithubClient(githubToken)
  await upsertComment(githubClient, { org, repo, pull, body: comment })

  return res.send()
}
