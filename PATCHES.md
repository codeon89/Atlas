# CUMMULATIVE PATCHES

## Pending Patched Changes
  *Changes that's already on the fork and waiting to be reviewed for merge into original Atlas*
  - Removed the stale restart popup and hint on the Show debug console toggle — it applies immediately to all open windows.[#399](https://github.com/towerwatchman/Atlas/pull/399)
    - (Dev-Only) DevTools no longer auto-opens in dev mode unless explicitly enabled in config.
  - Update debounce logic for Browse and Library: Search in Catalog Browse and Library now debounces the text input and waits for a pause before filtering. Previously every keystroke updated `activeFilters.text` and ran `filterGamesWithState` (Library) or scheduled a catalog fetch, causing input lag on large libraries and a wasted local-filter pass even while browsing the server-side catalog. The input still echoes instantly from local state; clear bypasses the delay.[#398](https://github.com/towerwatchman/Atlas/pull/398)


## Exclusive Fork Changes
  *Any fork-only changes that is not accepted for merged from upstream*
  - LewdCorner member tier detection. Atlas now scrapes your LewdCorner account's shop page to determine your membership tier (Standard / Plus) and stores it alongside your credentials. Browse filters content by tier so Plus users see everything while Standard or non-login users only see what their subscription allows.[#391](https://github.com/towerwatchman/Atlas/pull/391)

## Fork's System Change
  *internal change that's not features but backend requirement for forks to release self-builds*
  - Support Linux builds & patch ci runs. [#20](https://github.com/codeon89/Atlas/pull/20)
  - Support `[no-build]` detection in your HEAD commit message when pushing without wanting a release (docs or changelog-only pushes) or merge existing change from original Atlas.[#19](https://github.com/codeon89/Atlas/pull/19) 
  - Nightly-Patched releases: the fork ships its own Windows + Linux installer line (`{base}-patched.nightly.{nightly}.{p}`) with a third update channel under Settings > App Updates. Patched builds check only the fork feed; upstream nightlies surface as a read-only notice, never a download. See `docs/FORK-PATCHED-RUNBOOK.md`. [#19](https://github.com/codeon89/Atlas/pull/19)


## Merged to thetowerman/Atlas's Nightly
  - Catalog tag filtering now matches Library and use exact-token filtering (avoid issue of -male +female return no result).[#394](https://github.com/towerwatchman/Atlas/pull/394)
  - Fixed MEGA v1 test timeout — legacy key derivation is intentionally slow and needed a longer test timeout.[#392](https://github.com/towerwatchman/Atlas/pull/392)
  - Fix multiple executable chooser rendering logic, and redo the executable chooser UI.[#389](https://github.com/towerwatchman/Atlas/pull/389)
  - Fixed bat file launcher for Atlas.[#388](https://github.com/towerwatchman/Atlas/pull/388)
  - Allow setting folder and program locations by typing or paste a path directly besides using Browse / Select Folder button.[#385](https://github.com/towerwatchman/Atlas/pull/385)
  - Allow Win download links to show up for Linux platform since Linux can run both Linux version and also use Wine to run Win executable.[#377](https://github.com/towerwatchman/Atlas/pull/377)
  - Support Local Previews Management: [#379](https://github.com/towerwatchman/Atlas/pull/379)
    - Add Media Upload UI, support Custom Previews via file picker, drag upload or URL upload.
    - Add drag sort interaction in MediaTab, preserve sorting order.
    - Fix existing Downloaded Assets Issues not skip already-download entries.
  - Add scrolling to Downloads page.The scrollbar is hidden but it will show up if hover on the right side.[#376](https://github.com/towerwatchman/Atlas/pull/376)
  - Add Buzzheavier host support (`buzzheavier.com`, `bzzhr.to`, `bzzhr.co`). Note: Each time IP change there will be a quick Cloudflare auto-resolve window, and the challenge result will persist (certain cookies from the throwaway partition is persist instead of complete partition removal prior).[#375](https://github.com/towerwatchman/Atlas/pull/375)
  - Add release verstion github page redirect when clicking on app version [#373](https://github.com/towerwatchman/Atlas/pull/373)
  - Fixed the colour pickers in the Banner Editor's Layout tab closing as soon as the colour changed, so the slider and shade square could only be click-selected and never dragged open. The per-field editor (`Inspector`) was defined *inside* the editor's render body, which makes React treat it as a new component type on every re-render; the first `onChange` re-rendered the editor, remounted the whole inspector, and destroyed the `<input type="color">` the native dialog was bound to. `Inspector` is now module-scope and takes its state as props, so its identity is stable and the picker stays open through a drag. Size & Image and Panels tabs were unaffected.[#372](https://github.com/towerwatchman/Atlas/pull/372)
  - Implement add/remove wishlist in Browse mode context menu that trigger `toggleWishlist` action for non-local rows, Using optimistc UI approach to dispatch the db update, and the success broadcast triggers the renderer so grid view without triggering full refresh. The `wishlist-updated` broadcast is now source-tagged: context-menu toggles skip the catalog refetch (optimistic UI already flipped the row), while the extension path keeps it (no optimistic UI exists there). [#368](https://github.com/towerwatchman/Atlas/pull/368)
  - Fixed slow "wishlist only" filtering in Browse and Library by 1. Adding indexes on columns used in query and 2. Splitting a single multi-OR subquery into separate EXISTS clauses. [#367](https://github.com/towerwatchman/Atlas/pull/367)
  - Fix and remove the redundant isWishlistEntry memory flag which was set but never unset and cause unexpected behavior on entry display regarding wishlist. The isWishlisted logic will check the data from wishlist_entries instead. Note: the IPC behavior is not related and not updated. [#366](https://github.com/towerwatchman/Atlas/pull/366)
  - Remove the 'has Steam mapping' quick filter. [#360](https://github.com/towerwatchman/Atlas/pull/360)


