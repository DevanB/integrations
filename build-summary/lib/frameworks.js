const fsRoutes = dir => path => {
  if (!path.startsWith(dir)) {
    return false
  }

  return path
    .slice(dir.length) // /src/pages/ -> /
    .replace(/\.[a-z]+$/, '') // strip .js, .ts, ...
    .replace(/index$/, '') // strip index
}

module.exports = [
  {
    dependency: 'next',
    routes: path => {
      const route = fsRoutes('pages')(path)
      if (route === '_app' || route === '_document') {
        return false
      }
      return route
    }
  },
  {
    dependency: 'gatsby',
    routes: fsRoutes('src/pages')
  }
]
