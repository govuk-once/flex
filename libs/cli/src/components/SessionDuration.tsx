import { Text } from "ink";
import { useEffect, useState } from "react";

const startTime = new Date();

export function SessionDuration() {
  const [duration, setDuration] = useState("00:00:00");

  useEffect(() => {
    const timer = setInterval(() => {
      const diff = new Date().getTime() - startTime.getTime();

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const formatted = [
        hours.toString().padStart(2, "0"),
        minutes.toString().padStart(2, "0"),
        seconds.toString().padStart(2, "0"),
      ].join(":");

      setDuration(formatted);
    }, 200);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return <Text bold>{duration}</Text>;
}
