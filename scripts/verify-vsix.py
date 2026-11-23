"""Verify the built distributable contains its runtime and no local test artifacts."""
import hashlib
import json
import sys
from pathlib import Path
import zipfile

version = json.loads(Path('package.json').read_text())['version']
artifact = Path(f'dist/xp-code-canvas-{version}.vsix')
with zipfile.ZipFile(artifact) as archive:
    assert archive.testzip() is None, 'VSIX ZIP checksum failure'
    names = set(archive.namelist())
    required = {
        'extension.vsixmanifest', 'extension/package.json',
        'extension/dist/extension/extension.js',
        'extension/dist/webview/assets/app.js',
        'extension/dist/webview/assets/app.css',
        'extension/dist/webview/assets/codicon.ttf',
        'extension/python/entrypoint.py',
        'extension/media/activity-bar.svg',
        'extension/media/structure.svg',
        'extension/media/git-history.svg',
    }
    assert required <= names, f'Missing runtime files: {required - names}'
    for source in Path('python/src').rglob('*.py'):
        assert f'extension/{source.as_posix()}' in names, f'Missing analyzer module: {source}'
    assert any('/assets/browserElk-' in name for name in names), 'Missing ELK worker bundle'
    assert any('/assets/SpatialGraph3D-' in name for name in names), 'Missing lazy WebGL bundle'
    assert b'.spatial-root' in archive.read('extension/dist/webview/assets/app.css'), 'Lazy WebGL styles missing from host CSS entry'
    forbidden = ('node_modules/', '.validation-runtime/', '.python-test-deps/',
                 'test-resources/', 'test-results/', 'dist/test/')
    assert 'extension/dist/vsix-verification.json' not in names, 'Stale artifact verification packaged'
    assert not [name for name in names if name.endswith('.vsix') or any(
        name.startswith(f'extension/{prefix}') for prefix in forbidden)], 'Local test artifacts packaged'
    manifest = json.loads(archive.read('extension/package.json'))
    assert (manifest['publisher'], manifest['name'], manifest['version']) == ('xp-libs', 'xp-code-canvas', version)
    if len(sys.argv)>1:
        installed=Path(sys.argv[1])
        for name in names:
            if name.startswith('extension/') and not name.endswith('/'):
                relative=name.removeprefix('extension/')
                if relative=='package.json':
                    actual=json.loads((installed/relative).read_bytes())
                    actual.pop('__metadata',None)
                    assert actual==manifest, 'Installed extension manifest mismatch'
                else:
                    assert (installed/relative).read_bytes()==archive.read(name), f'Installed file mismatch: {relative}'
print(json.dumps({'artifact': str(artifact), 'files': len(names), 'bytes': artifact.stat().st_size,
                  'sha256': hashlib.sha256(artifact.read_bytes()).hexdigest(), 'runtime_verified': True,
                  'installed_files_verified':len(sys.argv)>1}, indent=2))
