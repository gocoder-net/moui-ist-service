import { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable, ScrollView,
  Alert, Platform, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { spendPoints } from '@/lib/points';
import { parseRegion, REGIONS, PROVINCE_LIST } from '@/constants/regions';
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
const MAX_RECRUIT_DAYS = 90;
const MAX_RECRUIT_MONTHS = 3;
const MAX_MEETING_MONTHS = 6;
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function getMaxDate(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}

function getToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** 달력 그리드 생성 */
function buildCalendarGrid(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const rows: (number | null)[][] = [];
  let row: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    row.push(d);
    if (row.length === 7) { rows.push(row); row = []; }
  }
  if (row.length > 0) { while (row.length < 7) row.push(null); rows.push(row); }
  return rows;
}

/** 달력 피커 컴포넌트 */
function CalendarPicker({ visible, onClose, onSelect, selected, minDate, maxDate, colors: C, showTime, selectedHour, selectedMinute, onHourChange, onMinuteChange }: {
  visible: boolean;
  onClose: () => void;
  onSelect: (d: Date) => void;
  selected: Date | null;
  minDate: Date;
  maxDate: Date;
  colors: any;
  showTime?: boolean;
  selectedHour?: number | null;
  selectedMinute?: number | null;
  onHourChange?: (h: number) => void;
  onMinuteChange?: (m: number) => void;
}) {
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? minDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected ? selected.getMonth() + 1 : minDate.getMonth() + 1);
  const [showHourPicker, setShowHourPicker] = useState(false);
  const [showMinutePicker, setShowMinutePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setViewYear(selected?.getFullYear() ?? minDate.getFullYear());
      setViewMonth(selected ? selected.getMonth() + 1 : minDate.getMonth() + 1);
      setShowHourPicker(false);
      setShowMinutePicker(false);
    }
  }, [visible]);

  const goPrev = () => {
    let y = viewYear, m = viewMonth - 1;
    if (m < 1) { m = 12; y--; }
    const firstOfMonth = new Date(y, m - 1, 1);
    const lastOfMinMonth = new Date(minDate.getFullYear(), minDate.getMonth() + 1, 0);
    if (firstOfMonth <= lastOfMinMonth) { setViewYear(y); setViewMonth(m); }
  };
  const goNext = () => {
    let y = viewYear, m = viewMonth + 1;
    if (m > 12) { m = 1; y++; }
    if (new Date(y, m - 1, 1) <= maxDate) { setViewYear(y); setViewMonth(m); }
  };

  const grid = buildCalendarGrid(viewYear, viewMonth);
  const today = getToday();

  const isDisabled = (day: number) => {
    const d = new Date(viewYear, viewMonth - 1, day);
    return d < minDate || d > maxDate;
  };
  const isSelected = (day: number) => {
    if (!selected) return false;
    return selected.getFullYear() === viewYear && selected.getMonth() + 1 === viewMonth && selected.getDate() === day;
  };
  const isToday = (day: number) => {
    return today.getFullYear() === viewYear && today.getMonth() + 1 === viewMonth && today.getDate() === day;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={calStyles.overlay} onPress={onClose}>
        <Pressable style={[calStyles.container, { backgroundColor: C.bg }]} onPress={e => e.stopPropagation()}>
          {/* 헤더: < 2026년 4월 > */}
          <View style={calStyles.header}>
            <Pressable onPress={goPrev} style={calStyles.navBtn}>
              <Text style={{ color: C.fg, fontSize: 18 }}>‹</Text>
            </Pressable>
            <Text style={[calStyles.headerText, { color: C.fg }]}>{viewYear}년 {viewMonth}월</Text>
            <Pressable onPress={goNext} style={calStyles.navBtn}>
              <Text style={{ color: C.fg, fontSize: 18 }}>›</Text>
            </Pressable>
          </View>

          {/* 요일 헤더 */}
          <View style={calStyles.weekRow}>
            {DAY_NAMES.map((dn, i) => (
              <View key={i} style={calStyles.dayCell}>
                <Text style={{ color: i === 0 ? '#e55' : i === 6 ? '#58f' : C.muted, fontSize: 12, fontWeight: '600' }}>{dn}</Text>
              </View>
            ))}
          </View>

          {/* 날짜 그리드 */}
          {grid.map((row, ri) => (
            <View key={ri} style={calStyles.weekRow}>
              {row.map((day, ci) => {
                if (day === null) return <View key={ci} style={calStyles.dayCell} />;
                const disabled = isDisabled(day);
                const sel = isSelected(day);
                const tod = isToday(day);
                return (
                  <Pressable
                    key={ci}
                    onPress={() => !disabled && onSelect(new Date(viewYear, viewMonth - 1, day))}
                    style={[
                      calStyles.dayCell,
                      sel && { backgroundColor: C.gold, borderRadius: 20 },
                      tod && !sel && { borderWidth: 1, borderColor: C.gold, borderRadius: 20 },
                    ]}
                  >
                    <Text style={{
                      color: disabled ? C.mutedLight : sel ? C.bg : ci === 0 ? '#e55' : ci === 6 ? '#58f' : C.fg,
                      fontSize: 14,
                      fontWeight: sel ? '800' : '500',
                    }}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}

          {/* 시간 선택 (모이는 날용) */}
          {showTime && selected && (
            <View style={calStyles.timeSection}>
              <View style={calStyles.timeRow}>
                <Pressable
                  onPress={() => { setShowHourPicker(!showHourPicker); setShowMinutePicker(false); }}
                  style={[calStyles.timeBtn, { backgroundColor: C.card, borderColor: showHourPicker ? C.gold : C.border }]}
                >
                  <Text style={{ color: selectedHour !== null && selectedHour !== undefined ? C.fg : C.mutedLight, fontSize: 14 }}>
                    {selectedHour !== null && selectedHour !== undefined ? `${selectedHour}시` : '시'}
                  </Text>
                </Pressable>
                <Text style={{ color: C.muted, fontSize: 16 }}>:</Text>
                <Pressable
                  onPress={() => { setShowMinutePicker(!showMinutePicker); setShowHourPicker(false); }}
                  style={[calStyles.timeBtn, { backgroundColor: C.card, borderColor: showMinutePicker ? C.gold : C.border }]}
                >
                  <Text style={{ color: selectedMinute !== null && selectedMinute !== undefined ? C.fg : C.mutedLight, fontSize: 14 }}>
                    {selectedMinute !== null && selectedMinute !== undefined ? `${String(selectedMinute).padStart(2, '0')}분` : '분'}
                  </Text>
                </Pressable>
              </View>
              {showHourPicker && (
                <ScrollView style={[calStyles.timeList, { backgroundColor: C.card, borderColor: C.border }]} nestedScrollEnabled>
                  {HOURS.map(h => (
                    <Pressable key={h} onPress={() => { onHourChange?.(h); setShowHourPicker(false); }}
                      style={[calStyles.timeItem, selectedHour === h && { backgroundColor: C.gold + '22' }]}>
                      <Text style={{ color: selectedHour === h ? C.gold : C.fg, fontSize: 13 }}>{h}시</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              {showMinutePicker && (
                <ScrollView style={[calStyles.timeList, { backgroundColor: C.card, borderColor: C.border }]} nestedScrollEnabled>
                  {MINUTES.map(m => (
                    <Pressable key={m} onPress={() => { onMinuteChange?.(m); setShowMinutePicker(false); }}
                      style={[calStyles.timeItem, selectedMinute === m && { backgroundColor: C.gold + '22' }]}>
                      <Text style={{ color: selectedMinute === m ? C.gold : C.fg, fontSize: 13 }}>{String(m).padStart(2, '0')}분</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* 확인 버튼 */}
          {(() => {
            const needsTime = showTime && (selectedHour === null || selectedHour === undefined || selectedMinute === null || selectedMinute === undefined);
            const disabled = !selected || needsTime;
            return (
              <Pressable onPress={() => !disabled && onClose()} style={[calStyles.confirmBtn, { backgroundColor: disabled ? C.muted : C.gold, opacity: disabled ? 0.4 : 1 }]}>
                <Text style={{ color: C.bg, fontSize: 14, fontWeight: '700' }}>
                  {disabled && needsTime ? '시간을 선택해주세요' : '확인'}
                </Text>
              </Pressable>
            );
          })()}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const calStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: 340,
    borderRadius: 16,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '700',
  },
  navBtn: {
    padding: 8,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
  },
  timeSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 12,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  timeBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  timeList: {
    maxHeight: 150,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 8,
  },
  timeItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  confirmBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
});

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
  const [formTargets, setFormTargets] = useState<string[]>([]);
  const [formProvince, setFormProvince] = useState('');
  const [formDistrict, setFormDistrict] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formMapUrl, setFormMapUrl] = useState('');
  const [formFieldAll, setFormFieldAll] = useState(false);
  const [formFields, setFormFields] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 모집 기간 (시작은 오늘 자동, 종료일만 선택)
  const [recruitEndDate, setRecruitEndDate] = useState<Date | null>(null);
  const [showRecruitCalendar, setShowRecruitCalendar] = useState(false);

  // Picker visibility
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);

  // Meeting date state
  const [meetingDate, setMeetingDate] = useState<Date | null>(null);
  const [dateHour, setDateHour] = useState<number | null>(null);
  const [dateMinute, setDateMinute] = useState<number | null>(null);
  const [showMeetingCalendar, setShowMeetingCalendar] = useState(false);

  // 수정 모드: 기존 데이터 로드
  useEffect(() => {
    if (!edit) return;
    (async () => {
      const { data } = await (supabase as any).from('moui_posts').select('*').eq('id', edit).single();
      if (!data) return;
      setFormCategory(data.category ?? null);
      setFormTitle(data.title ?? '');
      setFormDesc(data.description ?? '');
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
      if (data.recruit_deadline) {
        setRecruitEndDate(new Date(data.recruit_deadline));
      }
      // meeting date
      if (data.meeting_date) {
        const md = new Date(data.meeting_date);
        setMeetingDate(new Date(md.getFullYear(), md.getMonth(), md.getDate()));
        setDateHour(md.getHours()); setDateMinute(md.getMinutes());
      }
    })();
  }, [edit]);

  const closeAllPickers = () => {
    setShowProvincePicker(false);
    setShowDistrictPicker(false);
  };

  const recruitStartDate = getToday();

  const recruitDaysGap = recruitEndDate
    ? Math.ceil((recruitEndDate.getTime() - recruitStartDate.getTime()) / 86400000)
    : null;

  const formatShortDate = (d: Date) =>
    `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;

  const formatDateLabel = (d: Date) => {
    const dayName = DAY_NAMES[d.getDay()];
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${dayName})`;
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!formCategory) { showAlert('알림', '카테고리를 선택해주세요.'); return; }
    if (formTitle.trim().length < 10) { showAlert('알림', '제목을 10글자 이상 입력해주세요.'); return; }
    if (formDesc.trim().length < 10) { showAlert('알림', '상세 내용을 10글자 이상 입력해주세요.'); return; }
    if (!recruitEndDate) { showAlert('알림', '모집 마감일을 선택해주세요.'); return; }
    if (recruitEndDate <= recruitStartDate) { showAlert('알림', '모집 마감일은 오늘 이후여야 합니다.'); return; }
    if (recruitDaysGap! > MAX_RECRUIT_DAYS) { showAlert('알림', `모집 기간은 최대 ${MAX_RECRUIT_DAYS}일입니다.`); return; }
    if (recruitEndDate > getMaxDate(MAX_RECRUIT_MONTHS)) { showAlert('알림', '모집 기간은 지금으로부터 3개월 이내만 가능합니다.'); return; }
    if (formTargets.length === 0) { showAlert('알림', '대상을 선택해주세요.'); return; }
    if (!formProvince || !formDistrict) { showAlert('알림', '모일 위치를 선택해주세요.'); return; }
    if (!formAddress.trim()) { showAlert('알림', '상세 주소를 입력해주세요.'); return; }
    if (!meetingDate) { showAlert('알림', '모이는 날을 선택해주세요.'); return; }
    if (dateHour === null || dateMinute === null) { showAlert('알림', '모이는 시간을 선택해주세요.'); return; }
    if (recruitEndDate && meetingDate < recruitEndDate) { showAlert('알림', '모이는 날은 모집 마감일 이후여야 합니다.'); return; }
    if (meetingDate > getMaxDate(MAX_MEETING_MONTHS)) { showAlert('알림', '모이는 날은 지금으로부터 6개월 이내만 가능합니다.'); return; }
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
    const meetingDateISO = new Date(meetingDate!.getFullYear(), meetingDate!.getMonth(), meetingDate!.getDate(), h, m).toISOString();

    const payload = {
      title: formTitle.trim(),
      description: formDesc.trim(),
      fields: formFieldAll ? '전체' : formFields.join(', '),
      category: formCategory,
      region: formRegion,
      address,
      target_types: targetTypes,
      map_url: mapUrl,
      meeting_date: meetingDateISO,
      frequency: null,
      recruit_start: recruitStartDate.toISOString(),
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
      const { data: newPost, error } = await (supabase as any).from('moui_posts').insert({
        ...payload,
        user_id: user.id,
        status: 'open',
      }).select('id').single();
      if (error) {
        showAlert('오류', '게시 실패: ' + error.message);
      } else {
        // 작성자를 첫 참석자로 자동 추가
        if (newPost?.id) {
          await (supabase as any).from('moui_participants').insert({
            moui_post_id: newPost.id,
            user_id: user.id,
          });
        }
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

          {/* 대상 */}
          <Animated.View entering={FadeInDown.delay(90).duration(300).springify()}>
            <Text style={[styles.label, { color: C.fg }]}>대상 <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>
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
            <Text style={{ color: formTitle.trim().length >= 10 ? C.muted : C.mutedLight, fontSize: 11, marginTop: 4, textAlign: 'right' }}>
              {formTitle.trim().length}/10
            </Text>
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
            <Text style={{ color: formDesc.trim().length >= 10 ? C.muted : C.mutedLight, fontSize: 11, marginTop: 4, textAlign: 'right' }}>
              {formDesc.trim().length}/10
            </Text>
          </Animated.View>


          {/* 5. 모집 기간 */}
          <Animated.View entering={FadeInDown.delay(190).duration(300).springify()} style={isEdit ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
            <Text style={[styles.label, { color: C.fg }]}>모집 마감일 <Text style={[styles.required, { color: C.gold }]}>*</Text>{isEdit && <Text style={{ color: C.muted, fontSize: 11 }}>  (수정 불가)</Text>}</Text>

            <Pressable
              onPress={() => setShowRecruitCalendar(true)}
              style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: recruitEndDate ? C.gold : C.border }]}
            >
              <Text style={{ color: recruitEndDate ? C.fg : C.mutedLight, fontSize: 13 }}>
                {recruitEndDate ? formatDateLabel(recruitEndDate) : '마감일을 선택하세요'}
              </Text>
              <Text style={{ color: C.mutedLight, fontSize: 10 }}>📅</Text>
            </Pressable>

            <CalendarPicker
              visible={showRecruitCalendar}
              onClose={() => setShowRecruitCalendar(false)}
              onSelect={(d) => setRecruitEndDate(d)}
              selected={recruitEndDate}
              minDate={new Date(getToday().getTime() + 86400000)}
              maxDate={new Date(getToday().getTime() + MAX_RECRUIT_DAYS * 86400000)}
              colors={C}
            />

            {/* 요약 */}
            {recruitEndDate && (
              <View style={[styles.recruitSummary, { backgroundColor: C.card, borderColor: recruitDaysGap! > MAX_RECRUIT_DAYS ? C.danger : C.gold + '44' }]}>
                <Text style={{ color: recruitDaysGap! > MAX_RECRUIT_DAYS ? C.danger : C.fg, fontSize: 12, fontWeight: '600' }}>
                  오늘 ~ {formatShortDate(recruitEndDate)}{'  '}({recruitDaysGap}일간)
                </Text>
                {recruitDaysGap! > MAX_RECRUIT_DAYS && (
                  <Text style={{ color: C.danger, fontSize: 11, marginTop: 2 }}>최대 {MAX_RECRUIT_DAYS}일까지 가능합니다</Text>
                )}
              </View>
            )}
          </Animated.View>

          {/* 6. 모이는 날 */}
          <Animated.View entering={FadeInDown.delay(200).duration(300).springify()}>
            <Text style={[styles.label, { color: C.fg }]}>모이는 날 <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>

            <Pressable
              onPress={() => setShowMeetingCalendar(true)}
              style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: meetingDate ? C.gold : C.border }]}
            >
              <Text style={{ color: meetingDate ? C.fg : C.mutedLight, fontSize: 13 }}>
                {meetingDate
                  ? `${formatDateLabel(meetingDate)}${dateHour !== null ? `  ${dateHour}:${String(dateMinute ?? 0).padStart(2, '0')}` : ''}`
                  : '날짜와 시간을 선택하세요'}
              </Text>
              <Text style={{ color: C.mutedLight, fontSize: 10 }}>📅</Text>
            </Pressable>

            <CalendarPicker
              visible={showMeetingCalendar}
              onClose={() => setShowMeetingCalendar(false)}
              onSelect={(d) => setMeetingDate(d)}
              selected={meetingDate}
              minDate={recruitEndDate ?? getToday()}
              maxDate={getMaxDate(MAX_MEETING_MONTHS)}
              colors={C}
              showTime
              selectedHour={dateHour}
              selectedMinute={dateMinute}
              onHourChange={setDateHour}
              onMinuteChange={setDateMinute}
            />

            {meetingDate && (
              <Pressable onPress={() => { setMeetingDate(null); setDateHour(null); setDateMinute(null); }} style={{ marginTop: 6 }}>
                <Text style={{ color: C.mutedLight, fontSize: 11 }}>초기화</Text>
              </Pressable>
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
                <Text style={[styles.subLabel, { color: C.muted, marginTop: 10 }]}>상세 주소 <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    position: 'relative',
    minHeight: 64,
  },
  backBtn: {
    position: 'absolute',
    left: 20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
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
