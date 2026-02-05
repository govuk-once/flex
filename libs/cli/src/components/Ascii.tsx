import figlet, { FigletOptions } from "figlet";
import { Box, Text } from "ink";

interface AsciiProps extends FigletOptions {
  text?: string;
}

const defaultProps: FigletOptions = {
  font: "Standard",
  horizontalLayout: "default",
  verticalLayout: "default",
};

export function Ascii({ text = "", ...figletProps }: AsciiProps) {
  return (
    <Box>
      <Text>{figlet.textSync(text, { ...defaultProps, ...figletProps })}</Text>
    </Box>
  );
}
