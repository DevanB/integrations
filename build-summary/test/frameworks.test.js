const frameworks = require('../lib/frameworks')

const tests = [
  {
    name: 'next',
    packageJson: { dependencies: { next: '*' } },
    paths: [
      'pages/_app.js',
      'pages/_document.js',
      'components/button.js',
      'pages/index.js',
      'pages/test.js',
      'pages/doc.mdx',
      'pages/about/index.jsx',
      'pages/about/us.ts'
    ],
    routes: ['/', '/test', '/doc', '/about', '/about/us']
  }
].map(t => [t.name, t.packageJson, t.paths, t.routes])

test.each(tests)('%s', (name, packageJson, paths, routes) => {
  const pkgDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  }
  const framework = frameworks.find(f => pkgDeps[f.dependency])
  if (!framework && routes) {
    throw new Error(`Testing ${name}, framework not detected`)
  }

  const actualRoutes = paths.map(framework.routes).filter(Boolean)

  expect(actualRoutes).toEqual(expect.arrayContaining(routes))
  expect(routes).toEqual(expect.arrayContaining(actualRoutes))
})
