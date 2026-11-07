#!/bin/sh
set -eu
build="$1"
snapshot="$2"
export EAS_NO_VCS=1
export EAS_LOCAL_BUILD_WORKINGDIR="/private/tmp/roam-local-build${build}-$(date +%s)"
export GEM_HOME=/private/tmp/roam-release-gems
export GEM_PATH="/private/tmp/roam-release-gems:/opt/homebrew/lib/ruby/gems/4.0.0:/opt/homebrew/Cellar/ruby/4.0.6_1/lib/ruby/gems/4.0.0"
export PATH="/private/tmp/roam-release-gems/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "$snapshot"
eas build --platform ios --profile testflight --local --non-interactive --freeze-credentials --output "/private/tmp/roam-0.1.0-build${build}.ipa"
