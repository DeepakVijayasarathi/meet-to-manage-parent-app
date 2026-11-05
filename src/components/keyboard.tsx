import { HeaderHeightContext } from "expo-router/react-navigation";
import { useContext, useEffect, useState, type ComponentRef, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, TextInput, View, type StyleProp, type ViewStyle } from "react-native";

/**
 * Keeps inputs above the on-screen keyboard. iOS needs explicit padding; Android already
 * resizes the app for the IME, and combining forced padding with an input-bearing ScrollView
 * can make the keyboard close immediately after a field receives focus.
 * The offset is this screen's stack header: the layout frame KeyboardAvoidingView measures
 * is relative to the screen, which starts below it.
 */
export function KeyboardSafe({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  // A plain view lets Android's native adjust-resize behavior own the keyboard transition.
  // Keeping KeyboardAvoidingView mounted there still subscribes to IME events and rerenders
  // this subtree even when `behavior` is undefined, which can blur a newly focused TextInput.
  if (Platform.OS !== "ios") {
    return <View style={[{ flex: 1 }, style]}>{children}</View>;
  }
  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

/** The on-screen keyboard's height while open, 0 while closed. */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return height;
}

/** True while the software keyboard is open (the floating tab bar hides then). */
export function useKeyboardVisible(): boolean {
  return useKeyboardHeight() > 0;
}

/**
 * Scrolls the currently focused input to just below the top of the visible area, so the keyboard never hides it.
 * Pass the ScrollView's ref; use as `<KeyboardSpacer onOpen={() => scrollFocusedInputIntoView(ref)} />`.
 */
export function scrollFocusedInputIntoView(scroller: { current: ComponentRef<typeof ScrollView> | null }, offset = 160) {
  const inner = scroller.current?.getInnerViewRef();
  const input = TextInput.State.currentlyFocusedInput?.();
  if (!inner || !input) return;
  input.measureLayout(inner as never, (_x, y) => scroller.current?.scrollTo({ y: Math.max(0, y - offset), animated: true }), () => undefined);
}

/**
 * Room for the Android keyboard at the end of a ScrollView. With edge-to-edge the system no longer resizes the
 * window for the IME, so without this the keyboard covers the lower fields and the page can't scroll past them.
 * `onOpen` runs once the space has been laid out (e.g. to scroll a field into view). It lives in its own component,
 * so the keyboard opening re-renders only this spacer and never the inputs above it (which can blur a focused input).
 * iOS needs nothing: KeyboardSafe already pads it.
 */
export function KeyboardSpacer({ onOpen }: { onOpen?: () => void }) {
  const height = useKeyboardHeight();
  useEffect(() => {
    if (Platform.OS !== "android" || height === 0 || !onOpen) return;
    const timer = setTimeout(onOpen, 120);
    return () => clearTimeout(timer);
  }, [height]); // eslint-disable-line react-hooks/exhaustive-deps
  return Platform.OS === "android" ? <View style={{ height }} /> : null;
}
