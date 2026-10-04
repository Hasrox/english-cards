import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Dock, showDock } from "@/components/dock";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AuthProvider } from "@/lib/auth/provider";
import { useVault } from "@/lib/cards/store";
import appCss from "../styles.css?url";

const APP_NAME = "English Cards";

function VaultBoot() {
  const init = useVault((state) => state.init);
  useEffect(() => {
    void init().catch(() => undefined);
  }, [init]);
  return null;
}

function Screen() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  return (
    <div key={path} className="screen-in">
      <Outlet />
    </div>
  );
}
function DockGate() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  if (!showDock(path)) return null;
  return <Dock />;
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "description", content: "English cards, practice whenever you want, and short games. Arabic stays hidden until you try." },
      { name: "theme-color", content: "#f3eee6" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560;9..144,640&family=Noto+Naskh+Arabic:wght@500;600&family=Outfit:wght@400;500;600&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <VaultBoot />
          <Screen />
          <DockGate />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
