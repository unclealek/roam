from pathlib import Path
import os, subprocess, sys
build = sys.argv[1]
directory = Path('/private/tmp/roam-release-credential-location').read_text().strip()
env = os.environ.copy()
env['GEM_HOME'] = '/private/tmp/roam-release-gems'
env['GEM_PATH'] = '/private/tmp/roam-release-gems:/opt/homebrew/lib/ruby/gems/4.0.0:/opt/homebrew/Cellar/ruby/4.0.6_1/lib/ruby/gems/4.0.0'
env['PATH'] = '/private/tmp/roam-release-gems/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin'
env['FASTLANE_SKIP_UPDATE_CHECK'] = '1'
notes = ('Phase 2: Groups, invitations and player profile redesign. Test creation, safe preview/join, member permissions, copy/share, group-aware game setup, profile editing, XP/Rewards, notification settings, sign-out, keyboard and light/dark.' if build == '5' else 'Phase 2B: Shared backgrounds, buttons, cards, dialogs, sheets, notification presentation and feedback. Test light/dark, accessibility, notification deep links and existing group/profile/game flows.') + ' Approved standalone mascot artwork remains pending.'
if len(sys.argv) > 2:
    notes = Path(sys.argv[2]).read_text().strip()
subprocess.run(['/private/tmp/roam-release-gems/bin/fastlane', 'pilot', 'upload', '--api_key_path', directory + '/api-key.json', '--ipa', f'/private/tmp/roam-0.1.0-build{build}.ipa', '--app_identifier', 'com.moredata.roam', '--apple_id', '6827296384', '--skip_submission', '--changelog', notes], env=env, check=True)
