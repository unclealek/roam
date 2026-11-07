from pathlib import Path
import shutil, sys, json, hashlib
root = Path(__file__).resolve().parents[2]
build, label = sys.argv[1:3]
destination = Path('/private/tmp') / f'roam-testflight-{label}-build{build}'
destination.mkdir(exist_ok=False)
for name in ['app', 'src', 'assets']:
    shutil.copytree(root / name, destination / name, ignore=shutil.ignore_patterns('.DS_Store'))
for name in ['app.config.ts', 'app.json', 'eas.json', 'package.json', 'package-lock.json', 'tsconfig.json', '.easignore', '.gitignore']:
    shutil.copy2(root / name, destination / name)
manifest = {str(path.relative_to(destination)): hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(destination.rglob('*')) if path.is_file()}
output = root / 'docs/releases' / f'testflight-0.1.0-build{build}-manifest.json'
output.write_text(json.dumps(manifest, indent=2) + '\n')
(destination / 'node_modules').symlink_to(root / 'node_modules', target_is_directory=True)
print(json.dumps({'source': str(destination), 'files': len(manifest), 'manifest_sha256': hashlib.sha256(output.read_bytes()).hexdigest()}))
