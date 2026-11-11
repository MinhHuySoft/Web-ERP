import base64, re, sys, os

src_dir, tsv, call = sys.argv[1], sys.argv[2], sys.argv[3]  # call e.g. sgHTKFBEcBb5Vj7I7A.EJvXFkTxfjx
m = {}
for l in open(tsv, encoding='utf-8-sig'):
    l = l.rstrip('\r\n')
    if not l:
        continue
    k, v = l.split('\t', 1)
    if v == '!ERR':
        continue
    m[k] = base64.b64decode(v).decode('utf-8')

BS = chr(92)
ESC = {BS: BS + BS, '"': BS + '"', '\r': BS + 'r', '\n': BS + 'n', '\t': BS + 't', '\0': BS + '0'}


def lit(s):
    return '"' + ''.join(ESC.get(c, c) for c in s) + '"'


pat = re.compile(r'(?:[A-Za-z0-9_]+\.)*' + re.escape(call) + r'\((\d+)\)')
count = [0, 0]
for root, _, fs in os.walk(src_dir):
    for f in fs:
        if not f.endswith('.cs'):
            continue
        p = os.path.join(root, f)
        t = open(p, encoding='utf-8-sig').read()

        def rep(mo):
            k = mo.group(1)
            if k in m:
                count[0] += 1
                return lit(m[k])
            return mo.group(0)

        t2 = pat.sub(rep, t)
        if t2 != t:
            count[1] += 1
            open(p, 'w', encoding='utf-8').write(t2)
print('replaced', count[0], 'in', count[1], 'files')
