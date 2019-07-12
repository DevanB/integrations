const { getStore } = require('../lib/mongo')
const nanoid = require('nanoid')
const { createComment } = require('../lib/comment')
const {
  upsertComment,
  createGithubClient,
  getPulls,
  getDiff
} = require('../lib/github')
const { ZeitClient } = require('@zeit/integration-utils')
const frameworks = require('../lib/frameworks')

module.exports = async (req, res) => {
  const event = req.body

  console.log('received event:', event)

  const { type, ownerId, teamId, payload } = event

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

  // retrieve zeit token and github token
  const store = await getStore()
  const { token, githubToken } = await store.findOne({ ownerId })

  if (!githubToken) {
    console.log(`ignoring event: ${ownerId} does not have a github token`)
    return res.send()
  }

  // get package.json content
  const zeitClient = new ZeitClient({ token, teamId })
  const deploymentFiles = await zeitClient.fetchAndThrow(
    `/v5/now/deployments/${payload.deploymentId}/files`,
    {}
  )
  const srcDir = deploymentFiles.find(
    file => file.name === 'src' && file.type === 'directory'
  )
  const packageJsonFile = (srcDir ? srcDir.children : []).find(
    file => file.name === 'package.json' && file.type === 'file'
  )
  if (!packageJsonFile) {
    console.log('ignoring event: no package.json found in the root folder')
    return res.send()
  }
  const packageJsonRes = await zeitClient.fetch(
    `/v5/now/deployments/${payload.deploymentId}/files/${packageJsonFile.uid}`,
    {}
  )
  if (!packageJsonRes.ok) {
    console.log('error: could not retrieve package.json content')
    return res.send()
  }
  const packageJsonContent = await packageJsonRes.text()

  // parse package.json
  let pkg = {}
  try {
    pkg = JSON.parse(packageJsonContent)
  } catch (err) {
    console.log('error: could not parse package.json')
    console.error(err)
    return res.send()
  }

  // look for a framework in deps
  const pkgDeps = { ...pkg.dependencies, ...pkg.devDependencies }
  const framework = frameworks.find(f => pkgDeps[f.dependency])
  if (!framework) {
    console.log('ignoring event: no framework dependency found in package.json')
    return res.send()
  }

  // configure behaviour based on framework
  const dir = framework.dir

  // get pull request associated to commit
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
