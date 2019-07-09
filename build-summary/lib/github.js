const fetch = require('./fetch')
const Octokit = require('@octokit/rest')

const createGithubClient = token => {
  return Octokit({ auth: token })
}

const getToken = async code => {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: require('querystring').stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code: code
    })
  })

  if (!res.ok) {
    throw new Error('could not get token')
  }

  const token = await res.json()
  return token.access_token
}

const getUser = async githubClient => {
  const { data: user } = await githubClient.users.getAuthenticated()
  return user
}

const getPulls = async (githubClient, { org, repo, sha }) => {
  const {
    data: pulls
  } = await githubClient.repos.listPullRequestsAssociatedWithCommit({
    owner: org,
    repo,
    commit_sha: sha
  })
  return pulls
}

const getDiff = async (githubClient, { org, repo, base, head }) => {
  const { data: diff } = await githubClient.repos.compareCommits({
    owner: org,
    repo,
    base,
    head
  })
  return diff.files.map(file => file.filename)
}

const upsertComment = async (githubClient, { org, repo, pull, body }) => {
  const { data: comments } = await githubClient.issues.listComments({
    owner: org,
    repo,
    issue_number: pull.number
  })

  const comment = comments.find(comment =>
    comment.body.startsWith('#### 📝Changed routes:')
  )

  if (!comment) {
    await githubClient.issues.createComment({
      owner: org,
      repo,
      issue_number: pull.number,
      body
    })
  } else {
    await githubClient.issues.updateComment({
      owner: org,
      repo,
      comment_id: comment.id,
      body
    })
  }
}

module.exports = {
  createGithubClient,
  getUser,
  getToken,
  upsertComment,
  getPulls,
  getDiff
}
