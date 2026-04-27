import { useState, useEffect } from 'react';
import { View, Text, Pressable, Image, Linking, StyleSheet } from 'react-native';
import { META_KEY_LABEL } from '@/constants/artwork-form';
import { r2ThumbUrl } from '@/lib/r2';
import type { Database } from '@/types/database';

type Artwork = Database['public']['Tables']['artworks']['Row'];

export function ArtworkCard({
  artwork,
  cardW,
  onPress,
  C,
}: {
  artwork: Artwork;
  cardW: number;
  onPress: () => void;
  C: any;
}) {
  const [expanded, setExpanded] = useState(false);
  const [imgRatio, setImgRatio] = useState<number | null>(null);

  useEffect(() => {
    if (artwork.image_url) {
      Image.getSize(r2ThumbUrl(artwork.image_url), (w, h) => {
        if (w && h) setImgRatio(w / h);
      });
    }
  }, [artwork.image_url]);

  const ratio = imgRatio
    ?? (artwork.width_cm && artwork.height_cm ? artwork.width_cm / artwork.height_cm : 1);
  const imgH = Math.max(cardW * 0.4, Math.min(cardW / ratio, cardW * 1.6));

  return (
    <View style={{ width: '100%', marginBottom: 20 }}>
      <Pressable onPress={onPress}>
        <View style={[styles.artCard, { backgroundColor: C.card }]}>
          <Image
            source={{ uri: r2ThumbUrl(artwork.image_url) }}
            style={{ width: '100%', height: imgH }}
            resizeMode="contain"
          />
          {(artwork as any).category && (
            <View style={styles.artCardCategoryBadge}>
              <Text style={styles.artCardCategoryLabel}>{(artwork as any).category}</Text>
            </View>
          )}
        </View>
      </Pressable>
      <View style={styles.artInfoRow}>
        <Text style={[styles.artInfoTitle, { color: C.fg }]} numberOfLines={expanded ? undefined : 1}>
          {artwork.title}
        </Text>
        <Pressable onPress={() => setExpanded(!expanded)} hitSlop={8}>
          <Text style={[styles.artInfoMore, { color: C.gold }]}>
            {expanded ? '접기' : '더보기'}
          </Text>
        </Pressable>
      </View>
      {expanded && (
        <View style={[styles.artExpandedInfo, { borderTopColor: C.border }]}>
          {(artwork as any).category && (
            <View style={[styles.artCategoryBadge, { backgroundColor: C.goldDim, borderColor: C.gold }]}>
              <Text style={[styles.artCategoryBadgeText, { color: C.gold }]}>{(artwork as any).category}</Text>
            </View>
          )}
          {(artwork.year || artwork.medium) && (
            <Text style={[styles.artExpandedMeta, { color: C.muted }]}>
              {[artwork.year, artwork.medium].filter(Boolean).join(' · ')}
            </Text>
          )}
          {artwork.width_cm && artwork.height_cm && (
            <Text style={[styles.artExpandedMeta, { color: C.muted }]}>
              {artwork.width_cm} × {artwork.height_cm} cm
            </Text>
          )}
          {(artwork as any).edition && (
            <Text style={[styles.artExpandedMeta, { color: C.muted }]}>
              에디션: {(artwork as any).edition}
            </Text>
          )}
          {(() => {
            const meta = ((artwork as any).metadata ?? {}) as Record<string, string>;
            const skipKeys = new Set(['medium', 'technique', 'width_cm', 'height_cm', 'edition']);
            const entries = Object.entries(meta).filter(([k, v]) => v && !skipKeys.has(k));
            return entries.length > 0 ? entries.map(([k, v]) => (
              k === 'link' ? (
                <Pressable key={k} onPress={() => Linking.openURL(v)}>
                  <Text style={[styles.artExpandedMeta, { color: '#C8A96E', textDecorationLine: 'underline' }]}>
                    {META_KEY_LABEL[k] ?? k} 열기 ↗
                  </Text>
                </Pressable>
              ) : (
                <Text key={k} style={[styles.artExpandedMeta, { color: C.muted }]}>
                  {META_KEY_LABEL[k] ?? k}: {v}
                </Text>
              )
            )) : null;
          })()}
          {(artwork as any).description && (
            <Text style={[styles.artExpandedDesc, { color: C.fg }]}>
              {(artwork as any).description}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  artCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  artCardCategoryBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  artCardCategoryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  artInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 10,
    gap: 12,
  },
  artInfoTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  artInfoMore: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  artExpandedInfo: {
    paddingHorizontal: 4,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  artExpandedMeta: {
    fontSize: 13,
    lineHeight: 20,
  },
  artExpandedDesc: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  artCategoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 2,
  },
  artCategoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
