import React from 'react';
import {StyleSheet, Text, View, ViewStyle} from 'react-native';
import {theme} from './theme';

export const Card: React.FC<{
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}> = ({title, children, style}) => (
  <View style={[styles.card, style]}>
    {title ? <Text style={styles.title}>{title}</Text> : null}
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: {
    color: theme.textDim,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
});
