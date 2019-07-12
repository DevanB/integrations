const ellipsis = (txt, l = 25) => {
  return txt.length > l ? `…${txt.slice(-22)}` : txt
}

const createComment = ({ sha, url, screenshots, rest = [] }) => {
  // group by screenshots by 3
  const grouped = screenshots.reduce((pv, cv, i) => {
    const j = Math.floor(i / 2)
    ;(pv[j] || (pv[j] = [])).push(cv)
    return pv
  }, [])

  return `#### 📝Changed routes:
${grouped.map(
  group => `
<table>
  <thead>
    <tr>
      ${group
        .map(
          ({ routeUrl, route }) =>
            `<th>
              <a href="${routeUrl}">
                <code>${ellipsis(route)}</code>
              </a>
            </th>`
        )
        .join('')}
    </tr>
  </thead>
  <tbody>
    <tr>
      ${group
        .map(
          ({ routeUrl, route, screenshotUrl }) =>
            `<td align="center" valign="top">
              <a href="${routeUrl}">
                <img src="${screenshotUrl}" alt="Screenshot of ${route}" width="300">
              </a><br /><sup><a href="${screenshotUrl}&fullPage=true">(view full size)</a></sup>
            </td>`
        )
        .join('')}
    </tr>
  </tbody>
</table>
`
)}
${
  rest.length > 0
    ? `And ${rest.length} other routes:
${rest
  .map(
    ({ route, routeUrl }) =>
      `- <a href="${routeUrl}"><code><b>${route}</b></code></a>`
  )
  .join('\n')}`
    : ''
}
Commit ${sha} (${url}).`
}

module.exports = { createComment }
