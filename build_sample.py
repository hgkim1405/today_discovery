import csv, json, os, collections
from datetime import date
from pathlib import Path
OUT=Path('/mnt/data/today_discovery'); REF=date(2026,10,13)
KTO='https://m.visitkorea.or.kr/kfes/list/clturTursmFstvlList.do'
TRAVEL='https://travelweek.visitkorea.or.kr/kfes/list/wntyFstvlList.do'
CB='https://tour.chungbuk.go.kr/www/selectBbsNttList.do?bbsNo=10&key=80&searchCtgry=2026'
GW='https://kimchi.gwangju.go.kr/index.php?cate=002004'
JB='https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_300000000014855'
BJ='https://www.visitbusan.net/schedule/list.do?boardId=BBS_0000009&menuCd=DOM_000000204012000000&month=10&startPage=1&year=2026'
DETAIL={
'진주남강유등축제':('https://m.visitkorea.or.kr/kfes/detail/fstvlDetail.do?cntntsNm=%EC%A7%84%EC%A3%BC%EB%82%A8%EA%B0%95%EC%9C%A0%EB%93%B1%EC%B6%95%EC%A0%9C&fstvlCntntsId=aebdd924-73cd-4187-be5e-ba29ccf19c49','무료','FREE','경상남도 진주시 남강로 626 (본성동)'),
'동래읍성역사축제':('https://m.visitkorea.or.kr/kfes/detail/fstvlDetail.do?cntntsNm=%EB%8F%99%EB%9E%98%EC%9D%8D%EC%84%B1%EC%97%AD%EC%82%AC%EC%B6%95%EC%A0%9C&fstvlCntntsId=78db2649-69d9-4710-a0d3-3c8f91c26720','무료(일부 체험 3,000~10,000원, 야외방탈출 10,000원)','MIXED','부산광역시 동래구 문화로 80 (명륜동)'),
'강릉커피축제':('https://m.visitkorea.or.kr/kfes/detail/fstvlDetail.do?cntntsNm=%EA%B0%95%EB%A6%89%EC%BB%A4%ED%94%BC%EC%B6%95%EC%A0%9C&fstvlCntntsId=eff62395-e989-4993-b5ab-1b1808220401','일부 유료','MIXED','강원특별자치도 강릉시 창해로14번길 20-1 (견소동)'),
'광주김치축제':('https://m.visitkorea.or.kr/kfes/detail/fstvlDetail.do?cntntsNm=%EA%B4%91%EC%A3%BC%EA%B9%80%EC%B9%98%EC%B6%95%EC%A0%9C&fstvlCntntsId=85a1dd0a-7a8b-4074-bf97-45bf0631db1a','무료(김치체험학교 유료)','MIXED','광주 서구 내방로 111 (치평동)'),
'서귀포칠십리축제':('https://travelweek.visitkorea.or.kr/kfes/detail/fstvlDetail.do?cntntsNm=%EC%84%9C%EA%B7%80%ED%8F%AC%EC%B9%A0%EC%8B%AD%EB%A6%AC%EC%B6%95%EC%A0%9C&fstvlCntntsId=e0645258-25e5-4f3e-9bdb-96987101bed3','무료','FREE','제주특별자치도 서귀포시 서홍동 684 천지연폭포 인근 주차장')}
rows=[]
def add(src,title,region,city,start,end,**kwargs):
    rows.append(dict(record_id=f'R{len(rows)+1:03d}',source=src,source_url=kwargs.get('source_url') or KTO,title=title,region=region,city=city,source_region_label=kwargs.get('source_region_label') or region,starts_on=start,ends_on=end,venue_or_address=kwargs.get('venue_or_address'),price_text=kwargs.get('price_text'),price_class=kwargs.get('price_class') or 'UNKNOWN',reservation_detail_url=kwargs.get('reservation_detail_url'),event_detail_url=kwargs.get('event_detail_url'),application_opens_at=kwargs.get('application_opens_at'),application_closes_at=kwargs.get('application_closes_at'),session_time_text=kwargs.get('session_time_text'),booking_evidence=kwargs.get('booking_evidence') or 'NOT_CHECKED',granularity=kwargs.get('granularity') or 'EVENT',parent_event_title=kwargs.get('parent_event_title'),collected_on=REF.isoformat(),method='공식 공개 웹페이지 수기 표본 추출 (인증 API 응답 아님)',remarks=kwargs.get('remarks')))
# 26 items copied from Korea Tourism Organization official Oct 2026 cultural tourism festival listing, viewed 2026-10-13.
events=[
('진주남강유등축제','경남','진주','2026-10-03','2026-10-18'),
('순창장류축제','전북','순창','2026-10-15','2026-10-18'),
('영동난계국악축제','충북','영동','2026-10-15','2026-10-18'),
('강동선사문화축제','서울','강동','2026-10-16','2026-10-18'),
('동래읍성역사축제','부산','동래','2026-10-16','2026-10-18'),
('목포항구축제','전남','목포','2026-10-16','2026-10-18'),
('강릉커피축제','강원','강릉','2026-10-21','2026-10-25'),
('광주김치축제','광주','광주 서구','2026-10-23','2026-10-25'),
('김천김밥축제','경북','김천','2026-10-23','2026-10-25'),
('여주오곡나루축제','경기','여주','2026-10-23','2026-10-25'),
('광주 추억의 충장축제','광주','광주 동구','2026-10-07','2026-10-11'),
('금산세계인삼축제','충남','금산','2026-10-02','2026-10-11'),
('산청한방약초축제','경남','산청','2026-10-02','2026-10-11'),
('서산해미읍성축제','충남','서산','2026-10-09','2026-10-11'),
('세종한글축제','세종','세종','2026-10-09','2026-10-11'),
('수원화성문화제','경기','수원','2026-10-04','2026-10-11'),
('영주 풍기인삼축제','경북','영주','2026-10-03','2026-10-11'),
('임실N치즈축제','전북','임실','2026-10-08','2026-10-11'),
('계룡軍문화축제','충남','계룡','2026-10-01','2026-10-05'),
('김제지평선축제','전북','김제','2026-10-01','2026-10-05'),
('안성맞춤 남사당 바우덕이축제','경기','안성','2026-10-02','2026-10-05'),
('천안흥타령춤축제','충남','천안','2026-10-01','2026-10-05'),
('부산국제록페스티벌','부산','사상','2026-10-02','2026-10-04'),
('부평풍물대축제','인천','부평','2026-10-02','2026-10-04'),
('안동국제탈춤페스티벌','경북','안동','2026-09-24','2026-10-04'),
('정선아리랑제','강원','정선','2026-10-01','2026-10-04')]
for title,reg,city,start,end in events:
    kw={}
    if title in DETAIL:
        url,price,cls,addr=DETAIL[title]
        kw.update(event_detail_url=url,price_text=price,price_class=cls,venue_or_address=addr)
    if title in ('목포항구축제','광주김치축제','광주 추억의 충장축제'):
        kw['source_region_label']='전남광주통합특별시 (제공 페이지 표기)'
    add('KTO_CULTURAL_LIST',title,reg,city,start,end,**kw)
# Publicly visible official nationwide festival listing, individual events.
add('KTO_NATIONWIDE_LIST','서귀포칠십리축제','제주','서귀포','2026-10-23','2026-10-25',source_url=TRAVEL,event_detail_url=DETAIL['서귀포칠십리축제'][0],venue_or_address=DETAIL['서귀포칠십리축제'][3],price_text='무료',price_class='FREE')
add('KTO_NATIONWIDE_LIST','인제가을꽃축제','강원','인제','2026-09-24','2026-10-18',source_url=TRAVEL)
add('KTO_NATIONWIDE_LIST','익산천만송이 국화축제','전북','익산','2026-10-23','2026-11-01',source_url=TRAVEL)
# Regional government official public pages.
DJ='https://daejeon.go.kr/fvu/index.do'
add('DAEJEON_EVENT_PORTAL','김근화 바이올린 리사이틀','대전','대전','2026-10-14','2026-10-14',source_url=DJ,venue_or_address='대전예술의전당')
add('DAEJEON_EVENT_PORTAL','소리의 형상화 - 감각을 실험하는 피아노 프로젝트 Ⅳ','대전','대전','2026-10-15','2026-10-15',source_url=DJ,venue_or_address='대전예술의전당')
add('DAEJEON_EVENT_PORTAL','주제가 있는 창작음악회(주창회) 2026 정기연주회 [선율에 시를 담다]','대전','대전','2026-10-16','2026-10-16',source_url=DJ,venue_or_address='대전예술의전당')
add('ULSAN_TOURISM','울산공업축제','울산','울산 남구','2026-10-08','2026-10-11',source_url='https://tour.ulsan.go.kr/tour/korean/unit/fstvl/list.ulsan?mId=001003001000000000&searchDvsn1=1',venue_or_address='태화강 국가정원 남구둔치 일원',remarks='공식 월별 목록 이미지 포스터의 기간 표기')
add('DAEGU_EVENT_OFFICIAL','2026 대구국제커피&카페페스타','대구','대구','2026-10-29','2026-10-31',source_url='https://daegucoffee.kr/coffeefesta',venue_or_address='대구 엑스코 서관 2홀',session_time_text='10/29~30 10:00~18:00; 10/31 10:00~17:00 (입장 마감 별도)',remarks='행사 자체 공식 홈페이지')
add('CHUNGBUK_TOURISM','영동난계국악축제','충북','영동','2026-10-15','2026-10-18',source_url=CB,remarks='KTO 문화관광축제 목록과 중복 후보')
add('CHUNGBUK_TOURISM','세종대왕과 초정약수축제','충북','청주','2026-10-16','2026-10-18',source_url=CB,venue_or_address='초정행궁 일원',remarks='충북 연간목록의 일부 게시물은 다른 일정도 보여 교차확인 필요')
# Festival independent official site record and distinct ticketable session/experience.
add('GWANGJU_FESTIVAL_OFFICIAL','광주김치축제','광주','광주 서구','2026-10-23','2026-10-25',source_url=GW,venue_or_address='광주청사 시청 앞 일대',remarks='KTO 문화관광축제 목록과 중복 후보')
add('GWANGJU_FESTIVAL_OFFICIAL','김치체험학교','광주','광주 서구','2026-10-23','2026-10-25',source_url=GW,venue_or_address='광주청사 의회 앞 광장',granularity='PROGRAM',parent_event_title='광주김치축제',price_class='UNKNOWN',session_time_text='13:30~18:00; 1일 5회, 회당 30분',booking_evidence='네이버 사전 예약·잔여석 현장 접수 (예약 URL 미확인)',remarks='상위 축제는 기본 입장 무료지만 체험은 유료. 프로그램 가격 숫자 미확인')
add('VISITJEJU_FESTIVAL_OFFICIAL','제7회 서귀포 은갈치 축제','제주','서귀포','2026-10-08','2026-10-10',source_url='https://visitjeju.net/kr/festival/view?contentsid=CNTS_300000000014990',venue_or_address='서귀포항 동부두 일원',price_text='축제장 입장 무료; 일부 체험 유료',price_class='MIXED',session_time_text='10/8 14:30~21:00; 10/9~10 11:00~21:00')
add('VISITJEJU_FESTIVAL_OFFICIAL','서귀포칠십리축제','제주','서귀포','2026-10-23','2026-10-25',source_url=JB,venue_or_address='천지연폭포 주차장 일대',remarks='KTO 전국축제 목록과 중복 후보')
add('VISITBUSAN_FESTIVAL_OFFICIAL','동래읍성역사축제','부산','동래','2026-10-16','2026-10-18',source_url=BJ,remarks='KTO 문화관광축제 목록과 중복 후보')

# Compute sample-only classification. Date status is inferred from schedule, NOT live reservation status.
for row in rows:
    s=date.fromisoformat(row['starts_on']); e=date.fromisoformat(row['ends_on'])
    row['schedule_status_on_2026_10_13']='PAST' if e<REF else ('FUTURE' if s>REF else 'ONGOING')
    row['exact_duplicate_key']=f"{row['granularity']}|{row['region']}|{row['city']}|{''.join(row['title'].split()).lower()}|{row['starts_on']}|{row['ends_on']}"
    row['has_known_price']=(row['price_class']!='UNKNOWN')
    row['has_direct_booking_url']=bool(row['reservation_detail_url'])
    row['has_specific_place']=bool(row['venue_or_address'])
    row['has_event_detail_url']=bool(row['event_detail_url'])

all_keys=collections.Counter(r['exact_duplicate_key'] for r in rows)
key_groups={k:[r['record_id'] for r in rows if r['exact_duplicate_key']==k] for k,c in all_keys.items() if c>1}
regions=sorted(set(r['region'] for r in rows))
status=collections.Counter(r['schedule_status_on_2026_10_13'] for r in rows)
summary={
'date':REF.isoformat(),
'method':'공식 관광/지자체 웹페이지의 공개 목록·일부 상세에서 확인한 비무작위 목적 표본. API 직접 응답은 아님.',
'raw_records':len(rows),
'event_level_records':sum(r['granularity']=='EVENT' for r in rows),
'program_level_records':sum(r['granularity']=='PROGRAM' for r in rows),
'distinct_exact_record_keys':len(all_keys),
'exact_duplicate_group_count':len(key_groups),
'extra_rows_caused_by_exact_duplicates':sum(v-1 for v in all_keys.values()),
'exact_duplicate_groups':list(key_groups.values()),
'covered_region_count':len(regions), 'covered_regions':regions,
'by_schedule_status':dict(status),
'field_presence_counts':{k:sum(bool(r[k]) for r in rows) for k in ['title','region','starts_on','ends_on','venue_or_address','price_text','reservation_detail_url','event_detail_url','session_time_text','application_opens_at']},
'known_price_count':sum(r['has_known_price'] for r in rows),
'booking_evidence_count':sum(r['booking_evidence']!='NOT_CHECKED' for r in rows),
'by_source':dict(collections.Counter(r['source'] for r in rows)),
'limitations':['KTO/공유누리/서울 API 인증키를 발급받지 못해 응답 필드와 전체 데이터 건수를 측정하지 못함','공식 공개 웹페이지 표본에서 날짜·지역 등 항목을 확인한 결과이지 출처 전체 데이터의 품질 비율이 아님','공식 목록과 상세페이지의 필드 집합 차이 때문에 가격 결측은 공개 목록에서 미확인된 값임','웹페이지에서 링크 존재 여부와 실제 예약 잔여석·접수상태는 다름','일정 상태 PAST/FUTURE/ONGOING은 참고일 기준 날짜 계산이고 실제 개최확정/예약 가능과 다름']}
assert len(regions)==17,(len(regions),regions)
assert len(rows)==41,len(rows)
assert len(key_groups)==4,key_groups
for r in rows: assert r['source_url'] and r['title'] and r['region'] and r['starts_on']<=r['ends_on']
with (OUT/'verified_public_web_sample_2026-10-13.csv').open('w',encoding='utf-8-sig',newline='') as f:
    fields=[k for k in rows[0].keys() if k!='exact_duplicate_key']
    w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');w.writeheader();w.writerows(rows)
(OUT/'verified_public_web_sample_2026-10-13.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'sample_quality_summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False,indent=2))
