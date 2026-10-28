"""Stamps each stylesheet and script link in the pages with a short hash of the file (?v=1a2b3c4d), so browsers
fetch a changed file at once instead of using the copy they saved earlier. Run it after editing anything in
assets/css or assets/js:   python3 tools/version-assets.py"""
import glob
import hashlib
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def stamp(match):
    attr, path = match.group(1), match.group(2)
    with open(os.path.join(ROOT, path.lstrip("/")), "rb") as f:
        v = hashlib.sha1(f.read()).hexdigest()[:8]
    return f'{attr}="{path}?v={v}"'


for page in sorted(glob.glob(os.path.join(ROOT, "*.html"))):
    with open(page) as f:
        html = f.read()
    new = re.sub(r'(href|src)="(/assets/(?:css|js)/[^"?]+\.(?:css|js))(?:\?v=[0-9a-f]+)?"', stamp, html)
    if new != html:
        with open(page, "w") as f:
            f.write(new)
        print("stamped", os.path.basename(page))
