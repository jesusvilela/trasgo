import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from './theme';

export function Screen({ children }) {
  return <ScrollView contentContainerStyle={styles.screen}>{children}</ScrollView>;
}

export function Hero({ title, subtitle, kicker }) {
  return (
    <View style={styles.hero}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroSubtitle}>{subtitle}</Text>
    </View>
  );
}

export function Card({ title, children, accentColor = theme.colors.accent }) {
  return (
    <View style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

export function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function Chip({ children, tone = 'accent' }) {
  const backgroundColor =
    tone === 'good'
      ? '#113020'
      : tone === 'warn'
        ? '#332611'
        : tone === 'bad'
          ? '#32131a'
          : theme.colors.accentSoft;
  const color =
    tone === 'good'
      ? theme.colors.good
      : tone === 'warn'
        ? theme.colors.warn
        : tone === 'bad'
          ? theme.colors.bad
          : theme.colors.accent;

  return (
    <View style={[styles.chip, { backgroundColor }]}>
      <Text style={[styles.chipText, { color }]}>{children}</Text>
    </View>
  );
}

export function PrimaryButton({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, value, onChangeText, placeholder, multiline = false, keyboardType = 'default' }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

export function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function EmptyState({ children }) {
  return <Text style={styles.emptyState}>{children}</Text>;
}

export function Stack({ gap = theme.spacing.md, children }) {
  return <View style={{ gap }}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    padding: 18,
    paddingBottom: 42,
    gap: 16,
    backgroundColor: theme.colors.bg,
  },
  hero: {
    backgroundColor: theme.colors.panel,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
  },
  kicker: {
    color: theme.colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    fontSize: 12,
    marginBottom: 8,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '800',
  },
  heroSubtitle: {
    marginTop: 10,
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: theme.colors.panel,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardAccent: {
    height: 3,
    width: '100%',
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  cardBody: {
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLabel: {
    color: theme.colors.muted,
    flex: 1,
  },
  rowValue: {
    color: theme.colors.text,
    flex: 1.4,
    textAlign: 'right',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  button: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonLabel: {
    color: '#051018',
    fontWeight: '800',
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  input: {
    backgroundColor: theme.colors.panelSoft,
    color: theme.colors.text,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  inputMultiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyState: {
    color: theme.colors.muted,
    fontStyle: 'italic',
  },
});
