const fetch = require('../fetch')
const qs = require('querystring')
const { Gitlab } = require('gitlab')

module.exports = {
  // OAUTH FLOW
  getAuthorizeEndpoint() {
    return (
      'https://gitlab.com/oauth/authorize' +
      qs.stringify({
        client_id: process.env.GITLAB_CLIENT_ID,
        response_type: 'code',
        redirect_uri: `${process.env.INTEGRATION_URL}/api/callback`
      })
    )
  },
  async getToken(code) {
    const res = await fetch('http://gitlab.com/oauth/token', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: qs.stringify({
        client_id: process.env.GITLAB_CLIENT_ID,
        client_secret: process.env.GITLAB_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.INTEGRATION_URL}/api/callback`
      })
    })

    if (!res.ok) {
      throw new Error()
    }

    const token = await res.json()
    return token.access_token
  },

  // GITLAB API BRIDGE
  createClient(token) {
    const client = new Gitlab({ oauthToken: token })
    return client
  },
  async getUser(client) {
    const user = await client.Users.current()
    return user
  },
  async getPull(client, { repo, head }) {
    const [pull] = await client.MergeRequests.all({
      projectId: repo,
      state: 'opened',
      source_branch: head
    })
    if (!pull) return null
    return {
      id: pull.iid,
      base: pull.target_branch
    }
  },
  async getDiff(client, { repo, base, head }) {
    const projectId = repo
    const from = base
    const to = head
    const comparison = await client.Repositories.compare(projectId, from, to, {
      straight: false
    })

    const deleted = []
    const modified = []

    for (let diff of comparison.diffs) {
      if (diff.deleted_file) {
        deleted.push(diff.old_path)
      } else {
        modified.push(diff.new_path)
      }
    }

    return { deleted, modified }
  },
  async upsertComment(client, { repo, pullId, body }) {
    const comments = await client.MergeRequestNotes.all(repo, pullId)

    const comment = comments.find(comment =>
      comment.body.startsWith('#### 📝Changed routes:')
    )

    if (!comment) {
      await client.MergeRequestNotes.create(repo, pullId, body)
    } else {
      await client.MergeRequestNotes.edit(repo, pullId, comment.id, body)
    }
  }
}
