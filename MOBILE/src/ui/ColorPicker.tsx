import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Slider} from './Slider';
import {theme} from './theme';

interface Props {
  r: number;
  g: number;
  b: number;
  onChange: (r: number, g: number, b: number) => void;
}

const PRESETS = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 0],
  [0, 255, 255],
  [255, 0, 255],
  [255, 255, 255],
  [0, 0, 0],
];

const hex = (n: number) => n.toString(16).padStart(2, '0');
const rgbCss = (r: number, g: number, b: number) =>
  `#${hex(r)}${hex(g)}${hex(b)}`;

export const ColorPicker: React.FC<Props> = ({r, g, b, onChange}) => {
  return (
    <View>
      <View style={[styles.preview, {backgroundColor: rgbCss(r, g, b)}]}>
        <Text style={styles.previewText}>{rgbCss(r, g, b).toUpperCase()}</Text>
      </View>

      <Text style={styles.label}>R · {r}</Text>
      <Slider value={r} color="#ef4444" onChange={v => onChange(v, g, b)} />
      <Text style={styles.label}>G · {g}</Text>
      <Slider value={g} color="#22c55e" onChange={v => onChange(r, v, b)} />
      <Text style={styles.label}>B · {b}</Text>
      <Slider value={b} color="#3b82f6" onChange={v => onChange(r, g, v)} />

      <View style={styles.presets}>
        {PRESETS.map((c, i) => (
          <Pressable
            key={i}
            style={[styles.swatch, {backgroundColor: rgbCss(c[0], c[1], c[2])}]}
            onPress={() => onChange(c[0], c[1], c[2])}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  preview: {
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  previewText: {
    color: '#000',
    fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  label: {color: theme.textDim, fontSize: 13, marginTop: 4},
  presets: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12},
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
});
