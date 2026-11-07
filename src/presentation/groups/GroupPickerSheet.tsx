import { router } from "expo-router";
import { groupService } from "../../platform/groups/service";
import { useAccountResource } from "../../platform/sessions/useAccountResource";
import { RoamSheet } from "../brand/overlays";
import { Body, ErrorState, Loading, RoamButton } from "../brand/ui";
export function GroupPickerSheet({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (id?: string) => void;
}) {
  const resource = useAccountResource(groupService.list);
  return (
    <RoamSheet visible title="Choose a group" onClose={onClose}>
      <Body>Choose a group or play without one.</Body>
      <RoamButton
        variant="secondary"
        label="Play without a group"
        onPress={() => onSelect()}
      />
      {resource.loading ? <Loading label="Loading your groups…" /> : null}
      {resource.error ? (
        <ErrorState message={resource.error} retry={resource.refresh} />
      ) : null}
      {resource.data?.map((group) => (
        <RoamButton
          variant="outline"
          key={group.id}
          label={`Play with ${group.name}`}
          onPress={() => onSelect(group.id)}
        />
      ))}
      {resource.data?.length === 0 ? (
        <>
          <Body>No groups yet.</Body>
          <RoamButton
            label="Create a Group"
            onPress={() => {
              onClose();
              router.push("/group/create");
            }}
          />
        </>
      ) : null}
    </RoamSheet>
  );
}
