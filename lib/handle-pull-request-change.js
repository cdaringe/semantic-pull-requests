module.exports = handlePullRequestChange

const isSemanticMessage = require('./is-semantic-message')
const getConfig = require('probot-config')

const DEFAULT_OPTS = {
  titleOnly: false,
  commitsOnly: false,
  titleAndCommits: false,
  anyCommit: false,
  scopes: null,
  types: null,
  allowMergeCommits: false,
  allowRevertCommits: false,
  allowEmptyScope: true,
  targetUrl: 'https://github.com/probot/semantic-pull-requests'
}

async function commitsAreSemantic (context, scopes, types, allCommits = false, allowMergeCommits, allowRevertCommits, allowEmptyScope) {
  const commits = await context.github.pulls.listCommits(context.repo({
    pull_number: context.payload.pull_request.number
  }))

  return commits.data
    .map(element => element.commit)[allCommits ? 'every' : 'some'](commit => isSemanticMessage(
      commit.message,
      scopes,
      types,
      allowMergeCommits,
      allowRevertCommits,
      allowEmptyScope
    ))
}

async function handlePullRequestChange (context) {
  const { title, head } = context.payload.pull_request
  const {
    titleOnly,
    commitsOnly,
    titleAndCommits,
    anyCommit,
    scopes,
    types,
    allowMergeCommits,
    allowRevertCommits,
    allowEmptyScope,
    targetUrl
  } = await getConfig(context, 'semantic.yml', DEFAULT_OPTS)
  const hasSemanticTitle = isSemanticMessage(title, scopes, types, false, false, allowEmptyScope)
  const hasSemanticCommits = await commitsAreSemantic(
    context,
    scopes,
    types,
    (commitsOnly || titleAndCommits) && !anyCommit,
    allowMergeCommits,
    allowRevertCommits,
    allowEmptyScope
  )

  let isSemantic

  if (titleOnly) {
    isSemantic = hasSemanticTitle
  } else if (commitsOnly) {
    isSemantic = hasSemanticCommits
  } else if (titleAndCommits) {
    isSemantic = hasSemanticTitle && hasSemanticCommits
  } else {
    isSemantic = hasSemanticTitle || hasSemanticCommits
  }

  const state = isSemantic ? 'success' : 'failure'

  function getDescription () {
    if (isSemantic && titleAndCommits) return 'ready to be merged, squashed or rebased'
    if (!isSemantic && titleAndCommits) return 'add a semantic commit AND PR title'
    if (hasSemanticTitle && !commitsOnly) return 'ready to be squashed'
    if (hasSemanticCommits && !titleOnly) return 'ready to be merged or rebased'
    if (titleOnly) return 'add a semantic PR title'
    if (commitsOnly && anyCommit) return 'add a semantic commit'
    if (commitsOnly) return 'make sure every commit is semantic'
    return 'add a semantic commit or PR title'
  }

  const status = {
    sha: head.sha,
    state,
    target_url: targetUrl,
    description: getDescription(),
    context: 'Semantic Pull Request'
  }
  const result = await context.github.repos.createStatus(context.repo(status))
  return result
}
