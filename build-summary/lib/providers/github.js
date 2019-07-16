const fetch = require('../fetch')
const Octokit = require('@octokit/rest')
const qs = require('querystring')

module.exports = {
  // OAUTH FLOW
  getAuthorizeEndpoint() {
    return (
      'https://github.com/login/oauth/authorize?' +
      qs.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        scope: 'repo'
      })
    )
  },
  async getToken(code) {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: qs.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code
      })
    })

    if (!res.ok) throw new Error()

    return (await res.json()).access_token
  },

  // GITHUB API BRIDGE
  createClient(token) {
    return Octokit({ auth: token })
  },
  async getUser(client) {
    const { data: user } = await client.users.getAuthenticated()
    return user
  },
  async getPull(client, { org, repo, head }) {
    const {
      data: [pull]
    } = await client.pulls.list({
      owner: org,
      repo,
      head,
      state: 'open'
    })
    if (!pull) return null
    return {
      id: pull.number,
      base: pull.base.ref
    }
  },
  async getDiff(client, { org, repo, base, head }) {
    const { data: comparison } = await client.repos.compareCommits({
      owner: org,
      repo,
      base,
      head
    })

    const deleted = []
    const modified = []

    for (let file of comparison.files) {
      if (file.status === 'removed') {
        deleted.push(file.filename)
      } else {
        modified.push(file.filename)
      }
    }

    return { deleted, modified }
  },
  async upsertComment(client, { org, repo, pullId, body }) {
    const { data: comments } = await client.issues.listComments({
      owner: org,
      repo,
      issue_number: pullId
    })

    const comment = comments.find(comment =>
      comment.body.startsWith('#### 📝Changed routes:')
    )

    if (!comment) {
      await client.issues.createComment({
        owner: org,
        repo,
        issue_number: pullId,
        body
      })
    } else {
      await client.issues.updateComment({
        owner: org,
        repo,
        comment_id: comment.id,
        body
      })
    }
  }
}
