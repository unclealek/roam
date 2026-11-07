# Welcome and sign-in screens

This describes the initial build 4 implementation. Scope 07.5 Phase 1 supersedes its visual components and generated artwork usage: see [the current report](design/scope-07-5-phase1/README.md). Approved mascot exports are missing; the current source uses a clean replacement slot and does not consume the generated illustration.

Implemented a greeting screen, three onboarding pages, and separate create-account / returning-player presentations of the existing Apple and Google sign-in flow. Signed-out Home entry routes to `/welcome`; `/sign-in` remains directly accessible. Onboarding can be skipped and revisited. It is not persisted as completed between launches.

The ivory, navy and blue design follows the three supplied reference photos. A single generated transparent mascot illustration is reused throughout. Name collection and legal links from the reference are not implemented: authentication still requires Apple or Google, and approved legal destinations were not available in this checkout.

Asset: `assets/onboarding/roam-mascot.png`. Generated with the built-in imagegen tool. Prompt: “Create a production app illustration asset, transparent background, no text or phone or UI. Match the blue fluffy Roam mascot in the supplied conversation references: round cobalt blue plush bunny-like creature, two long floppy asymmetrical antenna ears, tiny arms and stubby feet, glossy black friendly eyes, small blue nose, happy open smile with pink tongue. Full body joyfully jumping with arms open, front facing, rich tactile fine plush fur, beautifully lit soft 3D toy render. Center complete character with generous transparent margins, no accessories, no ground or background.”

Verification: TypeScript, ESLint, 19 existing authentication tests, web export, and Playwright navigation tests at 390px and 320px. Web screenshots reviewed for onboarding and login. Live provider authentication, native layout, and physical-device behavior remain unverified. No hosted backend changes or release deployment.
