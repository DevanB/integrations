const fsRoutes = dir => path => {
  if (path.startsWith(dir)) {
    return false
  }

  return path
    .slice(dir.length) // /src/pages/ -> /
    .replace(/\.[a-z]+$/, '') // strip .js, .ts, ...
}

module.exports = [
  {
    dependency: 'next',
    routes: fsRoutes('pages')
  },
  {
    dependency: 'gatsby',
    routes: fsRoutes('src/pages')
  }
]
