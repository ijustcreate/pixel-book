# Page and insert quality contract

“AAA / AAAA” is a review standard here, not a certification or a promise of a particular frame rate. A change is ready when the visible failures in the supplied recordings are addressed together, saved books survive the update, pointer interactions work in both directions, and the installed desktop application contains the verified source. A passing numerical test alone is insufficient: diagonal, crossing, landing and overhanging-card poses also require visual review.

The page uses a smooth, variable-curvature material surface. The page and inserts share an indexed WebGL depth buffer with alpha cutouts; a sorted-triangle Canvas renderer provides a fallback. This is a constrained animation model, not a finite-element paper simulation. Source text and illustration textures remain editable and use the same material coordinates as the paper.

| # | Page requirement | Implementation / acceptance |
|---|---|---|
| P1 | Eliminate diagonal staircase | 96 × 48 shared-vertex grid; face selection per rasterized triangle. Review diagonal poses on both sides. |
| P2 | Close dark slits | Indexed topology and alpha-aware depth writes. Opaque synthetic surface must have zero interior transparent pixels. |
| P3 | Correct front/back visibility | GPU winding selects front/reverse texture; test known red/blue faces. |
| P4 | Resolve overlap | Shared depth buffer independent of submission order; transparent cutouts expose the correct underlying object. |
| P5 | Replace uniform scroll | Smooth sigmoid tangent profile gives a changing bend radius, with bounded grip-controlled width. |
| P6 | Reduce rigid flap | Curvature extends continuously across the sheet instead of joining a cylinder to a planar flap. |
| P7 | Avoid permanent diagonal crease | Fold position and oblique axis vary continuously with pointer travel; no hard fold boundary. |
| P8 | Preserve proportions | Shape blends tangent angles rather than vertex positions. Check material distances across 90 poses and three stack depths. |
| P9 | Maintain binding tangent | Full binding edge remains attached; support tangents are integrated into the bend. |
| P10 | Limit downward extension | Whole-sheet axis resistance and a bounded radius solve keep the page above the lower reach limit. |
| P11 | Preserve text through curl | Both faces, glyphs, artwork and alpha edge use one set of material UVs. |
| P12 | Follow actual fold with shadows | Alpha-shaped sheet shadow is projected from the same surface onto each receiving page, clipped and softened. |
| P13 | Smooth drag reversals | A single arc-length-parameterized held arch covers low pulls, crossing and release. Its active bend grows from the grip; endpoint travel and quintic release easing avoid branch switches. Repeated forward/back sweeps check grip accuracy, material lengths and identical poses on return. |

## Review of `book current.gif` (1.0.34) — 13 new issues and fixes

| # | Visible issue | Change in 1.0.35 |
|---|---|---|
| 1 | Pulling up created a tall flag beyond the book | Bound the grab just outside the trim and cap lift response. |
| 2 | Pulling down dragged the opposite page edge off-screen | Limit whole-sheet vertical pitch; excess vertical pull now meets resistance. |
| 3 | The free edge formed a hanging hook | Reduce the mid-turn bow and constrain the held arch. |
| 4 | The sheet peaked into a sharp mountain | Start the bend later and let it expand as the grip travels. |
| 5 | Most of the leaf turned edge-on together | Localize the automatic crease from 118 to 82 material pixels. |
| 6 | The title illustration collapsed into a narrow ribbon | Preserve a broad readable panel; use a crease radius that grows modestly near mid-turn. |
| 7 | Text lines kinked at the moving curl | Reduce simultaneous rotation and keep a shared material mapping. |
| 8 | The crown formed a pointed peak | Add a small, reversible diagonal crease that eases to zero at rest. |
| 9 | The lower edge curled into a hook | Reduce bow and let the peel expand only after the grip travels. |
| 10 | The curl solver did unnecessary work on every pointer frame | Use 96 arc samples and 14 length-solve steps, retaining subpixel grip accuracy. |
| 11 | The top corner escaped the book frame | Restrict upward pointer reach and lift. |
| 12 | The lower corner crossed the cover rail | Restrict downward reach and sheet pitch. |
| 13 | Extreme pulls distorted page height or left a stale shape on reversal | Keep vertical displacement bounded and retain one reversible, length-solved curve. |

The GIF review exposed the visible causes; verification also measures off-page extent across both drag directions and all four grip heights.

| # | Insert requirement | Implementation / acceptance |
|---|---|---|
| I1 | Consistent support point | Rigid frame derives from the supporting surface and material pose, including at pickup and landing. |
| I2 | Preserve overhang | Extrapolate edge tangents instead of clamping free-card material coordinates. |
| I3 | Preserve rectangular proportions | Orthonormal card frame maintains width/height through 36 folded/overhanging poses. |
| I4 | Independent stiffness | Cards bridge the sheet on a fitted plane; taped cards and feathers have limited compliant flex. |
| I5 | Maintain surface separation | Fit positive contact clearance across the local support patch; render a thin edge along the opaque contour. |
| I6 | Static friction before slip | Thresholded support-slope acceleration and damped, bounded material displacement; saved pose changes only on commit. |
| I7 | Rotational inertia | Separate damped angular response to the turning support. |
| I8 | Fold/card collision | Support-plane fit raises the card over local curvature; shared depth handles the remaining physical coverage. |
| I9 | Continuous landing transfer | Card follows the surface into its receiving support; uncovered and buried states are determined by geometry. Check cancellation and 20 round trips in both directions. |
| I10 | Independent card faces | Separate front/reverse card textures use card triangle winding; no whole-card hidden-face switch. |
| I11 | Insert contact shadow | Alpha-shaped shadow follows the supporting surface, with clearance-dependent opacity and offset; resting cards retain contact shadows. |
| I12 | Unambiguous pickup | Visible insert precedes underlying contents hit areas; hover outline, cursor and mount feedback distinguish the card. Verify actual mouse drag and reload persistence. |
| I13 | Inspection continuity | Lift/return use projected card axes, return recomputes its destination after resize, and flip uses perspective geometry. Tape state is explicit. |

## Review of `current state.gif` — systemic follow-up in 1.0.36

- A dragged insert now has one lifted screen-space pose while the pointer is down. Its saved page and material coordinates stay fixed across the gutter, and the release point selects its next support. A short eased contact moves the visible pose onto that page without a resize or rotation pop.
- The held-page solver hands off to the normal turn curve as the leaf approaches its destination. The handoff weight is monotonic and late-weighted, and manual release uses a longer eased landing so the grip does not jump while the fold relaxes.
- The automatic crease grows over the first third of the turn and its middle-turn angle relaxes before the final return to the flat endpoint. This softens the early edge-on roll while retaining exact resting endpoints and shared text/art UVs.
- Validation adds a real mouse drag across the gutter with saved-state checks before release and a settled-page check after release. The turn test checks monotonic release blending and bounds the grip's largest frame-to-frame movement.

## Verification

- `verify-paper-surface.cjs`: winding, per-pixel depth, alpha cutouts, watertight rasterization, 90 material/reach poses, 36 rigid-card poses, visual captures and Canvas fallback.
- `verify-natural-turn.cjs`: material grip, exact resting endpoints, commit/cancel timing and draw cost.
- `verify-turn-reversal.cjs`: 1,112 low-pull and full-spine-crossing poses, both sides and four grip heights; subpixel grip error, bounded shape steps and no forward/back shape drift.
- `verify-grab-shelf.cjs`: real corner/middle drags in both directions, short-pull cancellation, click turns and shelf navigation.
- `verify-insert-transfer.cjs`: pixel-based pickup/burial, supporting-page ownership, taped anchor, cancellation, 20 round trips per direction, real mouse pickup and saved-pose reload. This replaces old draw-call-count assumptions, which cannot establish GPU occlusion.
- `verify-insert-lift.cjs`: lift, perspective flip, exact return pose, tape, resize, keyboard/outside dismissal and persistence.
- `verify-edge-bookmarks.cjs`: all four protruding edges, buried visibility, exposed hit areas and saved-book round trips.

Desktop release verification must run against the packaged executable with an isolated profile. Back up the real profile while the app is closed, install the release, compare runtime file hashes, and resolve the actual desktop shortcut target and executable version. Do not substitute a browser build for this gate.

## Installed release

Version 1.0.36 was installed through the Windows installer. All 18 packaged runtime files match the working source, the installed executable reports 1.0.36, and both `Pixel Book.lnk` and `The Book.lnk` resolve to that executable. The saved-book profile was backed up before installation.

The packaged executable passed the depth, cutout and raster-gap checks; 90 automatic page poses; 36 card poses; 1,112 held-page reversal poses; the insert transfer and persistence suite; and the real cross-gutter card drag. The natural-turn check verified exact endpoints, monotonic held-to-free release, and a maximum 38.8-pixel grip step in its commit sample. The installed executable passed runtime identity, all 18 source hashes, WebGL2 renderer and geometry checks. Draw timings vary by machine and GPU; screenshots and the supplied GIF remain the visual acceptance reference.
