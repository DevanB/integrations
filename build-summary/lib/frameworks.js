const changeCase = require('change-case')

const fsRoutes = dir => path => {
  if (!path.startsWith(dir)) {
    return false
  }

  path = path
    .slice(dir.length) // /src/pages/ -> /
    .replace(/\.[a-z]+$/, '') // strip .js, .ts, ...
    .replace(/index$/i, '') // strip index

  if (path !== '/' && path[path.length - 1] === '/') {
    path = path.slice(0, path.length - 1)
  }

  return path
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
  },
  {
    dependency: 'nuxt',
    routes: fsRoutes('pages')
  },
  {
    dependency: 'gridsome',
    routes: path => {
      const route = fsRoutes('src/pages')(path)
      return route
        .split('/')
        .map(changeCase.paramCase)
        .join('/')
    }
  },
  {
    dependency: 'sapper',
    routes: fsRoutes('src/routes')
  },
  {
    dependency: 'umi',
    routes: path => {
      const route = fsRoutes('pages')(path)
      if (route === 'document') {
        return false
      }
      return route
    }
  }
]
