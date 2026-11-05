import type { Href } from "expo-router";

/**
 * Where a notification tap goes, from the backend's target type and (optional) record id.
 * Unknown targets return null so the tap just marks the item read.
 */
export function routeForTarget(targetType?: string | null, targetId?: string | null): Href | null {
  switch (targetType) {
    case "homework":
      return "/homework" as Href;
    case "invoice":
      return "/fees" as Href;
    case "class":
      return (targetId ? `/class/${targetId}` : "/classes") as Href;
    case "report":
      return (targetId ? `/reports/${targetId}` : "/reports") as Href;
    case "ticket":
      return (targetId ? `/support/${targetId}` : "/support") as Href;
    case "resource":
      return "/resources" as Href;
    case "recording":
      return "/recordings" as Href;
    case "certificate":
      return "/certificates" as Href;
    case "home":
      return "/" as Href;
    default:
      return null;
  }
}
