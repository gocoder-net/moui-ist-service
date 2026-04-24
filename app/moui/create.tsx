import { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { spendPoints } from '@/lib/points';
import { parseRegion } from '@/constants/regions';
import { REGIONS, PROVINCE_LIST } from '@/constants/regions';
import { MOUI_CATEGORIES, MOUI_POST_COST, FIELD_OPTIONS, TARGET_TOP, TARGET_CREATOR_SUB } from '@/constants/moui';
import Animated, { FadeInDown } from 'react-native-reanimated';

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n${message}`);
  else Alert.alert(title, message);
}

const MAP_DOMAINS = ['naver.me', 'map.naver.com', 'naver.com', 'map.kakao.com', 'kakao.com', 'maps.app.goo.gl', 'goo.gl', 'google.com', 'maps.google.com'];

function isValidMapUrl(url: string): boolean {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return MAP_DOMAINS.some(d => u.hostname.endsWith(d));
  } catch {
    return false;
  }
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const MAX_RECRUIT_DAYS = 30;
const MAX_RECRUIT_MONTHS = 3;
const MAX_MEETING_MONTHS = 6;

function getMaxDate(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}

/** 오늘~maxDate 사이의 연도 목록 */
function getYears(maxMonths: number) {
  const now = new Date();
  const max = getMaxDate(maxMonths);
  const years: number[] = [];
  for (let y = now.getFullYear(); y <= max.getFullYear(); y++) years.push(y);
  return years;
}

/** 선택한 연도 기준, 오늘~maxDate 사이의 월 목록 */
function getMonths(year: number, maxMonths: number) {
  const now = new Date();
  const max = getMaxDate(maxMonths);
  const months: number[] = [];
  for (let m = 1; m <= 12; m++) {
    const first = new Date(year, m - 1, 1);
    const last = new Date(year, m, 0);
    // 해당 월의 마지막 날이 오늘 이전이면 스킵, 첫날이 max 이후면 스킵
    if (last < new Date(now.getFullYear(), now.getMonth(), 1)) continue;
    if (first > max) continue;
    months.push(m);
  }
  return months;
}

/** 선택한 연/월 기준, 오늘~maxDate 사이의 일 목록 */
function getFilteredDays(year: number, month: number, maxMonths: number) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const max = getMaxDate(maxMonths);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    if (date < today) continue;
    if (date > max) continue;
    days.push(d);
  }
  return days;
}

const FREQUENCY_OPTIONS = [
  { key: 'once', icon: '1️⃣', label: '1회성' },
  { key: 'regular', icon: '🔄', label: '정기' },
] as const;

export default function CreateMouiScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const isEdit = !!edit;
  const { user } = useAuth();
  const { colors: C } = useThemeMode();

  // Form state
  const [formCategory, setFormCategory] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formFrequency, setFormFrequency] = useState<string | null>(null);
  const [formTargets, setFormTargets] = useState<string[]>([]);
  const [formProvince, setFormProvince] = useState('');
  const [formDistrict, setFormDistrict] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formMapUrl, setFormMapUrl] = useState('');
  const [formFieldAll, setFormFieldAll] = useState(false);
  const [formFields, setFormFields] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 모집 기간 (시작~종료)
  const [recruitStartYear, setRecruitStartYear] = useState<number | null>(null);
  const [recruitStartMonth, setRecruitStartMonth] = useState<number | null>(null);
  const [recruitStartDay, setRecruitStartDay] = useState<number | null>(null);
  const [recruitEndYear, setRecruitEndYear] = useState<number | null>(null);
  const [recruitEndMonth, setRecruitEndMonth] = useState<number | null>(null);
  const [recruitEndDay, setRecruitEndDay] = useState<number | null>(null);
  const [showRSYearPicker, setShowRSYearPicker] = useState(false);
  const [showRSMonthPicker, setShowRSMonthPicker] = useState(false);
  const [showRSDayPicker, setShowRSDayPicker] = useState(false);
  const [showREYearPicker, setShowREYearPicker] = useState(false);
  const [showREMonthPicker, setShowREMonthPicker] = useState(false);
  const [showREDayPicker, setShowREDayPicker] = useState(false);

  // Picker visibility
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);

  // Meeting date state
  const [dateYear, setDateYear] = useState<number | null>(null);
  const [dateMonth, setDateMonth] = useState<number | null>(null);
  const [dateDay, setDateDay] = useState<number | null>(null);
  const [dateHour, setDateHour] = useState<number | null>(null);
  const [dateMinute, setDateMinute] = useState<number | null>(null);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showHourPicker, setShowHourPicker] = useState(false);
  const [showMinutePicker, setShowMinutePicker] = useState(false);

  // 수정 모드: 기존 데이터 로드
  useEffect(() => {
    if (!edit) return;
    (async () => {
      const { data } = await (supabase as any).from('moui_posts').select('*').eq('id', edit).single();
      if (!data) return;
      setFormCategory(data.category ?? null);
      setFormTitle(data.title ?? '');
      setFormDesc(data.description ?? '');
      setFormFrequency(data.frequency ?? null);
      setFormMapUrl(data.map_url ?? '');
      setFormAddress(data.address ?? '');
      // region
      const reg = parseRegion(data.region);
      if (reg) { setFormProvince(reg.province); setFormDistrict(reg.district); }
      // targets
      if (data.target_types) setFormTargets(data.target_types.split(',').map((s: string) => s.trim()));
      // fields
      if (data.fields === '전체' || !data.fields) { setFormFieldAll(true); setFormFields([]); }
      else { setFormFieldAll(false); setFormFields(data.fields.split(',').map((s: string) => s.trim())); }
      // recruit dates
      if (data.recruit_start) {
        const rs = new Date(data.recruit_start);
        setRecruitStartYear(rs.getFullYear()); setRecruitStartMonth(rs.getMonth() + 1); setRecruitStartDay(rs.getDate());
      }
      if (data.recruit_deadline) {
        const re = new Date(data.recruit_deadline);
        setRecruitEndYear(re.getFullYear()); setRecruitEndMonth(re.getMonth() + 1); setRecruitEndDay(re.getDate());
      }
      // meeting date
      if (data.meeting_date) {
        const md = new Date(data.meeting_date);
        setDateYear(md.getFullYear()); setDateMonth(md.getMonth() + 1); setDateDay(md.getDate());
        setDateHour(md.getHours()); setDateMinute(md.getMinutes());
      }
    })();
  }, [edit]);

  const closeAllPickers = () => {
    setShowYearPicker(false);
    setShowMonthPicker(false);
    setShowDayPicker(false);
    setShowHourPicker(false);
    setShowMinutePicker(false);
    setShowProvincePicker(false);
    setShowDistrictPicker(false);
    setShowRSYearPicker(false);
    setShowRSMonthPicker(false);
    setShowRSDayPicker(false);
    setShowREYearPicker(false);
    setShowREMonthPicker(false);
    setShowREDayPicker(false);
  };

  const recruitYears = getYears(MAX_RECRUIT_MONTHS);
  const recruitStartMonths = recruitStartYear ? getMonths(recruitStartYear, MAX_RECRUIT_MONTHS) : [];
  const recruitStartDays = recruitStartYear && recruitStartMonth
    ? getFilteredDays(recruitStartYear, recruitStartMonth, MAX_RECRUIT_MONTHS)
    : [];
  const recruitEndMonths = recruitEndYear ? getMonths(recruitEndYear, MAX_RECRUIT_MONTHS) : [];
  const recruitEndDays = recruitEndYear && recruitEndMonth
    ? getFilteredDays(recruitEndYear, recruitEndMonth, MAX_RECRUIT_MONTHS)
    : [];

  const recruitStartDate = recruitStartYear && recruitStartMonth && recruitStartDay
    ? new Date(recruitStartYear, recruitStartMonth - 1, recruitStartDay)
    : null;
  const recruitEndDate = recruitEndYear && recruitEndMonth && recruitEndDay
    ? new Date(recruitEndYear, recruitEndMonth - 1, recruitEndDay)
    : null;

  const recruitDaysGap = recruitStartDate && recruitEndDate
    ? Math.ceil((recruitEndDate.getTime() - recruitStartDate.getTime()) / 86400000)
    : null;

  const formatShortDate = (y: number, m: number, d: number) =>
    `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;

  const meetingYears = getYears(MAX_MEETING_MONTHS);
  const meetingMonths = dateYear ? getMonths(dateYear, MAX_MEETING_MONTHS) : [];
  const days = dateYear && dateMonth
    ? getFilteredDays(dateYear, dateMonth, MAX_MEETING_MONTHS)
    : [];

  const handleSubmit = async () => {
    if (!user) return;
    if (!formCategory) { showAlert('알림', '카테고리를 선택해주세요.'); return; }
    if (!formTitle.trim()) { showAlert('알림', '제목을 입력해주세요.'); return; }
    if (!formDesc.trim()) { showAlert('알림', '내용을 입력해주세요.'); return; }
    if (!formFrequency) { showAlert('알림', '1회성/정기를 선택해주세요.'); return; }
    if (!recruitStartDate || !recruitEndDate) { showAlert('알림', '모집 기간 시작일과 종료일을 선택해주세요.'); return; }
    if (recruitEndDate <= recruitStartDate) { showAlert('알림', '모집 종료일은 시작일 이후여야 합니다.'); return; }
    if (recruitDaysGap! > MAX_RECRUIT_DAYS) { showAlert('알림', `모집 기간은 최대 ${MAX_RECRUIT_DAYS}일입니다.`); return; }
    if (recruitEndDate > getMaxDate(MAX_RECRUIT_MONTHS)) { showAlert('알림', '모집 기간은 지금으로부터 3개월 이내만 가능합니다.'); return; }
    if (formTargets.length === 0) { showAlert('알림', '모집 대상을 선택해주세요.'); return; }
    if (!formProvince || !formDistrict) { showAlert('알림', '모일 위치를 선택해주세요.'); return; }
    if (!formAddress.trim()) { showAlert('알림', '상세 주소를 입력해주세요.'); return; }
    if (!(dateYear && dateMonth && dateDay)) { showAlert('알림', '모임 일시를 선택해주세요.'); return; }
    const meetingD = new Date(dateYear, dateMonth - 1, dateDay);
    if (meetingD > getMaxDate(MAX_MEETING_MONTHS)) { showAlert('알림', '모임 일시는 지금으로부터 6개월 이내만 가능합니다.'); return; }
    if (!formFieldAll && formFields.length === 0) { showAlert('알림', '분야를 선택해주세요.'); return; }
    if (formMapUrl.trim() && !isValidMapUrl(formMapUrl.trim())) {
      showAlert('알림', '지도 링크는 네이버, 카카오, 구글맵 URL만 가능합니다.');
      return;
    }

    setSubmitting(true);

    const formRegion = `${formProvince} ${formDistrict}`;
    const targetTypes = formTargets.length > 0 ? formTargets.join(', ') : null;
    const mapUrl = formMapUrl.trim() || null;
    const address = formAddress.trim() || null;

    const h = dateHour ?? 0;
    const m = dateMinute ?? 0;
    const meetingDate = new Date(dateYear!, dateMonth! - 1, dateDay!, h, m).toISOString();

    const payload = {
      title: formTitle.trim(),
      description: formDesc.trim(),
      fields: formFieldAll ? '전체' : formFields.join(', '),
      category: formCategory,
      region: formRegion,
      address,
      target_types: targetTypes,
      map_url: mapUrl,
      meeting_date: meetingDate,
      frequency: formFrequency,
      recruit_start: recruitStartDate!.toISOString(),
      recruit_deadline: recruitEndDate!.toISOString(),
    };

    if (isEdit) {
      const { error } = await (supabase as any).from('moui_posts').update(payload).eq('id', edit);
      if (error) {
        showAlert('오류', '수정 실패: ' + error.message);
      } else {
        router.replace('/(tabs)/moui');
        return;
      }
    } else {
      const { error: pointErr } = await spendPoints(user.id, MOUI_POST_COST, '모임 모집글 작성');
      if (pointErr) {
        showAlert('모의 부족', pointErr);
        setSubmitting(false);
        return;
      }
      const { error } = await (supabase as any).from('moui_posts').insert({
        ...payload,
        user_id: user.id,
        status: 'open',
      });
      if (error) {
        showAlert('오류', '게시 실패: ' + error.message);
      } else {
        router.replace('/(tabs)/moui');
        return;
      }
    }
    setSubmitting(false);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: C.bg }]}>
      <View style={styles.innerContainer}>
        {/* Top bar */}
        <View style={[styles.topBar, { borderBottomColor: C.border }]}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.backText, { color: C.fg }]}>← 뒤로</Text>
          </Pressable>
          <Text style={[styles.topTitle, { color: C.fg }]}>{isEdit ? '모집글 수정' : '모임 모집'}</Text>
          <Pressable
            style={({ pressed }) => [styles.saveBtn, { backgroundColor: C.gold }, pressed && { opacity: 0.6 }, submitting && { opacity: 0.4 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={C.bg} />
            ) : (
              <Text style={[styles.saveBtnText, { color: C.bg }]}>게시</Text>
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* 1. 카테고리 */}
          <Animated.View entering={FadeInDown.delay(50).duration(300).springify()}>
            <Text style={[styles.label, { color: C.fg }]}>카테고리 <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>
            <View style={styles.chipRow}>
              {MOUI_CATEGORIES.map(cat => {
                const active = formCategory === cat.key;
                return (
                  <Pressable
                    key={cat.key}
                    onPress={() => setFormCategory(active ? null : cat.key)}
                    style={[
                      styles.chip,
                      { backgroundColor: active ? C.gold : C.card, borderColor: active ? C.gold : C.border },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? C.bg : C.muted }]}>
                      {cat.icon} {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* 2. 분야 */}
          <Animated.View entering={FadeInDown.delay(80).duration(300).springify()}>
            <Text style={[styles.label, { color: C.fg }]}>분야 <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>
            <View style={styles.chipRow}>
              {FIELD_OPTIONS.map(f => {
                const active = !formFieldAll && formFields.includes(f.key);
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => {
                      if (formFieldAll) {
                        setFormFieldAll(false);
                        setFormFields([f.key]);
                      } else {
                        setFormFields(prev => active ? prev.filter(k => k !== f.key) : [...prev, f.key]);
                      }
                    }}
                    style={[
                      styles.fieldChip,
                      { borderColor: active ? C.gold : C.border, backgroundColor: active ? C.gold + '1F' : C.card },
                    ]}
                  >
                    <Text style={{ fontSize: 14 }}>{f.icon}</Text>
                    <Text style={[styles.fieldChipText, { color: active ? C.gold : C.muted }]}>{f.key}</Text>
                  </Pressable>
                );
              })}
              {/* 전체 */}
              <Pressable
                onPress={() => {
                  setFormFieldAll(true);
                  setFormFields([]);
                }}
                style={[
                  styles.fieldChip,
                  { borderColor: formFieldAll ? C.gold : C.border, backgroundColor: formFieldAll ? C.gold + '1F' : C.card },
                ]}
              >
                <Text style={{ fontSize: 14 }}>🌐</Text>
                <Text style={[styles.fieldChipText, { color: formFieldAll ? C.gold : C.muted }]}>전체</Text>
              </Pressable>
            </View>
            {!formFieldAll && formFields.length === 0 && (
              <Text style={{ color: C.danger, fontSize: 11, marginTop: 4 }}>분야를 하나 이상 선택해주세요</Text>
            )}
          </Animated.View>

          {/* 모집 대상 */}
          <Animated.View entering={FadeInDown.delay(90).duration(300).springify()}>
            <Text style={[styles.label, { color: C.fg }]}>모집 대상 <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>
            <View style={styles.chipRow}>
              {TARGET_TOP.map(t => {
                const isCreator = t.key === 'creator';
                const creatorActive = isCreator && (formTargets.includes('verified') || formTargets.includes('unverified'));
                const active = isCreator ? creatorActive : formTargets.includes(t.key);
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => {
                      if (isCreator) {
                        if (creatorActive) {
                          setFormTargets(prev => prev.filter(k => k !== 'verified' && k !== 'unverified'));
                        } else {
                          setFormTargets(prev => [...prev, 'verified', 'unverified']);
                        }
                      } else {
                        setFormTargets(prev => active ? prev.filter(k => k !== t.key) : [...prev, t.key]);
                      }
                    }}
                    style={[
                      styles.chip,
                      { borderColor: active ? C.gold : C.border, backgroundColor: active ? C.gold + '1F' : C.card },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? C.gold : C.muted }]}>
                      {t.icon} {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {(formTargets.includes('verified') || formTargets.includes('unverified')) && (
              <View style={[styles.chipRow, { marginTop: 8, paddingLeft: 12 }]}>
                {TARGET_CREATOR_SUB.map(s => {
                  const active = formTargets.includes(s.key);
                  return (
                    <Pressable
                      key={s.key}
                      onPress={() => {
                        setFormTargets(prev => active ? prev.filter(k => k !== s.key) : [...prev, s.key]);
                      }}
                      style={[
                        styles.chip,
                        { borderColor: active ? C.gold : C.border, backgroundColor: active ? C.gold + '1F' : C.card },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: active ? C.gold : C.muted }]}>
                        {s.icon} {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Animated.View>

          {/* 제목 */}
          <Animated.View entering={FadeInDown.delay(100).duration(300).springify()}>
            <Text style={[styles.label, { color: C.fg }]}>제목 <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
              value={formTitle}
              onChangeText={setFormTitle}
              placeholder="어떤 모임을 찾고 계신가요?"
              placeholderTextColor={C.mutedLight}
            />
          </Animated.View>

          {/* 3. 상세 내용 */}
          <Animated.View entering={FadeInDown.delay(150).duration(300).springify()}>
            <Text style={[styles.label, { color: C.fg }]}>상세 내용 <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
              value={formDesc}
              onChangeText={setFormDesc}
              placeholder="모임 설명, 원하는 역할, 일정 등을 적어주세요"
              placeholderTextColor={C.mutedLight}
              multiline
              textAlignVertical="top"
            />
          </Animated.View>

          {/* 4. 1회성 / 정기 */}
          <Animated.View entering={FadeInDown.delay(175).duration(300).springify()}>
            <Text style={[styles.label, { color: C.fg }]}>모임 유형 <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>
            <View style={styles.chipRow}>
              {FREQUENCY_OPTIONS.map(f => {
                const active = formFrequency === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setFormFrequency(active ? null : f.key)}
                    style={[
                      styles.chip,
                      { backgroundColor: active ? C.gold : C.card, borderColor: active ? C.gold : C.border },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? C.bg : C.muted }]}>
                      {f.icon} {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* 5. 모집 기간 */}
          <Animated.View entering={FadeInDown.delay(190).duration(300).springify()} style={isEdit ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
            <Text style={[styles.label, { color: C.fg }]}>모집 기간 <Text style={[styles.required, { color: C.gold }]}>*</Text>{isEdit && <Text style={{ color: C.muted, fontSize: 11 }}>  (수정 불가)</Text>}</Text>

            {/* 시작일 */}
            <Text style={[styles.subLabel, { color: C.muted }]}>시작일</Text>
            <View style={styles.regionRow}>
              <Pressable
                onPress={() => { closeAllPickers(); setShowRSYearPicker(!showRSYearPicker); }}
                style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: showRSYearPicker ? C.gold : C.border }]}
              >
                <Text style={{ color: recruitStartYear ? C.fg : C.mutedLight, fontSize: 13 }}>
                  {recruitStartYear ? `${recruitStartYear}년` : '년'}
                </Text>
                <Text style={{ color: C.mutedLight, fontSize: 10 }}>{showRSYearPicker ? '▲' : '▼'}</Text>
              </Pressable>
              {recruitStartYear !== null && (
                <Pressable
                  onPress={() => { closeAllPickers(); setShowRSMonthPicker(!showRSMonthPicker); }}
                  style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: showRSMonthPicker ? C.gold : C.border }]}
                >
                  <Text style={{ color: recruitStartMonth ? C.fg : C.mutedLight, fontSize: 13 }}>
                    {recruitStartMonth ? `${recruitStartMonth}월` : '월'}
                  </Text>
                  <Text style={{ color: C.mutedLight, fontSize: 10 }}>{showRSMonthPicker ? '▲' : '▼'}</Text>
                </Pressable>
              )}
              {recruitStartMonth !== null && (
                <Pressable
                  onPress={() => { closeAllPickers(); setShowRSDayPicker(!showRSDayPicker); }}
                  style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: showRSDayPicker ? C.gold : C.border }]}
                >
                  <Text style={{ color: recruitStartDay ? C.fg : C.mutedLight, fontSize: 13 }}>
                    {recruitStartDay ? `${recruitStartDay}일` : '일'}
                  </Text>
                  <Text style={{ color: C.mutedLight, fontSize: 10 }}>{showRSDayPicker ? '▲' : '▼'}</Text>
                </Pressable>
              )}
            </View>
            {showRSYearPicker && (
              <ScrollView style={[styles.pickerList, { backgroundColor: C.card, borderColor: C.border }]} nestedScrollEnabled>
                {recruitYears.map(y => (
                  <Pressable key={y} onPress={() => { setRecruitStartYear(y); setRecruitStartMonth(null); setRecruitStartDay(null); setShowRSYearPicker(false); setShowRSMonthPicker(true); }}
                    style={[styles.pickerItem, recruitStartYear === y && { backgroundColor: C.gold + '22' }]}>
                    <Text style={{ color: recruitStartYear === y ? C.gold : C.fg, fontSize: 13 }}>{y}년</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {showRSMonthPicker && (
              <ScrollView style={[styles.pickerList, { backgroundColor: C.card, borderColor: C.border }]} nestedScrollEnabled>
                {recruitStartMonths.map(m => (
                  <Pressable key={m} onPress={() => { setRecruitStartMonth(m); setRecruitStartDay(null); setShowRSMonthPicker(false); setShowRSDayPicker(true); }}
                    style={[styles.pickerItem, recruitStartMonth === m && { backgroundColor: C.gold + '22' }]}>
                    <Text style={{ color: recruitStartMonth === m ? C.gold : C.fg, fontSize: 13 }}>{m}월</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {showRSDayPicker && (
              <ScrollView style={[styles.pickerList, { backgroundColor: C.card, borderColor: C.border }]} nestedScrollEnabled>
                {recruitStartDays.map(d => (
                  <Pressable key={d} onPress={() => { setRecruitStartDay(d); setShowRSDayPicker(false); }}
                    style={[styles.pickerItem, recruitStartDay === d && { backgroundColor: C.gold + '22' }]}>
                    <Text style={{ color: recruitStartDay === d ? C.gold : C.fg, fontSize: 13 }}>{d}일</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* 종료일 */}
            <Text style={[styles.subLabel, { color: C.muted, marginTop: 10 }]}>종료일</Text>
            <View style={styles.regionRow}>
              <Pressable
                onPress={() => { closeAllPickers(); setShowREYearPicker(!showREYearPicker); }}
                style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: showREYearPicker ? C.gold : C.border }]}
              >
                <Text style={{ color: recruitEndYear ? C.fg : C.mutedLight, fontSize: 13 }}>
                  {recruitEndYear ? `${recruitEndYear}년` : '년'}
                </Text>
                <Text style={{ color: C.mutedLight, fontSize: 10 }}>{showREYearPicker ? '▲' : '▼'}</Text>
              </Pressable>
              {recruitEndYear !== null && (
                <Pressable
                  onPress={() => { closeAllPickers(); setShowREMonthPicker(!showREMonthPicker); }}
                  style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: showREMonthPicker ? C.gold : C.border }]}
                >
                  <Text style={{ color: recruitEndMonth ? C.fg : C.mutedLight, fontSize: 13 }}>
                    {recruitEndMonth ? `${recruitEndMonth}월` : '월'}
                  </Text>
                  <Text style={{ color: C.mutedLight, fontSize: 10 }}>{showREMonthPicker ? '▲' : '▼'}</Text>
                </Pressable>
              )}
              {recruitEndMonth !== null && (
                <Pressable
                  onPress={() => { closeAllPickers(); setShowREDayPicker(!showREDayPicker); }}
                  style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: showREDayPicker ? C.gold : C.border }]}
                >
                  <Text style={{ color: recruitEndDay ? C.fg : C.mutedLight, fontSize: 13 }}>
                    {recruitEndDay ? `${recruitEndDay}일` : '일'}
                  </Text>
                  <Text style={{ color: C.mutedLight, fontSize: 10 }}>{showREDayPicker ? '▲' : '▼'}</Text>
                </Pressable>
              )}
            </View>
            {showREYearPicker && (
              <ScrollView style={[styles.pickerList, { backgroundColor: C.card, borderColor: C.border }]} nestedScrollEnabled>
                {recruitYears.map(y => (
                  <Pressable key={y} onPress={() => { setRecruitEndYear(y); setRecruitEndMonth(null); setRecruitEndDay(null); setShowREYearPicker(false); setShowREMonthPicker(true); }}
                    style={[styles.pickerItem, recruitEndYear === y && { backgroundColor: C.gold + '22' }]}>
                    <Text style={{ color: recruitEndYear === y ? C.gold : C.fg, fontSize: 13 }}>{y}년</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {showREMonthPicker && (
              <ScrollView style={[styles.pickerList, { backgroundColor: C.card, borderColor: C.border }]} nestedScrollEnabled>
                {recruitEndMonths.map(m => (
                  <Pressable key={m} onPress={() => { setRecruitEndMonth(m); setRecruitEndDay(null); setShowREMonthPicker(false); setShowREDayPicker(true); }}
                    style={[styles.pickerItem, recruitEndMonth === m && { backgroundColor: C.gold + '22' }]}>
                    <Text style={{ color: recruitEndMonth === m ? C.gold : C.fg, fontSize: 13 }}>{m}월</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {showREDayPicker && (
              <ScrollView style={[styles.pickerList, { backgroundColor: C.card, borderColor: C.border }]} nestedScrollEnabled>
                {recruitEndDays.map(d => (
                  <Pressable key={d} onPress={() => { setRecruitEndDay(d); setShowREDayPicker(false); }}
                    style={[styles.pickerItem, recruitEndDay === d && { backgroundColor: C.gold + '22' }]}>
                    <Text style={{ color: recruitEndDay === d ? C.gold : C.fg, fontSize: 13 }}>{d}일</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* 요약 */}
            {recruitStartDate && recruitEndDate && (
              <View style={[styles.recruitSummary, { backgroundColor: C.card, borderColor: recruitDaysGap! > MAX_RECRUIT_DAYS ? C.danger : C.gold + '44' }]}>
                <Text style={{ color: recruitDaysGap! > MAX_RECRUIT_DAYS ? C.danger : C.fg, fontSize: 12, fontWeight: '600' }}>
                  {formatShortDate(recruitStartYear!, recruitStartMonth!, recruitStartDay!)} ~ {formatShortDate(recruitEndYear!, recruitEndMonth!, recruitEndDay!)}
                  {'  '}({recruitDaysGap}일간)
                </Text>
                {recruitDaysGap! > MAX_RECRUIT_DAYS && (
                  <Text style={{ color: C.danger, fontSize: 11, marginTop: 2 }}>최대 {MAX_RECRUIT_DAYS}일까지 가능합니다</Text>
                )}
              </View>
            )}
            {recruitStartDate && recruitEndDate && recruitEndDate <= recruitStartDate && (
              <Text style={{ color: C.danger, fontSize: 11, marginTop: 4 }}>종료일은 시작일 이후여야 합니다</Text>
            )}
          </Animated.View>

          {/* 6. 모임 일시 */}
          <Animated.View entering={FadeInDown.delay(200).duration(300).springify()}>
            <Text style={[styles.label, { color: C.fg }]}>모임 일시 <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>

            {/* 날짜 행: 년 / 월 / 일 */}
            <View style={styles.regionRow}>
              <Pressable
                onPress={() => { closeAllPickers(); setShowYearPicker(!showYearPicker); }}
                style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: showYearPicker ? C.gold : C.border }]}
              >
                <Text style={{ color: dateYear ? C.fg : C.mutedLight, fontSize: 13 }}>
                  {dateYear ? `${dateYear}년` : '년'}
                </Text>
                <Text style={{ color: C.mutedLight, fontSize: 10 }}>{showYearPicker ? '▲' : '▼'}</Text>
              </Pressable>

              {dateYear !== null && (
                <Pressable
                  onPress={() => { closeAllPickers(); setShowMonthPicker(!showMonthPicker); }}
                  style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: showMonthPicker ? C.gold : C.border }]}
                >
                  <Text style={{ color: dateMonth ? C.fg : C.mutedLight, fontSize: 13 }}>
                    {dateMonth ? `${dateMonth}월` : '월'}
                  </Text>
                  <Text style={{ color: C.mutedLight, fontSize: 10 }}>{showMonthPicker ? '▲' : '▼'}</Text>
                </Pressable>
              )}

              {dateMonth !== null && (
                <Pressable
                  onPress={() => { closeAllPickers(); setShowDayPicker(!showDayPicker); }}
                  style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: showDayPicker ? C.gold : C.border }]}
                >
                  <Text style={{ color: dateDay ? C.fg : C.mutedLight, fontSize: 13 }}>
                    {dateDay ? `${dateDay}일` : '일'}
                  </Text>
                  <Text style={{ color: C.mutedLight, fontSize: 10 }}>{showDayPicker ? '▲' : '▼'}</Text>
                </Pressable>
              )}
            </View>

            {showYearPicker && (
              <ScrollView style={[styles.pickerList, { backgroundColor: C.card, borderColor: C.border }]} nestedScrollEnabled>
                {meetingYears.map(y => (
                  <Pressable key={y} onPress={() => { setDateYear(y); setDateMonth(null); setDateDay(null); setShowYearPicker(false); setShowMonthPicker(true); }}
                    style={[styles.pickerItem, dateYear === y && { backgroundColor: C.gold + '22' }]}>
                    <Text style={{ color: dateYear === y ? C.gold : C.fg, fontSize: 13 }}>{y}년</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {showMonthPicker && (
              <ScrollView style={[styles.pickerList, { backgroundColor: C.card, borderColor: C.border }]} nestedScrollEnabled>
                {meetingMonths.map(m => (
                  <Pressable key={m} onPress={() => { setDateMonth(m); setDateDay(null); setShowMonthPicker(false); setShowDayPicker(true); }}
                    style={[styles.pickerItem, dateMonth === m && { backgroundColor: C.gold + '22' }]}>
                    <Text style={{ color: dateMonth === m ? C.gold : C.fg, fontSize: 13 }}>{m}월</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {showDayPicker && (
              <ScrollView style={[styles.pickerList, { backgroundColor: C.card, borderColor: C.border }]} nestedScrollEnabled>
                {days.map(d => (
                  <Pressable key={d} onPress={() => { setDateDay(d); setShowDayPicker(false); }}
                    style={[styles.pickerItem, dateDay === d && { backgroundColor: C.gold + '22' }]}>
                    <Text style={{ color: dateDay === d ? C.gold : C.fg, fontSize: 13 }}>{d}일</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* 시간 행: 시 : 분 */}
            {dateDay !== null && (
              <View style={[styles.regionRow, { marginTop: 8 }]}>
                <Pressable
                  onPress={() => { closeAllPickers(); setShowHourPicker(!showHourPicker); }}
                  style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: showHourPicker ? C.gold : C.border }]}
                >
                  <Text style={{ color: dateHour !== null ? C.fg : C.mutedLight, fontSize: 13 }}>
                    {dateHour !== null ? `${dateHour}시` : '시'}
                  </Text>
                  <Text style={{ color: C.mutedLight, fontSize: 10 }}>{showHourPicker ? '▲' : '▼'}</Text>
                </Pressable>

                <Pressable
                  onPress={() => { closeAllPickers(); setShowMinutePicker(!showMinutePicker); }}
                  style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: showMinutePicker ? C.gold : C.border }]}
                >
                  <Text style={{ color: dateMinute !== null ? C.fg : C.mutedLight, fontSize: 13 }}>
                    {dateMinute !== null ? `${String(dateMinute).padStart(2, '0')}분` : '분'}
                  </Text>
                  <Text style={{ color: C.mutedLight, fontSize: 10 }}>{showMinutePicker ? '▲' : '▼'}</Text>
                </Pressable>

                <Pressable onPress={() => { setDateYear(null); setDateMonth(null); setDateDay(null); setDateHour(null); setDateMinute(null); }}>
                  <Text style={{ color: C.mutedLight, fontSize: 11 }}>초기화</Text>
                </Pressable>
              </View>
            )}

            {showHourPicker && (
              <ScrollView style={[styles.pickerList, { backgroundColor: C.card, borderColor: C.border }]} nestedScrollEnabled>
                {HOURS.map(h => (
                  <Pressable key={h} onPress={() => { setDateHour(h); setShowHourPicker(false); }}
                    style={[styles.pickerItem, dateHour === h && { backgroundColor: C.gold + '22' }]}>
                    <Text style={{ color: dateHour === h ? C.gold : C.fg, fontSize: 13 }}>{h}시</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {showMinutePicker && (
              <ScrollView style={[styles.pickerList, { backgroundColor: C.card, borderColor: C.border }]} nestedScrollEnabled>
                {MINUTES.map(m => (
                  <Pressable key={m} onPress={() => { setDateMinute(m); setShowMinutePicker(false); }}
                    style={[styles.pickerItem, dateMinute === m && { backgroundColor: C.gold + '22' }]}>
                    <Text style={{ color: dateMinute === m ? C.gold : C.fg, fontSize: 13 }}>{String(m).padStart(2, '0')}분</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Animated.View>

          {/* 모일 위치 */}
          <Animated.View entering={FadeInDown.delay(250).duration(300).springify()}>
            <Text style={[styles.label, { color: C.fg }]}>모일 위치 <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>
            <View style={styles.regionRow}>
              <Pressable
                onPress={() => { closeAllPickers(); setShowProvincePicker(!showProvincePicker); }}
                style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: showProvincePicker ? C.gold : C.border }]}
              >
                <Text style={{ color: formProvince ? C.fg : C.mutedLight, fontSize: 13 }}>
                  {formProvince || '시/도'}
                </Text>
                <Text style={{ color: C.mutedLight, fontSize: 10 }}>{showProvincePicker ? '▲' : '▼'}</Text>
              </Pressable>
              {formProvince !== '' && (
                <Pressable
                  onPress={() => { closeAllPickers(); setShowDistrictPicker(!showDistrictPicker); }}
                  style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: showDistrictPicker ? C.gold : C.border }]}
                >
                  <Text style={{ color: formDistrict ? C.fg : C.mutedLight, fontSize: 13 }}>
                    {formDistrict || '구/군/시'}
                  </Text>
                  <Text style={{ color: C.mutedLight, fontSize: 10 }}>{showDistrictPicker ? '▲' : '▼'}</Text>
                </Pressable>
              )}
              {formProvince && formDistrict ? (
                <Pressable onPress={() => { setFormProvince(''); setFormDistrict(''); setFormAddress(''); }}>
                  <Text style={{ color: C.mutedLight, fontSize: 11 }}>초기화</Text>
                </Pressable>
              ) : null}
            </View>
            {showProvincePicker && (
              <ScrollView style={[styles.pickerList, { backgroundColor: C.card, borderColor: C.border }]} nestedScrollEnabled>
                {PROVINCE_LIST.map(p => (
                  <Pressable
                    key={p}
                    onPress={() => { setFormProvince(p); setFormDistrict(''); setFormAddress(''); setShowProvincePicker(false); setShowDistrictPicker(true); }}
                    style={[styles.pickerItem, formProvince === p && { backgroundColor: C.gold + '22' }]}
                  >
                    <Text style={{ color: formProvince === p ? C.gold : C.fg, fontSize: 13 }}>{p}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {showDistrictPicker && formProvince !== '' && (
              <ScrollView style={[styles.pickerList, { backgroundColor: C.card, borderColor: C.border }]} nestedScrollEnabled>
                {(REGIONS[formProvince] ?? []).map(d => (
                  <Pressable
                    key={d}
                    onPress={() => { setFormDistrict(d); setShowDistrictPicker(false); }}
                    style={[styles.pickerItem, formDistrict === d && { backgroundColor: C.gold + '22' }]}
                  >
                    <Text style={{ color: formDistrict === d ? C.gold : C.fg, fontSize: 13 }}>{d}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {/* 상세 주소 — 구/군/시 선택 후 표시 */}
            {formProvince !== '' && formDistrict !== '' && (
              <>
                <Text style={[styles.subLabel, { color: C.muted, marginTop: 10 }]}>상세 주소</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
                  value={formAddress}
                  onChangeText={setFormAddress}
                  placeholder="건물명, 층, 호수 등"
                  placeholderTextColor={C.mutedLight}
                />
              </>
            )}
          </Animated.View>

          {/* 지도 링크 */}
          <Animated.View entering={FadeInDown.delay(300).duration(300).springify()}>
            <Text style={[styles.label, { color: C.fg }]}>지도 링크 <Text style={[styles.optional, { color: C.mutedLight }]}>(선택)</Text></Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
              value={formMapUrl}
              onChangeText={setFormMapUrl}
              placeholder="네이버/카카오/구글맵 링크 붙여넣기"
              placeholderTextColor={C.mutedLight}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </Animated.View>

          {/* 11. 하단 게시 버튼 */}
          <Animated.View entering={FadeInDown.delay(450).duration(300).springify()}>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={({ pressed }) => [styles.submitBtn, { backgroundColor: C.gold }, pressed && { opacity: 0.7 }, submitting && { opacity: 0.5 }]}
            >
              <Text style={[styles.submitText, { color: C.bg }]}>
                {submitting ? '저장 중...' : isEdit ? '수정하기' : `게시하기 · ${MOUI_POST_COST} MOUI`}
              </Text>
            </Pressable>
          </Animated.View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  topTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 90,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  required: { fontWeight: '700' },
  optional: { fontSize: 11, fontWeight: '500' },
  subLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 4,
  },
  recruitSummary: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fieldChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fieldChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerList: {
    maxHeight: 180,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 6,
  },
  pickerItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  submitBtn: {
    marginTop: 28,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
