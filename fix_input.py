import sys
with open('modules/core/SharedTimeline/components/TimelineInput.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "onOpenCamera();" in line:
        continue
    new_lines.append(line)

with open('modules/core/SharedTimeline/components/TimelineInput.tsx', 'w') as f:
    f.writelines(new_lines)
