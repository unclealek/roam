from pathlib import Path
import zipfile, plistlib, subprocess, json, hashlib, sys
build = sys.argv[1]
ipa = Path(f'/private/tmp/roam-0.1.0-build{build}.ipa')
destination = Path(f'/private/tmp/roam-verify-build{build}')
destination.mkdir(exist_ok=True)
with zipfile.ZipFile(ipa) as archive:
    prefix = next(name for name in archive.namelist() if name.count('/') == 2 and name.startswith('Payload/') and name.endswith('.app/Info.plist')).removesuffix('Info.plist')
    info = plistlib.loads(archive.read(prefix + 'Info.plist'))
    backend = any(b'ywpmvqgtiawtkcqxeehf' in archive.read(name) for name in archive.namelist() if name.startswith(prefix) and name.endswith('.jsbundle'))
    archive.extractall(destination)
app = destination / prefix
profile = plistlib.loads(subprocess.check_output(['security', 'cms', '-D', '-i', str(app / 'embedded.mobileprovision')]))
signed = plistlib.loads(subprocess.run(['codesign', '-d', '--entitlements', ':-', str(app)], check=True, capture_output=True).stdout)
subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True, capture_output=True)
assert info['CFBundleIdentifier'] == 'com.moredata.roam'
assert info['CFBundleShortVersionString'] == '0.1.0' and info['CFBundleVersion'] == build
assert signed['aps-environment'] == 'production' and signed['get-task-allow'] is False
assert signed['beta-reports-active'] is True and 'Default' in signed['com.apple.developer.applesignin']
assert signed['com.apple.developer.team-identifier'] == '3Y42VMC42F'
assert not profile.get('ProvisionedDevices') and not profile.get('ProvisionsAllDevices', False)
assert backend, 'Expected Roam backend missing from bundled JavaScript'
result = {'bundle_id': info['CFBundleIdentifier'], 'version': info['CFBundleShortVersionString'], 'build': build, 'minimum_ios': info['MinimumOSVersion'], 'production_apns': True, 'apple_signin': True, 'beta_reports': True, 'debugging_disabled': True, 'no_device_restriction': True, 'roam_backend_in_bundle': True, 'codesign_verified': True, 'profile_expires': profile['ExpirationDate'].isoformat() + 'Z', 'ipa_bytes': ipa.stat().st_size, 'ipa_sha256': hashlib.sha256(ipa.read_bytes()).hexdigest()}
output = Path(__file__).resolve().parents[2] / 'docs/releases' / f'testflight-0.1.0-build{build}-ipa-verification.json'
output.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
