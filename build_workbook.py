import csv,json
from pathlib import Path
from artifact_tool import Workbook,SpreadsheetFile
ROOT=Path('/mnt/data/today_discovery')
with (ROOT/'verified_public_web_sample_2026-10-13.csv').open(encoding='utf-8-sig',newline='') as f: rows=list(csv.DictReader(f))
stats=json.loads((ROOT/'sample_quality_summary.json').read_text())
w=Workbook.create()
s=w.worksheets.add('요약')
s.get_range('A1:F1').merge_cells() if False else None
s.merge_cells('A1:F1');s.get_range('A1').values=[['오늘의 발견 | 전국 공개 웹 행사 표본 분석']]
s.get_range('A1:F1').format={'fill':'#153A57','font':{'bold':True,'color':'#FFFFFF','size':16},'row_height':34}
s.merge_cells('A2:F2');s.get_range('A2').values=[['2026-10-13 기준 / 공식 공개 페이지의 연구용 표본 / 인증키 API 응답 아님']]
s.get_range('A2:F2').format={'fill':'#EAF2F9','font':{'color':'#304D65'},'row_height':25}
metrics=[['분석 항목','결과','주의 사항'],
['공개 페이지 표본 기록 수',stats['raw_records'],'비무작위 목적 표본; API 전체 모집단 아님'],
['행사 기록',stats['event_level_records'],'공연·축제 포함'],
['세부 프로그램 기록',stats['program_level_records'],'김치체험학교'],
['구분된 광역 지역',stats['covered_region_count'],'각 지역 최소 1건이지 충분한 공급을 뜻하지 않음'],
['중복 그룹',stats['exact_duplicate_group_count'],'동일 축제의 다중 공식 원천'],
['일정 종료',stats['by_schedule_status'].get('PAST',0),'예약 상태와 별도'],
['진행 중',stats['by_schedule_status'].get('ONGOING',0),'개최 상태는 날짜 계산'],
['시작 전',stats['by_schedule_status'].get('FUTURE',0),'신청 가능 여부는 미확인'],
['장소/주소 확인',stats['field_presence_counts']['venue_or_address'],'표본 41행 중 확인 수'],
['가격 문구 확인',stats['known_price_count'],'무료·유료 판단시 상세 정보 필요'],
['직접 예약 URL 확인',stats['field_presence_counts']['reservation_detail_url'],'없음은 실제 예약 불가를 뜻하지 않음'],
['개별 회차시간 확인',stats['field_presence_counts']['session_time_text'],'문자열 설명, 회차별 정확 시각 아님']]
s.get_range('A4:C16').values=metrics
s.get_range('A4:C4').format={'fill':'#176B89','font':{'color':'#FFFFFF','bold':True},'row_height':24}
s.get_range('A:A').format.column_width=28
s.get_range('B:B').format.column_width=16
s.get_range('C:C').format.column_width=66
s.get_range('D:F').format.column_width=18
s.get_range('A5:C16').format.row_height=22
s.get_range('A18:F18').merge_cells() if False else None
s.merge_cells('A18:F18');s.get_range('A18').values=[['해석: 가격 6/41은 전체 서비스의 가격 필드 결측률이 아니라 이 연구 표본에서 명시 확인한 가격 문구 건수입니다.']]
s.get_range('A18:F18').format={'fill':'#FFF6DB','font':{'color':'#835B1A'},'row_height':27}

sample=w.worksheets.add('공식웹표본41건')
cols=[('record_id','ID'),('source','공식 출처코드'),('granularity','레벨'),('title','활동명'),('region','지역'),('city','시군구'),('starts_on','시작일'),('ends_on','종료일'),('schedule_status_on_2026_10_13','일정 상태'),('price_class','가격 분류'),('price_text','확인 가격 문구'),('venue_or_address','확인된 장소'),('booking_evidence','신청 근거'),('session_time_text','회차 설명'),('event_detail_url','개별 상세'),('source_url','공식 원문 출처'),('remarks','품질 메모')]
head=[lab for _,lab in cols]
mat=[head]+[[row.get(key,'') or '' for key,_ in cols] for row in rows]
sample.get_range_by_indexes(0,0,len(mat),len(cols)).values=mat
last_col='Q';sample.get_range(f'A1:{last_col}1').format={'fill':'#176B89','font':{'bold':True,'color':'#FFFFFF'},'row_height':30}
sample.freeze_panes.freeze_rows(1)
for col,width in [('A',11),('B',30),('C',12),('D',42),('E',11),('F',20),('G',14),('H',14),('I',15),('J',13),('K',44),('L',48),('M',42),('N',45),('O',65),('P',65),('Q',48)]:sample.get_range(f'{col}:{col}').format.column_width=width
sample.get_range(f'A2:{last_col}{len(mat)}').format.row_height=22
sample.get_range(f'A1:{last_col}{len(mat)}').format.wrap_text=False
try:sample.tables.add(f'A1:{last_col}{len(mat)}',True,'OfficialWebSample')
except Exception as ex:print('table not created',str(ex)[:150])

src=w.worksheets.add('공급처및주의')
source_rows=[['데이터 원천','공식 문서/링크','검증 상태','운영 전 필요'],
['TourAPI','https://www.data.go.kr/data/15101578/openapi.do','공식 API 존재','계정 키·실제 응답·이미지 개별 권리'],
['공유누리','https://www.eshare.go.kr/OpenApi/Info/list.do','심의승인 API 존재','키 신청, 데이터 연동권한과 필드 확인'],
['서울 공공서비스예약','https://data.seoul.go.kr/dataList/OA-2271/A/1/datasetView.do','공식 API 필드·사용 조건 확인','키 발급·실제 신청 상태 정확도'],
['한국관광공사 공개 축제','https://m.visitkorea.or.kr/kfes/list/clturTursmFstvlList.do','2026년 10월 26건 연구 표본','원문 재배포 권한 별도 확인'],
['대전 공식 행사','https://daejeon.go.kr/fvu/index.do','3건 연구 표본','신청/가격 상세 조사'],
['울산 관광','https://tour.ulsan.go.kr/tour/korean/unit/fstvl/list.ulsan?mId=001003001000000000&searchDvsn1=1','1건 연구 표본','가격·예약 확인'],
['대구 커피 페스타','https://daegucoffee.kr/coffeefesta','1건 연구 표본','요금·신청 확인'],
['광주김치축제','https://kimchi.gwangju.go.kr/index.php?cate=002004','축제/체험 부모 자식 확인','개별 회차 정확 시각·예약 URL'],
['제주관광','https://visitjeju.net/kr/festival/view?contentsid=CNTS_300000000014990','일부 유료 실제 사례','외부 제휴 이미지 권리 확인']]
src.get_range_by_indexes(0,0,len(source_rows),4).values=source_rows
src.get_range('A1:D1').format={'fill':'#176B89','font':{'color':'#FFFFFF','bold':True}}
for c,wi in [('A',26),('B',95),('C',39),('D',43)]:src.get_range(f'{c}:{c}').format.column_width=wi
src.freeze_panes.freeze_rows(1)
output=ROOT/'nationwide_sample_quality_2026-10-13.xlsx'
SpreadsheetFile.export_xlsx(w).save(str(output))
print('XLSX',output,output.stat().st_size)
print('sheets',w.inspect({'kind':'sheet','include':'id,name'}).ndjson[:500])
