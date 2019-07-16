const fetch = require('../fetch')
const qs = require('querystring')
const { Gitlab } = require('gitlab')

module.exports = {
  // OAUTH FLOW
  getAuthorizeEndpoint() {
    return (
      'https://gitlab.com/oauth/authorize?' +
      qs.stringify({
        client_id: process.env.GITLAB_CLIENT_ID,
        response_type: 'code',
        redirect_uri: `${process.env.INTEGRATION_URL}/api/callback`
      })
    )
  },
  async getToken(code) {
    const res = await fetch('https://gitlab.com/oauth/token', {
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
      const err = await res.json()
      console.log(err)
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
    if (!user) return null
    return {
      id: user.id,
      username: user.username,
      avatar: user.avatar_url,
      settings: 'https://gitlab.com/profile/applications'
    }
  },
  async getPull(client, { meta }) {
    const [pull] = await client.MergeRequests.all({
      projectId: meta.gitlabProjectId,
      state: 'opened',
      source_branch: meta.gitlabCommitRef,
      scope: 'all'
    })
    return pull
  },
  async getDiff(client, { meta, pull }) {
    const from = pull.target_branch
    const to = meta.gitlabCommitSha
    const comparison = await client.Repositories.compare(
      meta.gitlabProjectId,
      from,
      to,
      { straight: false }
    )

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
  async upsertComment(client, { meta, pull, body }) {
    const comments = await client.MergeRequestNotes.all(
      meta.gitlabProjectId,
      pull.iid
    )

    const comment = comments.find(comment =>
      comment.body.startsWith('#### 📝Changed routes:')
    )

    if (!comment) {
      await client.MergeRequestNotes.create(
        meta.gitlabProjectId,
        pull.iid,
        body
      )
    } else {
      await client.MergeRequestNotes.edit(
        meta.gitlabProjectId,
        pull.iid,
        comment.id,
        body
      )
    }
  },
  getCommitShaFromMeta(meta) {
    return meta.gitlabCommitSha
  }
}
