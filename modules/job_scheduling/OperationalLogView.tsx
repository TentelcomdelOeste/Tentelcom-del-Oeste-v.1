import SharedTimelineView, { type SharedTimelineProps } from "@/modules/core/SharedTimeline/SharedTimelineView";

export default function OperationalLogView(
  props: SharedTimelineProps & { initialState?: any }
) {
  const { initialState, ...timelineProps } = props;
  return (
    <SharedTimelineView
      {...timelineProps}
      navigationState={initialState}
    />
  );
}
