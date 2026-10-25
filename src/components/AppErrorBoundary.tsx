import { Component, type ErrorInfo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

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
    return (
      <View style={styles.root}>
        <Logo size={64} />
        <Text style={styles.title}>The app hit a problem</Text>
        <Text style={styles.body}>Your information is safe. Try loading the screen again.</Text>
        <Button label="Try again" icon="refresh-cw" onPress={() => this.setState({ failed: false })} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg, padding: space.xxl, backgroundColor: "#FFFFFF" },
  title: { fontFamily: fonts.bold, fontSize: 22, color: "#181A1F", textAlign: "center" },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: "#667085", textAlign: "center" },
});
