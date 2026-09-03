'use strict'

const axios = require('axios')

// Only a published, installable Windows nightly counts: drafts and builds
// still uploading their installer or manifest must never notify.
function nightlyNotice(releases, lastSeenTag) {
  if (!Array.isArray(releases)) throw new Error('Invalid upstream releases response')
  const nightly = releases.filter((release) => {
    const assets = release.assets?.filter((asset) => asset.state === 'uploaded' && asset.size > 0) || []
    return !release.draft && release.prerelease && release.published_at &&
      /^v\d+\.\d+\.\d+-nightly\.\d+$/.test(release.tag_name) &&
      assets.some((asset) => asset.name === 'nightly.yml') &&
      assets.some((asset) => asset.name.endsWith('.exe'))
  }).sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
  const latest = nightly[0]
  if (!latest || latest.tag_name === lastSeenTag) return null
  const seenIndex = nightly.findIndex((release) => release.tag_name === lastSeenTag)
  return {
    tag: latest.tag_name,
    version: latest.tag_name.slice(1),
    // Count catch-up releases within the fetched page only; anything older
    // still yields a latest-release notice, never an invented exact count.
    count: seenIndex > 0 ? seenIndex : null,
    url: `https://github.com/towerwatchman/Atlas/releases/tag/${encodeURIComponent(latest.tag_name)}`,
  }
}

// Read-only by design: this never touches electron-updater's feed or a pending
// installer. A failed request leaves the stored receipt alone.
async function fetchNightlyNotice(lastSeenTag) {
  const { data } = await axios.get('https://api.github.com/repos/towerwatchman/Atlas/releases', {
    params: { per_page: 100 },
    timeout: 15000,
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Atlas-Fork-Upstream-Check' },
  })
  return nightlyNotice(data, lastSeenTag)
}

module.exports = { nightlyNotice, fetchNightlyNotice }
