const ellipsis = (txt, l = 25) => {
  return txt.length > l ? `…${txt.slice(-22)}` : txt
}

const createComment = ({ commitSha, url, screenshots, rest = [] }) => {
  // group by screenshots by 3
  const grouped = screenshots.reduce((pv, cv, i) => {
    const j = Math.floor(i / 2)
    ;(pv[j] || (pv[j] = [])).push(cv)
    return pv
  }, [])

  return `#### 📝Changed routes:
${grouped.map(
  group => `

| ${group
    .map(({ routeLink, route }) => `[${ellipsis(route)}](${routeLink})`)
    .join(' | ')} |

| ${group
    .map(
      ({ routeLink, route }) =>
        `<a href="${routeLink}"><img src="${screenshotUrl}" alt="Screenshot of ${route}" width="300"></a>` +
        `<center><sup><a href="${screenshotUrl}&fullPage=true">(view full size)</a></center>`
    )
    .join(' | ')} |


`
)}
${
  rest.length > 0
    ? `And ${rest.length} other routes:
${rest
  .map(
    ({ route, routeLink }) =>
      `- <a href="${routeLink}"><code><b>${route}</b></code></a>`
  )
  .join('\n')}`
    : ''
}
Commit ${commitSha} (${url}).`
}

module.exports = { createComment }
