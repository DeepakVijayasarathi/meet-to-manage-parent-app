import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { memo, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, G, Mask, Rect } from "react-native-svg";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { API_BASE_URL, apiFetch } from "@/api/client";
import { toPixels, type Stroke } from "@/lib/board";
import type { Classroom } from "@/lib/useClassroom";
import { fonts, space, type, useColors } from "@/lib/theme";

import { StrokeShape } from "./Whiteboard";

interface Presentation { id: string; originalFileName: string }
type PageRect = { left: number; top: number; width: number; height: number };

// pdf.js renders the deck exactly as the web classroom does; the page is served from the web
// portal's origin so the API's CORS allows the authenticated file request.
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";

function viewerHtml(fileUrl: string, token: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;height:100%;background:#F7F8FA;overflow:hidden}#c{position:absolute;box-shadow:0 2px 12px rgba(16,24,40,.12);background:#fff}</style>
<script src="${PDFJS}/pdf.min.js"></script></head><body><canvas id="c"></canvas><script>
pdfjsLib.GlobalWorkerOptions.workerSrc="${PDFJS}/pdf.worker.min.js";
var doc=null,want=0,busy=false,post=function(m){window.ReactNativeWebView.postMessage(JSON.stringify(m))};
function render(){if(!doc||busy)return;busy=true;var n=Math.max(0,Math.min(want,doc.numPages-1));
doc.getPage(n+1).then(function(p){var v=p.getViewport({scale:1}),W=innerWidth,H=innerHeight,s=Math.min(W/v.width,H/v.height),
dpr=window.devicePixelRatio||1,vp=p.getViewport({scale:s*dpr}),c=document.getElementById("c");
c.width=vp.width;c.height=vp.height;var w=v.width*s,h=v.height*s;c.style.width=w+"px";c.style.height=h+"px";
c.style.left=((W-w)/2)+"px";c.style.top=((H-h)/2)+"px";
return p.render({canvasContext:c.getContext("2d"),viewport:vp}).promise.then(function(){post({type:"page",page:n,rect:{left:(W-w)/2,top:(H-h)/2,width:w,height:h}})})})
.catch(function(e){post({type:"error",message:String(e&&e.message||e)})}).then(function(){busy=false;if(want!==n)render()})}
window.showPage=function(n){want=n;render()};
pdfjsLib.getDocument({url:${JSON.stringify(fileUrl)},httpHeaders:{Authorization:${JSON.stringify(`Bearer ${token}`)}}}).promise
.then(function(d){doc=d;post({type:"loaded",pages:d.numPages});render()})
.catch(function(e){post({type:"error",message:String(e&&e.message||e)})});
addEventListener("resize",render);
</script></body></html>`;
}

/** The teacher's presented deck, following her page, with her marks drawn on top. */
export function SlidesView({ room }: { room: Classroom }) {
  const colors = useColors();
  const web = useRef<ComponentRef<typeof WebView>>(null);
  const [pages, setPages] = useState(0);
  const [rect, setRect] = useState<PageRect | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Whether a deck exists; refetched whenever the teacher uploads a new one.
  const deck = useQuery({
    queryKey: ["presentation", room.sessionId, room.deckVersion],
    queryFn: () => apiFetch<Presentation | null>(`/api/sessions/${room.sessionId}/presentation`, { token: room.token }),
  });
  const html = useMemo(
    () => viewerHtml(`${API_BASE_URL}/api/sessions/${room.sessionId}/presentation/file?v=${room.deckVersion}`, room.token),
    [room.sessionId, room.token, room.deckVersion],
  );

  useEffect(() => {
    if (pages > 0) web.current?.injectJavaScript(`window.showPage(${room.slidePage});true;`);
  }, [room.slidePage, pages]);

  function onMessage(e: WebViewMessageEvent) {
    const msg = JSON.parse(e.nativeEvent.data) as { type: string; pages?: number; rect?: PageRect; message?: string };
    if (msg.type === "loaded") { setPages(msg.pages ?? 0); setError(null); }
    else if (msg.type === "page" && msg.rect) setRect(msg.rect);
    else if (msg.type === "error") setError(msg.message ?? "The slides couldn't be shown.");
  }

  if (deck.isPending) return <Center><ActivityIndicator color={colors.primary} /></Center>;
  if (!deck.data) {
    return (
      <Center>
        <Feather name="monitor" size={30} color={colors.muted} />
        <Text style={[type.heading, { color: colors.text }]}>No slides yet</Text>
        <Text style={[type.caption, { color: colors.muted, textAlign: "center" }]}>When your teacher presents slides, they appear here.</Text>
      </Center>
    );
  }

  const page = Math.max(0, Math.min(room.slidePage, Math.max(0, pages - 1)));
  return (
    <View style={{ flex: 1, gap: space.sm }}>
      <View style={[styles.stage, { borderColor: colors.border }]}>
        <WebView
          key={room.deckVersion}
          ref={web}
          source={{ html, baseUrl: API_BASE_URL }}
          originWhitelist={["*"]}
          onMessage={onMessage}
          javaScriptEnabled
          scrollEnabled={false}
          style={styles.web}
        />
        {rect && (
          <View pointerEvents="none" style={[styles.marks, { left: rect.left, top: rect.top, width: rect.width, height: rect.height }]}>
            <Marks strokes={room.slideMarks[page] ?? []} w={rect.width} h={rect.height} />
          </View>
        )}
        {!rect && !error && <View style={styles.loading} pointerEvents="none"><ActivityIndicator color={colors.primary} /></View>}
        {error && (
          <View style={styles.loading}>
            <Text style={[type.caption, { color: colors.danger, textAlign: "center" }]}>{error}</Text>
          </View>
        )}
      </View>
      <View style={styles.footer}>
        <Feather name="eye" size={13} color={colors.muted} />
        <Text style={[styles.footerText, { color: colors.textSoft }]}>
          {pages ? `${page + 1} / ${pages} · following the teacher` : deck.data.originalFileName}
        </Text>
      </View>
    </View>
  );
}

/**
 * Eraser strokes cut holes in the marks only (web: destination-out on the mark layer), never
 * in the slide underneath: each mark is masked by every eraser stroke drawn after it.
 */
const Marks = memo(function Marks({ strokes, w, h }: { strokes: Stroke[]; w: number; h: number }) {
  const px = strokes.map((s) => toPixels(s, w, h));
  return (
    <Svg width={w} height={h}>
      {px.map((s, i) => {
        if (s.tool === "eraser") return null;
        const erasers = px.slice(i + 1).filter((e) => e.tool === "eraser");
        if (erasers.length === 0) return <StrokeShape key={s.id} stroke={s} />;
        return (
          <G key={s.id}>
            <Defs>
              <Mask id={`m-${s.id}`} x="0" y="0" width={w} height={h} maskUnits="userSpaceOnUse">
                <Rect x="0" y="0" width={w} height={h} fill="#FFFFFF" />
                {erasers.map((e) => <StrokeShape key={e.id} stroke={{ ...e, color: "#000000" }} eraseAs="#000000" />)}
              </Mask>
            </Defs>
            <G mask={`url(#m-${s.id})`}><StrokeShape stroke={s} /></G>
          </G>
        );
      })}
    </Svg>
  );
});

function Center({ children }: { children: React.ReactNode }) {
  return <View style={styles.center}>{children}</View>;
}

const styles = StyleSheet.create({
  stage: { flex: 1, borderRadius: 16, borderWidth: 1, overflow: "hidden", backgroundColor: "#F7F8FA" },
  web: { flex: 1, backgroundColor: "#F7F8FA" },
  marks: { position: "absolute" },
  loading: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: space.lg },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  footerText: { fontFamily: fonts.semibold, fontSize: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm, padding: space.xl },
});
