"""Build GitHub-ready source and standalone web ZIPs. Run after pnpm test && pnpm build."""
from pathlib import Path
import subprocess, sys, zipfile
root=Path(__file__).resolve().parents[1]
out=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root.parent/'loggin-release'
out.mkdir(parents=True,exist_ok=True)
files=set(subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root).decode().split('\0'))
with zipfile.ZipFile(out/'Loggin-source.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for name in sorted(files):
        if not name or name.startswith(('.openai/','.sites-runtime/','shots/')): continue
        file=root/name
        if file.is_file(): archive.write(file,'loggin/'+name)
with zipfile.ZipFile(out/'Loggin-web.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for file in sorted((root/'dist').rglob('*')):
        if file.is_file(): archive.write(file,file.relative_to(root/'dist'))
print(out/'Loggin-source.zip')
print(out/'Loggin-web.zip')
