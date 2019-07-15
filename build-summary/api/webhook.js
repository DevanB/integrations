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

  const { type, ownerId, teamId, payload } = event

  if (type !== 'deployment-ready') {
    return res.send()
  }

  const isGithub = !!event.payload.deployment.meta.githubDeployment

  if (!isGithub) {
    return res.send()
  }

  console.log(JSON.stringify(event, null, 2))

  const {
    githubOrg: org,
    githubRepo: repo,
    githubCommitSha: commitSha,
    githubCommitOrg: commitOrg,
    githubCommitRef: commitRef
  } = payload.deployment.meta
  console.log('deployment ready', { ownerId, repo, org, commitSha })

  // retrieve zeit token and github token
  const store = await getStore()
  const { token, githubToken } = await store.findOne({ ownerId })

  if (!token || !githubToken) {
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

  // get pull request associated to commit
  const githubClient = createGithubClient(githubToken)
  const [pull] = await getPulls(githubClient, {
    org,
    repo,
    head: `${commitOrg}:${commitRef}`
  })

  if (!pull) {
    console.log(`ignoring event: no PR associated with commit ${commitSha}`)
    return res.send()
  }

  const diff = await getDiff(githubClient, {
    org,
    repo,
    base: pull.base.ref,
    head: `${commitOrg}:${commitSha}`
  })

  const routes = diff.map(framework.routes || (x => x)).filter(Boolean)

  if (routes.length === 0) {
    console.log(`ignoring event: no changed page`)
    return res.send()
  }

  let deploymentUrl = `https://${payload.deployment.url}`
  let aliasUrl = null

  // if there's an alias, use alias url instead
  try {
    const {
      aliases: [alias]
    } = await zeitClient.fetch(
      `/v2/now/deployments/${payload.deploymentId}/aliases`,
      {}
    )
    if (alias) {
      aliasUrl = `https://${alias}`
    }
  } catch (err) {
    console.warn('warning, error while fetching alias', err)
  }

  console.log('creating screenshots...')
  const max = 6
  const screenshots = routes.slice(0, max).map(route => {
    const screenshotId = nanoid()
    return {
      screenshotId,
      screenshotUrl: `${process.env.INTEGRATION_URL}/api/screenshot?screenshotId=${screenshotId}`,
      route,
      routeUrl: `${deploymentUrl}${route}`,
      routeLink: `${aliasUrl || deploymentUrl}${route}`
    }
  })
  await store.insertMany(screenshots)

  const rest = routes.slice(max).map(route => ({
    route,
    routeLink: `${aliasUrl || deploymentUrl}${route}`
  }))

  console.log('writing PR comment...')
  const comment = createComment({
    commitSha,
    url: aliasUrl || deploymentUrl,
    screenshots,
    rest
  })
  await upsertComment(githubClient, { org, repo, pull, body: comment })

  return res.send()
}
