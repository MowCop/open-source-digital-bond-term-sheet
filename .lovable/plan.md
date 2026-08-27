# Correct the AI Extraction review pulse

## Goal
Make the review-panel border complete exactly one slow pulse every 2 seconds. If that timing is not reliable in the rendered app, remove the pulse rather than leave a distracting fast animation.

## Implementation
1. Inspect the open review dialog in the live app and measure its computed `animation-name`, `animation-duration`, and visible border/shadow state over time to identify any cascade, duplicated animation, or rendering conflict.
2. Replace the current combined border-and-shadow animation with a single, isolated review-dialog animation whose full cycle is explicitly `2000ms`, using stable keyframe phases and reduced visual intensity so one cycle reads as one pulse.
3. Preserve the existing behavior that stops animation immediately after the first accepted or rejected suggestion.
4. Add reduced-motion handling so the border remains static when motion reduction is enabled.
5. Verify in the live modal that only one visual peak occurs per two-second cycle and that interaction removes the animation immediately. If that cannot be demonstrated reliably, remove the animation class and retain the bright static border.

## Technical details
- Scope changes to the review modal and its animation CSS only.
- Validate computed styles and sample the rendered border/shadow across multiple cycles rather than checking only whether the CSS class exists.
