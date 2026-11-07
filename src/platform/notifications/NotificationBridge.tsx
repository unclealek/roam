import { useEffect } from "react";
import { AppState } from "react-native";
import {
  foregroundNoticeAllowed,
  foregroundPresentationSuppressed,
  setForegroundRouteSuppressed,
} from "./presentation";
import { suppressForegroundBanner } from "../../presentation/brand/feedback-policy";
import { router, usePathname, type Href } from "expo-router";
import { useAuth } from "../auth/AuthProvider";
import {
  observeNotifications,
  registerPush,
  type NativePushToken,
} from "./device";
import { getNotification, getPreferences, markNotification } from "./service";
import { notificationTarget } from "./routes";
import { useFeedback } from "../../presentation/brand/ToastFeedback";

export function NotificationBridge() {
  const show = useFeedback()?.show;
  const path = usePathname();
  useEffect(() => {
    setForegroundRouteSuppressed(suppressForegroundBanner(path));
    return () => setForegroundRouteSuppressed(false);
  }, [path]);
  const userId = useAuth().session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    const refresh = (token?: NativePushToken) => {
      void registerPush(false, token).catch(() => {});
    };
    refresh();
    const stop = observeNotifications(
      (id) => {
        void getNotification(id)
          .then(async (n) => {
            if (!active || !n) return;
            const route = notificationTarget(n);
            if (!route) return;
            await markNotification(n.id);
            if (active) router.push(route as Href);
          })
          .catch(() => {});
      },
      refresh,
      (id) => {
        if (foregroundPresentationSuppressed()) return;
        void Promise.all([getNotification(id), getPreferences()])
          .then(([notice, preferences]) => {
            if (
              !active ||
              AppState.currentState !== "active" ||
              foregroundPresentationSuppressed() ||
              !notice ||
              !!notice.read_at ||
              notice.user_id !== userId ||
              !foregroundNoticeAllowed(notice.category, preferences)
            )
              return;
            // Generic copy avoids leaking recipient or other private content into previews.
            show?.({
              id: `notification:${notice.id}`,
              kind: "activity",
              message:
                "A new Roam update is ready. Open Notifications to catch up.",
            });
          })
          .catch(() => {});
      },
    );
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      active = false;
      stop();
      sub.remove();
    };
  }, [userId, show]);
  return null;
}
