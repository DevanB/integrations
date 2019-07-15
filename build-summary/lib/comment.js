const ellipsis = (txt, l = 25) => {
  return txt.length > l ? `…${txt.slice(-22)}` : txt
}

const escapeLinkTitle = txt => {
  // escape [ and ] with \
  return txt.replace(/\[/g, '\\[').replace(/\]/g, '\\]')
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

|${group
    .map(
      ({ routeLink, route }) =>
        ` [${escapeLinkTitle(ellipsis(route))}](${routeLink}) |`
    )
    .join('')}
|${':-:|'.repeat(group.length)}
|${group
    .map(
      ({ routeLink, route, screenshotUrl }) =>
        `<a href="${routeLink}"><img src="${screenshotUrl}" alt="Screenshot of ${route}" width="300"></a>` +
        '<br />' +
        `<sup><a href="${screenshotUrl}&fullPage=true">(view full size)</a>` +
        ' |'
    )
    .join('')}

`
)}
${
  rest.length > 0
    ? `And ${rest.length} other route${rest.length === 1 ? '' : 's'}:
${rest
  .map(
    ({ route, routeLink }) => `- [**${escapeLinkTitle(route)}**](${routeLink})`
  )
  .join('\n')}`
    : ''
}

Commit ${commitSha} (${url}).`
}

module.exports = { createComment }
