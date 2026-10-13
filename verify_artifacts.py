import csv,json,re,zipfile,collections
from pathlib import Path
try: import yaml
except ImportError: yaml=None
P=Path('/mnt/data/today_discovery')
with (P/'verified_public_web_sample_2026-10-13.csv').open(encoding='utf-8-sig',newline='') as f: rows=list(csv.DictReader(f))
stats=json.loads((P/'sample_quality_summary.json').read_text(encoding='utf-8'))
assert len(rows)==stats['raw_records']==41
assert len({r['region'] for r in rows})==17
assert collections.Counter(r['schedule_status_on_2026_10_13'] for r in rows)==stats['by_schedule_status']
assert all(r['source_url'].startswith('https://') for r in rows)
assert sum(r['granularity']=='PROGRAM' for r in rows)==1
assert sum(r['has_known_price']=='True' for r in rows)==6
assert (P/'nationwide_sample_quality_2026-10-13.xlsx').stat().st_size>10000
with zipfile.ZipFile(P/'nationwide_sample_quality_2026-10-13.xlsx') as z: assert 'xl/workbook.xml' in z.namelist()
if yaml:
 api=yaml.safe_load((P/'04_OPENAPI_v1.yaml').read_text(encoding='utf-8'))
 refs=[]
 def descend(x):
  if isinstance(x,dict):
   if '$ref' in x:refs.append(x['$ref'])
   for v in x.values():descend(v)
  elif isinstance(x,list):
   for v in x:descend(v)
 descend(api)
 for ref in refs:
  assert ref.startswith('#/'),ref
  obj=api
  for tok in ref[2:].split('/'):
   obj=obj[tok.replace('~1','/').replace('~0','~')]
 assert len(api['paths'])==16
 print('OpenAPI paths',len(api['paths']),'resolved references',len(refs))
SQL=(P/'03_MYSQL84_SCHEMA.sql').read_text(encoding='utf-8')
tables=re.findall(r'^CREATE TABLE\s+(\w+)',SQL,re.M)
assert len(tables)>=20
for required in ['activities','activity_programs','activity_sessions','source_records','activity_source_links','source_sync_runs','merge_review_cases','users']:
 assert required in tables
print('Verified:',len(rows),'sample records,',len(tables),'SQL table statements, 17 regions, XLSX valid package')
