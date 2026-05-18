import { Image, StyleSheet, Text, View } from 'react-native';

type BrandHeaderProps = {
  title: string;
  subtitle?: string;
};

export default function BrandHeader({ title, subtitle }: BrandHeaderProps) {
  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/ydl-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={styles.title}>{title}</Text>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    alignItems: 'center',
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    marginTop: 4,
    color: '#555555',
    textAlign: 'center',
  },
});