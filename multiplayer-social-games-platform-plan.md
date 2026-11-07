# MULTIPLAYER SOCIAL GAMES PLATFORM
## Master Codex Implementation Plan — Version 2

### 1. Product vision

Build a cross-platform mobile application where people can create groups, invite friends and participate in social games throughout the year.

The platform must support multiple independent game types.

The first game is Secret Santa, which includes several activities:

- Secret gift assignments
- Mind Match
- Discover the Secret Agent
- Secret Missions and Messages
- Final gift exchange

Secret Santa must not define the overall application's architecture, branding, navigation or database ownership.

Future games must be addable without rewriting the platform's core systems.

### 2. Technology

- Expo / React Native / TypeScript
- Expo Router
- Supabase Auth
- Supabase PostgreSQL
- Supabase Edge Functions
- PostgreSQL scheduled jobs
- Expo Notifications
- React Native Reanimated
- EAS Build and Submit

Use compatible stable versions and existing repository conventions.

### 3. Architecture principles

Separate code into three conceptual layers:

**Platform layer**

Owns authentication, profiles, groups, invitations, game catalog, game sessions, membership, scheduling, notifications, XP and collectibles.

**Game layer**

Each game owns its unique rules, database tables, screens, events and results.

**Presentation layer**

Provides common navigation, reusable UI components, animations, accessibility and theming.

Use a modular monolith initially. Do not introduce microservices or an unnecessarily complex plugin runtime.

Use a typed game registry to associate game identifiers with configuration validation, lifecycle handlers and screen routes.

All privileged game actions must be validated server-side.

### 4. Global Codex instructions

Before each scope:
1. Inspect the repository and current migrations.
2. Identify existing functionality that can be reused.
3. Present a short implementation plan.
4. Implement only the requested scope.

During implementation:
- Keep migrations versioned.
- Apply RLS to exposed tables.
- Store sensitive game data in protected schemas or behind authorized server functions.
- Never ship service-role secrets in the client.
- Make critical operations transactional and idempotent.
- Validate group membership, game membership and ownership server-side.
- Handle retries, network failures and concurrent requests.
- Use UTC for persisted timestamps and local time for presentation.
- Add tests for important business rules.

After each scope:
1. Run type checks, linting and relevant tests.
2. Summarize changes.
3. Identify outstanding risks.
4. Stop for review.

---

# SCOPE 01 — PLATFORM FOUNDATION

## Goal

Create the reusable application shell and user account system.

## Build

- Expo application with TypeScript and Expo Router.
- Apple and Google authentication.
- Persistent authentication sessions.
- User profiles with display names.
- Account deletion.
- Home screen.
- Games tab.
- Groups tab.
- Rewards tab.
- Profile tab.
- Shared design tokens and UI components.
- Loading, empty and error states.

The home screen must be game-neutral, not Christmas-themed.

## Database

`profiles`
- id
- display_name
- created_at
- updated_at

## Acceptance

Users can sign in, navigate the app, update their profiles and sign out.

---

# SCOPE 02 — GAME CATALOG & SESSION ENGINE

## Goal

Allow the platform to support multiple independent games.

## Build

Create a game catalog displaying available game types.

A game type defines:
- Unique identifier
- Name
- Description
- Icon or artwork
- Minimum and maximum players
- Supported configuration
- Availability status
- Game-specific route

Create game sessions with:
- Game type
- Host
- Optional associated group
- Configuration
- Status
- Created timestamp
- Started timestamp
- Finished timestamp

Suggested generic lifecycle:

DRAFT → LOBBY → ACTIVE → COMPLETED

Additional states:
CANCELLED and FAILED.

Do not force every game to use the same internal phases. Games may define their own substates.

## Database

- `game_types`
- `game_sessions`
- `game_session_members`

Use stable identifiers and foreign keys.

Store game-specific configuration in validated typed structures, not arbitrary unvalidated client JSON.

## Architecture

Implement a typed game registry.

For example:

`secret_santa` → Secret Santa routes, configuration schema and lifecycle handlers.

Future games can register their own modules.

Do not create a dynamic code-loading system.

## Acceptance

A developer can register a second placeholder game without changing the authentication, groups or rewards schema.

---

# SCOPE 03 — GROUPS & INVITATIONS

## Goal

Create reusable groups for playing different games.

## Build

- Create group.
- Join using invitation code.
- Share invitation.
- View members.
- Host permissions.
- Leave group.
- Remove members when permitted.
- Group settings.
- Group details.

Groups must be reusable across game sessions.

A group can host multiple game sessions over time.

Separate permanent group membership from participation in an individual game session.

Support temporary game sessions without requiring a permanent group.

## Database

- `groups`
- `group_members`
- `group_invites`

Use cryptographically unpredictable invite codes.

Add rate limiting and expiration where appropriate.

## Acceptance

One group can host a Secret Santa session today and another game session later without requiring users to create new accounts or groups.

---

# SCOPE 04 — SCHEDULING & NOTIFICATIONS

## Goal

Build reusable infrastructure for activities that occur over days or weeks.

## Build

- Scheduled activities.
- Unlock times.
- Expiration times.
- Activity completion.
- Push notifications.
- Notification preferences.
- Retry handling.
- Idempotent background processing.

The scheduler must work for any game type.

Support activity types such as:
- Question available
- Player turn available
- Clue unlocked
- Mission unlocked
- Game deadline
- Final result available

The scheduler must not depend on a mobile device remaining online.

## Database

- `scheduled_activities`
- `activity_participants`
- `notification_outbox`
- `device_push_tokens`

## Acceptance

An activity becomes available at the correct time even if the user has not opened the app for several days.

---

# SCOPE 05 — SHARED REWARDS & COLLECTIBLES

## Goal

Create a reward system reusable across games.

## Build

- XP transactions.
- Player level.
- Achievement definitions.
- Collectible card definitions.
- Card inventory.
- Game-specific reward eligibility.
- Reward history.

Rewards should have two scopes:

**Global rewards:** Contribute to the player's platform progression.

**Game rewards:** Earned within a particular game or session.

Examples:
- Mind Reader — Secret Santa / Mind Match
- Mystery Solver — Secret Santa / Secret Agent
- First Game — Platform achievement

Cards are cosmetic and must not provide unfair gameplay advantages.

## Database

- `reward_definitions`
- `xp_transactions`
- `collectible_cards`
- `user_collectibles`
- `user_achievements`

Use immutable transaction records and idempotency keys to prevent duplicate rewards.

## Acceptance

A future game can award XP and cards using the same platform service.

---

# SCOPE 06 — SECRET SANTA GAME SETUP

## Goal

Implement Secret Santa as the platform's first game module.

## Build

From the Games catalog, users can select Secret Santa and create a session.

The host configures:
- Session name
- Joining deadline
- Gift exchange date
- Optional budget
- Currency
- Optional description
- Optional final identity reveal

Users can join the session through its invite code or associated group.

Display:
- Participants
- Countdown
- Game settings
- Joining status
- Host controls

Automatically close joining at the deadline.

Allow the host to close early.

Do not allow membership changes after the draw begins.

## Database

- `secret_santa_settings`

Store Secret Santa configuration separately from generic game sessions.

## Acceptance

A Secret Santa session can be created and joined without affecting other game types.

---

# SCOPE 07 — SECRET SANTA MATCHING

## Goal

Implement secure anonymous gift assignments.

## Rules

- Every participant gives to exactly one person.
- Every participant receives from exactly one person.
- No self-assignment.
- Odd and even group sizes supported.
- Assignments are secret.
- Hosts cannot inspect other assignments.
- Draws cannot execute twice.

Use a cryptographically secure randomized single-cycle assignment algorithm.

Run the draw inside a transaction with concurrency protection.

Use the actual draw time as the beginning of the game season.

## Build

- Automatic deadline draw.
- Host-triggered early draw.
- Private recipient reveal.
- Gift assignment screen.
- Reveal animation.
- Secure assignment retrieval.

## Database

- Private `secret_santa_assignments`

## Acceptance

Test 2, 3, 5, 11, 13, 50 and 100 participants.

Verify uniqueness, completeness, anonymity and concurrent execution safety.

---

# SCOPE 08 — MIND MATCH

## Goal

Build an interval-based question-and-prediction game within Secret Santa.

## Core rule

Every participant is simultaneously:

1. A receiver answering questions about themselves.
2. A giver predicting answers submitted by their assigned recipient.

## Scheduling

Questions must appear gradually across days or weeks.

Do not display an entire questionnaire at once.

Example for a 21-day season:
- Day 2: Question 1
- Day 5: Question 2
- Day 9: Question 3
- Day 13: Question 4
- Day 17: Question 5
- Day 20: Final question

Generate schedules based on the available season duration.

## Receiver experience

- Receive question notification.
- Open one available question.
- Choose an answer.
- Submit and lock the answer.
- Wait for the prediction.

## Giver experience

- Receive a prediction challenge after the receiver answers.
- See the same question and available options.
- Predict the receiver's answer.
- Submit and lock prediction.
- Receive result and XP.

## Scoring

- Valid prediction: 20 XP.
- Correct prediction: 80 additional XP.
- Optional streak bonuses and cards.

All rewards must be validated and awarded server-side.

## Question decks

- Personality
- Gift preferences
- Hobbies
- Food and lifestyle
- Travel
- Fun scenarios

Use curated questions with predefined answer choices.

## Database

- `mind_match_decks`
- `mind_match_questions`
- `mind_match_rounds`
- Private `mind_match_answers`
- Private `mind_match_predictions`

## Privacy

The giver cannot access the receiver's answer before submitting a prediction.

The receiver cannot discover the giver's identity.

## Acceptance

Questions unlock at intervals, predictions remain private until resolved, and correct guesses receive rewards exactly once.

---

# SCOPE 09 — DISCOVER THE SECRET AGENT

## Goal

Build a mystery game where the gift recipient tries to identify their unknown Santa.

## Roles

- Secret Agent: the assigned gift giver.
- Detective: the gift recipient.

## Secret Agent experience

- Receive scheduled clue missions.
- Choose from optional predefined clues.
- Approve or skip clues.
- Remain anonymous.

Example clues:
- I prefer tea to coffee.
- I enjoy outdoor activities.
- I love watching movies.

## Detective experience

- Receive clue notifications.
- Collect clues in a private investigation board.
- Review unlocked evidence.
- Select a suspected Santa.
- Submit a final guess before the deadline.

## Rules

- Do not confirm guesses early.
- Keep all guesses private.
- Do not force agents to disclose identifying facts.
- Reveal identity only if enabled for the session.
- Resolve detective predictions only when reveal is permitted.

## Database

- `secret_agent_clues`
- `secret_agent_releases`
- `secret_agent_guesses`

## Acceptance

Clues unlock on schedule, agent identities remain protected, and final guesses cannot be modified after submission.

---

# SCOPE 10 — SECRET MISSIONS & MESSAGES

## Goal

Introduce optional interactive activities that make the Secret Santa experience engaging between major game events.

## Mission categories

**Discovery missions**
- Learn about the recipient's interests.
- Ask an optional gift-related question.
- Explore wishlist preferences.

**Mystery missions**
- Send an anonymous clue.
- Deliver a festive riddle.
- Send a surprise message.

**Kindness missions**
- Prepare a thoughtful note.
- Confirm gift readiness.
- Plan a small surprise.

## Messaging

- Anonymous Santa-to-recipient messages.
- Optional recipient responses.
- Prewritten message templates.
- Limited custom messages.
- Muting and reporting.
- Rate limits.

## Privacy

Never expose the giver's identity through recipient-facing APIs, push notifications or message metadata.

## Database

- `secret_santa_missions`
- `secret_santa_mission_progress`
- `secret_santa_threads`
- `secret_santa_messages`
- `message_reports`

## Acceptance

Missions unlock and complete independently, anonymous messages work, and mission completion cannot compromise assignment secrecy.

---

# SCOPE 11 — GAME EXPERIENCE & FINALE

## Goal

Deliver a polished Secret Santa experience inside the broader game platform.

## Platform UI

Keep global navigation game-neutral.

Suggested tabs:
- Home
- Games
- Groups
- Rewards
- Profile

## Secret Santa UI

Within an active Secret Santa session:
- Overview
- My recipient
- Mind Match
- Secret Agent
- Missions
- Finale

## Visuals

Use a premium festive theme inside the Secret Santa game.

Do not apply Christmas visuals to the entire application.

## Animations

- Secret recipient reveal.
- Mission completion.
- Card flips.
- XP awards.
- Clue discovery.
- Gift exchange celebration.

## Finale

On the exchange date:
- Show final game progress.
- Display completed Mind Match results.
- Resolve eligible Secret Agent guesses.
- Award achievements.
- Allow optional identity reveal.
- Mark the game session completed.

The gift exchange must remain functional even if participants skipped every mini-game.

## Acceptance

Users can complete the entire experience without being required to participate in optional activities.

---

# SCOPE 12 — SECURITY, TESTING & RELEASE

## Goal

Validate the complete platform and prepare it for distribution.

## Tests

- Authentication and authorization.
- Group and session membership.
- Invitation-code security.
- Secret matching.
- Odd and even player counts.
- Concurrent draws.
- Scheduled activity unlocking.
- Mind Match answer secrecy.
- Secret Agent anonymity.
- Anonymous messaging.
- XP idempotency.
- Reward eligibility.
- Account deletion.
- Offline recovery.
- Push notification retries.

## Additional platform test

Create a minimal second game module as a developer-only fixture.

Verify it can:
- Register in the catalog.
- Create a session.
- Use group invitations.
- Schedule an activity.
- Award XP.
- Finish a session.

This fixture does not need production gameplay.

Its purpose is to prove that the platform genuinely supports additional games.

## Release

- Development and production configuration.
- Supabase migrations and deployment.
- EAS Build.
- iOS TestFlight.
- Android internal testing.
- Push notification setup.
- Privacy and account deletion flows.
- Monitoring and error reporting.

## Acceptance

The application supports a complete Secret Santa season and demonstrates that an additional game can be integrated without restructuring the platform.

---

# FUTURE GAME DEVELOPMENT

After Secret Santa launches, new games should be developed as independent modules.

A new game should reuse:
- Authentication
- Profiles
- Groups
- Invitations
- Sessions
- Scheduling
- Notifications
- XP
- Collectibles
- Shared UI components

Each game should own:
- Rules
- Game-specific database tables
- Gameplay screens
- Game-specific state transitions
- Scoring conditions

Do not assume that all future games require anonymous matching, gift exchange, countdowns or Christmas-related concepts.

# END OF MASTER PLAN