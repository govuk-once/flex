import cliSpinners from "cli-spinners";
import { Text } from "ink";
import { useEffect, useState } from "react";

export function useSpinner({
  paused = false,
  frames,
  interval,
}: {
  paused?: boolean;
  frames: string[];
  interval: number;
}) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const switchFrame = () => {
      const isLastFrame = frame === frames.length - 1;
      const nextFrame = isLastFrame ? 0 : frame + 1;
      setFrame(nextFrame);
    };

    if (!paused) {
      const frameInterval = setInterval(switchFrame, interval);
      return () => {
        clearInterval(frameInterval);
      };
    }
  }, [frame, frames.length, interval, paused]);

  return frames[frame];
}

export function Spinner({
  spinner = "dots",
  paused = false,
}: {
  spinner?: keyof typeof cliSpinners;
  paused?: boolean;
}) {
  const { frames, interval } = cliSpinners[spinner];
  const frame = useSpinner({ frames, interval, paused });

  return <Text>{frame}</Text>;
}
