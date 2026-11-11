import sys; sys.stdout.reconfigure(encoding="utf-8")
import re, os, json, glob, collections
ROOT = r'D:/Data/Web-ERP/.legacy/decompiled/Tools'
prop_re = re.compile(r'public\s+(?:override\s+|virtual\s+|new\s+)*[\w\.<>\[\],]+\s+(\w+)\s*\r?\n\s*\{\s*\r?\n\s*get', re.M)
cls_re = re.compile(r'\b(?:class|struct)\s+(\w+)')
desc_re = re.compile(r'\[Description\("((?:[^"\\]|\\.)*)"\)\]')
cat_re = re.compile(r'\[Category\("((?:[^"\\]|\\.)*)"\)\]')
gv_re = re.compile(r'GetValue\(\s*"([^"]*)"\s*(?:\+\s*([^,\)]+))?')
out = []
for p in glob.glob(ROOT + '/**/*.cs', recursive=True):
    try:
        s = open(p, encoding='utf-8', errors='replace').read()
    except Exception:
        continue
    if 'GetValue("' not in s:
        continue
    classes = [(m.start(), m.group(1)) for m in cls_re.finditer(s)]
    props = list(prop_re.finditer(s))
    prev_end = 0
    for i, m in enumerate(props):
        start = m.start()
        end = props[i + 1].start() if i + 1 < len(props) else len(s)
        seg = s[start:end]
        g = gv_re.search(seg)
        if not g:
            prev_end = end
            continue
        pre = s[max(0, start - 2500):start]
        k = pre.rfind(chr(10) + chr(9) + '}')
        pre = pre[k + 3:] if k >= 0 else pre
        ds = desc_re.findall(pre)
        cs = cat_re.findall(pre)
        cl = [c for pos, c in classes if pos < start and not c.startswith('_') and c not in ('của',)]
        out.append(dict(file=os.path.relpath(p, ROOT).replace(os.sep, '/'), cls=cl[-1] if cl else '',
                        prop=m.group(1), key=g.group(1), keysuffix=(g.group(2) or '').strip(),
                        desc=ds[-1] if ds else '', cat=cs[-1] if cs else ''))
        prev_end = end
json.dump(out, open('keys_from_source.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
c = collections.Counter(o['cls'] for o in out)
print(len(out))
print(c.most_common(80))
