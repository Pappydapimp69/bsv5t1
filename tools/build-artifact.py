#!/usr/bin/env python3
"""Rebuild artifact/xrndm.html from index.html.

The artifact host wraps the page in its own <html>/<head>/<body>, so this keeps
only the title, styles and body content, and adds safe-area padding for phones.
The page loads the same core.js, art.js, audio.js and ui.js, published beside it.
Run: python3 tools/build-artifact.py
"""
import pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'index.html').read_text()
style = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', src, re.S).group(1)
extra = """
:root { color-scheme: dark; }
#app { padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px); }
"""
out = ('<title>XRNDM</title>\n'
       '<meta name="description" content="XRNDM: a bag-building roguelite about reading the odds.">\n'
       '<style>' + style + extra + '</style>\n' + body.strip() + '\n')
dest = root / 'artifact' / 'xrndm.html'
dest.parent.mkdir(exist_ok=True)
dest.write_text(out)
print('wrote', dest.relative_to(root), len(out), 'bytes')
