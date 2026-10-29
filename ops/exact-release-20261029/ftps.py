import os,ipaddress,subprocess,pathlib,hashlib
phase=os.environ['FTPS_PHASE'];assert phase in ['read-only','assets','documents','finalize']
assert os.environ['FTPS_PORT']=='21'
host=os.environ['FTPS_TLS_HOST'];assert host.endswith('.superhosting.bg') and all(x.isalnum() or x in '.-' for x in host)
ipaddress.ip_address(os.environ['FTPS_SERVER_IP'])
def quote(value):
 assert '\n' not in value and '\r' not in value
 return '"'+value.replace('\\','\\\\').replace('"','\\"').replace('$','\\$').replace('`','\\`')+'"'
root=pathlib.Path('.exact-release').resolve()
settings='''set cmd:fail-exit true
set net:max-retries 2
set net:timeout 30
set ftp:ssl-force true
set ftp:ssl-protect-data true
set ftp:passive-mode true
set ssl:verify-certificate true
set ssl:check-hostname true
'''
script=settings+'open -u '+quote(os.environ['FTPS_USERNAME'])+','+quote(os.environ['FTPS_PASSWORD'])+' -p 21 '+quote('ftp://'+host)+'\ncd /\n'
if phase=='read-only':
 script+='get /.htaccess -o '+quote(str(root/'htaccess-before'))+'\n'
 for remote,name in [('deploy-manifest.json','live-manifest-before.json'),('.bulgaritam-deploy-state.json','live-state-before.json')]:
  script+='get /'+remote+' -o '+quote(str(root/('ftps-'+name)))+'\n'
else:
 assert (root/'htaccess-before').stat().st_size>0
 script+='source '+quote(str(root/(phase+'.lftp')))+'\n'
 script+='get /.htaccess -o '+quote(str(root/('htaccess-after-'+phase)))+'\n'
script+='bye\n'
# Credentials only go to lftp stdin; never to a command line, log, or artifact.
result=subprocess.run(['lftp'],input=script,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
output=result.stdout
for key in ['FTPS_USERNAME','FTPS_PASSWORD']:
 output=output.replace(os.environ[key],'[REDACTED]')
(root/('ftps-'+phase+'.log')).write_text(output)
print(output)
assert result.returncode==0, f'FTPS {phase} stopped; no automatic rollback'
if phase=='read-only':
 for name in ['live-manifest-before.json','live-state-before.json']:
  assert (root/('ftps-'+name)).read_bytes()==(pathlib.Path('ops/exact-release-20261029')/name).read_bytes(),'FTPS root differs from audited public origin'
 assert (root/'htaccess-before').stat().st_size>0
if phase!='read-only':
 assert (root/'htaccess-before').read_bytes()==(root/('htaccess-after-'+phase)).read_bytes(),'Hosting-owned .htaccess changed'
print('PASS: FTPS '+phase)
