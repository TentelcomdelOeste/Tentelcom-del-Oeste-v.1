import sys
with open('modules/core/SharedTimeline/SharedTimelineView.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if "const [isIntegratedCameraOpen" in line:
        skip = True
    if skip and line.strip() == "};" and "uploadMediaAndSend" in lines[i-2]:
        skip = False
        continue
    if skip:
        continue
    
    if "onOpenCamera={() => setIsIntegratedCameraOpen(true)}" in line:
        continue
    
    if "<TimelineCameraModal" in line:
        skip = True
    if skip and "/>" in line and "jobLocation" in lines[i-1]:
        skip = False
        continue
    if skip:
        continue

    new_lines.append(line)

with open('modules/core/SharedTimeline/SharedTimelineView.tsx', 'w') as f:
    f.writelines(new_lines)
