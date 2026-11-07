import { Linking } from "react-native";
import {
  roamCommunityGuidelinesUrl,
  roamPrivacyUrl,
  roamSupportEmail,
  roamSupportUrl,
} from "../roam-website";
import { SectionHeading } from "../brand/ui";
import { RoamDialog } from "../brand/overlays";
import { useState } from "react";
import { useAuth } from "../../platform/auth/AuthProvider";
import { requireSupabase } from "../../platform/supabase";
import { deleteAccount } from "../../platform/auth/operations";
import {
  Body,
  Button,
  ErrorState,
  Field,
  Loading,
  Panel,
  Screen,
} from "../brand/forms";
export default function PrivacyScreen() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to complete this action. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="Privacy & account" backTo="/profile">
      {auth.profileLoading ? <Loading label="Loading your profile…" /> : null}
      {auth.error ? (
        <ErrorState
          message={auth.error}
          retry={() => void auth.reloadProfile()}
        />
      ) : null}
      <Panel>
        <Body>
          Your name is visible in your groups and games. Invites show group
          details, never your private account information.
        </Body>
      </Panel>
      <Button
        label="Privacy Policy"
        variant="outline"
        onPress={() => Linking.openURL(roamPrivacyUrl)}
      />
      <Panel>
        <SectionHeading>Safety &amp; Reporting</SectionHeading>
        <Body>
          To report a group, open its details and tap Report group. To report
          someone, open View members and tap Report member under their name.
        </Body>
        <Body>
          Choose a reason and add details if you like. Roam reviews reports
          privately. Your identity and report details are kept from group owners
          and members.
        </Body>
        <Body>For help with a safety concern, contact {roamSupportEmail}.</Body>
        <Button
          label="Support"
          variant="outline"
          onPress={() => Linking.openURL(roamSupportUrl)}
        />
        <Button
          label="Community Guidelines"
          variant="outline"
          onPress={() => Linking.openURL(roamCommunityGuidelinesUrl)}
        />
        <Button
          label="Email support"
          variant="ghost"
          onPress={() => Linking.openURL(`mailto:${roamSupportEmail}`)}
        />
      </Panel>
      {error && !confirm ? <ErrorState message={error} /> : null}
      <Panel>
        <Body>
          Deleting your account is permanent. Your vice owner takes over your
          groups. Otherwise, transfer ownership or delete the group first.
          Groups with games can’t be deleted.
        </Body>
        <Button
          danger
          label="Delete account"
          actionIcon="delete"
          disabled={busy}
          onPress={() => {
            setError(null);
            setConfirm(true);
          }}
        />
        <RoamDialog
          visible={confirm}
          title="Delete your account?"
          message="This permanently removes your profile. Appoint a vice owner or transfer each owned group first. Deletion cannot be undone."
          kind="destructive"
          busy={busy}
          confirmLabel="Permanently delete account"
          cancelLabel="Keep my account"
          confirmDisabled={confirmation !== "DELETE"}
          error={error ?? undefined}
          onCancel={() => {
            setConfirm(false);
            setConfirmation("");
            setError(null);
          }}
          onConfirm={() =>
            perform(async () => {
              const client = requireSupabase();
              await deleteAccount(
                () => client.rpc("delete_own_account"),
                () => client.auth.signOut({ scope: "local" }),
              );
            })
          }
        >
          <Field
            label="Type DELETE to confirm"
            value={confirmation}
            onChangeText={setConfirmation}
            autoCapitalize="characters"
            editable={!busy}
          />
        </RoamDialog>
      </Panel>
    </Screen>
  );
}
