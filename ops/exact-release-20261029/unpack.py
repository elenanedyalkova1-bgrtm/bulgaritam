import hashlib,zipfile,pathlib,shutil,json
root=pathlib.Path('.exact-release');root.mkdir(exist_ok=True)
archives=[(root/'release.zip','08bb5ce1eac73faa45cb3873f0d7a8af02d7ee4f2c23a8cb729904cd4d4ea1bf',root/'dist'),(root/'rollback.zip','a6775c36155ff186376b4224eb58b8a0982c7b948e14324e5cf7c160896e601d',root/'rollback'),(pathlib.Path('ops/exact-release-20261029/rollback-supplement-before.zip'),'35270fbb5e31d49d52bfd5aaaa82bfdd50b2cbb3996c7dcecc0eda02e79694a9',root/'rollback')]
for source,expected,target in archives:
 assert hashlib.sha256(source.read_bytes()).hexdigest()==expected, f'Archive SHA mismatch: {source}'
 with zipfile.ZipFile(source) as z:
  assert z.testzip() is None
  for name in z.namelist():
   assert not pathlib.PurePosixPath(name).is_absolute() and '..' not in pathlib.PurePosixPath(name).parts
  z.extractall(target)
print('PASS: all three exact ZIP hashes, CRC and safe paths; no build.')
