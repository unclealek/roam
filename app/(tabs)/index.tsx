import { AdventureCard } from "../../src/presentation/brand/AdventureCard";
import { router } from "expo-router";
import {
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useCallback, useEffect, useRef } from "react";
import { useFeedback } from "../../src/presentation/brand/ToastFeedback";
import { useAuth } from "../../src/platform/auth/AuthProvider";
import { useAccountResource } from "../../src/platform/sessions/useAccountResource";
import { listNotifications } from "../../src/platform/notifications/service";
import { sessionService } from "../../src/platform/sessions/service";
import type { SessionSummary } from "../../src/platform/sessions/types";
import { loadCatalog } from "../../src/platform/games/service";
import { groupService } from "../../src/platform/groups/service";
import { SessionCard } from "../../src/presentation/brand/SessionCard";
import { GroupCard } from "../../src/presentation/brand/GroupCard";
import { useRoamTheme } from "../../src/presentation/brand/theme";
import {
  FunctionalIcon,
  RoamIcon,
  RoamIllustration,
} from "../../src/presentation/icons";
import {
  EmptyState,
  ErrorState,
  Loading,
  RoamButton,
  RoamScreen,
} from "../../src/presentation/brand/ui";
import { PlayerAvatar } from "../../src/presentation/brand/PlayerAvatar";
import homeClouds from "../../assets/home-clouds.jpg";

function HomeSection({
  title,
  icon,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  icon: "play" | "challenge" | "groups";
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  const { colors, type } = useRoamTheme();
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <RoamIcon name={icon} size={26} />
          <Text
            accessibilityRole="header"
            style={[
              type.headline,
              {
                color: colors.textPrimary,
                fontSize: 19,
                lineHeight: 25,
                letterSpacing: -0.3,
              },
            ]}
          >
            {title}
          </Text>
        </View>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              actionLabel === "See all" ? `All ${title}` : actionLabel
            }
            onPress={onAction}
            hitSlop={8}
            style={{
              minHeight: 44,
              justifyContent: "center",
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              paddingLeft: 8,
            }}
          >
            <Text
              style={[
                type.caption,
                { color: colors.brandPrimary, fontWeight: "700" },
              ]}
            >
              {actionLabel}
            </Text>
            <FunctionalIcon
              accessible={false}
              name="chevron-forward"
              size={17}
              color={colors.brandPrimary}
            />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function HomeHeader({
  name,
  unreadCount,
}: {
  name?: string;
  unreadCount: number;
}) {
  const { colors, type } = useRoamTheme();
  const firstName = name?.trim().split(/\s+/u)[0] || "there";
  const actionStyle = {
    width: 48,
    height: 48,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginTop: 4,
        marginBottom: 4,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          accessibilityRole="header"
          style={[
            type.headline,
            {
              color: colors.textPrimary,
              fontSize: 30,
              lineHeight: 36,
              letterSpacing: -0.8,
            },
          ]}
        >
          Hey, {firstName}!
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          unreadCount
            ? `Notifications (${unreadCount} unread)`
            : "Notifications"
        }
        onPress={() => router.navigate("/notifications")}
        style={({ pressed }) => ({
          ...actionStyle,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <FunctionalIcon
          name="notifications-outline"
          size={23}
          color={colors.textPrimary}
        />
        {unreadCount > 0 ? (
          <View
            style={{
              position: "absolute",
              top: 3,
              right: 3,
              minWidth: 17,
              height: 17,
              borderRadius: 9,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 3,
              backgroundColor: colors.actionPrimary,
            }}
          >
            <Text
              style={{
                color: colors.onAction,
                fontSize: 10,
                lineHeight: 13,
                fontWeight: "700",
              }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Text>
          </View>
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Your profile"
        onPress={() => router.navigate("/profile")}
        style={({ pressed }) => ({
          ...actionStyle,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <PlayerAvatar name={name || "You"} size={36} />
      </Pressable>
    </View>
  );
}

function ContinuePlayingCard({ session }: { session: SessionSummary }) {
  const load = useCallback(() => sessionService.get(session.id), [session.id]);
  const details = useAccountResource(load);
  return (
    <>
      <SessionCard
        session={session}
        backgroundImage={homeClouds}
        participants={details.data?.participants}
      />
      {details.error ? (
        <ErrorState
          message="Couldn’t load player details."
          retry={details.refresh}
        />
      ) : null}
    </>
  );
}

export default function Home() {
  const { colors, type } = useRoamTheme();
  const { profile } = useAuth();
  const notifications = useAccountResource(listNotifications);
  const showFeedback = useFeedback()?.show;
  const previousUnread = useRef<number | null>(null);
  useEffect(() => {
    if (!notifications.data) return;
    const count = notifications.data.unread_count;
    const first = notifications.data.items?.[0];
    if (
      Platform.OS === "web" &&
      previousUnread.current !== null &&
      count > previousUnread.current &&
      first
    )
      showFeedback?.({
        id: `notification:${first.id}`,
        kind: "activity",
        message: "You have a new game update.",
      });
    previousUnread.current = count;
  }, [notifications.data, showFeedback]);
  const sessions = useAccountResource(sessionService.list);
  const catalog = useAccountResource(loadCatalog);
  const groups = useAccountResource(groupService.list);
  const current = sessions.data?.filter(
    (s) => !["completed", "cancelled", "failed"].includes(s.status),
  );
  const featuredGames = [
    {
      id: "secret_santa",
      title: "Secret Santa",
      description: "Give a little mystery. Share a lot of joy.",
      illustration: "secret-santa",
    },
    {
      id: "mind_match",
      title: "Mind Match",
      description: "Find the connections. Match minds together.",
      illustration: "mind-match",
    },
    {
      id: "secret_agent",
      title: "Secret Agent",
      description: "Uncover clues. Keep your identity secret.",
      illustration: "secret-agent",
    },
  ] as const;
  return (
    <RoamScreen background="home">
      <HomeHeader
        name={profile?.display_name}
        unreadCount={notifications.data?.unread_count ?? 0}
      />
      {notifications.error ? (
        <ErrorState
          message={notifications.error}
          retry={notifications.refresh}
        />
      ) : null}
      <AdventureCard backgroundImage={homeClouds} />
      <HomeSection
        title="Continue playing"
        icon="play"
        actionLabel={sessions.data?.length ? "See all" : undefined}
        onAction={() => router.navigate("/games")}
      >
        {sessions.loading ? (
          <Loading label="Loading your games…" />
        ) : sessions.error ? (
          <ErrorState message={sessions.error} retry={sessions.refresh} />
        ) : current?.length ? (
          current
            .slice(0, 1)
            .map((session) => (
              <ContinuePlayingCard key={session.id} session={session} />
            ))
        ) : (
          <View style={{ gap: 12 }}>
            <EmptyState
              title="No games in progress"
              illustration="empty-games"
              message="Start a game or join with a code."
            />
            <RoamButton
              label="Explore games"
              onPress={() => router.navigate("/games")}
            />
          </View>
        )}
      </HomeSection>
      <HomeSection
        title="Play something new"
        icon="play"
        actionLabel="See all"
        onAction={() => router.navigate("/games")}
      >
        {catalog.loading ? (
          <Loading label="Loading games…" />
        ) : catalog.error ? (
          <ErrorState message={catalog.error} retry={catalog.refresh} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingRight: 4 }}
          >
            {featuredGames.map((featured) => {
              const registered = catalog.data?.find(
                (game) => game.definition.id === featured.id,
              );
              const available =
                registered?.metadata.availability_status === "available";
              return (
                <Pressable
                  key={featured.id}
                  accessibilityRole="button"
                  accessibilityLabel={
                    available
                      ? `View ${featured.title}`
                      : `${featured.title} — Coming soon`
                  }
                  accessibilityHint={
                    available
                      ? `${featured.description}. Opens game details.`
                      : "This game is not available yet."
                  }
                  accessibilityState={{ disabled: !available }}
                  disabled={!available}
                  onPress={() => {
                    if (registered)
                      router.push(registered.definition.routes.details);
                  }}
                  style={({ pressed }) => ({
                    width: 152,
                    minHeight: 166,
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    overflow: "hidden",
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <ImageBackground
                    source={homeClouds}
                    resizeMode="cover"
                    imageStyle={{ opacity: 0.7 }}
                    style={{
                      flexGrow: 1,
                      minHeight: 166,
                      padding: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                    }}
                  >
                    <RoamIllustration name={featured.illustration} size={56} />
                    <Text
                      style={[
                        type.headline,
                        { color: colors.textPrimary, textAlign: "center" },
                      ]}
                    >
                      {registered?.metadata.name ?? featured.title}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[
                        type.caption,
                        { color: colors.textSecondary, textAlign: "center" },
                      ]}
                    >
                      {registered?.metadata.description ?? featured.description}
                    </Text>
                    {!available ? (
                      <Text
                        style={[
                          type.caption,
                          { color: colors.brandPrimary, fontWeight: "700" },
                        ]}
                      >
                        Coming soon
                      </Text>
                    ) : null}
                  </ImageBackground>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </HomeSection>
      <HomeSection
        title="Your Groups"
        icon="groups"
        actionLabel="See all"
        onAction={() => router.navigate("/groups")}
      >
        {groups.loading ? (
          <Loading label="Loading your groups…" />
        ) : groups.error ? (
          <ErrorState message={groups.error} retry={groups.refresh} />
        ) : groups.data?.length ? (
          <View style={{ gap: 10 }}>
            {groups.data.slice(0, 2).map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Text style={[type.callout, { color: colors.textSecondary }]}>
              Play together by creating a group or joining one with a code.
            </Text>
            <RoamButton
              label="Explore groups"
              onPress={() => router.navigate("/groups")}
            />
          </View>
        )}
      </HomeSection>
      <HomeSection title="Make today a game day" icon="challenge">
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 16,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceElevated,
          }}
        >
          <RoamIcon name="challenge" size={40} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[type.headline, { color: colors.textPrimary }]}>
              Bring your group together
            </Text>
            <Text style={[type.caption, { color: colors.textSecondary }]}>
              Pick a game and make a little time for fun.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose a group"
            onPress={() => router.navigate("/groups")}
            style={{ padding: 6 }}
          >
            <FunctionalIcon
              name="chevron-forward"
              size={22}
              color={colors.brandPrimary}
            />
          </Pressable>
        </View>
      </HomeSection>
    </RoamScreen>
  );
}
