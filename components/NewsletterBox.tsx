import { StyleSheet, Text, TextInput, View } from "react-native";

export default function NewsletterBox() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>First Name</Text>
      <TextInput style={styles.input} editable={false} />

      <Text style={styles.label}>Last Name</Text>
      <TextInput style={styles.input} editable={false} />

      <Text style={styles.label}>Email address:</Text>
      <TextInput
        style={styles.input}
        editable={false}
        placeholder="Your email address"
      />

      <View style={styles.button}>
        <Text style={styles.buttonText}>SIGN UP</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 18,
  },
  label: {
    fontSize: 12,
    color: "#111",
    marginBottom: 5,
  },
  input: {
    height: 42,
    backgroundColor: "#eeeeee",
    marginBottom: 12,
    paddingHorizontal: 10,
  },
  button: {
    backgroundColor: "#111",
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  buttonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
});