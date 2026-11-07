import {
  roamPrivacyUrl,
  roamSupportUrl,
} from "../src/presentation/roam-website";
import { RoamMascot } from "../src/presentation/brand/RoamMascot";
import { pendingSantaInvitation } from "../src/games/secret-santa/pending-invitation";
import { useState } from "react";
import { Redirect, router } from "expo-router";
import Constants from "expo-constants";
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  WelcomeButton,
  WelcomeFrame,
  useWelcomeStyles,
} from "../src/presentation/welcome/WelcomeUI";
import * as Apple from "expo-apple-authentication";
import {
  nativeSignInRequirement,
  signInErrorMessage,
} from "../src/platform/auth/errors";
import { useAuth } from "../src/platform/auth/AuthProvider";
import { signIn, signInWithPassword } from "../src/platform/auth/sign-in";
import { Field } from "../src/presentation/brand/forms";
import { isConfigured } from "../src/platform/supabase";
import { EmptyState, ErrorState, Loading } from "../src/presentation/ui";
export default function SignIn() {
  const auth = useAuth();
  const { colors: c, dark, styles: s } = useWelcomeStyles();
  const styles = makeStyles(c);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requirement = nativeSignInRequirement(
    Platform.OS,
    Constants.appOwnership,
  );
  if (auth.loading)
    return (
      <WelcomeFrame>
        <Loading />
      </WelcomeFrame>
    );
  if (auth.session)
    return <Redirect href={(pendingSantaInvitation() || "/") as never} />;
  async function start(operation: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (failure) {
      setError(signInErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <WelcomeFrame>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace("/welcome")}
      >
        <Text style={styles.back}>Back to welcome</Text>
      </Pressable>
      <View style={{ alignItems: "center", marginTop: 55, marginBottom: 10 }}>
        <RoamMascot size={110} />
      </View>
      <View style={s.headingBlock}>
        <Text
          accessibilityRole="header"
          style={[s.title, { textAlign: "center", fontSize: 32 }]}
        >
          Welcome to Roam
        </Text>
        <Text style={[s.body, { textAlign: "center" }]}>
          Sign in to play with your groups
        </Text>
      </View>
      <View style={styles.providers}>
        {Platform.OS === "ios" ? (
          !busy && isConfigured ? (
            <Apple.AppleAuthenticationButton
              buttonType={Apple.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={
                dark
                  ? Apple.AppleAuthenticationButtonStyle.WHITE
                  : Apple.AppleAuthenticationButtonStyle.WHITE_OUTLINE
              }
              cornerRadius={16}
              style={{ width: "100%", height: 54 }}
              onPress={() => void start(() => signIn("apple"))}
            />
          ) : null
        ) : (
          <WelcomeButton
            label="Continue with Apple"
            secondary
            disabled={busy || !isConfigured || !!requirement}
            onPress={() => void start(() => signIn("apple"))}
          />
        )}
        <WelcomeButton
          label="Continue with Google"
          secondary
          disabled={busy || !isConfigured || !!requirement}
          onPress={() => void start(() => signIn("google"))}
        />
        <WelcomeButton
          label={showEmail ? "Hide email sign-in" : "Sign in with email"}
          variant="ghost"
          disabled={busy || !isConfigured || !!requirement}
          onPress={() => {
            setShowEmail(!showEmail);
            setPassword("");
            setError(null);
          }}
        />
        {showEmail ? (
          <>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              editable={!busy}
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoComplete="current-password"
              secureTextEntry
              editable={!busy}
            />
            <WelcomeButton
              label="Sign in"
              disabled={busy || !email.trim() || !password}
              onPress={() =>
                void start(() => signInWithPassword(email, password))
              }
            />
          </>
        ) : null}
        {busy ? <Loading label="Signing in…" /> : null}
      </View>
      {requirement ? (
        <EmptyState
          title="Open Roam to sign in"
          message="Open the Roam app to sign in."
        />
      ) : null}
      {!isConfigured ? (
        <EmptyState
          title="Sign-in unavailable"
          message="Please try again later."
        />
      ) : null}
      {error ? <ErrorState message={error} /> : null}
      {auth.error ? (
        <ErrorState message={auth.error} retry={auth.retry} />
      ) : null}
      <View style={s.footer}>
        <WelcomeButton
          variant="ghost"
          size="small"
          label="Privacy Policy"
          onPress={() => Linking.openURL(roamPrivacyUrl)}
        />
        <WelcomeButton
          variant="ghost"
          size="small"
          label="Support"
          onPress={() => Linking.openURL(roamSupportUrl)}
        />
      </View>
    </WelcomeFrame>
  );
}
const makeStyles = (c: ReturnType<typeof useWelcomeStyles>["colors"]) =>
  StyleSheet.create({
    back: { color: c.textSecondary, paddingVertical: 12, fontSize: 15 },
    providers: { gap: 12, marginTop: "auto", paddingTop: 64 },
  });
