import { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { spendPoints } from '@/lib/points';
import { REGIONS, PROVINCE_LIST } from '@/constants/regions';
import { MOUI_CATEGORIES, MOUI_POST_COST, FIELD_OPTIONS, TARGET_OPTIONS } from '@/constants/moui';
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

const YEARS: number[] = [];
for (let y = new Date().getFullYear() + 1; y >= new Date().getFullYear(); y--) YEARS.push(y);
for (let y = new Date().getFullYear() - 1; y >= new Date().getFullYear() - 2; y--) YEARS.push(y);

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export default function CreateMouiScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { colors: C } = useThemeMode();

  // Form state
  const [formCategory, setFormCategory] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formTargets, setFormTargets] = useState<string[]>([]);
  const [formProvince, setFormProvince] = useState('');
  const [formDistrict, setFormDistrict] = useState('');
  const [formMapUrl, setFormMapUrl] = useState('');
  const [formFields, setFormFields] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

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

  const closeAllDatePickers = () => {
    setShowYearPicker(false);
    setShowMonthPicker(false);
    setShowDayPicker(false);
    setShowHourPicker(false);
    setShowMinutePicker(false);
  };

  const closeAllRegionPickers = () => {
    setShowProvincePicker(false);
    setShowDistrictPicker(false);
  };

  const days = dateYear && dateMonth
    ? Array.from({ length: getDaysInMonth(dateYear, dateMonth) }, (_, i) => i + 1)
    : [];

  const handleSubmit = async () => {
    if (!user) return;
    if (!formCategory) { showAlert('알림', '카테고리를 선택해주세요.'); return; }
    if (!formTitle.trim()) { showAlert('알림', '제목을 입력해주세요.'); return; }
    if (!formDesc.trim()) { showAlert('알림', '내용을 입력해주세요.'); return; }
    if (formMapUrl.trim() && !isValidMapUrl(formMapUrl.trim())) {
      showAlert('알림', '지도 링크는 네이버, 카카오, 구글맵 URL만 가능합니다.');
      return;
    }

    setSubmitting(true);

    const { error: pointErr } = await spendPoints(user.id, MOUI_POST_COST, '모임 모집글 작성');
    if (pointErr) {
      showAlert('모의 부족', pointErr);
      setSubmitting(false);
      return;
    }

    const formRegion = formProvince && formDistrict ? `${formProvince} ${formDistrict}` : null;
    const targetTypes = formTargets.length > 0 ? formTargets.join(', ') : null;
    const mapUrl = formMapUrl.trim() || null;

    let meetingDate: string | null = null;
    if (dateYear && dateMonth && dateDay) {
      const h = dateHour ?? 0;
      const m = dateMinute ?? 0;
      meetingDate = new Date(dateYear, dateMonth - 1, dateDay, h, m).toISOString();
    }

    const { error } = await (supabase as any).from('moui_posts').insert({
      user_id: user.id,
      title: formTitle.trim(),
      description: formDesc.trim(),
      fields: formFields.length > 0 ? formFields.join(', ') : null,
      category: formCategory,
      region: formRegion,
      target_types: targetTypes,
      map_url: mapUrl,
      meeting_date: meetingDate,
      status: 'open',
    });

    if (error) {
      showAlert('오류', '게시 실패: ' + error.message);
    } else {
      router.back();
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
          <Text style={[styles.topTitle, { color: C.fg }]}>모임 모집</Text>
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

          {/* 2. 제목 */}
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

          {/* 4. 모집 대상 */}
          <Animated.View entering={FadeInDown.delay(200).duration(300).springify()}>
            <Text style={[styles.label, { color: C.fg }]}>모집 대상 <Text style={[styles.optional, { color: C.mutedLight }]}>(선택)</Text></Text>
            <View style={styles.chipRow}>
              {TARGET_OPTIONS.map(t => {
                const active = formTargets.includes(t.key);
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => setFormTargets(prev => active ? prev.filter(k => k !== t.key) : [...prev, t.key])}
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
          </Animated.View>

          {/* 5. 위치 */}
          <Animated.View entering={FadeInDown.delay(250).duration(300).springify()}>
            <Text style={[styles.label, { color: C.fg }]}>위치 <Text style={[styles.optional, { color: C.mutedLight }]}>(선택)</Text></Text>
            <View style={styles.regionRow}>
              <Pressable
                onPress={() => { closeAllDatePickers(); setShowProvincePicker(!showProvincePicker); setShowDistrictPicker(false); }}
                style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: showProvincePicker ? C.gold : C.border }]}
              >
                <Text style={{ color: formProvince ? C.fg : C.mutedLight, fontSize: 13 }}>
                  {formProvince || '시/도'}
                </Text>
                <Text style={{ color: C.mutedLight, fontSize: 10 }}>{showProvincePicker ? '▲' : '▼'}</Text>
              </Pressable>
              {formProvince !== '' && (
                <Pressable
                  onPress={() => { closeAllDatePickers(); setShowDistrictPicker(!showDistrictPicker); setShowProvincePicker(false); }}
                  style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: showDistrictPicker ? C.gold : C.border }]}
                >
                  <Text style={{ color: formDistrict ? C.fg : C.mutedLight, fontSize: 13 }}>
                    {formDistrict || '구/군/시'}
                  </Text>
                  <Text style={{ color: C.mutedLight, fontSize: 10 }}>{showDistrictPicker ? '▲' : '▼'}</Text>
                </Pressable>
              )}
              {formProvince && formDistrict ? (
                <Pressable onPress={() => { setFormProvince(''); setFormDistrict(''); }}>
                  <Text style={{ color: C.mutedLight, fontSize: 11 }}>초기화</Text>
                </Pressable>
              ) : null}
            </View>
            {showProvincePicker && (
              <ScrollView style={[styles.pickerList, { backgroundColor: C.card, borderColor: C.border }]} nestedScrollEnabled>
                {PROVINCE_LIST.map(p => (
                  <Pressable
                    key={p}
                    onPress={() => { setFormProvince(p); setFormDistrict(''); setShowProvincePicker(false); setShowDistrictPicker(true); }}
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
          </Animated.View>

          {/* 6. 지도 링크 */}
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

          {/* 7. 모임 일시 */}
          <Animated.View entering={FadeInDown.delay(350).duration(300).springify()}>
            <Text style={[styles.label, { color: C.fg }]}>모임 일시 <Text style={[styles.optional, { color: C.mutedLight }]}>(선택)</Text></Text>

            {/* 날짜 행: 년 / 월 / 일 */}
            <View style={styles.regionRow}>
              <Pressable
                onPress={() => { closeAllRegionPickers(); closeAllDatePickers(); setShowYearPicker(!showYearPicker); }}
                style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: showYearPicker ? C.gold : C.border }]}
              >
                <Text style={{ color: dateYear ? C.fg : C.mutedLight, fontSize: 13 }}>
                  {dateYear ? `${dateYear}년` : '년'}
                </Text>
                <Text style={{ color: C.mutedLight, fontSize: 10 }}>{showYearPicker ? '▲' : '▼'}</Text>
              </Pressable>

              {dateYear !== null && (
                <Pressable
                  onPress={() => { closeAllRegionPickers(); closeAllDatePickers(); setShowMonthPicker(!showMonthPicker); }}
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
                  onPress={() => { closeAllRegionPickers(); closeAllDatePickers(); setShowDayPicker(!showDayPicker); }}
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
                {YEARS.map(y => (
                  <Pressable
                    key={y}
                    onPress={() => { setDateYear(y); setDateMonth(null); setDateDay(null); setShowYearPicker(false); setShowMonthPicker(true); }}
                    style={[styles.pickerItem, dateYear === y && { backgroundColor: C.gold + '22' }]}
                  >
                    <Text style={{ color: dateYear === y ? C.gold : C.fg, fontSize: 13 }}>{y}년</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {showMonthPicker && (
              <ScrollView style={[styles.pickerList, { backgroundColor: C.card, borderColor: C.border }]} nestedScrollEnabled>
                {MONTHS.map(m => (
                  <Pressable
                    key={m}
                    onPress={() => { setDateMonth(m); setDateDay(null); setShowMonthPicker(false); setShowDayPicker(true); }}
                    style={[styles.pickerItem, dateMonth === m && { backgroundColor: C.gold + '22' }]}
                  >
                    <Text style={{ color: dateMonth === m ? C.gold : C.fg, fontSize: 13 }}>{m}월</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {showDayPicker && (
              <ScrollView style={[styles.pickerList, { backgroundColor: C.card, borderColor: C.border }]} nestedScrollEnabled>
                {days.map(d => (
                  <Pressable
                    key={d}
                    onPress={() => { setDateDay(d); setShowDayPicker(false); }}
                    style={[styles.pickerItem, dateDay === d && { backgroundColor: C.gold + '22' }]}
                  >
                    <Text style={{ color: dateDay === d ? C.gold : C.fg, fontSize: 13 }}>{d}일</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* 시간 행: 시 : 분 */}
            {dateDay !== null && (
              <View style={[styles.regionRow, { marginTop: 8 }]}>
                <Pressable
                  onPress={() => { closeAllRegionPickers(); closeAllDatePickers(); setShowHourPicker(!showHourPicker); }}
                  style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: showHourPicker ? C.gold : C.border }]}
                >
                  <Text style={{ color: dateHour !== null ? C.fg : C.mutedLight, fontSize: 13 }}>
                    {dateHour !== null ? `${dateHour}시` : '시'}
                  </Text>
                  <Text style={{ color: C.mutedLight, fontSize: 10 }}>{showHourPicker ? '▲' : '▼'}</Text>
                </Pressable>

                <Pressable
                  onPress={() => { closeAllRegionPickers(); closeAllDatePickers(); setShowMinutePicker(!showMinutePicker); }}
                  style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: showMinutePicker ? C.gold : C.border }]}
                >
                  <Text style={{ color: dateMinute !== null ? C.fg : C.mutedLight, fontSize: 13 }}>
                    {dateMinute !== null ? `${String(dateMinute).padStart(2, '0')}분` : '분'}
                  </Text>
                  <Text style={{ color: C.mutedLight, fontSize: 10 }}>{showMinutePicker ? '▲' : '▼'}</Text>
                </Pressable>

                {(dateYear || dateMonth || dateDay) ? (
                  <Pressable onPress={() => { setDateYear(null); setDateMonth(null); setDateDay(null); setDateHour(null); setDateMinute(null); }}>
                    <Text style={{ color: C.mutedLight, fontSize: 11 }}>초기화</Text>
                  </Pressable>
                ) : null}
              </View>
            )}

            {showHourPicker && (
              <ScrollView style={[styles.pickerList, { backgroundColor: C.card, borderColor: C.border }]} nestedScrollEnabled>
                {HOURS.map(h => (
                  <Pressable
                    key={h}
                    onPress={() => { setDateHour(h); setShowHourPicker(false); }}
                    style={[styles.pickerItem, dateHour === h && { backgroundColor: C.gold + '22' }]}
                  >
                    <Text style={{ color: dateHour === h ? C.gold : C.fg, fontSize: 13 }}>{h}시</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {showMinutePicker && (
              <ScrollView style={[styles.pickerList, { backgroundColor: C.card, borderColor: C.border }]} nestedScrollEnabled>
                {MINUTES.map(m => (
                  <Pressable
                    key={m}
                    onPress={() => { setDateMinute(m); setShowMinutePicker(false); }}
                    style={[styles.pickerItem, dateMinute === m && { backgroundColor: C.gold + '22' }]}
                  >
                    <Text style={{ color: dateMinute === m ? C.gold : C.fg, fontSize: 13 }}>{String(m).padStart(2, '0')}분</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Animated.View>

          {/* 8. 분야 칩 */}
          <Animated.View entering={FadeInDown.delay(400).duration(300).springify()}>
            <Text style={[styles.label, { color: C.fg }]}>분야 <Text style={[styles.optional, { color: C.mutedLight }]}>(선택)</Text></Text>
            <View style={styles.chipRow}>
              {FIELD_OPTIONS.map(f => {
                const active = formFields.includes(f.key);
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setFormFields(prev => active ? prev.filter(k => k !== f.key) : [...prev, f.key])}
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
            </View>
          </Animated.View>

          {/* 9. 하단 게시 버튼 */}
          <Animated.View entering={FadeInDown.delay(450).duration(300).springify()}>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={({ pressed }) => [styles.submitBtn, { backgroundColor: C.gold }, pressed && { opacity: 0.7 }, submitting && { opacity: 0.5 }]}
            >
              <Text style={[styles.submitText, { color: C.bg }]}>
                {submitting ? '게시 중...' : `게시하기 · ${MOUI_POST_COST} MOUI`}
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
