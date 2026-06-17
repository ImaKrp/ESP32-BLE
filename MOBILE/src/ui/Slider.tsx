import React, {useEffect, useRef, useState} from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';
import {theme} from './theme';

interface Props {
  value: number;
  max?: number;
  color?: string;
  onChange: (v: number) => void;
}

export const Slider: React.FC<Props> = ({
  value,
  max = 255,
  color = theme.primary,
  onChange,
}) => {
  const widthRef = useRef(1);
  const [w, setW] = useState(1);

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    setW(e.nativeEvent.layout.width);
  };

  const update = (x: number) => {
    const clamped = Math.max(0, Math.min(widthRef.current, x));
    onChange(Math.round((clamped / widthRef.current) * max));
  };

  const updateRef = useRef(update);
  useEffect(() => {
    updateRef.current = update;
  });

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: e => updateRef.current(e.nativeEvent.locationX),
      onPanResponderMove: e => updateRef.current(e.nativeEvent.locationX),
    }),
  ).current;

  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <View
      style={styles.track}
      onLayout={onLayout}
      {...responder.panHandlers}>
      <View style={[styles.fill, {width: pct * w, backgroundColor: color}]} />
      <View style={[styles.thumb, {left: pct * w - 10}]} />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.cardAlt,
    justifyContent: 'center',
    marginVertical: 6,
  },
  fill: {height: 28, borderRadius: 14},
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    top: 4,
  },
});
