# Proof 5 (legal pages): every line of Cowork's three files is on the page, word for word, after only the
# documented substitutions (placeholders filled from site-config.json; brief A1's name/address placeholders and
# "sample prices"). The grey draft note and the "Contents" list (rebuilt from the sections) are the only lines left out.
import json, re, sys
cfg = json.load(open('site-config.json'))
L = cfg['legal']
V = dict(L, legal_name=cfg['legalName'], registered_address=cfg['registeredAddress'], cin=cfg['cin'] or '(To be confirmed)', gstin=cfg['gstin'] or '(To be confirmed)',
  support_email=cfg['supportEmail'], grievance_email=cfg['privacyEmail'], security_email=cfg['securityEmail'], support_reply_days=str(cfg['replyDays']),
  free_months=str(cfg['freeMonths']), founding_places=f"{cfg['foundingPlaces']:,}", founding_years=str(cfg['foundingYears']), grace_days=str(cfg['familyGraceDays']), backup_days=str(cfg['backupDays']))
fails = 0
for key, f in [('privacy-policy','jeevanto-privacy-policy.md'),('terms','jeevanto-terms-of-use.md'),('refunds','jeevanto-refunds-and-cancellation.md')]:
  md = open('content/legal/'+f).read()
  md = md.replace('Nistula Tech Labs OPC Private Limited','{{legal_name}}').replace('Sector-66, Gurugram, Haryana - 122102, India','{{registered_address}}').replace('*Example, at the founding prices:*','*Example, with sample prices (not our prices):*')
  if 'private limited' not in cfg['legalName'].lower():  # founder, 1 Oct: Terms 1.1 before registration
    md = md.replace('{{legal_name}}**, a One Person Company registered in India. Its registered office is at {{registered_address}}.', '{{legal_name}}**, {{registered_address}}.')
  md = re.sub(r'\{\{\s*(\w+)\s*\}\}', lambda m: V[m.group(1)], md)
  site = open(f'proofs/text/{key}.site.txt').read()
  site_norm = re.sub(r'\s+', ' ', site)
  section = None; n = 0
  for ln in md.split('\n'):
    ln = ln.strip()
    if not ln or ln == '---' or ln.startswith('>') or ln.startswith('# '): continue
    if ln.startswith('## '): section = ln[3:]; 
    if section == 'Contents' and not ln.startswith('## '): continue
    if ln.startswith('## '):
      t = ln[3:]
      if t == 'Contents': continue
      t = re.sub(r'^(\d+)\. ', r'\1 ', t)
    elif ln.startswith('|'):
      if re.match(r'^\|[\s|:-]+\|$', ln): continue
      cells = [c.strip() for c in ln.strip('|').split('|')]
      for c in cells:
        c = re.sub(r'\*\*|\*', '', re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', c)); n += 1
        if re.sub(r'\s+',' ',c).upper() not in site_norm.upper(): print(key, 'MISSING CELL:', c[:120]); fails += 1
      continue
    else:
      t = re.sub(r'^- ', '', ln)
    t = re.sub(r'\*\*|\*', '', re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', t)); n += 1
    head = ln.startswith('## ')  # headings may be set in capitals by the design (IN SHORT)
    if (re.sub(r'\s+',' ',t).upper() not in site_norm.upper()) if head else (re.sub(r'\s+',' ',t) not in site_norm): print(key, 'MISSING:', t[:160]); fails += 1
  print(f'{key}: {n} lines and cells checked')
print('FAILURES:', fails); sys.exit(1 if fails else 0)
