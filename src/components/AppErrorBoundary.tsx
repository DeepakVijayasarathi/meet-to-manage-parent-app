import { Component, type ErrorInfo, type ReactNode } from "react";
import { Appearance, StyleSheet, Text, View } from "react-native";

import { Button, Logo } from "@/components/ui";
import { captureError } from "@/lib/telemetry";
import { fonts, space } from "@/lib/theme";

interface State { failed: boolean }

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureError(error, info.componentStack ?? "render");
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const dark = Appearance.getColorScheme() === "dark";
    return (
      <View style={[styles.root, { backgroundColor: dark ? "#0F1115" : "#FAFAF9" }]}>
        <Logo size={64} />
        <Text style={[styles.title, { color: dark ? "#F3F4F6" : "#20242C" }]}>The app hit a problem</Text>
        <Text style={[styles.body, { color: dark ? "#9CA3AF" : "#6B7280" }]}>Your information is safe. Try loading the screen again.</Text>
        <Button label="Try again" icon="refresh-cw" onPress={() => this.setState({ failed: false })} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg, padding: space.xxl },
  title: { fontFamily: fonts.bold, fontSize: 22, textAlign: "center" },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, textAlign: "center" },
});
