/**
 * 예술 작품 100개 시드 데이터 (R2 + Supabase DB)
 * 고화질 예술 이미지 + 리얼한 작품 데이터
 * 실행: node scripts/seed-artworks.mjs
 */
import sharp from 'sharp';

const R2_WORKER_URL = 'https://moui-ist-r2.gocoder-net.workers.dev';
const R2_API_TOKEN = 'moui-r2-secret-2026';
const SUPABASE_URL = 'https://xtcyfuizbdegshaujfof.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0Y3lmdWl6YmRlZ3NoYXVqZm9mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQwMjY3NywiZXhwIjoyMDkxOTc4Njc3fQ.6OY8tbBDzl40Ft5Y7-t6Rd1GzUOVkSDsIQZv3bnPH0U';

let USER_ID = '';

// ── 장르별 리얼한 작품 데이터 ──

const ARTWORKS_DATA = [
  // ─── 회화 (20) ───
  { category: '회화', title: '붉은 지평선', medium: '캔버스에 유채', technique: '임파스토', w: 130, h: 97, desc: '석양이 물드는 지평선을 두꺼운 유채 물감으로 표현한 대형 추상화. 붓의 궤적이 빛의 흐름을 따라 화면을 가로지른다.', tags: ['추상', '풍경', '유화', '임파스토'] },
  { category: '회화', title: '무제 — 청색 연작 III', medium: '캔버스에 아크릴', technique: '글레이징', w: 100, h: 100, desc: '청색의 무한한 깊이를 탐구하는 시리즈. 수십 겹의 투명한 아크릴 레이어가 명상적인 공간을 만들어낸다.', tags: ['추상', '모노크롬', '미니멀리즘', '글레이징'] },
  { category: '회화', title: '정원에서', medium: '캔버스에 유채', technique: '알라프리마', w: 72, h: 90, desc: '오후의 정원을 한 세션에 완성한 알라프리마 기법의 인상주의 풍경화. 빛과 그림자의 찰나적 순간을 포착했다.', tags: ['인상주의', '풍경', '정원', '알라프리마'] },
  { category: '회화', title: '자화상 — 거울 너머', medium: '리넨에 유채', technique: '사실주의', w: 60, h: 80, desc: '거울에 비친 자신의 모습을 그린 자화상. 렘브란트의 명암법에서 영감을 받아 어둠 속에서 얼굴이 떠오른다.', tags: ['인물', '자화상', '사실주의', '명암법'] },
  { category: '회화', title: '분열된 풍경', medium: '캔버스에 혼합', technique: '콜라주', w: 150, h: 120, desc: '도시화로 파편화된 자연 풍경을 콜라주와 회화를 결합하여 표현. 찢어진 종이와 유화 물감이 충돌하는 화면.', tags: ['혼합매체', '풍경', '콜라주', '현대미술'] },
  { category: '회화', title: '꿈의 건축', medium: '캔버스에 아크릴', technique: '하드엣지', w: 120, h: 80, desc: '기하학적 형태로 구축된 상상의 건축물. 명확한 경계선과 평면적 색채가 꿈속 공간을 구성한다.', tags: ['기하학', '추상', '하드엣지', '건축'] },
  { category: '회화', title: '폭풍 전야', medium: '캔버스에 유채', technique: '표현주의', w: 162, h: 130, desc: '거대한 먹구름이 몰려오는 바다를 격정적인 붓놀림으로 그린 표현주의 해경화. 자연의 위압감이 화면을 지배한다.', tags: ['표현주의', '바다', '풍경', '대작'] },
  { category: '회화', title: '정물 — 석류와 청자', medium: '패널에 유채', technique: '세밀화', w: 40, h: 50, desc: '고려청자 위에 놓인 석류를 극사실적으로 묘사한 정물화. 도자기의 비취색과 석류의 붉은색이 대비를 이룬다.', tags: ['정물', '극사실', '한국미술', '세밀화'] },
  { category: '회화', title: '도시의 리듬', medium: '캔버스에 아크릴', technique: '드리핑', w: 200, h: 150, desc: '잭슨 폴록에게 오마주를 바치는 대형 액션 페인팅. 서울 도심의 에너지를 물감의 자유로운 흐름으로 번역했다.', tags: ['액션페인팅', '추상', '드리핑', '대작'] },
  { category: '회화', title: '봄비 내리는 골목', medium: '캔버스에 유채', technique: '인상주의', w: 65, h: 80, desc: '비 오는 서촌 골목길을 부드러운 터치로 담아낸 풍경화. 젖은 노면에 반사되는 불빛이 서정적 분위기를 자아낸다.', tags: ['인상주의', '도시풍경', '비', '서정적'] },
  { category: '회화', title: '해체된 형상 No.7', medium: '캔버스에 혼합', technique: '입체주의', w: 100, h: 120, desc: '인체를 다시점에서 해체하고 재구성한 입체주의적 구성. 피카소와 데 쿠닝 사이 어딘가에 위치하는 형상.', tags: ['입체주의', '인물', '해체', '현대미술'] },
  { category: '회화', title: '적막', medium: '한지에 먹', technique: '수묵', w: 70, h: 140, desc: '전통 수묵화의 여백미를 현대적으로 재해석한 산수화. 먹의 농담이 안개 자욱한 산세를 만들어낸다.', tags: ['수묵화', '동양화', '산수', '여백'] },
  { category: '회화', title: '네온 야상곡', medium: '캔버스에 아크릴', technique: '팝아트', w: 100, h: 100, desc: '밤의 도시를 네온사인의 형광 색채로 가득 채운 팝아트 회화. 현대 소비문화의 화려함과 공허함을 동시에 담는다.', tags: ['팝아트', '네온', '도시', '야경'] },
  { category: '회화', title: '잔상 — 움직이는 사람들', medium: '캔버스에 유채', technique: '미래주의', w: 130, h: 89, desc: '출퇴근 인파의 움직임을 겹쳐 그린 연작. 속도와 시간의 중첩이 화면 위에서 잔상으로 남는다.', tags: ['미래주의', '인물', '움직임', '도시'] },
  { category: '회화', title: '침묵의 방', medium: '캔버스에 유채', technique: '극사실주의', w: 90, h: 72, desc: '텅 빈 방 안에 의자 하나만 놓인 극사실주의 실내 풍경. 빛이 만드는 그림자가 부재의 존재감을 드러낸다.', tags: ['극사실주의', '실내', '정적', '빛'] },
  { category: '회화', title: '지층', medium: '캔버스에 혼합', technique: '마띠에르', w: 80, h: 120, desc: '모래, 석고, 안료를 층층이 쌓아 올린 물성 탐구 작업. 지질학적 시간이 캔버스 표면에 압축되어 있다.', tags: ['물성', '추상', '마띠에르', '텍스처'] },
  { category: '회화', title: '모란이 피기까지는', medium: '비단에 채색', technique: '민화', w: 60, h: 90, desc: '전통 민화의 모란도를 현대적 색감으로 재해석. 화려한 모란꽃 사이로 나비와 새가 노닌다.', tags: ['민화', '전통', '꽃', '채색화'] },
  { category: '회화', title: '그리드 위의 감정', medium: '캔버스에 아크릴', technique: '기하추상', w: 100, h: 100, desc: '몬드리안의 격자 구조를 감정의 색으로 채운 추상화. 차가운 구조 안에 뜨거운 색채가 갇혀 있다.', tags: ['기하추상', '격자', '색채', '모더니즘'] },
  { category: '회화', title: '밤의 수영장', medium: '캔버스에 아크릴', technique: '플랫컬러', w: 120, h: 90, desc: '호크니에게 영감받은 밤의 수영장 풍경. 물의 일렁임과 인공 조명의 푸른빛이 독특한 분위기를 만든다.', tags: ['풍경', '수영장', '플랫컬러', '팝아트'] },
  { category: '회화', title: '부유하는 세계', medium: '캔버스에 유채', technique: '초현실주의', w: 80, h: 100, desc: '중력을 잃은 사물들이 허공에 떠다니는 초현실주의 회화. 마그리트와 달리의 세계가 교차하는 꿈의 장면.', tags: ['초현실주의', '환상', '부유', '꿈'] },

  // ─── 일러스트 (15) ───
  { category: '일러스트', title: '숲속의 차 한잔', medium: '디지털 페인팅', technique: '수채풍 디지털', w: 60, h: 80, desc: '안개 자욱한 숲속에서 차를 마시는 소녀를 수채화풍 디지털 기법으로 그린 판타지 일러스트.', tags: ['판타지', '디지털', '수채풍', '캐릭터'] },
  { category: '일러스트', title: '도시 위의 고래', medium: '디지털 페인팅', technique: '컨셉아트', w: 120, h: 68, desc: '서울 하늘 위를 유영하는 거대한 고래. 현실과 환상이 공존하는 도시 판타지 컨셉아트.', tags: ['컨셉아트', '고래', '도시', '판타지'] },
  { category: '일러스트', title: '빈티지 식물도감 — 제비꽃', medium: '종이에 수채', technique: '보태니컬', w: 30, h: 40, desc: '19세기 식물도감 스타일로 그린 제비꽃 세밀화. 학명과 부위별 해부도가 함께 구성되어 있다.', tags: ['보태니컬', '식물', '세밀화', '빈티지'] },
  { category: '일러스트', title: '밤의 서점', medium: '디지털 페인팅', technique: '로파이', w: 80, h: 80, desc: '불 켜진 작은 서점의 따뜻한 야경을 로파이 감성으로 그린 일러스트. 고양이가 쇼윈도에 앉아있다.', tags: ['로파이', '야경', '서점', '감성'] },
  { category: '일러스트', title: '사이버 사무라이', medium: '디지털 페인팅', technique: '사이버펑크', w: 70, h: 100, desc: '네온 빛 도쿄를 배경으로 한 사이버펑크 사무라이 캐릭터 디자인. 전통 갑옷에 홀로그램 장식.', tags: ['사이버펑크', '캐릭터', 'SF', '사무라이'] },
  { category: '일러스트', title: '어린 왕자의 별', medium: '종이에 과슈', technique: '동화풍', w: 40, h: 50, desc: '생텍쥐페리의 어린 왕자에서 영감받은 동화풍 일러스트. 작은 별 위에 선 소년과 장미.', tags: ['동화', '문학', '과슈', '서정적'] },
  { category: '일러스트', title: '한옥 카페 오후', medium: '디지털 페인팅', technique: '애니메이션풍', w: 120, h: 68, desc: '북촌 한옥마을의 카페를 지브리 애니메이션 스타일로 그린 배경 일러스트. 따스한 오후 햇살.', tags: ['애니메이션', '한옥', '배경', '지브리'] },
  { category: '일러스트', title: '우주 정거장의 일상', medium: '디지털 페인팅', technique: 'SF 컨셉', w: 120, h: 50, desc: '우주 정거장 내부에서 식사하는 우주인들의 일상을 그린 SF 파노라마 일러스트.', tags: ['SF', '우주', '컨셉아트', '파노라마'] },
  { category: '일러스트', title: '포션 가게', medium: '디지털 페인팅', technique: '게임아트', w: 80, h: 80, desc: '판타지 RPG의 포션 가게 내부를 세밀하게 그린 게임 배경 아트. 유리병과 마법 재료가 빼곡하다.', tags: ['게임아트', '판타지', '배경', '세밀'] },
  { category: '일러스트', title: '비 오는 날의 고양이들', medium: '디지털 드로잉', technique: '라인드로잉', w: 50, h: 70, desc: '비 오는 거리에서 우산을 쓴 고양이들의 행렬. 심플한 라인과 제한된 색상의 감성 일러스트.', tags: ['고양이', '비', '라인드로잉', '감성'] },
  { category: '일러스트', title: '전통 문양 리디자인', medium: '벡터 그래픽', technique: '그래픽', w: 60, h: 60, desc: '한국 전통 단청 문양을 현대적 그래픽으로 재해석한 패턴 일러스트. 오방색의 현대적 변주.', tags: ['전통', '패턴', '단청', '그래픽'] },
  { category: '일러스트', title: '해저 도서관', medium: '디지털 페인팅', technique: '판타지', w: 90, h: 120, desc: '바닷속에 가라앉은 고대 도서관을 그린 판타지 일러스트. 해파리가 랜턴처럼 빛을 밝힌다.', tags: ['판타지', '바다', '도서관', '몽환적'] },
  { category: '일러스트', title: '소녀와 드래곤', medium: '디지털 페인팅', technique: '동양풍 판타지', w: 70, h: 100, desc: '동양화적 구도와 서양 판타지를 결합한 소녀와 용의 조우. 수묵의 번짐과 디지털 채색의 조화.', tags: ['판타지', '동양풍', '드래곤', '캐릭터'] },
  { category: '일러스트', title: '제주 감귤밭', medium: '종이에 수채', technique: '수채화', w: 50, h: 35, desc: '제주도 감귤밭의 따뜻한 풍경을 투명 수채로 그린 여행 일러스트. 돌담과 감귤나무가 어우러진다.', tags: ['수채화', '제주', '풍경', '여행'] },
  { category: '일러스트', title: '1960년대 서울', medium: '디지털 페인팅', technique: '레트로', w: 100, h: 60, desc: '1960년대 종로거리를 레트로풍으로 재현한 일러스트. 전차와 양장점, 다방이 있는 풍경.', tags: ['레트로', '서울', '역사', '향수'] },

  // ─── 판화 (10) ───
  { category: '판화', title: '달빛 소나타', medium: '목판화', technique: '다색 목판', w: 45, h: 60, desc: '보름달 아래 소나무 숲을 다색 목판화로 찍어낸 작품. 나뭇결의 자연스러운 텍스처가 살아있다.', tags: ['목판화', '달', '소나무', '다색'] },
  { category: '판화', title: '도시 야경 — 에칭', medium: '동판화', technique: '에칭', w: 30, h: 40, desc: '서울 야경의 빛을 세밀한 에칭 선으로 표현한 동판화. 인타글리오의 깊은 톤이 밤의 깊이를 전달한다.', tags: ['에칭', '동판화', '야경', '도시'] },
  { category: '판화', title: '파도', medium: '리노컷', technique: '리노커팅', w: 50, h: 35, desc: '호쿠사이의 파도에 오마주를 바치는 현대적 리노컷. 단순화된 형태와 강렬한 흑백 대비.', tags: ['리노컷', '파도', '흑백', '오마주'] },
  { category: '판화', title: '실크스크린 초상 — 마릴린', medium: '실크스크린', technique: '세리그래피', w: 80, h: 80, desc: '앤디 워홀의 방법론을 차용한 실크스크린 초상. 반복과 색채 변주를 통해 이미지의 의미를 탐구한다.', tags: ['실크스크린', '팝아트', '초상', '워홀'] },
  { category: '판화', title: '숲의 층위', medium: '목판화', technique: '환원목판', w: 40, h: 55, desc: '하나의 판목을 깎아가며 여러 색을 찍는 환원 기법의 목판화. 숲의 깊이감이 층층이 쌓인다.', tags: ['목판화', '환원', '숲', '다색'] },
  { category: '판화', title: '추상 구성 No.12', medium: '석판화', technique: '리소그래피', w: 55, h: 75, desc: '석판의 부드러운 톤을 활용한 추상 구성. 크레용의 질감이 그대로 전사된 석판화의 매력.', tags: ['석판화', '추상', '리소그래피', '톤'] },
  { category: '판화', title: '정원의 새들', medium: '목판화', technique: '수인목판', w: 35, h: 50, desc: '전통 수인목판 기법으로 찍은 새와 꽃. 물을 머금은 한지 위에 먹의 번짐이 자연스럽다.', tags: ['수인목판', '새', '전통', '한지'] },
  { category: '판화', title: '메조틴트 — 밤의 고양이', medium: '동판화', technique: '메조틴트', w: 25, h: 30, desc: '메조틴트 기법의 깊은 흑색에서 부드럽게 떠오르는 고양이 눈동자. 벨벳 같은 톤의 변화.', tags: ['메조틴트', '고양이', '흑백', '동판화'] },
  { category: '판화', title: '해부학적 꽃', medium: '동판화', technique: '드라이포인트', w: 30, h: 45, desc: '꽃의 구조를 해부학적 시선으로 그린 드라이포인트. 날카로운 선과 버가 만드는 독특한 질감.', tags: ['드라이포인트', '꽃', '해부학', '세밀'] },
  { category: '판화', title: '한글 타이포 — 비', medium: '실크스크린', technique: '실크스크린', w: 50, h: 70, desc: '한글 "비"를 타이포그래피와 실크스크린으로 표현. 빗줄기처럼 흐르는 글자의 형태 실험.', tags: ['실크스크린', '한글', '타이포그래피', '실험'] },

  // ─── 소설 (8) ───
  { category: '소설', title: '유리 도시의 기억', medium: null, technique: null, w: null, h: null, desc: '2050년 서울을 배경으로 한 디스토피아 SF 소설. 기억을 거래하는 사회에서 자신의 과거를 찾아가는 여정을 그린다.', tags: ['SF', '디스토피아', '장편소설', '기억'], meta: { genre: 'SF, 디스토피아', publisher: '문학동네', page_count: '380', edition: '초판', link: 'https://brunch.co.kr/@gocoder/1' } },
  { category: '소설', title: '바다가 삼킨 마을', medium: null, technique: null, w: null, h: null, desc: '해수면 상승으로 사라진 해안 마을의 마지막 주민들을 그린 기후 소설. 상실과 회복탄력성에 대한 이야기.', tags: ['기후소설', '해안', '상실', '현대문학'], meta: { genre: '기후소설, 문학', publisher: '창비', page_count: '290', edition: '초판', link: 'https://brunch.co.kr/@gocoder/2' } },
  { category: '소설', title: '밤의 도서관', medium: null, technique: null, w: null, h: null, desc: '밤마다 책 속 인물들이 살아나는 도서관을 배경으로 한 판타지 소설. 메타픽션적 구조가 독특하다.', tags: ['판타지', '메타픽션', '도서관', '밤'], meta: { genre: '판타지, 메타픽션', publisher: '민음사', page_count: '320', link: 'https://brunch.co.kr/@gocoder/3' } },
  { category: '소설', title: '삼 대의 식탁', medium: null, technique: null, w: null, h: null, desc: '할머니, 어머니, 딸 삼 대가 함께하는 명절 식탁을 중심으로 한국 가족사를 조명하는 가족 소설.', tags: ['가족', '한국문학', '세대', '식탁'], meta: { genre: '가족소설, 한국문학', publisher: '문학과지성사', page_count: '260', edition: '초판', link: 'https://brunch.co.kr/@gocoder/4' } },
  { category: '소설', title: '번역가의 연인', medium: null, technique: null, w: null, h: null, desc: '서울과 파리를 오가는 번역가의 사랑 이야기. 언어의 틈새에서 피어나는 감정을 섬세하게 풀어낸다.', tags: ['로맨스', '번역', '파리', '언어'], meta: { genre: '로맨스, 문학', publisher: '은행나무', page_count: '240', link: 'https://brunch.co.kr/@gocoder/5' } },
  { category: '소설', title: '지하철 3호선 이야기', medium: null, technique: null, w: null, h: null, desc: '3호선 각 역에서 벌어지는 단편들을 엮은 연작소설. 서울 시민들의 소소한 일상과 비밀을 담는다.', tags: ['연작', '서울', '지하철', '일상'], meta: { genre: '연작소설', publisher: '현대문학', page_count: '210', link: 'https://brunch.co.kr/@gocoder/6' } },
  { category: '소설', title: '마지막 조선 마법사', medium: null, technique: null, w: null, h: null, desc: '조선 시대 실존했다는 마법사들의 이야기를 현대 서울과 교차 편집한 한국형 판타지 장편.', tags: ['한국판타지', '조선', '마법', '역사'], meta: { genre: '한국판타지, 역사', publisher: '위즈덤하우스', page_count: '420', link: 'https://brunch.co.kr/@gocoder/7' } },
  { category: '소설', title: '로봇이 우는 밤', medium: null, technique: null, w: null, h: null, desc: '감정을 갖게 된 AI 로봇의 시선으로 인간 사회를 바라보는 SF 소설. 공감과 의식의 본질을 묻는다.', tags: ['SF', 'AI', '감정', '철학적'], meta: { genre: 'SF, 철학소설', publisher: '문학동네', page_count: '310', link: 'https://brunch.co.kr/@gocoder/8' } },

  // ─── 시 (7) ───
  { category: '시', title: '서울의 달', medium: null, technique: null, w: null, h: null, desc: '서울 하늘의 달을 매일 관찰하며 쓴 30편의 연작시. 도시의 밤하늘과 고독에 대한 시적 명상.', tags: ['서정시', '달', '서울', '연작'], meta: { publisher: '문학과지성사', page_count: '120', edition: '초판', link: 'https://brunch.co.kr/@gocoder/9' } },
  { category: '시', title: '엄마의 부엌', medium: null, technique: null, w: null, h: null, desc: '어머니의 요리와 음식 냄새를 통해 기억을 더듬는 시집. 가정의 따뜻함과 그리움을 담았다.', tags: ['가정', '음식', '기억', '서정시'], meta: { publisher: '창비', page_count: '96', edition: '초판', link: 'https://brunch.co.kr/@gocoder/10' } },
  { category: '시', title: '데이터의 시', medium: null, technique: null, w: null, h: null, desc: '프로그래밍 코드와 알고리즘을 시적 언어로 변환한 실험시. 디지털 시대의 새로운 서정을 탐색한다.', tags: ['실험시', '디지털', '코드', '현대시'], meta: { publisher: '민음사', page_count: '88', link: 'https://brunch.co.kr/@gocoder/11' } },
  { category: '시', title: '걷는 사람', medium: null, technique: null, w: null, h: null, desc: '매일 같은 길을 걸으며 발견하는 미세한 변화들에 대한 시. 반복 속의 차이가 만드는 시적 순간.', tags: ['산책', '일상', '관찰', '산문시'], meta: { publisher: '문학동네', page_count: '104', link: 'https://brunch.co.kr/@gocoder/12' } },
  { category: '시', title: '물의 언어', medium: null, technique: null, w: null, h: null, desc: '강, 비, 눈, 바다 — 물의 다양한 형태를 통해 생명과 순환을 노래하는 생태 시집.', tags: ['생태시', '물', '자연', '순환'], meta: { publisher: '창비', page_count: '110', edition: '초판', link: 'https://brunch.co.kr/@gocoder/13' } },
  { category: '시', title: '번역 불가능한 단어들', medium: null, technique: null, w: null, h: null, desc: '한국어에만 존재하는 단어들(정, 눈치, 한)을 시로 풀어낸 시집. 언어의 결에 대한 탐구.', tags: ['한국어', '언어', '문화', '서정'], meta: { publisher: '문학과지성사', page_count: '92', link: 'https://brunch.co.kr/@gocoder/14' } },
  { category: '시', title: '0시의 지하철', medium: null, technique: null, w: null, h: null, desc: '막차를 타는 사람들의 표정과 사연을 상상하며 쓴 시들. 도시인의 피로와 꿈이 교차한다.', tags: ['도시', '지하철', '야간', '군상'], meta: { publisher: '민음사', page_count: '84', link: 'https://brunch.co.kr/@gocoder/15' } },

  // ─── 순수사진 (8) ───
  { category: '순수사진', title: '안개 속의 다리', medium: '젤라틴 실버 프린트', technique: '흑백 필름', w: 60, h: 40, desc: '새벽 안개 속 마포대교를 대형 포맷 필름 카메라로 촬영한 흑백 사진. 도시의 적막을 담았다.', tags: ['흑백', '풍경', '안개', '필름'] },
  { category: '순수사진', title: '시장 사람들', medium: '디지털 프린트', technique: '다큐멘터리', w: 80, h: 53, desc: '전통 시장 상인들의 일상을 기록한 다큐멘터리 사진 시리즈. 사라져가는 풍경의 아카이브.', tags: ['다큐멘터리', '시장', '인물', '기록'] },
  { category: '순수사진', title: '반영', medium: '디지털 프린트', technique: '미니멀', w: 50, h: 50, desc: '물웅덩이에 비친 건물의 반영을 촬영한 미니멀 사진. 대칭과 왜곡이 만드는 추상적 구성.', tags: ['미니멀', '반영', '추상', '도시'] },
  { category: '순수사진', title: '밤의 편의점', medium: '디지털 프린트', technique: '스트리트', w: 60, h: 40, desc: '심야 편의점의 형광등 빛과 고독한 손님을 담은 스트리트 포토. 에드워드 호퍼적 고독.', tags: ['스트리트', '야간', '편의점', '고독'] },
  { category: '순수사진', title: '겹쳐진 시간', medium: '다중노출 필름', technique: '다중노출', w: 40, h: 60, desc: '같은 장소를 다른 시간에 촬영해 필름 위에 겹친 다중노출 사진. 시간의 겹침이 만드는 환영.', tags: ['다중노출', '필름', '시간', '실험'] },
  { category: '순수사진', title: '폐공장의 빛', medium: '디지털 프린트', technique: '폐허사진', w: 80, h: 60, desc: '버려진 공장에 스며드는 자연광을 촬영한 폐허 사진. 쇠퇴와 자연 회복의 아름다움.', tags: ['폐허', '빛', '공장', '자연'] },
  { category: '순수사진', title: '초상 — 할머니의 손', medium: '젤라틴 실버 프린트', technique: '인물사진', w: 40, h: 50, desc: '90세 할머니의 주름진 손을 클로즈업으로 촬영한 흑백 초상. 한 생애의 시간이 담겨있다.', tags: ['인물', '흑백', '손', '시간'] },
  { category: '순수사진', title: '도시 기하학', medium: '디지털 프린트', technique: '건축사진', w: 60, h: 80, desc: '서울 현대 건축물의 기하학적 패턴을 추상적으로 촬영한 건축 사진 시리즈.', tags: ['건축', '기하학', '추상', '패턴'] },

  // ─── 조각 (5) ───
  { category: '조각', title: '바람의 형태', medium: '스테인리스 스틸', technique: '용접', w: 120, h: 200, desc: '바람의 보이지 않는 흐름을 스테인리스 스틸 곡면으로 형상화한 야외 조각. 표면에 하늘이 반사된다.', tags: ['금속조각', '바람', '야외', '추상'] },
  { category: '조각', title: '앉아있는 사람', medium: '브론즈', technique: '로스트왁스', w: 30, h: 45, desc: '고개를 숙이고 앉아있는 인물의 브론즈 조각. 현대인의 피로와 사색을 담은 구상 조각.', tags: ['브론즈', '인물', '구상', '사색'] },
  { category: '조각', title: '연결 — 두 개의 손', medium: '대리석', technique: '카빙', w: 40, h: 25, desc: '서로를 향해 뻗은 두 손을 대리석으로 조각한 작품. 연결과 단절 사이의 긴장을 표현한다.', tags: ['대리석', '손', '연결', '카빙'] },
  { category: '조각', title: '도시 토템', medium: '폐자재', technique: '어셈블리지', w: 50, h: 180, desc: '도시에서 수집한 폐금속과 전자부품으로 쌓아 올린 현대판 토템. 소비문화에 대한 비평.', tags: ['어셈블리지', '폐자재', '토템', '비평'] },
  { category: '조각', title: '물방울', medium: '유리', technique: '블로잉', w: 25, h: 35, desc: '떨어지는 물방울의 순간을 투명한 유리로 포착한 조각. 빛이 통과하며 무지개빛을 만든다.', tags: ['유리', '물', '빛', '투명'] },

  // ─── 미디어아트 (5) ───
  { category: '미디어아트', title: '데이터 폭포', medium: '프로젝션 맵핑', technique: '인터랙티브', w: null, h: null, desc: '실시간 SNS 데이터를 폭포처럼 쏟아지는 빛으로 변환하는 인터랙티브 프로젝션 맵핑 설치 작품.', tags: ['인터랙티브', '데이터', '프로젝션', '설치'] },
  { category: '미디어아트', title: '숨쉬는 벽', medium: 'LED, 센서', technique: '키네틱', w: null, h: null, desc: '관람객의 호흡에 반응하여 LED 빛이 파동치는 키네틱 미디어 월. 생명의 리듬을 시각화한다.', tags: ['키네틱', 'LED', '호흡', '인터랙티브'] },
  { category: '미디어아트', title: 'AI 초상화 생성기', medium: 'AI, 모니터', technique: '제너레이티브', w: null, h: null, desc: '관람객의 얼굴을 인식하여 다양한 미술 사조로 실시간 변환하는 AI 기반 제너레이티브 아트.', tags: ['AI', '제너레이티브', '초상', '인터랙티브'] },
  { category: '미디어아트', title: '사운드 오브 시티', medium: '사운드 설치', technique: '사운드아트', w: null, h: null, desc: '서울 각 구에서 수집한 환경음을 공간에 재배치한 사운드 설치. 도시의 보이지 않는 소리 지도.', tags: ['사운드아트', '설치', '서울', '환경음'] },
  { category: '미디어아트', title: '디지털 산수', medium: '4K 영상, 모니터', technique: 'AI아트', w: null, h: null, desc: 'AI가 전통 산수화를 학습하여 실시간으로 생성하는 디지털 산수. 전통과 기술의 경계를 묻는다.', tags: ['AI아트', '산수화', '전통', '디지털'] },

  // ─── 웹툰/만화 (5) ───
  { category: '웹툰/만화', title: '오늘도 출근', medium: '디지털 드로잉', technique: '웹툰', w: 70, h: 100, desc: '평범한 직장인의 일상을 유쾌하게 그린 일상 코미디 웹툰. 공감 100%의 출퇴근 에피소드.', tags: ['웹툰', '일상', '코미디', '직장'] },
  { category: '웹툰/만화', title: '달빛 검객', medium: '디지털 드로잉', technique: '만화', w: 60, h: 90, desc: '조선시대 밤의 도성을 지키는 검객의 이야기. 수묵풍 터치와 다이나믹한 액션 연출.', tags: ['만화', '액션', '조선', '검객'] },
  { category: '웹툰/만화', title: '카페 고양이', medium: '디지털 드로잉', technique: '감성웹툰', w: 60, h: 80, desc: '동네 카페에 사는 고양이의 시선으로 본 손님들의 이야기. 따뜻한 힐링 감성 웹툰.', tags: ['웹툰', '고양이', '카페', '힐링'] },
  { category: '웹툰/만화', title: '우주 택배', medium: '디지털 드로잉', technique: 'SF웹툰', w: 70, h: 100, desc: '은하계를 누비는 택배기사의 모험을 그린 SF 웹툰. 각 행성마다 독특한 문화와 캐릭터.', tags: ['SF', '웹툰', '우주', '모험'] },
  { category: '웹툰/만화', title: '인디 밴드 다이어리', medium: '수작업 + 디지털', technique: '에세이만화', w: 50, h: 70, desc: '무명 인디 밴드의 데뷔 과정을 기록한 에세이 만화. 음악과 청춘에 대한 솔직한 이야기.', tags: ['에세이만화', '음악', '인디', '청춘'] },

  // ─── 캘리그래피 (4) ───
  { category: '캘리그래피', title: '바람이 분다', medium: '화선지에 먹', technique: '전통 서예', w: 35, h: 100, desc: '윤동주의 시 "바람이 분다"를 전통 행서체로 쓴 서예 작품. 바람처럼 흐르는 필획.', tags: ['서예', '시', '행서', '전통'] },
  { category: '캘리그래피', title: '하나', medium: '종이에 먹', technique: '현대 캘리', w: 60, h: 60, desc: '"하나"라는 글자를 다양한 굵기와 농담으로 반복 표현한 현대 캘리그래피. 단일성과 다양성의 역설.', tags: ['현대캘리', '한글', '먹', '반복'] },
  { category: '캘리그래피', title: '사계 — 봄여름가을겨울', medium: '한지에 채색 먹', technique: '채묵', w: 120, h: 30, desc: '사계절을 네 글자에 담아 각각 다른 색 먹으로 표현한 가로형 캘리그래피 연작.', tags: ['사계절', '채묵', '한지', '연작'] },
  { category: '캘리그래피', title: '길 위에서', medium: '나무 패널에 각인', technique: '우드캘리', w: 40, h: 50, desc: '나무 패널에 직접 조각하여 새긴 캘리그래피. 나뭇결과 글자가 하나가 되는 물성의 만남.', tags: ['우드캘리', '조각', '나무', '물성'] },

  // ─── 그래픽디자인 (5) ───
  { category: '그래픽디자인', title: '서울 타이포 포스터', medium: '디지털 프린트', technique: '타이포그래피', w: 59, h: 84, desc: '"서울"이라는 글자를 해체하고 재구성한 실험적 타이포그래피 포스터. A1 사이즈 실크스크린.', tags: ['타이포그래피', '포스터', '서울', '실험'] },
  { category: '그래픽디자인', title: '재즈 페스티벌 2025', medium: '디지털 프린트', technique: '포스터', w: 50, h: 70, desc: '가상의 재즈 페스티벌을 위한 포스터 디자인. 악기의 곡선과 음표가 흐르는 유기적 구성.', tags: ['포스터', '재즈', '음악', '이벤트'] },
  { category: '그래픽디자인', title: '한글날 기념 엽서 세트', medium: '디지털 프린트', technique: '레터링', w: 15, h: 10, desc: '한글 자모를 활용한 10종 엽서 세트. 각 자음과 모음의 조형미를 현대적으로 해석.', tags: ['한글', '레터링', '엽서', '한글날'] },
  { category: '그래픽디자인', title: '브루탈리즘 웹 포스터', medium: '디지털', technique: '브루탈리즘', w: 80, h: 120, desc: '브루탈리즘 웹 디자인 트렌드를 종이 포스터로 옮긴 작업. 거친 타이포와 형광 색상.', tags: ['브루탈리즘', '웹디자인', '포스터', '트렌드'] },
  { category: '그래픽디자인', title: '제로웨이스트 캠페인', medium: '디지털 프린트', technique: '인포그래픽', w: 59, h: 84, desc: '환경 캠페인을 위한 인포그래픽 포스터. 데이터를 아름답게 시각화하여 메시지를 전달한다.', tags: ['인포그래픽', '환경', '캠페인', '데이터'] },

  // ─── 기타 장르 (13) ───
  { category: '에세이', title: '느린 아침의 기술', medium: null, technique: null, w: null, h: null, desc: '바쁜 도시에서 느리게 사는 법에 대한 에세이. 아침 루틴, 산책, 요리를 통한 소소한 행복 찾기.', tags: ['에세이', '일상', '슬로라이프', '아침'], meta: { publisher: '브런치북', page_count: '180', link: 'https://brunch.co.kr/@gocoder/16' } },
  { category: '에세이', title: '미술관 옆 카페에서', medium: null, technique: null, w: null, h: null, desc: '세계 각지의 미술관을 방문하며 쓴 예술 에세이. 그림 앞에서 느낀 감정과 사유의 기록.', tags: ['에세이', '미술관', '여행', '예술'], meta: { publisher: '아트북스', page_count: '220', link: 'https://brunch.co.kr/@gocoder/17' } },
  { category: '작곡', title: '빗소리 변주곡', medium: null, technique: null, w: null, h: null, desc: '빗소리를 샘플링하여 피아노 선율과 결합한 앰비언트 곡. 자연음과 악기의 경계를 허문다.', tags: ['앰비언트', '피아노', '빗소리', '샘플링'], meta: { genre: '앰비언트, 뉴에이지', duration: '6분 42초', instruments: '피아노, 필드레코딩, Ableton Live', link: 'https://soundcloud.com/gocoder/rain-variations' } },
  { category: '작곡', title: '서울 지하철 교향곡', medium: null, technique: null, w: null, h: null, desc: '지하철 안내 방송, 문 닫히는 소리, 승객들의 발걸음을 소재로 한 실험 음악 작곡.', tags: ['실험음악', '서울', '지하철', '교향곡'], meta: { genre: '실험음악, 전자음악', duration: '12분 15초', instruments: 'Max/MSP, 필드레코딩, 신디사이저', link: 'https://soundcloud.com/gocoder/seoul-subway-symphony' } },
  { category: '연주', title: '가야금 즉흥 — 달밤', medium: null, technique: null, w: null, h: null, desc: '보름달을 바라보며 즉흥으로 연주한 가야금 독주. 전통 산조 가락이 자유롭게 변주된다.', tags: ['가야금', '즉흥', '전통', '독주'], meta: { genre: '국악, 즉흥연주', duration: '8분 30초', instruments: '25현 가야금', link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
  { category: '도예/세라믹', title: '달항아리 — 현대적 변주', medium: '백자토', technique: '물레성형', w: 35, h: 40, desc: '조선 달항아리의 형태를 계승하면서 표면에 현대적 균열 문양을 넣은 도예 작품.', tags: ['도예', '달항아리', '백자', '현대'] },
  { category: '도예/세라믹', title: '찻잔 세트 — 오방색', medium: '청자토', technique: '핸드빌딩', w: 10, h: 8, desc: '한국의 오방색을 각각 입힌 다섯 개의 찻잔 세트. 전통 유약의 깊은 색감이 특징.', tags: ['도예', '찻잔', '오방색', '전통'] },
  { category: '설치미술', title: '천 개의 종이학', medium: '한지, 낚싯줄', technique: '설치', w: null, h: null, desc: '천 개의 한지 종이학이 천장에서 쏟아지는 대형 설치 작품. 소원과 기도의 물리적 형태.', tags: ['설치', '종이학', '한지', '소원'] },
  { category: '설치미술', title: '기억의 방', medium: '거울, LED, 안개', technique: '몰입형 설치', w: null, h: null, desc: '무한 거울의 방에 안개와 LED를 결합한 몰입형 설치. 관람객이 기억 속에 빠져드는 체험.', tags: ['몰입형', '거울', 'LED', '설치'] },
  { category: 'AI아트', title: '기계의 꿈 No.42', medium: 'AI 생성 + 수작업 보정', technique: 'AI제너레이티브', w: 80, h: 80, desc: 'AI가 생성한 이미지를 작가가 선별하고 수작업으로 보정한 인간-기계 협업 작품.', tags: ['AI', '제너레이티브', '협업', '꿈'], meta: { link: 'https://www.artstation.com/gocoder' } },
  { category: '영화', title: '마지막 버스', medium: null, technique: null, w: null, h: null, desc: '서울 외곽 마지막 버스를 타는 사람들의 이야기를 담은 단편 영화. 15분, 흑백, 대사 없음.', tags: ['단편영화', '흑백', '무대사', '서울'], meta: { genre: '드라마, 실험영화', duration: '15분', role: '감독, 촬영, 편집', link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
  { category: '애니메이션', title: '종이 나비', medium: null, technique: null, w: null, h: null, desc: '접힌 종이 나비가 살아 움직이는 스톱모션 애니메이션. 3분, 수작업 페이퍼크래프트.', tags: ['스톱모션', '종이', '나비', '수작업'], meta: { genre: '스톱모션, 실험 애니메이션', duration: '3분 12초', role: '감독, 애니메이터, 미술', link: 'https://vimeo.com/123456789' } },
  { category: '무용', title: '물 위를 걷다', medium: null, technique: null, w: null, h: null, desc: '수면 위에 설치된 무대에서 펼쳐지는 현대무용 공연 기록. 물과 몸의 대화.', tags: ['현대무용', '물', '공연', '퍼포먼스'], meta: { genre: '현대무용, 사이트스페시픽', duration: '25분', role: '안무, 출연', venue: '서울시립미술관 야외 무대', link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function randomYear() { return 2018 + Math.floor(Math.random() * 8); }

async function uploadToR2(path, imageBuffer, contentType) {
  const res = await fetch(
    `${R2_WORKER_URL}/upload?bucket=artworks&path=${encodeURIComponent(path)}&type=${encodeURIComponent(contentType)}`,
    { method: 'POST', headers: { Authorization: `Bearer ${R2_API_TOKEN}` }, body: imageBuffer }
  );
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return (await res.json()).url;
}

async function insertArtwork(data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/artworks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Insert failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// 예술 관련 검색어로 고화질 이미지 가져오기 (Unsplash Source)
const ART_QUERIES = [
  'abstract-painting', 'oil-painting', 'modern-art', 'watercolor',
  'sculpture', 'gallery', 'canvas', 'artwork', 'illustration',
  'printmaking', 'calligraphy', 'pottery', 'ceramic', 'installation-art',
  'street-art', 'portrait-painting', 'landscape-painting', 'still-life',
  'digital-art', 'photography-art', 'contemporary-art', 'fine-art',
  'acrylic-painting', 'ink-drawing', 'sketch', 'mixed-media',
  'pop-art', 'minimalism', 'expressionism', 'surrealism',
];

async function downloadArtImage() {
  const w = 1200 + Math.floor(Math.random() * 600);
  const h = 900 + Math.floor(Math.random() * 900);
  const res = await fetch(`https://picsum.photos/${w}/${h}`, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  return await res.arrayBuffer();
}

async function main() {
  console.log(`=== ${ARTWORKS_DATA.length}개 예술 작품 시드 시작 ===\n`);

  // gocoder 유저 ID 조회
  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?username=eq.gocoder&select=id`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  });
  const profiles = await profileRes.json();
  if (!profiles?.length) throw new Error('gocoder 프로필 없음');
  USER_ID = profiles[0].id;
  console.log(`gocoder ID: ${USER_ID}\n`);

  for (let i = 0; i < ARTWORKS_DATA.length; i++) {
    const art = ARTWORKS_DATA[i];
    const year = randomYear();

    try {
      // 1. 고화질 이미지 다운로드
      const imgBuffer = await downloadArtImage();

      // 2. R2 업로드 (원본)
      const baseName = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const fileName = `${USER_ID}/${baseName}.jpg`;
      const url = await uploadToR2(fileName, imgBuffer, 'image/jpeg');

      // 3. 썸네일 생성 (sharp로 400px 리사이즈) + 업로드
      const thumbBuffer = await sharp(Buffer.from(imgBuffer))
        .resize(400)
        .jpeg({ quality: 60 })
        .toBuffer();
      await uploadToR2(`${USER_ID}/thumb_${baseName}.jpg`, thumbBuffer, 'image/jpeg');

      // 4. DB 저장
      const metadata = { ...(art.meta || {}) };
      if (art.medium) metadata.medium = art.medium;
      if (art.technique) metadata.technique = art.technique;

      await insertArtwork({
        user_id: USER_ID,
        title: art.title,
        image_url: url,
        year,
        width_cm: art.w,
        height_cm: art.h,
        medium: art.medium,
        description: art.desc,
        tags: [art.category, String(year), ...art.tags],
        category: art.category,
        metadata,
      });

      console.log(`[${i + 1}/${ARTWORKS_DATA.length}] ${art.title} (${art.category}) ✓`);
    } catch (err) {
      console.error(`[${i + 1}/${ARTWORKS_DATA.length}] 실패:`, err.message);
    }

    // Rate limit
    if (i % 10 === 9) {
      console.log('  ... 대기 ...');
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('\n=== 완료! ===');
}

main().catch(console.error);
