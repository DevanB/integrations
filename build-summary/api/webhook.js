const { getStore } = require('../lib/mongo')
const nanoid = require('nanoid')
const { createComment } = require('../lib/comment')
const { ZeitClient } = require('@zeit/integration-utils')
const frameworks = require('../lib/frameworks')
const getStrategy = require('../lib/strategy')

module.exports = async (req, res) => {
  const event = req.body
  const { type, ownerId, teamId, payload } = event

  // not a deployment-ready event
  if (type !== 'deployment-ready') {
    return res.send()
  }

  const { meta } = payload.deployment

  let provider
  if (meta.githubDeployment) {
    provider = 'github'
  } else if (meta.gitlabDeployment) {
    provider = 'gitlab'
  }

  // not a "git" deployment
  if (!provider) {
    return res.send()
  }

  console.log(JSON.stringify(event, null, 2))

  const {
    [provider + 'Org']: org,
    [provider + 'Repo']: repo,
    [provider + 'CommitSha']: commitSha,
    [provider + 'CommitOrg']: commitOrg,
    [provider + 'CommitRef']: commitRef
  } = meta
  console.log('deployment ready', { ownerId, repo, org, commitSha })

  // retrieve zeit token and github token
  const store = await getStore()
  const { token, [provider + 'Token']: providerToken } = await store.findOne({
    ownerId
  })

  if (!token || !providerToken) {
    console.log(`ignoring event: ${ownerId} does not have a ${provider}Token`)
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
  const strategy = getStrategy(provider)
  const providerClient = strategy.createClient(providerToken)
  const pull = await strategy.getPull(providerClient, {
    org,
    repo,
    head: `${commitOrg}:${commitRef}`
  })

  if (!pull) {
    console.log(`ignoring event: no PR associated with commit ${commitSha}`)
    return res.send()
  }

  const diff = await strategy.getDiff(providerClient, {
    org,
    repo,
    base: pull.base,
    head: `${commitOrg}:${commitSha}`
  })

  const routes = diff.modified.map(framework.routes).filter(Boolean)
  const deletedRoutes = diff.deleted.map(framework.routes).filter(Boolean)

  if (routes.length === 0 && deletedRoutes.length === 0) {
    console.log(`ignoring event: no changed route`)
    return res.send()
  }

  let deploymentUrl = `https://${payload.deployment.url}`
  let aliasUrl = null

  // if there's an alias, use alias url instead
  try {
    const { alias } = await zeitClient.fetchAndThrow(
      `/v9/now/deployments/${payload.deploymentId}`,
      {}
    )
    if (alias.length > 0) {
      aliasUrl = `https://${alias.pop()}`
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
  if (screenshots.length > 0) {
    await store.insertMany(screenshots)
  }

  const otherRoutes = routes.slice(max).map(route => ({
    route,
    routeLink: `${aliasUrl || deploymentUrl}${route}`
  }))

  console.log('writing PR comment...')
  const comment = createComment({
    commitSha,
    url: aliasUrl || deploymentUrl,
    screenshots,
    otherRoutes,
    deletedRoutes
  })
  await strategy.upsertComment(providerClient, {
    org,
    repo,
    pullId: pull.id,
    body: comment
  })

  return res.send()
}
