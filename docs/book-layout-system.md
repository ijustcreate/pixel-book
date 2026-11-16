# Book layout profiles and review

The physical reader and shelf use separate decisions. `book-layout.js` defines the ten edition profiles, classifies page content, typesets prose and audits the resulting layout. `book-typography.js` measures chapter lettering and supplies its body exclusion region. Paper geometry is shared with the existing turn renderer.

## Layout decisions

- Prose uses the selected loaded pixel font at one consistent 11.5 material-pixel body size. Measure glyph widths and line metrics before dividing text into pages. A font change repeats composition instead of shrinking every page to fit a former font's divisions.
- Continue paragraphs across imported PDF page boundaries. Reserve each chapter heading's measured height; only section endings may finish with a short text block. Normal pages use all complete body lines above the folio zone.
- Preserve title pages, contents, plates, mixed illustration pages, verse line structure, author edits and marked fragments. Romeo and Juliet uses the dedicated play strategy in `play-layout.js`: preserve logical source lines while wrapping them with hanging indents, distinguish speakers/stage directions and keep labels with dialogue. Acts retain divider pages; scene headings reserve their own measured region. Illustration/body exclusion regions continue to be measured by the physical renderer.
- Preserve source-page and word-span coordinates. Chapter links resolve to the actual nearby heading. Reading position follows its source passage.
- When migrating or changing font, pin edited/marked reading fragments to their source spans. Store those user-authored fragments with the original-edition snapshot; keep ordinary derived novel pages out of localStorage. Each shelf copy owns its derived edition identity.
- Keep the source volume's physical thickness when reading pagination changes. Peter Pan has an explicit shorter, wider shelf model (length 390, cover width 344, spine scale 1.16); other shelf models retain their dimensions.

## Review coverage

Reviewed body/chapter or verse/contents spreads for Dracula, Frankenstein, Dorian Gray, Peter Pan, The Divine Comedy, The Time Machine, Common Sense, The Secret Garden, Romeo and Juliet, and illustrated Inferno. Common Sense now classifies its author/title prefix as opening furniture. The Divine Comedy's final two prose pages are recognized as back matter rather than underfilled verse pages.

`docs/book-layout-audit.json` records the latest default-font all-page audit. Normal prose pages averaged about 97.8% of their usable body height. Chapter endings, source verse, illustrations and authored pages are intentionally exempt from a uniform fill target. These are measurements, not a claim that every source extraction is editorially perfect.

## Verification

- `node scripts/audit-book-layout.cjs`: classify and measure all bundled pages, recording overflow and unexpected underfill.
- `node scripts/review-book-layouts.cjs`: capture representative spreads and a contact sheet, and verify Peter Pan shelf dimensions.
- `node scripts/verify-reading-editions.cjs`: compare all prose words and order, contents ranges, edition switching, saved edits, copies and reload.
- `node scripts/verify-reading-pixel-font.cjs`: actual pixel-font fit on every generated prose page; font-change passage preservation. Supports BOOK_QA_EXE.
- `node scripts/verify-layout-migration.cjs`: migrate an old edited/illustrated/bookmarked page, preserve its text and art exactly, change font, then reload.
- `node scripts/verify-book-typography.cjs`: heading/body separation and an actual click through the printed contents.

Bump BOOK_LAYOUT_VERSION when changing pagination rules. Update an edition's profile rather than adding page-count heuristics in the renderer. Source verse and plate pagination stay available through Original pages.

## Play regression

`node scripts/verify-play-layout.cjs` compares all Romeo and Juliet words and nonblank source lines, measures every typed run, rejects stranded speaker labels, verifies all 31 contents destinations and checks passage retention across a font change. It supports BOOK_QA_EXE. Default Alagard composition measured about 91% average body-area use; the smaller stage-direction size is an intentional hierarchy.
