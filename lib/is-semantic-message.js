const commitTypes = Object.keys(require('conventional-commit-types').types)
const { validate } = require('parse-commit-message')

module.exports = function isSemanticMessage (
  message,
  validScopes,
  validTypes,
  allowMergeCommits,
  allowRevertCommits,
  allowEmptyScope
) {
  const isMergeCommit = message && message.startsWith('Merge')
  if (allowMergeCommits && isMergeCommit) return true

  const isRevertCommit = message && message.startsWith('Revert')
  if (allowRevertCommits && isRevertCommit) return true

  const { error, value: commits } = validate(message, true)

  if (error) {
    return false
  }

  const [result] = commits
  const { scope, type } = result.header
  const isScopeValid = (!validScopes || !scope || validScopes.includes(scope)) &&
    (allowEmptyScope ? true : !!scope)
  return (validTypes || commitTypes).includes(type) && isScopeValid
}
