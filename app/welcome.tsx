import { useState } from "react";
import { Redirect, router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useAuth } from "../src/platform/auth/AuthProvider";
import { RoamMascot } from "../src/presentation/brand/RoamMascot";
import {
  WelcomeButton,
  WelcomeFrame,
  useWelcomeStyles,
} from "../src/presentation/welcome/WelcomeUI";
import { RoamBackground } from "../src/presentation/brand/RoamBackground";

const pages = [
  {
    title: "Make a group",
    body: "Invite friends or family to play",
  },
  {
    title: "Pick a game",
    body: "Start a new game or join with a code",
  },
  {
    title: "See what you’ve earned",
    body: "Find your XP and collectibles in Rewards",
  },
];
export default function Welcome() {
  const auth = useAuth();
  const { colors: c, styles: s } = useWelcomeStyles();
  const [page, setPage] = useState(-2);
  if (auth.session) return <Redirect href="/" />;
  const enter = () =>
    router.push({ pathname: "/sign-in", params: { mode: "create" } });
  if (page === -2)
    return (
      <RoamBackground>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tap anywhere to begin"
          onPress={() => setPage(-1)}
          style={{
            flex: 1,
            backgroundColor: "transparent",
            alignItems: "center",
            justifyContent: "space-evenly",
            overflow: "hidden",
            padding: 24,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: "Manrope",
              fontSize: 54,
              fontWeight: "700",
              color: c.textPrimary,
              letterSpacing: -2.5,
            }}
          >
            Roam
          </Text>
          <RoamMascot size={280} />
          <Text
            style={{
              fontFamily: "Manrope",
              fontSize: 14,
              fontWeight: "600",
              color: c.textSecondary,
            }}
          >
            Tap anywhere to begin
          </Text>
        </Pressable>
      </RoamBackground>
    );
  return (
    <WelcomeFrame>
      {page < 0 ? (
        <>
          <View
            style={{
              backgroundColor: c.surfaceElevated,
              borderRadius: 24,
              paddingTop: 28,
              paddingBottom: 20,
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: "Manrope",
                fontSize: 48,
                fontWeight: "700",
                letterSpacing: -2,
                color: c.textPrimary,
              }}
            >
              Roam
            </Text>
            <RoamMascot size={220} />
          </View>
          <View style={{ gap: 12, paddingTop: 24, alignItems: "center" }}>
            <Text
              accessibilityRole="header"
              style={[
                s.title,
                { textAlign: "center", fontSize: 31, lineHeight: 36 },
              ]}
            >
              Games for your group
            </Text>
            <Text style={[s.body, { textAlign: "center", fontSize: 15 }]}>
              Start a game or join with a code
            </Text>
          </View>
          <View style={s.footer}>
            <WelcomeButton label="Get started" onPress={() => setPage(0)} />
            <WelcomeButton
              secondary
              label="Sign in"
              onPress={() => router.push("/sign-in")}
            />
          </View>
        </>
      ) : (
        <>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous screen"
              onPress={() => setPage(page - 1)}
              style={{ minHeight: 48, justifyContent: "center" }}
            >
              <Text style={s.body}>Back</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={enter}
              style={{ minHeight: 48, justifyContent: "center" }}
            >
              <Text style={s.body}>Skip</Text>
            </Pressable>
          </View>
          <View
            style={{
              backgroundColor: c.surfaceElevated,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 16,
              paddingVertical: 24,
            }}
          >
            <RoamMascot size={240} placement="peek" />
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              paddingVertical: 12,
            }}
          >
            {pages.map((_, index) => (
              <Pressable
                key={index}
                accessibilityRole="button"
                accessibilityLabel={`Onboarding page ${index + 1} of 3`}
                accessibilityState={{ selected: page === index }}
                onPress={() => setPage(index)}
                style={{
                  minWidth: 32,
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: page === index ? 22 : 7,
                    height: 7,
                    borderRadius: 5,
                    backgroundColor: page === index ? c.brandPrimary : c.border,
                  }}
                />
              </Pressable>
            ))}
          </View>
          <View
            style={[s.headingBlock, { alignItems: "center" }]}
            accessibilityLiveRegion="polite"
          >
            <Text
              accessibilityRole="header"
              style={[
                s.title,
                { textAlign: "center", fontSize: 30, lineHeight: 35 },
              ]}
            >
              {pages[page].title}
            </Text>
            <Text style={[s.body, { textAlign: "center", fontSize: 15 }]}>
              {pages[page].body}
            </Text>
          </View>
          <View style={s.footer}>
            <WelcomeButton
              label={page === 2 ? "Get started" : "Next"}
              onPress={() => (page < 2 ? setPage(page + 1) : enter())}
            />
          </View>
        </>
      )}
    </WelcomeFrame>
  );
}
