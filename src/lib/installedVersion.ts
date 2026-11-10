import * as Application from "expo-application";
import Constants from "expo-constants";

/** "1.0.0 (build 11)": read from the installed app itself, so it follows each build rather than app.json alone. */
export function installedVersionLabel(): string {
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "1.0.0";
  const build = Application.nativeBuildVersion;
  return build ? `${version} (build ${build})` : version;
}
